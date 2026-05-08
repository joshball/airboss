/**
 * Producer pipeline.
 *
 * `runProducers` walks the plugin registry, calls each plugin's
 * `produceIssues` for the requested corpus, upserts the yielded inputs,
 * and at the end of each plugin's run flips disappeared issues to
 * `stale`. One plugin's failure is captured and logged; remaining
 * plugins still run.
 *
 * @browser-globals: server-only -- never imported by client .svelte
 */

import type { Corpus, IngestIssueKind } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { listPlugins } from './plugin';
import { markStaleByDifference, upsertIssues } from './queries';
import type { IssueInput, ProducerContext } from './types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface ProducerOptions {
	corpus: Corpus;
	sourceId?: string;
	repoRoot: string;
	/** Optional kind filter; when set, only plugins matching `kind` run. */
	kind?: IngestIssueKind;
}

export interface ProducerSummary {
	kind: IngestIssueKind;
	upserted: number;
	staled: number;
	error?: { message: string; name: string };
}

export interface RunProducersResult {
	totalPlugins: number;
	totalUpserted: number;
	totalStaled: number;
	totalErrors: number;
	perPlugin: readonly ProducerSummary[];
}

/**
 * Run the producer pipeline. Returns one summary entry per plugin run.
 */
export async function runProducers(opts: ProducerOptions, db: Db = defaultDb): Promise<RunProducersResult> {
	const ctx: ProducerContext = {
		corpus: opts.corpus,
		repoRoot: opts.repoRoot,
		...(opts.sourceId !== undefined ? { sourceId: opts.sourceId } : {}),
	};
	const plugins = listPlugins().filter((p) => {
		// Only run plugins whose kind starts with the corpus prefix. Avoids
		// running a `regs.*` plugin during a `--corpus handbook` invocation.
		if (!p.kind.startsWith(`${opts.corpus}.`)) return false;
		if (opts.kind && p.kind !== opts.kind) return false;
		return true;
	});
	const perPlugin: ProducerSummary[] = [];
	let totalUpserted = 0;
	let totalStaled = 0;
	let totalErrors = 0;
	for (const plugin of plugins) {
		const seenExternalIds: string[] = [];
		const batch: IssueInput[] = [];
		try {
			for await (const input of plugin.produceIssues(ctx)) {
				batch.push(input);
				seenExternalIds.push(input.externalId);
			}
			if (batch.length > 0) {
				await upsertIssues(batch, db);
			}
			const staled = await markStaleByDifference({ corpus: opts.corpus, kind: plugin.kind }, seenExternalIds, db);
			perPlugin.push({ kind: plugin.kind, upserted: batch.length, staled: staled.length });
			totalUpserted += batch.length;
			totalStaled += staled.length;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const name = err instanceof Error ? err.name : 'Error';
			perPlugin.push({ kind: plugin.kind, upserted: batch.length, staled: 0, error: { message, name } });
			totalErrors += 1;
		}
	}
	return {
		totalPlugins: plugins.length,
		totalUpserted,
		totalStaled,
		totalErrors,
		perPlugin,
	};
}
