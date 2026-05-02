/**
 * Dashboard count helpers. Each fn returns the live count for one tile on
 * the hangar admin home; per-call try/catch is left to the caller because
 * the home wraps every counter in a `safeCount` helper that defaults to 0
 * on failure.
 */

import { db as defaultDb } from '@ab/db/connection';
import { hangarJob } from '@ab/hangar-jobs';
import { and, count, isNotNull, isNull } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { hangarReference, hangarSource } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export async function countLiveSources(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(hangarSource).where(isNull(hangarSource.deletedAt));
	return Number(rows[0]?.c ?? 0);
}

export async function countLiveReferences(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(hangarReference).where(isNull(hangarReference.deletedAt));
	return Number(rows[0]?.c ?? 0);
}

/**
 * Count of live references that carry a verbatim source-exact block.
 *
 * Powers the "verbatim materialised" tile on `/sources`. Replaces a previous
 * regex sweep over `libs/aviation/src/references/aviation.ts` that ran on
 * every page load.
 */
export async function countVerbatimReferences(db: Db = defaultDb): Promise<number> {
	const rows = await db
		.select({ c: count() })
		.from(hangarReference)
		.where(and(isNull(hangarReference.deletedAt), isNotNull(hangarReference.verbatim)));
	return Number(rows[0]?.c ?? 0);
}

export async function countAllJobs(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(hangarJob);
	return Number(rows[0]?.c ?? 0);
}

/**
 * List all live (`deletedAt IS NULL`) sources, sorted by id. Drives the
 * `/sources` flow diagram's primary list.
 *
 * Slim column projection: the `/sources` page mapper only reads the columns
 * below, so pulling the full row (including `media`, `edition`,
 * `locatorShape` jsonb) on every page hit was wasted DB I/O + wire bytes
 * (chunk-6 perf MIN closure).
 */
export async function listLiveSources(db: Db = defaultDb) {
	return db
		.select({
			id: hangarSource.id,
			rev: hangarSource.rev,
			type: hangarSource.type,
			title: hangarSource.title,
			version: hangarSource.version,
			url: hangarSource.url,
			path: hangarSource.path,
			format: hangarSource.format,
			checksum: hangarSource.checksum,
			sizeBytes: hangarSource.sizeBytes,
			downloadedAt: hangarSource.downloadedAt,
			dirty: hangarSource.dirty,
			updatedAt: hangarSource.updatedAt,
		})
		.from(hangarSource)
		.where(isNull(hangarSource.deletedAt))
		.orderBy(hangarSource.id);
}
