/**
 * /sources/[id] -- operational detail for one source.
 *
 * Loads the `hangar.source` row, its recent job history, and the on-disk
 * snapshot (size, mtime, checksum match). Exposes form actions for every
 * operation that targets this source: fetch, extract, diff, validate.
 *
 * Delete lives on `/glossary/sources/[id]` (registry surface) to keep the
 * operational surface focused on live binary + verbatim state.
 */

import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRole } from '@ab/auth';
import { PENDING_DOWNLOAD } from '@ab/aviation';
import { JOB_KINDS, ROLES, ROUTES } from '@ab/constants';
import { db, hangarJob, hangarSource } from '@ab/db';
import { enqueueJob } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { REPO_ROOT } from '$lib/server/source-jobs';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-detail');

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [row] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
	if (!row) throw error(404, `source '${event.params.id}' not found`);

	const recentJobs = await db
		.select()
		.from(hangarJob)
		.where(eq(hangarJob.targetId, event.params.id))
		.orderBy(desc(hangarJob.createdAt))
		.limit(10);

	// On-disk snapshot. Surfaces missing-file / rev-mismatch / size-match state
	// so the operator knows whether a fetch is needed.
	const absolutePath = row.path ? resolve(REPO_ROOT, row.path) : null;
	let onDisk: { sizeBytes: number; mtime: string } | null = null;
	if (absolutePath) {
		try {
			const s = await stat(absolutePath);
			onDisk = { sizeBytes: s.size, mtime: s.mtime.toISOString() };
		} catch {
			onDisk = null;
		}
	}

	const isPendingChecksum = row.checksum === PENDING_DOWNLOAD || row.checksum === '';

	return {
		user: { id: user.id, role: user.role },
		source: {
			id: row.id,
			rev: row.rev,
			type: row.type,
			title: row.title,
			version: row.version,
			url: row.url,
			path: row.path,
			format: row.format,
			checksum: row.checksum,
			sizeBytes: row.sizeBytes,
			downloadedAt: row.downloadedAt,
			locatorShape: row.locatorShape,
			dirty: row.dirty,
			updatedAt: row.updatedAt.toISOString(),
			isPendingChecksum,
		},
		onDisk,
		recentJobs: recentJobs.map((job) => ({
			id: job.id,
			kind: job.kind,
			status: job.status,
			createdAt: job.createdAt.toISOString(),
			finishedAt: job.finishedAt?.toISOString() ?? null,
		})),
	};
};

function buildEnqueue(kind: (typeof JOB_KINDS)[keyof typeof JOB_KINDS]) {
	return async (event: Parameters<NonNullable<Actions['fetch']>>[0]): Promise<Response | ReturnType<typeof fail>> => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		try {
			const job = await enqueueJob({
				kind,
				targetType: 'hangar.source',
				targetId: event.params.id,
				actorId: user.id,
				payload: { sourceId: event.params.id },
			});
			redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) throw err;
			log.error(
				`enqueue ${kind} failed`,
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue job' });
		}
	};
}

export const actions: Actions = {
	fetch: buildEnqueue(JOB_KINDS.FETCH_SOURCE),
	extract: buildEnqueue(JOB_KINDS.EXTRACT_SOURCE),
	diff: buildEnqueue(JOB_KINDS.DIFF_SOURCE),
	validate: buildEnqueue(JOB_KINDS.VALIDATE_REFERENCES),
};
