/**
 * Read-side helpers around `hangar.job`. Exposed so route loaders never call
 * `db.select().from(hangarJob)` directly -- the BC owns the query shape.
 */

import { type JOB_KINDS, JOB_STATUSES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type HangarJobRow, hangarJob } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Most-recent N jobs for a target id, newest first. Drives the "recent
 * activity" panel on `/sources/[id]`.
 */
export async function listRecentJobsForTarget(
	targetId: string,
	limit: number,
	db: Db = defaultDb,
): Promise<readonly HangarJobRow[]> {
	return db
		.select()
		.from(hangarJob)
		.where(eq(hangarJob.targetId, targetId))
		.orderBy(desc(hangarJob.createdAt))
		.limit(limit);
}

/**
 * Single non-terminal (queued or running) job for a target. Used by every
 * source-detail action to refuse a duplicate enqueue with a clean 409.
 */
export async function getActiveJobForTarget(targetId: string, db: Db = defaultDb): Promise<HangarJobRow | undefined> {
	const [row] = await db
		.select()
		.from(hangarJob)
		.where(
			and(eq(hangarJob.targetId, targetId), inArray(hangarJob.status, [JOB_STATUSES.QUEUED, JOB_STATUSES.RUNNING])),
		)
		.orderBy(desc(hangarJob.createdAt))
		.limit(1);
	return row;
}

/**
 * Latest `complete` job for a given kind. Drives the "last validation /
 * last scan / last diff" surfaces on `/sources` and `/sources/[id]/diff`.
 */
export async function getLatestCompleteJobByKind(
	kind: (typeof JOB_KINDS)[keyof typeof JOB_KINDS],
	db: Db = defaultDb,
): Promise<HangarJobRow | undefined> {
	const [row] = await db
		.select()
		.from(hangarJob)
		.where(and(eq(hangarJob.kind, kind), eq(hangarJob.status, JOB_STATUSES.COMPLETE)))
		.orderBy(desc(hangarJob.finishedAt))
		.limit(1);
	return row;
}

/**
 * Latest `complete` job of a given kind scoped to one target. Drives the
 * `/sources/[id]/diff` "most recent diff for this source" lookup.
 */
export async function getLatestCompleteJobForTarget(
	kind: (typeof JOB_KINDS)[keyof typeof JOB_KINDS],
	targetId: string,
	db: Db = defaultDb,
): Promise<HangarJobRow | undefined> {
	const [row] = await db
		.select()
		.from(hangarJob)
		.where(and(eq(hangarJob.kind, kind), eq(hangarJob.targetId, targetId), eq(hangarJob.status, JOB_STATUSES.COMPLETE)))
		.orderBy(desc(hangarJob.finishedAt))
		.limit(1);
	return row;
}

/**
 * Currently-running jobs across the registry, newest first. Drives the
 * `/sources` flow diagram's "active arrows" overlay.
 */
export async function listRunningJobs(db: Db = defaultDb): Promise<readonly HangarJobRow[]> {
	return db
		.select()
		.from(hangarJob)
		.where(eq(hangarJob.status, JOB_STATUSES.RUNNING))
		.orderBy(desc(hangarJob.startedAt));
}
