/**
 * GET /sources/[id]/download -- stream the current edition archive from
 * disk with `content-disposition: attachment`. Binary-visual sources only.
 *
 * For text sources the caller should use `/sources/[id]/files` which
 * exposes the inline previews.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
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
		throw error(400, 'download is only available for binary-visual sources');
	}
	if (!row.edition) {
		throw error(409, 'source has no edition on disk yet; run fetch first');
	}

	const archivePath = resolve(REPO_ROOT, 'data', 'sources', row.type, row.id, row.edition.effectiveDate, 'chart.zip');
	try {
		const s = await stat(archivePath);
		if (!s.isFile()) throw new Error('archive path is not a file');
	} catch {
		throw error(404, `archive not on disk at ${archivePath}`);
	}

	const stream = createReadStream(archivePath);
	const filename = `${row.id}-${row.edition.effectiveDate}-${basename(archivePath)}`;
	return new Response(stream as unknown as ReadableStream, {
		status: 200,
		headers: {
			'content-type': 'application/zip',
			'content-disposition': `attachment; filename="${filename}"`,
		},
	});
};
