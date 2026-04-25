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
import {
	JOB_KINDS,
	JOB_STATUSES,
	type ReferenceSourceType,
	ROLES,
	ROUTES,
	SOURCE_KIND_BY_TYPE,
	SOURCE_KINDS,
} from '@ab/constants';
import { db, hangarJob, hangarSource } from '@ab/db';
import { enqueueJob } from '@ab/hangar-jobs';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, inArray } from 'drizzle-orm';
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

	// Pre-check: if a job for this source is already queued or running, the
	// worker will serialise a second submission anyway (see source-jobs.ts).
	// Surface that fact on the form so the operator doesn't fire-and-wait.
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
	const sourceKind = SOURCE_KIND_BY_TYPE[row.type as ReferenceSourceType] ?? SOURCE_KINDS.TEXT;

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
			media: row.media,
			edition: row.edition,
			sourceKind,
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
		activeJob: activeJob
			? {
					id: activeJob.id,
					kind: activeJob.kind,
					status: activeJob.status,
					startedAt: activeJob.startedAt?.toISOString() ?? null,
				}
			: null,
	};
};

function buildEnqueue(kind: (typeof JOB_KINDS)[keyof typeof JOB_KINDS]) {
	return async (event: Parameters<NonNullable<Actions['fetch']>>[0]): Promise<Response | ReturnType<typeof fail>> => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		try {
			// Defense-in-depth: even though the worker serialises by targetId, refuse
			// to enqueue a second non-terminal job from the form layer so the user
			// gets a fast, unambiguous error rather than a deferred queue position.
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
