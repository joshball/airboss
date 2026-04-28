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
