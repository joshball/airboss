/**
 * Freshness gate for the discovery dispatcher.
 *
 * Discovery makes ~17 HTTPS requests per run; cheap on a wall-clock basis,
 * but the dev-server hook needs to be effectively free in the common case.
 * The gate compares the timestamp inside `<cache>/discovery/_last_run.json`
 * to "now" and returns true when the file is missing, corrupt, or older
 * than `DISCOVERY_FRESHNESS_MS`.
 *
 * The 7-day window is set in `libs/constants/src/sources.ts` so the cron
 * cadence and the freshness check stay in lock-step.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DISCOVERY_CACHE, DISCOVERY_FRESHNESS_MS } from '@ab/constants';

export interface LastRun {
	readonly ranAt: string;
	readonly handbooksScanned: number;
	readonly candidatesFound: number;
}

export function lastRunPath(cacheRoot: string): string {
	return join(cacheRoot, DISCOVERY_CACHE.LAST_RUN_FILE);
}

export function readLastRun(cacheRoot: string): LastRun | null {
	const path = lastRunPath(cacheRoot);
	if (!existsSync(path)) return null;
	try {
		const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
		const ranAt = typeof raw.ran_at === 'string' ? raw.ran_at : null;
		const handbooksScanned = typeof raw.handbooks_scanned === 'number' ? raw.handbooks_scanned : null;
		const candidatesFound = typeof raw.candidates_found === 'number' ? raw.candidates_found : null;
		if (ranAt === null || handbooksScanned === null || candidatesFound === null) return null;
		return { ranAt, handbooksScanned, candidatesFound };
	} catch {
		return null;
	}
}

export function writeLastRun(cacheRoot: string, summary: LastRun): void {
	const path = lastRunPath(cacheRoot);
	mkdirSync(dirname(path), { recursive: true });
	const payload = {
		ran_at: summary.ranAt,
		handbooks_scanned: summary.handbooksScanned,
		candidates_found: summary.candidatesFound,
	};
	writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export interface FreshnessOptions {
	readonly now?: number;
	readonly windowMs?: number;
}

export function isStale(cacheRoot: string, opts: FreshnessOptions = {}): boolean {
	const now = opts.now ?? Date.now();
	const windowMs = opts.windowMs ?? DISCOVERY_FRESHNESS_MS;
	const last = readLastRun(cacheRoot);
	if (last === null) return true;
	const lastMs = Date.parse(last.ranAt);
	if (Number.isNaN(lastMs)) return true;
	return now - lastMs >= windowMs;
}
