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
import { getActiveJobForTarget, getSource, listRecentJobsForTarget, REPO_ROOT } from '@ab/bc-hangar/server';
import { JOB_KINDS, type ReferenceSourceType, ROLES, SOURCE_KIND_BY_TYPE, SOURCE_KINDS } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail } from '@sveltejs/kit';
import { enqueueAndRedirect } from '$lib/server/enqueue-and-redirect';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:source-detail');

const RECENT_JOBS_LIMIT = 10;

export const load: PageServerLoad = async (event) => {
	const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const row = await getSource(event.params.id);
	if (!row) throw error(404, `source '${event.params.id}' not found`);

	// Fan out the three independent reads in parallel (chunk-6 perf NIT
	// closure). recent-jobs + active-job pre-check both hit `hangar.job`
	// keyed by targetId; the on-disk stat depends only on the source row
	// already loaded above. Bundling them collapses three round trips to
	// one wall-clock unit.
	const absolutePath = row.path ? resolve(REPO_ROOT, row.path) : null;
	const [recentJobs, activeJob, onDisk] = await Promise.all([
		listRecentJobsForTarget(event.params.id, RECENT_JOBS_LIMIT),
		// Surfaces "another job already in flight for this source" so the
		// operator doesn't fire-and-wait. Worker serialises by targetId
		// regardless; the BC pre-check just keeps the UI honest.
		getActiveJobForTarget(event.params.id),
		// On-disk snapshot for missing-file / size-match indicators on the
		// page; null on stat-failure so the consumer renders the empty
		// state rather than crashing the loader.
		absolutePath
			? stat(absolutePath)
					.then((s) => ({ sizeBytes: s.size, mtime: s.mtime.toISOString() }))
					.catch(() => null as { sizeBytes: number; mtime: string } | null)
			: Promise.resolve(null as { sizeBytes: number; mtime: string } | null),
	]);

	// Per the 2026-05-06 review §N, NULL = pending download (the earlier
	// `'pending-download'` sentinel + the NOT NULL constraint were dropped).
	// Empty-string is preserved as a defensive equivalent for any legacy
	// row that survived the migration with a placeholder.
	const isPendingChecksum = row.checksum === null || row.checksum === '';
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
			downloadedAt: row.downloadedAt?.toISOString() ?? null,
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
	return async (event: Parameters<NonNullable<Actions['fetch']>>[0]) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		// Defense-in-depth: even though the worker serialises by targetId, refuse
		// to enqueue a second non-terminal job from the form layer so the user
		// gets a fast, unambiguous error rather than a deferred queue position.
		const existing = await getActiveJobForTarget(event.params.id);
		if (existing) {
			return fail(409, {
				error: `source '${event.params.id}' already has a ${existing.status} ${existing.kind} job (#${existing.id}); wait for it to finish or cancel it first`,
			});
		}
		return enqueueAndRedirect(
			event,
			{
				kind,
				targetType: 'hangar.source',
				targetId: event.params.id,
				actorId: user.id,
				payload: { sourceId: event.params.id },
			},
			{ logger: log },
		);
	};
}

export const actions: Actions = {
	fetch: buildEnqueue(JOB_KINDS.FETCH_SOURCE),
	extract: buildEnqueue(JOB_KINDS.EXTRACT_SOURCE),
	diff: buildEnqueue(JOB_KINDS.DIFF_SOURCE),
	validate: buildEnqueue(JOB_KINDS.VALIDATE_REFERENCES),
};
