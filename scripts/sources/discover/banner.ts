/**
 * Dispatcher banner: surface unreviewed errata candidates at the top of
 * every `bun run sources <command>` invocation so the developer can't miss
 * a discovered candidate. Suppressed by `AIRBOSS_QUIET=1`.
 *
 * Reads only state files; never blocks the dispatcher on a slow scan.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DISCOVERY_CACHE, DISCOVERY_QUIET_ENV, DISCOVERY_STATUSES } from '@ab/constants';
import { resolveCacheRoot } from '../../lib/cache';
import { loadState } from './state';

export interface BannerOptions {
	readonly cacheRoot?: string;
	readonly env?: Record<string, string | undefined>;
	readonly logger?: (line: string) => void;
}

export function maybePrintBanner(options: BannerOptions = {}): void {
	const env = options.env ?? process.env;
	if (env[DISCOVERY_QUIET_ENV] === '1' || env[DISCOVERY_QUIET_ENV] === 'true') return;

	let cacheRoot: string;
	try {
		cacheRoot = options.cacheRoot ?? resolveCacheRoot();
	} catch {
		return;
	}
	const handbooksDir = join(cacheRoot, DISCOVERY_CACHE.HANDBOOKS_DIR);
	if (!existsSync(handbooksDir)) return;

	let unreviewedCount = 0;
	let entries: string[];
	try {
		entries = readdirSync(handbooksDir);
	} catch {
		return;
	}
	for (const filename of entries) {
		if (!filename.endsWith('.json')) continue;
		const slug = filename.slice(0, -'.json'.length);
		const state = safeLoadState(cacheRoot, slug);
		if (state === null) continue;
		for (const candidate of state.candidates) {
			if (candidate.status === DISCOVERY_STATUSES.CANDIDATE || candidate.status === DISCOVERY_STATUSES.UNMATCHED) {
				unreviewedCount += 1;
			}
		}
	}
	if (unreviewedCount === 0) return;

	const log = options.logger ?? ((line) => console.log(line));
	const noun = unreviewedCount === 1 ? 'candidate' : 'candidates';
	log(
		`[!] ${unreviewedCount} unreviewed errata ${noun}. ` +
			`Run 'bun run sources discover-errata --force' or read ` +
			`${join(DISCOVERY_CACHE.PENDING_REPORT_FILE)} to triage. Suppress with ${DISCOVERY_QUIET_ENV}=1.`,
	);
}

function safeLoadState(cacheRoot: string, slug: string) {
	try {
		return loadState(cacheRoot, slug);
	} catch {
		return null;
	}
}
