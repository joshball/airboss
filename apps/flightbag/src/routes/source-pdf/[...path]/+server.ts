/**
 * Streams the canonical source PDF for a reference from the developer-local
 * cache (per ADR 018).
 *
 * The `[...path]` segment is the per-corpus cache subpath produced by
 * `describeSourcePdf` from `@ab/sources`. The route resolves it against the
 * cache root, enforces a path-traversal guard (the resolved path must remain
 * inside the cache root), and streams the file with a `Content-Type: application/pdf`
 * header.
 *
 * Returns 404 when the cache file doesn't exist (a fresh dev box hasn't
 * downloaded the PDF yet, or the cache is on a different machine). The reader
 * pages render the local PDF link only when the page-server load already
 * confirmed the file exists, so a 404 here is rare and indicates a race
 * (the file was deleted between page load and link click).
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { resolveCachedSourcePdfPath } from '@ab/sources';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const abs = resolveCachedSourcePdfPath(params.path);
	if (abs === null) throw error(404, 'Not found');
	if (!existsSync(abs)) throw error(404, 'Not found');
	const stat = statSync(abs);
	if (!stat.isFile()) throw error(404, 'Not found');

	const filename = params.path.split('/').pop() ?? 'source.pdf';
	// Wrap the Node Readable as a proper Web ReadableStream so an aborted
	// browser request doesn't crash undici with `ERR_INVALID_STATE` -- see
	// the matching note in `handbook-asset/[...path]/+server.ts`.
	const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream<Uint8Array>;
	return new Response(stream, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Length': String(stat.size),
			'Cache-Control': 'public, max-age=86400',
			'Content-Disposition': `inline; filename="${filename.replace(/"/g, '')}"`,
		},
	});
};
