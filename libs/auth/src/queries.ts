/**
 * Read-only query helpers over `bauth_user`. Exposed so admin surfaces
 * (e.g. the hangar dashboard) never need to inline a Drizzle `db.select`
 * against the auth table -- they ask `@ab/auth` for the count.
 */

import { db as defaultDb } from '@ab/db/connection';
import { count } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { bauthUser } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Count of every row in `bauth_user`, including banned (and any
 * future-soft-deleted) accounts. Renamed from a plain `countAllUsers` to make
 * the inclusion explicit -- the hangar admin home tile can drift from "active
 * sessions" by the banned-row delta and the call-site name now documents that.
 */
export async function countAllUsersIncludingBanned(db: Db = defaultDb): Promise<number> {
	const rows = await db.select({ c: count() }).from(bauthUser);
	// drizzle's pg `count()` already returns a `number`; the previous `Number(...)`
	// cast was a no-op. Cast a `bigint` defensively in case a future driver swap
	// changes the shape, but otherwise pass the number through directly.
	const c = rows[0]?.c ?? 0;
	return typeof c === 'bigint' ? Number(c) : c;
}
