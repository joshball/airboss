/**
 * Streams handbook-asset files (figures + tables) from the repo's
 * `handbooks/<doc>/<edition>/...` tree.
 *
 * Mirrors `apps/study/src/routes/handbook-asset/[...path]/+server.ts`. The
 * SvelteKit static folder is per-app; rather than copying ~70 MB of PNGs into
 * every app, we expose this endpoint that resolves the request to the on-disk
 * file in the monorepo's `handbooks/` directory and streams it back.
 *
 * Path-traversal guard: the resolved path must remain inside the repo's
 * `handbooks/` directory; any `..` or absolute fragment is rejected.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const HERE = dirname(fileURLToPath(import.meta.url));
// apps/flightbag/src/routes/handbook-asset/[...path] -> repo root is six levels up.
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

	// Wrap the Node Readable as a proper Web ReadableStream. Casting the
	// Node stream straight to `ReadableStream` (the previous shape) tripped
	// undici's response writer when the browser disconnected mid-stream:
	// undici's `close()` raced with the Node stream's auto-close and threw
	// `ERR_INVALID_STATE: ReadableStream is already closed`, crashing the
	// dev server. `Readable.toWeb` returns a Web stream whose lifecycle is
	// owned by undici, so an aborted browser request doesn't double-close.
	const stream = Readable.toWeb(createReadStream(requested)) as ReadableStream<Uint8Array>;
	return new Response(stream, {
		headers: {
			'Content-Type': contentType,
			'Content-Length': String(stat.size),
			'Cache-Control': 'public, max-age=86400',
		},
	});
};
