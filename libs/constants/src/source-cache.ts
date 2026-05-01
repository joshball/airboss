/**
 * Source-document cache root resolution. Single source of truth for the
 * `AIRBOSS_HANDBOOK_CACHE` env var, the default cache directory layout, and
 * the helper every ingest pipeline + script + server hook calls to figure
 * out where source PDFs / XML live on disk.
 *
 * See ADR 018 (storage policy) and `docs/platform/STORAGE.md`. ADR 021 owns
 * the per-corpus subdirectory layout under the resolved root.
 *
 * Lives in `@ab/constants` (and not `@ab/sources`) so that pure-Node script
 * entry points can import the helper without dragging in the full sources
 * lib's transitive deps (fast-xml-parser, etc.).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ENV_VARS } from './env';

/** Names + literals defining the source-document cache. */
export const SOURCE_CACHE = {
	/** Env var consulted to override the cache root. */
	ENV_VAR: ENV_VARS.AIRBOSS_HANDBOOK_CACHE,
	/** Parent directory beneath the user home for the default cache root. */
	DEFAULT_PARENT_DIR: 'Documents',
	/** Directory name appended under the parent for the default cache root. */
	DEFAULT_DIR_NAME: 'airboss-handbook-cache',
} as const;

/**
 * Expand a leading `~` or `~/` in a path against the current user home.
 * No-op when the path does not start with `~`.
 */
export function expandHome(p: string): string {
	if (p === '~') return homedir();
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	return p;
}

/** Default cache root: `~/Documents/airboss-handbook-cache/`. */
export function defaultCacheRoot(): string {
	return join(homedir(), SOURCE_CACHE.DEFAULT_PARENT_DIR, SOURCE_CACHE.DEFAULT_DIR_NAME);
}

/**
 * Resolve the source-document cache root.
 *
 * Resolution order:
 *   1. `AIRBOSS_HANDBOOK_CACHE` env var (with `~/` expanded), if non-empty.
 *   2. `~/Documents/airboss-handbook-cache/` (default).
 *
 * When `ensureExists` is `true` (default), the directory is created on
 * demand. Pass `false` for read-only callsites (tests, smoke probes) where
 * mkdir-on-resolve would be a side effect.
 */
export function resolveCacheRoot(options: { ensureExists?: boolean } = {}): string {
	const { ensureExists = true } = options;
	const fromEnv = process.env[SOURCE_CACHE.ENV_VAR];
	const root = fromEnv !== undefined && fromEnv.length > 0 ? expandHome(fromEnv) : defaultCacheRoot();
	if (ensureExists && !existsSync(root)) {
		mkdirSync(root, { recursive: true });
	}
	return root;
}
