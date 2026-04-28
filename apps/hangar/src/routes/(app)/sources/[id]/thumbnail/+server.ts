/**
 * GET /sources/[id]/thumbnail -- inline JPEG for the preview tile. Binary-
 * visual sources only; served from `media.thumbnailPath` relative to the
 * repo root.
 *
 * Returns 204 No Content when the row has no thumbnail yet (pre-fetch or
 * generator='unavailable'); the detail page renders a placeholder tile in
 * that case rather than a broken image.
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

export const GET: RequestHandler = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [row] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
	if (!row) throw error(404, `source '${event.params.id}' not found`);
	const kind = SOURCE_KIND_BY_TYPE[row.type as ReferenceSourceType];
	if (kind !== SOURCE_KINDS.BINARY_VISUAL) {
		throw error(400, 'thumbnail is only available for binary-visual sources');
	}
	if (!row.media?.thumbnailPath || row.media.thumbnailSizeBytes === 0) {
		return new Response(null, { status: 204 });
	}

	const abs = resolve(REPO_ROOT, row.media.thumbnailPath);
	// Defense-in-depth: refuse any path that escapes data/sources/. The DB
	// column is operator-supplied (fetch worker stores it); a future bug or
	// hand-edit could drop a `..` segment. Mirrors the guard in
	// /sources/[id]/files/raw/+server.ts.
	const sourcesRoot = resolve(REPO_ROOT, 'data', 'sources');
	if (!(abs === sourcesRoot || abs.startsWith(`${sourcesRoot}/`))) {
		throw error(400, `thumbnail path is outside data/sources/: ${abs}`);
	}
	try {
		const s = await stat(abs);
		if (!s.isFile()) throw new Error(`thumbnail is not a file: ${abs}`);
		if (s.size === 0) return new Response(null, { status: 204 });
	} catch {
		return new Response(null, { status: 204 });
	}

	const stream = createReadStream(abs);
	return new Response(stream as unknown as ReadableStream, {
		status: 200,
		headers: {
			'content-type': 'image/jpeg',
			'cache-control': 'private, max-age=60',
		},
	});
};
