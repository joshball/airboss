/**
 * Streams handbook-asset files (figures + tables) from the repo's
 * `handbooks/<doc>/<edition>/...` tree.
 *
 * SvelteKit's static folder is per-app; the handbook output lives at the
 * monorepo root. Rather than copying ~70 MB of PNGs into every app, we
 * expose a `/handbook-asset/<doc>/<edition>/figures/<file>.png` endpoint
 * that resolves the request to the on-disk file and streams it back. The
 * `[...path]` catch-all keeps the URL grammar identical to the manifest
 * `asset_path` field after stripping the `handbooks/` prefix.
 *
 * Path-traversal guard: the resolved path must remain inside the repo's
 * `handbooks/` directory; any `..` or absolute fragment is rejected. After
 * the lexical prefix check, we also `realpathSync` the requested path and
 * re-check the prefix on the canonical (symlink-resolved) result. This
 * defends against a symlink inside the corpus that points outside the
 * tree -- a future ingest script that drops shared-cache symlinks under
 * `handbooks/` cannot be turned into an arbitrary-file read.
 */

import { createReadStream, existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLogger } from '@ab/utils';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const log = createLogger('study:handbook-asset');
const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/handbook-asset/[...path] -> repo root is six levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const HANDBOOKS_DIR = resolve(REPO_ROOT, 'handbooks');
// Canonicalize the corpus root once so the per-request realpath check
// compares against a stable, symlink-resolved prefix even if a parent of
// `handbooks/` is itself a symlink (common with shared dev volumes).
const HANDBOOKS_DIR_REAL = (() => {
	try {
		return realpathSync(HANDBOOKS_DIR);
	} catch {
		// `handbooks/` doesn't exist in this checkout -- the per-request
		// existsSync below will fail first; fall back to the lexical path so
		// the prefix compare still has a value.
		return HANDBOOKS_DIR;
	}
})();

const CONTENT_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.html': 'text/html; charset=utf-8',
};

export const GET: RequestHandler = async ({ params, locals }) => {
	const requested = resolve(HANDBOOKS_DIR, params.path);
	// Lexical prefix check: rejects `..` traversal after `path.resolve`
	// collapses the segments. Cheap; runs before any fs syscall.
	if (!requested.startsWith(`${HANDBOOKS_DIR}/`) && requested !== HANDBOOKS_DIR) {
		// Log path-escape attempts only -- typos and stale links don't escape
		// HANDBOOKS_DIR. A spike in this line is the signal someone is fuzzing
		// the catch-all for traversal; the missing-file branches stay quiet.
		log.warn('handbook-asset path-escape attempt', {
			requestId: locals.requestId,
			userId: locals.user?.id ?? null,
			metadata: { requested: params.path },
		});
		throw error(404, 'Not found');
	}
	if (!existsSync(requested)) throw error(404, 'Not found');

	// Symlink defence: realpath the resolved path and re-check the prefix on
	// the canonical result. Without this, a symlink inside `handbooks/` that
	// points outside the corpus would pass the lexical check and serve any
	// readable file on disk. `realpathSync` throws if the path doesn't
	// exist, but we already gated on existsSync above.
	let canonical: string;
	try {
		canonical = realpathSync(requested);
	} catch {
		throw error(404, 'Not found');
	}
	if (!canonical.startsWith(`${HANDBOOKS_DIR_REAL}/`) && canonical !== HANDBOOKS_DIR_REAL) {
		throw error(404, 'Not found');
	}

	const stat = statSync(canonical);
	if (!stat.isFile()) throw error(404, 'Not found');

	const ext = extname(canonical).toLowerCase();
	const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

	const stream = createReadStream(canonical);
	return new Response(stream as unknown as ReadableStream, {
		headers: {
			'Content-Type': contentType,
			'Content-Length': String(stat.size),
			// Figure files are content-addressed by the seed pipeline; they're
			// effectively immutable per edition. Long cache lets the browser
			// hold them across reads.
			'Cache-Control': 'public, max-age=86400',
		},
	});
};
