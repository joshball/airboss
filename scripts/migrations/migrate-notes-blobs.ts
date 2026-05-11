#!/usr/bin/env bun

/**
 * One-shot migrator: lift legacy `study.reference_section_read_state.notes_md`
 * blobs into `study.note` rows (wp-notes-primitive).
 *
 * Background: per-section single-blob notes (one row per `(user, section)`)
 * are superseded by `study.note` rows referencing the same `referenceSectionId`.
 * The dev seed regenerates from a clean schema so no data carries the old
 * column forward; this script exists so any non-dev environment that already
 * has populated `notes_md` rows can be lifted before the column is dropped.
 *
 * Usage on a populated DB (one-shot, before the schema regen drops the column):
 *
 *   bun scripts/migrations/migrate-notes-blobs.ts
 *   bun scripts/migrations/migrate-notes-blobs.ts --dry-run
 *   bun scripts/migrations/migrate-notes-blobs.ts --json
 *
 * The script reads the legacy `notes_md` column via raw SQL (the Drizzle
 * schema no longer carries the column once this WP lands), so it MUST be
 * run BEFORE the regenerated `0000_initial.sql` is applied if the column
 * needs to survive long enough for the lift. On greenfield envs the column
 * is gone before this script ever runs and it logs zero rows.
 *
 * Each lifted note carries `tags = ['migrated-from-blob']` so an admin can
 * find them later. No audit row is written: the BC `createNote` audit trail
 * is per-user, and the migrator runs as `system`, not as the affected user.
 */

import { NOTE_MIGRATED_FROM_BLOB_TAG } from '@ab/constants';
import { client, db as defaultDb } from '@ab/db/connection';
import { generateNoteId } from '@ab/utils';
import { sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { note } from '../../libs/bc/study/src/schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

interface MigrationSummary {
	scanned: number;
	migrated: number;
	skipped: number;
}

interface LegacyRow {
	user_id: string;
	reference_section_id: string;
	notes_md: string;
}

export async function migrateNotesBlobs(
	options: { dryRun?: boolean } = {},
	db: Db = defaultDb,
): Promise<MigrationSummary> {
	const dryRun = options.dryRun ?? false;
	let scanned = 0;
	let migrated = 0;
	let skipped = 0;

	// Probe the column: when the schema regen has already dropped it, return
	// a zero summary instead of raising. The script is meant to be safe to
	// re-run on greenfield envs.
	const colExists = await db.execute<{ exists: boolean }>(sql`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'study'
			  AND table_name = 'reference_section_read_state'
			  AND column_name = 'notes_md'
		) AS exists
	`);
	const present = colExists[0]?.exists ?? false;
	if (!present) {
		console.log('migrate-notes-blobs: `study.reference_section_read_state.notes_md` not found -- nothing to migrate.');
		return { scanned, migrated, skipped };
	}

	const rows = await db.execute<LegacyRow>(sql`
		SELECT user_id, reference_section_id, notes_md
		FROM study.reference_section_read_state
		WHERE notes_md IS NOT NULL AND notes_md != ''
	`);

	for (const row of rows) {
		scanned += 1;
		if (row.notes_md.trim().length === 0) {
			skipped += 1;
			continue;
		}
		if (dryRun) {
			migrated += 1;
			continue;
		}
		await db.insert(note).values({
			id: generateNoteId(),
			userId: row.user_id,
			bodyMd: row.notes_md,
			referenceSectionId: row.reference_section_id,
			tags: [NOTE_MIGRATED_FROM_BLOB_TAG],
		});
		migrated += 1;
	}

	return { scanned, migrated, skipped };
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const json = args.includes('--json');

	const summary = await migrateNotesBlobs({ dryRun });

	if (json) {
		console.log(JSON.stringify({ dryRun, ...summary }, null, 2));
	} else {
		console.log(`migrate-notes-blobs: dryRun=${dryRun}`);
		console.log(`  scanned:  ${summary.scanned}`);
		console.log(`  migrated: ${summary.migrated}`);
		console.log(`  skipped:  ${summary.skipped}`);
	}

	await client.end({ timeout: 5 });
}

if (import.meta.main) {
	main().catch((err) => {
		console.error('migrate-notes-blobs failed:', err);
		process.exit(1);
	});
}
