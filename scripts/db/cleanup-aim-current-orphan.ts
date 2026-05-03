#!/usr/bin/env bun

/**
 * Delete the legacy `(slug='aim', edition='current')` orphan row from
 * `study.reference` if it exists.
 *
 * Background: prior to the references-cleanup-sweep, the legacy citation
 * migrator at `scripts/db/migrate-references-to-structured.ts` resolved
 * bare `AIM` citations to a synthetic `(aim, current)` row, while the
 * AIM seeder writes the real edition (`2026-04`). The orphan row sat on
 * `/library` as a dead card. The migrator now pins to `AIM_CURRENT_EDITION`,
 * so future migrations resolve to the authored row -- but any DB seeded
 * before that fix still has the orphan.
 *
 * This script removes the orphan once. It's idempotent: re-running on a
 * cleaned DB is a no-op. Running on a DB that never had the orphan is
 * also a no-op. No deletion of `aim/2026-04` (the real row) is possible
 * because the WHERE clause pins both `document_slug` and `edition`.
 *
 * Usage:
 *   bun scripts/db/cleanup-aim-current-orphan.ts
 *   bun scripts/db/cleanup-aim-current-orphan.ts --dry-run
 *
 * Run after `bun run db seed` whenever you suspect a legacy orphan; the
 * seed itself doesn't create one (the migrator did, and only on first
 * run from legacy citations).
 */

import { client, db as defaultDb } from '@ab/db/connection';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { reference } from '../../libs/bc/study/src/schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const ORPHAN_SLUG = 'aim';
const ORPHAN_EDITION = 'current';

export interface CleanupReport {
	rowFound: boolean;
	rowDeleted: boolean;
}

export async function cleanupAimCurrentOrphan(
	options: { dryRun?: boolean } = {},
	db: Db = defaultDb,
): Promise<CleanupReport> {
	const dryRun = options.dryRun ?? false;
	const existing = await db
		.select({ id: reference.id })
		.from(reference)
		.where(and(eq(reference.documentSlug, ORPHAN_SLUG), eq(reference.edition, ORPHAN_EDITION)))
		.limit(1);
	const found = existing.length > 0;
	if (!found || dryRun) {
		return { rowFound: found, rowDeleted: false };
	}
	await db.delete(reference).where(and(eq(reference.documentSlug, ORPHAN_SLUG), eq(reference.edition, ORPHAN_EDITION)));
	return { rowFound: true, rowDeleted: true };
}

async function main(): Promise<void> {
	const args = new Set(process.argv.slice(2));
	const dryRun = args.has('--dry-run');
	const report = await cleanupAimCurrentOrphan({ dryRun });
	const tag = dryRun ? '(dry-run) ' : '';
	if (!report.rowFound) {
		process.stdout.write(`${tag}cleanup-aim-current-orphan: no orphan row found; nothing to do.\n`);
		return;
	}
	if (report.rowDeleted) {
		process.stdout.write(`${tag}cleanup-aim-current-orphan: deleted (slug='aim', edition='current') orphan row.\n`);
		return;
	}
	process.stdout.write(`${tag}cleanup-aim-current-orphan: would delete (slug='aim', edition='current') orphan row.\n`);
}

if (import.meta.main) {
	main()
		.catch((err) => {
			process.stderr.write(`cleanup-aim-current-orphan: ${(err as Error).stack ?? err}\n`);
			process.exitCode = 1;
		})
		.finally(() => client.end());
}
