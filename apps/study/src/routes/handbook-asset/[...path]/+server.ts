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
 * `handbooks/` directory; any `..` or absolute fragment is rejected.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/study/src/routes/handbook-asset/[...path] -> repo root is six levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..');
const HANDBOOKS_DIR = resolve(REPO_ROOT, 'handbooks');

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
	const requested = resolve(HANDBOOKS_DIR, params.path);
	if (!requested.startsWith(`${HANDBOOKS_DIR}/`) && requested !== HANDBOOKS_DIR) {
		throw error(404, 'Not found');
	}
	if (!existsSync(requested)) throw error(404, 'Not found');
	const stat = statSync(requested);
	if (!stat.isFile()) throw error(404, 'Not found');

	const ext = extname(requested).toLowerCase();
	const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';

	const stream = createReadStream(requested);
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
