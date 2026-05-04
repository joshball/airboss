/**
 * Path-traversal + symlink-escape guard for the handbook-asset streamer.
 *
 * Pre-2026-05-04 the route did
 * `requested.startsWith(`${HANDBOOKS_DIR}/`)`. That correctly rejects
 * `..`-collapsed escapes (after `path.resolve`) and absolute fragments,
 * but it does NOT defend against symlinks INSIDE `handbooks/` whose
 * targets escape the corpus. If a future ingest script, a shared cache
 * mount, or a misconfigured deploy ever drops such a symlink, the
 * string-prefix check would happily pass it through and the route would
 * stream `/etc/passwd` (or whatever the symlink pointed at).
 *
 * The two-layer guard:
 *   1. `path.resolve` collapses `..`/absolute fragments and the result
 *      must start with `${root}/` (cheap string check; rejects most
 *      attacks).
 *   2. `fs.realpathSync` canonicalises symlinks; the canonical path
 *      must start with `${rootReal}/` (defends against symlink-escape).
 *
 * Both checks return `null` (the caller maps to 404). 403 would leak
 * existence at the symlink target; 404 is uniform for any
 * "not in the corpus" case.
 *
 * Pure module so the guard can be unit-tested with a tmpdir without
 * booting SvelteKit. The route applies the guard in a single call; the
 * guard does not stream.
 */

import { existsSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ResolveHandbookAssetPathInput {
	/** Configured handbooks root (may itself be a symlink target). */
	root: string;
	/**
	 * Canonical (`realpathSync`) form of `root`. Computed once at module
	 * init so symlink-rooted handbooks dirs still validate against the
	 * canonical prefix check.
	 */
	rootReal: string;
	/** The `[...path]` catch-all value from the URL (already URL-decoded). */
	requestedPath: string;
}

/**
 * Returns the canonical on-disk path for `requestedPath` if and only if
 * it resolves inside `root` AFTER symlink canonicalisation. Returns
 * `null` for any failure (missing file, traversal escape, symlink that
 * canonicalises out of the tree).
 */
export function resolveHandbookAssetPath(input: ResolveHandbookAssetPathInput): string | null {
	const { root, rootReal, requestedPath } = input;
	const requested = resolve(root, requestedPath);

	// Cheap string-prefix check: rejects `..`-collapsed escapes and absolute
	// path fragments that would resolve outside the handbooks tree.
	if (!requested.startsWith(`${root}/`) && requested !== root) return null;

	if (!existsSync(requested)) return null;

	// Canonicalise symlinks before doing the second prefix check. Without
	// this, a symlink dropped under `root/` (by a future ingest script,
	// a dev-machine cache mount, or a misconfigured deploy) could point
	// at `/etc/passwd` and the cheap string check above would happily
	// pass it through.
	let canonical: string;
	try {
		canonical = realpathSync(requested);
	} catch {
		// realpathSync throws if a path component is missing -- treat as
		// not-found, mirroring `existsSync`.
		return null;
	}
	if (!canonical.startsWith(`${rootReal}/`) && canonical !== rootReal) return null;

	return canonical;
}
