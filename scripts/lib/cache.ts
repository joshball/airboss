/**
 * Resolve the developer-local source cache root.
 *
 * Honors `AIRBOSS_HANDBOOK_CACHE`; defaults to `~/Documents/airboss-handbook-cache/`.
 * Mirrors the helper in `libs/sources/src/regs/cache.ts` -- duplicated up
 * here because the script entry points are pure-Node + must not pull in the
 * rest of `@ab/sources` (and its `fast-xml-parser` etc. transitive deps) just
 * to compute a path.
 *
 * See ADR 018 (storage policy) and `docs/platform/STORAGE.md`.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function expandHome(p: string): string {
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	if (p === '~') return homedir();
	return p;
}

export function resolveCacheRoot(): string {
	const fromEnv = process.env.AIRBOSS_HANDBOOK_CACHE;
	const expanded =
		fromEnv !== undefined && fromEnv.length > 0
			? expandHome(fromEnv)
			: join(homedir(), 'Documents', 'airboss-handbook-cache');
	if (!existsSync(expanded)) {
		mkdirSync(expanded, { recursive: true });
	}
	return expanded;
}
