/**
 * GET /sources/[id]/files/raw?name=<filename> -- stream a single file from
 * the source's `data/sources/<type>[/<id>]/...` tree with `content-type`
 * inferred from the extension. Used by the inline previewers (PdfPreview
 * embeds a PDF via `<object>`; the same endpoint backs future viewers).
 *
 * Path-escape resistance: `name` is parsed as a relative path against the
 * source's expected on-disk root and rejected if the resolved absolute path
 * leaves that root. Symlink escapes are caught by the same prefix check.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { type ReferenceSourceType, ROLES, SOURCE_KIND_BY_TYPE, SOURCE_KINDS } from '@ab/constants';
import { db, hangarSource } from '@ab/db';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { REPO_ROOT } from '$lib/server/source-jobs';
import type { RequestHandler } from './$types';

/** Map common preview extensions to a streamable content-type. */
const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
	pdf: 'application/pdf',
	csv: 'text/csv; charset=utf-8',
	tsv: 'text/tab-separated-values; charset=utf-8',
	md: 'text/markdown; charset=utf-8',
	markdown: 'text/markdown; charset=utf-8',
	txt: 'text/plain; charset=utf-8',
	text: 'text/plain; charset=utf-8',
	log: 'text/plain; charset=utf-8',
	html: 'text/html; charset=utf-8',
	json: 'application/json; charset=utf-8',
	xml: 'application/xml; charset=utf-8',
};

function extensionOf(filename: string): string {
	const lastDot = filename.lastIndexOf('.');
	if (lastDot <= 0 || lastDot === filename.length - 1) return '';
	return filename.slice(lastDot + 1).toLowerCase();
}

export const GET: RequestHandler = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);

	const name = event.url.searchParams.get('name');
	if (!name || name.length === 0) throw error(400, 'missing ?name=');
	// Reject obvious path-escape patterns. The resolve() check below is the
	// authoritative guard, but rejecting these early gives clearer errors.
	if (name.includes('..') || name.includes('\\')) throw error(400, 'invalid filename');

	const [source] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
	if (!source) throw error(404, `source '${event.params.id}' not found`);

	const sourcesRoot = resolve(REPO_ROOT, 'data', 'sources');
	const kind = SOURCE_KIND_BY_TYPE[source.type as ReferenceSourceType] ?? SOURCE_KINDS.TEXT;
	const root =
		kind === SOURCE_KINDS.BINARY_VISUAL
			? resolve(sourcesRoot, source.type, source.id)
			: resolve(sourcesRoot, source.type);

	const full = resolve(root, name);
	if (!(full === root || full.startsWith(`${root}/`))) {
		throw error(400, 'path escape');
	}
	if (!(full === sourcesRoot || full.startsWith(`${sourcesRoot}/`))) {
		throw error(400, 'path escape');
	}
	// For text sources we also enforce the per-source filename prefix to keep
	// this endpoint scoped to files that the /files browser actually lists.
	if (kind !== SOURCE_KINDS.BINARY_VISUAL) {
		if (!(name.startsWith(`${source.id}.`) || name.startsWith(`${source.id}@`))) {
			throw error(400, 'filename does not belong to this source');
		}
	}

	let size: number;
	try {
		const s = await stat(full);
		if (!s.isFile()) throw new Error('not a file');
		size = s.size;
	} catch {
		throw error(404, `file not found: ${name}`);
	}

	const ext = extensionOf(name);
	const contentType = CONTENT_TYPE_BY_EXTENSION[ext] ?? 'application/octet-stream';

	const stream = createReadStream(full);
	return new Response(stream as unknown as ReadableStream, {
		status: 200,
		headers: {
			'content-type': contentType,
			'content-length': size.toString(),
			// Inline so <object>/<embed> renders in-place; not an attachment.
			'content-disposition': `inline; filename="${name.replace(/[\\"]/g, '_')}"`,
		},
	});
};
