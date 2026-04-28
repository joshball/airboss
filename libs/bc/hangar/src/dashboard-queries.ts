/**
 * Dashboard count helpers. Each fn returns the live count for one tile on
 * the hangar admin home; per-call try/catch is left to the caller because
 * the home wraps every counter in a `safeCount` helper that defaults to 0
 * on failure.
 */

import { db as defaultDb } from '@ab/db';
import { count, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { hangarJob, hangarReference, hangarSource } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export async function countLiveSources(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(hangarSource).where(isNull(hangarSource.deletedAt));
	return Number(rows[0]?.c ?? 0);
}

export async function countLiveReferences(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(hangarReference).where(isNull(hangarReference.deletedAt));
	return Number(rows[0]?.c ?? 0);
}

export async function countAllJobs(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(hangarJob);
	return Number(rows[0]?.c ?? 0);
}

/**
 * List all live (`deletedAt IS NULL`) sources, sorted by id. Drives the
 * `/sources` flow diagram's primary list.
 */
export async function listLiveSources(db: Db = defaultDb) {
	return db.select().from(hangarSource).where(isNull(hangarSource.deletedAt)).orderBy(hangarSource.id);
}
