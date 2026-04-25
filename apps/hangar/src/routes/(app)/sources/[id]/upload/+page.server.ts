/**
 * /sources/[id]/upload -- versioned upload form.
 *
 * The form accepts one file + an optional version string. The server action
 * writes the file to an OS temp path, enqueues an `upload-source` job with
 * the temp path, and redirects to `/jobs/[id]` so the user watches the
 * hash + archive + row-update stream in the live log.
 *
 * Size is bounded by SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES; over-limit
 * uploads fail with a 413-shaped response.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { requireRole } from '@ab/auth';
import { JOB_KINDS, JOB_STATUSES, ROLES, ROUTES, SOURCE_ACTION_LIMITS } from '@ab/constants';
import { db, hangarJob, hangarSource } from '@ab/db';
import { enqueueJob } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-upload');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const [source] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
	if (!source) throw error(404, `source '${event.params.id}' not found`);
	const [activeJob] = await db
		.select()
		.from(hangarJob)
		.where(
			and(
				eq(hangarJob.targetId, event.params.id),
				inArray(hangarJob.status, [JOB_STATUSES.QUEUED, JOB_STATUSES.RUNNING]),
			),
		)
		.orderBy(desc(hangarJob.createdAt))
		.limit(1);
	return {
		source: {
			id: source.id,
			title: source.title,
			type: source.type,
			version: source.version,
		},
		limits: {
			maxUploadBytes: SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES,
		},
		activeJob: activeJob
			? {
					id: activeJob.id,
					kind: activeJob.kind,
					status: activeJob.status,
				}
			: null,
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const file = form.get('file');
		const version = form.get('version');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { error: 'choose a file to upload' });
		}
		if (file.size > SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES) {
			return fail(413, {
				error: `file exceeds ${SOURCE_ACTION_LIMITS.MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`,
			});
		}
		const [source] = await db.select().from(hangarSource).where(eq(hangarSource.id, event.params.id)).limit(1);
		if (!source) return fail(404, { error: 'source not found' });
		if (source.deletedAt) return fail(404, { error: 'source is deleted' });

		// Defense-in-depth busy pre-check (mirrors /sources/[id] form actions).
		const [existing] = await db
			.select()
			.from(hangarJob)
			.where(
				and(
					eq(hangarJob.targetId, event.params.id),
					inArray(hangarJob.status, [JOB_STATUSES.QUEUED, JOB_STATUSES.RUNNING]),
				),
			)
			.limit(1);
		if (existing) {
			return fail(409, {
				error: `source '${event.params.id}' already has a ${existing.status} ${existing.kind} job (#${existing.id}); wait for it to finish or cancel it first`,
			});
		}

		const dir = await mkdtemp(join(tmpdir(), 'airboss-hangar-upload-'));
		const tempPath = join(dir, file.name);
		const buffer = new Uint8Array(await file.arrayBuffer());
		await writeFile(tempPath, buffer);

		try {
			const job = await enqueueJob({
				kind: JOB_KINDS.UPLOAD_SOURCE,
				targetType: 'hangar.source',
				targetId: event.params.id,
				actorId: user.id,
				payload: {
					sourceId: event.params.id,
					tempPath,
					originalFilename: file.name,
					sizeBytes: file.size,
					version: typeof version === 'string' ? version : undefined,
				},
			});
			redirect(303, ROUTES.HANGAR_JOB_DETAIL(job.id));
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) throw err;
			log.error(
				'enqueue upload failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: err instanceof Error ? err.message : 'failed to enqueue upload job' });
		}
	},
};
