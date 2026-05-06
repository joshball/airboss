/**
 * Reusable column-fragment helpers for Drizzle tables.
 *
 * The study schema already ships `createdAt` / `updatedAt` pairs on every
 * mutable row. Tables that need an authorship trail import `auditColumns`
 * from `@ab/auth` (it lives next to `bauthUser` so `@ab/db` stays free of
 * any auth dependency).
 *
 * ## Usage
 *
 *   import { timestamps } from '@ab/db';
 *   import { auditColumns } from '@ab/auth';
 *
 *   export const myThing = schema.table('my_thing', {
 *     id: text('id').primaryKey(),
 *     name: text('name').notNull(),
 *     ...timestamps(),        // createdAt + updatedAt
 *     ...auditColumns(),      // createdBy + updatedBy (opt-in, requires @ab/auth)
 *   });
 *
 * The helper returns an object literal so the call site stays greppable
 * (`timestamps()`) and the returned columns keep their full Drizzle
 * typing -- no `as` cast, no widened `PgColumn` -- so downstream
 * `InferSelectModel` / `InferInsertModel` work as usual.
 */

import { timestamp } from 'drizzle-orm/pg-core';

/**
 * `createdAt` + `updatedAt` pair used by every mutable table.
 *
 *   - Both `timestamptz`, `defaultNow()`, `notNull()`.
 *   - `updatedAt.$onUpdate(() => new Date())` so Drizzle bumps it on every
 *     update. Answers the "when did this projection last change" question
 *     independent of domain columns like `lastReviewedAt`.
 *
 * Spread into a table definition: `...timestamps()`.
 */
export function timestamps() {
	return {
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	};
}

/**
 * Serialize a string array as a SQL `IN (...)` value list for embedding in
 * a CHECK constraint. Single quotes are escaped; the result is interpolated
 * between `IN (` and `)` in `sql.raw(...)` calls.
 *
 * Consolidated here per the 2026-05-06 schema review §I -- the same
 * one-line helper was duplicated across six schema files (audit, sources,
 * hangar-jobs, bc/study, bc/study/citations, bc/hangar). Drift risk on the
 * function itself was nil, but the cross-file repetition was a smell.
 *
 * Usage:
 *
 *   import { inList } from '@ab/db';
 *   check('foo_check', sql.raw(`"col" IN (${inList(FOO_VALUES)})`)),
 */
export function inList(values: readonly string[]): string {
	return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
}
