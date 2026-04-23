/**
 * Reusable column-fragment helpers for Drizzle tables.
 *
 * The study schema already ships `createdAt` / `updatedAt` pairs on every
 * mutable row, plus actor columns on tables that need an authorship trail.
 * The shapes are identical across tables (withTimezone, defaultNow, onUpdate)
 * but were copy-pasted. These helpers consolidate the shape so new tables
 * get the correct defaults by default, and existing tables can migrate in
 * a later wave.
 *
 * Wave 1 adds the helpers. It does NOT refactor existing tables to use them
 * -- that lands in Wave 2 so one schema change, one migration, one review.
 *
 * ## Usage
 *
 *   import { timestamps, auditColumns } from '@ab/db';
 *
 *   export const myThing = schema.table('my_thing', {
 *     id: text('id').primaryKey(),
 *     name: text('name').notNull(),
 *     ...timestamps(),        // createdAt + updatedAt
 *     ...auditColumns(),      // createdBy + updatedBy (opt-in)
 *   });
 *
 * Both helpers return an object literal so the call sites stay greppable
 * (`timestamps()`, `auditColumns()`) and the returned columns keep their
 * full Drizzle typing -- no `as` cast, no widened `PgColumn` -- so
 * downstream `InferSelectModel` / `InferInsertModel` work as usual.
 */

import { bauthUser } from '@ab/auth/schema';
import { text, timestamp } from 'drizzle-orm/pg-core';

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
 * `createdBy` + `updatedBy` actor columns keyed to `bauth_user.id`.
 *
 * Opt-in: apply only to tables where authorship matters for UI / audit
 * ("which user saved this content?"). Both FKs are NOT NULL with
 * `onDelete: 'restrict'` so a user can't be removed while rows still cite
 * them -- if that becomes painful, the migration that introduces the
 * column can start with `set null` and tighten later.
 *
 * For system-owned writes (migrations, scheduled jobs) the caller still
 * needs a synthetic user row to satisfy the NOT NULL. If that's onerous
 * enough to matter, prefer the audit log's nullable `actor_id` pattern
 * instead.
 *
 * Spread into a table definition: `...auditColumns()`.
 */
export function auditColumns() {
	return {
		createdBy: text('created_by')
			.references(() => bauthUser.id, { onDelete: 'restrict', onUpdate: 'cascade' })
			.notNull(),
		updatedBy: text('updated_by')
			.references(() => bauthUser.id, { onDelete: 'restrict', onUpdate: 'cascade' })
			.notNull(),
	};
}
