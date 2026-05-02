/**
 * Partial-download recovery log.
 *
 * When `bun run sources download` fetches a multi-file corpus (handbook
 * chapters + ancillaries, AIM sections, ...) and one plan fails mid-run, the
 * operator needs to know:
 *
 *   1. Exactly which plans failed (corpus / doc / kind / ordinal / URL).
 *   2. Whether re-running picks up just the failures or re-fetches everything.
 *
 * The freshness gate already answers (2) -- successful entries write a
 * manifest record and stay cached on the next run. This module answers (1).
 *
 * One log file per cache root: `<cache>/.partial-download.log`. Each line is
 * a single JSON record (newline-delimited JSON) so the file is greppable and
 * deduplication is trivial. At the start of every fresh real run, entries
 * matching the current run's plan set are dropped (the run is going to retry
 * them). Entries for plans the current run did NOT touch (e.g. filtered out
 * by `--corpus=`) survive so a follow-up run can still surface them.
 *
 * Any entries that survive are auto-surfaced on the next run as "N partial
 * downloads from previous run."
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describeError } from '../../lib/error';
import type { DownloadPlan } from './plans';

export const PARTIAL_LOG_FILENAME = '.partial-download.log';

/**
 * One row in the partial-download log. Captures enough context for an operator
 * to decide whether re-running will resolve the failure (transient network,
 * FAA rate-limit) or whether the URL itself is broken (404, schema drift).
 */
export interface PartialDownloadRecord {
	readonly timestamp: string;
	readonly corpus: string;
	readonly doc: string;
	readonly edition: string | null;
	readonly kind: string;
	readonly ordinal: number | null;
	readonly url: string;
	readonly destPath: string;
	readonly error: string;
}

export function partialLogPath(cacheRoot: string): string {
	return join(cacheRoot, PARTIAL_LOG_FILENAME);
}

/** Append one failure to the partial-download log (atomic per-line write). */
export function appendPartialDownload(cacheRoot: string, plan: DownloadPlan, error: unknown): void {
	const record: PartialDownloadRecord = {
		timestamp: new Date().toISOString(),
		corpus: plan.corpus,
		doc: plan.doc,
		edition: plan.edition,
		kind: plan.kind,
		ordinal: plan.ordinal,
		url: plan.url,
		destPath: plan.destPath,
		error: describeError(error),
	};
	const path = partialLogPath(cacheRoot);
	mkdirSync(dirname(path), { recursive: true });
	const line = `${JSON.stringify(record)}\n`;
	const tmp = `${path}.tmp`;
	const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
	writeFileSync(tmp, existing + line, 'utf-8');
	renameSync(tmp, path);
}

/** Read every record from the partial-download log. Empty when missing. */
export function readPartialDownloads(cacheRoot: string): readonly PartialDownloadRecord[] {
	const path = partialLogPath(cacheRoot);
	if (!existsSync(path)) return [];
	const lines = readFileSync(path, 'utf-8').split('\n');
	const records: PartialDownloadRecord[] = [];
	for (const line of lines) {
		if (line.trim() === '') continue;
		try {
			const parsed = JSON.parse(line) as PartialDownloadRecord;
			records.push(parsed);
		} catch {
			// Tolerate corruption: a partial line from a killed write doesn't poison
			// the whole log. The operator runs a fresh download to clear the file.
		}
	}
	return records;
}

/** Remove the partial-download log. Called at the start of a fresh run. */
export function clearPartialDownloads(cacheRoot: string): void {
	const path = partialLogPath(cacheRoot);
	if (existsSync(path)) unlinkSync(path);
}

/**
 * Drop only the records matching the given plan-id keys (`corpus|doc|kind|ordinal`).
 * Used when a partial run is being retried under `--corpus=` filtering: the
 * filtered-in records get cleared so re-runs have a clean slate, but records
 * for plans the current run did NOT include stay logged so a follow-up run
 * (or a future operator) can still see them.
 */
export function dropPartialDownloads(cacheRoot: string, planIds: ReadonlySet<string>): void {
	const path = partialLogPath(cacheRoot);
	if (!existsSync(path)) return;
	const remaining = readPartialDownloads(cacheRoot).filter((r) => !planIds.has(planIdKey(r)));
	if (remaining.length === 0) {
		unlinkSync(path);
		return;
	}
	const tmp = `${path}.tmp`;
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(tmp, `${remaining.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf-8');
	renameSync(tmp, path);
}

/** Compose the plan-id key used by `surfacePreviousPartialLog` + `dropPartialDownloads`. */
export function planIdKey(plan: { corpus: string; doc: string; kind: string; ordinal: number | null }): string {
	return `${plan.corpus}|${plan.doc}|${plan.kind}|${plan.ordinal ?? ''}`;
}
