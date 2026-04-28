/**
 * `createdBy` + `updatedBy` actor columns keyed to `bauth_user.id`.
 *
 * Lives in `@ab/auth` (not `@ab/db`) so the helper sits next to the
 * `bauthUser` schema it references. `@ab/db` stays a pure connection /
 * dialect-helper lib with no auth coupling.
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

import { text } from 'drizzle-orm/pg-core';
import { bauthUser } from './schema';

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
