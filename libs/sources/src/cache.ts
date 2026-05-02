/**
 * Canonical cache-root resolution for the developer-local source cache.
 *
 * Source of truth: ADR 018 (storage policy) + ADR 021 (flat naming) +
 * `docs/platform/STORAGE.md`. The cache root is read from the
 * `AIRBOSS_HANDBOOK_CACHE` env var (registered in `@ab/constants` `ENV_VARS`)
 * with a default of `<homedir>/Documents/airboss-handbook-cache/`. A literal
 * `~` or `~/...` prefix in the env value expands to `homedir()` so shell-style
 * paths in `.envrc` / `.env.local` work without additional plumbing.
 *
 * Every ingestion module + the script-side helper resolve through this file
 * so the env-var name, the parent dir, and the cache dir name live in exactly
 * one place (`SOURCE_CACHE` in `@ab/constants`). Pure-Node only -- this
 * module has no transitive deps beyond `@ab/constants`, so script entry
 * points can safely import from `@ab/sources/cache` without dragging in
 * the rest of the lib (e.g. `fast-xml-parser`).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ENV_VARS, SOURCE_CACHE } from '@ab/constants';

/**
 * Expand a `~` or `~/...` prefix in `p` to `homedir()`. Other paths pass
 * through unchanged. Exported for tests + for any script that wants to
 * normalise an operator-supplied path the same way the cache helper does.
 */
export function expandHome(p: string): string {
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	if (p === '~') return homedir();
	return p;
}

/**
 * Resolve the absolute path to the cache root, expanding `~` and creating
 * the directory tree on demand. Honors `ENV_VARS.AIRBOSS_HANDBOOK_CACHE`;
 * defaults to `<homedir>/Documents/airboss-handbook-cache/`.
 */
export function resolveCacheRoot(): string {
	const fromEnv = process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
	const root =
		fromEnv !== undefined && fromEnv.length > 0
			? expandHome(fromEnv)
			: join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME);
	if (!existsSync(root)) {
		mkdirSync(root, { recursive: true });
	}
	return root;
}

/**
 * Default cache root resolved through the env var without ensuring the
 * directory exists. Lighter-weight than `resolveCacheRoot()`; suitable for
 * CLI default values that may later be overridden by `--cache=` flags.
 */
export function defaultCacheRoot(): string {
	const fromEnv = process.env[ENV_VARS.AIRBOSS_HANDBOOK_CACHE];
	if (fromEnv !== undefined && fromEnv.length > 0) return expandHome(fromEnv);
	return join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME);
}
