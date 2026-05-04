/**
 * Background errata-discovery trigger fired at study-server startup.
 *
 * Dev-server boots fast: this hook MUST be non-blocking. We check the
 * freshness sentinel synchronously (cheap file read) and, if stale, spawn
 * `bun run sources discover-errata` as a detached child. The server proceeds
 * regardless; the child runs to completion (or fails silently) on its own.
 *
 * Configured by ADR 020 and WP `apply-errata-and-afh-mosaic` phase R7.
 *
 * Future: hangar UI surfaces the discovery report; same trigger applies.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DISCOVERY_CACHE, DISCOVERY_FRESHNESS_MS, ENV_VARS, resolveCacheRoot } from '@ab/constants';
import { createLogger } from '@ab/utils';

const log = createLogger('study');

function isStaleSentinel(cacheRoot: string, now: number, windowMs: number): boolean {
	const sentinel = join(cacheRoot, DISCOVERY_CACHE.LAST_RUN_FILE);
	if (!existsSync(sentinel)) return true;
	try {
		const raw = readFileSync(sentinel, 'utf8');
		const parsed = JSON.parse(raw) as { ran_at?: unknown };
		if (typeof parsed.ran_at !== 'string') return true;
		const ranAtMs = Date.parse(parsed.ran_at);
		if (Number.isNaN(ranAtMs)) return true;
		return now - ranAtMs >= windowMs;
	} catch {
		return true;
	}
}

/**
 * Fire-and-forget discovery scan when the freshness sentinel is stale.
 *
 * The startup hook awaits this once during server boot so the trigger
 * decision happens deterministically; the spawned child is `unref`ed so
 * the server process is free to exit independently.
 */
export async function maybeRunDiscovery(): Promise<void> {
	const cacheRoot = resolveCacheRoot();
	const now = Date.now();
	if (!isStaleSentinel(cacheRoot, now, DISCOVERY_FRESHNESS_MS)) return;

	try {
		const child = spawn('bun', ['run', 'sources', 'discover-errata'], {
			detached: true,
			stdio: 'ignore',
			env: { ...process.env, [ENV_VARS.AIRBOSS_HANDBOOK_CACHE]: cacheRoot },
		});
		child.on('error', (err) => {
			// Spawn failure means errata discovery is permanently broken (binary
			// missing, perms, etc.) -- on-call needs the error tier so they see
			// it without filtering through warn-noise. Fire-and-forget child;
			// this log is the only visibility.
			log.error('spawn discovery child failed', {
				metadata: { err: err.message },
			});
		});
		child.unref();
	} catch (error) {
		log.error('spawn discovery child failed', {
			metadata: { err: error instanceof Error ? error.message : String(error) },
		});
	}
}
