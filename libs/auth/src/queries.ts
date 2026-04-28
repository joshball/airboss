/**
 * Read-only query helpers over `bauth_user`. Exposed so admin surfaces
 * (e.g. the hangar dashboard) never need to inline a Drizzle `db.select`
 * against the auth table -- they ask `@ab/auth` for the count.
 */

import { db as defaultDb } from '@ab/db';
import { count } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { bauthUser } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/** Count of all `bauth_user` rows (no filter). */
export async function countAllUsers(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(bauthUser);
	return Number(rows[0]?.c ?? 0);
}
