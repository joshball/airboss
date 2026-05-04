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
 * Path-traversal defence -- see `resolveHandbookAssetPath` for the
 * two-layered prefix + real-path check.
 */

import { createReadStream, realpathSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveHandbookAssetPath } from './resolve-asset-path';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/handbook-asset/[...path] -> repo root is six levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const HANDBOOKS_DIR = resolve(REPO_ROOT, 'handbooks');
// Canonical (symlink-resolved) form of HANDBOOKS_DIR. The prefix check
// uses the canonical form so a symlink-rooted handbooks dir (e.g. dev
// machines that point `handbooks` at a shared cache) still validates
// correctly. Computed once at module init -- the directory itself does
// not move per process.
const HANDBOOKS_DIR_REAL = realpathSync(HANDBOOKS_DIR);

const CONTENT_TYPES: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.html': 'text/html; charset=utf-8',
};

export const GET: RequestHandler = async ({ params }) => {
	const resolved = resolveHandbookAssetPath({
		root: HANDBOOKS_DIR,
		rootReal: HANDBOOKS_DIR_REAL,
		requestedPath: params.path,
	});
	if (resolved === null) throw error(404, 'Not found');

	const stat = statSync(resolved);
	if (!stat.isFile()) throw error(404, 'Not found');

	const ext = extname(resolved).toLowerCase();
	const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

	const stream = createReadStream(resolved);
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
