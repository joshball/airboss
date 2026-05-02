/**
 * Hangar blob root resolver.
 *
 * Hangar-owned binary artefacts (uploaded source files, fetched binary-visual
 * archives, generated thumbnails) live under a hangar-owned subtree of the
 * developer-local cache root resolved by `AIRBOSS_HANDBOOK_CACHE`.
 *
 * Layout:
 *
 *   <cache-root>/hangar-blobs/
 *     <type>/<sourceId>.<ext>                  Text source upload (per upload-handler).
 *     <type>/<sourceId>@<version>.<ext>        Archived prior version.
 *     <type>/<sourceId>/<edition>/chart.zip    Binary-visual fetch (per source-fetch).
 *     <type>/<sourceId>/<edition>/thumb.jpg
 *     <type>/<sourceId>/<edition>/meta.json
 *
 * The `hangar.source.path` column stores a path relative to this root in the
 * shape `<type>/<sourceId>.<ext>` (text) or `<type>/<sourceId>` (binary-visual).
 * Apps that read these blobs resolve the row path against this root via
 * `resolveHangarBlobRoot()`.
 *
 * Replaces the pre-ADR-018 in-repo `data/sources/<type>/<id>.<ext>` location.
 * See ADR 018 §"What flips Flavor D to actual LFS" and the cluster-A
 * retirement WP that introduced this helper.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Subdirectory under the cache root where hangar binary artefacts live. */
export const HANGAR_BLOB_DIR = 'hangar-blobs';

/**
 * Expand a leading `~` in operator-supplied env-var values. Mirrors the
 * helper in `scripts/lib/cache.ts`; duplicated here so the BC stays free
 * of imports outside its workspace boundary.
 */
function expandHome(p: string): string {
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	if (p === '~') return homedir();
	return p;
}

/**
 * Resolve the developer-local cache root. Honors `AIRBOSS_HANDBOOK_CACHE`;
 * defaults to `~/Documents/airboss-handbook-cache/`. Creates the directory
 * when missing so callers can immediately write to it.
 */
function resolveCacheRoot(): string {
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

/**
 * Return the absolute path of the hangar blob root. Callers join `path`
 * column values onto this to materialise the on-disk location.
 *
 * Tests inject `cacheRoot` to point at a per-test tmp directory.
 */
export function resolveHangarBlobRoot(cacheRoot?: string): string {
	const root = cacheRoot ?? resolveCacheRoot();
	const blobRoot = join(root, HANGAR_BLOB_DIR);
	if (!existsSync(blobRoot)) {
		mkdirSync(blobRoot, { recursive: true });
	}
	return blobRoot;
}
