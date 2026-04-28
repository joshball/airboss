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
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DISCOVERY_CACHE, DISCOVERY_FRESHNESS_MS } from '@ab/constants';
import { createLogger } from '@ab/utils';

const log = createLogger('study');

function expandHome(p: string): string {
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	if (p === '~') return homedir();
	return p;
}

function resolveCacheRoot(): string {
	const fromEnv = process.env.AIRBOSS_HANDBOOK_CACHE;
	if (typeof fromEnv === 'string' && fromEnv.length > 0) return expandHome(fromEnv);
	return join(homedir(), 'Documents', 'airboss-handbook-cache');
}

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
			env: { ...process.env, AIRBOSS_HANDBOOK_CACHE: cacheRoot },
		});
		child.on('error', (err) => {
			log.warn('discover-errata startup hook failed to spawn', {
				metadata: { err: err.message },
			});
		});
		child.unref();
	} catch (error) {
		log.warn('discover-errata startup hook errored', {
			metadata: { err: error instanceof Error ? error.message : String(error) },
		});
	}
}
