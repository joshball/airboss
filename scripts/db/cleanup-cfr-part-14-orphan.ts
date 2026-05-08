#!/usr/bin/env bun

/**
 * Delete the orphaned `(slug='14cfr14', edition='current')` row from
 * `study.reference` if it exists.
 *
 * Background: PR #682 dropped 14 CFR Part 14 (Equal Access to Justice Act)
 * from `course/references/cfr-titles.yaml` because it's off-corpus for
 * pilot training. The authoring side stopped producing it, but DBs that
 * had been seeded prior to that PR retained the row with empty metadata
 * (`{}`). The orphan surfaced on `/dev/cards` as a row missing both
 * required and recommended fields -- pure audit noise.
 *
 * This script removes the orphan once. It's idempotent: re-running on a
 * cleaned DB is a no-op. Running on a DB that never had the orphan is
 * also a no-op. The WHERE clause pins both `document_slug` and `edition`
 * so no other CFR rows can be affected.
 *
 * Usage:
 *   bun scripts/db/cleanup-cfr-part-14-orphan.ts
 *   bun scripts/db/cleanup-cfr-part-14-orphan.ts --dry-run
 *
 * Follow-up consideration (NOT in this script): the seeder doesn't yet
 * prune rows for CFR parts removed from `cfr-titles.yaml`. A general
 * "prune stale CFR refs" pass during seeding would prevent future
 * orphans of this shape. That's a separate design question.
 */

import { client, db as defaultDb } from '@ab/db/connection';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { reference } from '../../libs/bc/study/src/schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const ORPHAN_SLUG = '14cfr14';
const ORPHAN_EDITION = 'current';

export interface CleanupReport {
	rowFound: boolean;
	rowDeleted: boolean;
}

export async function cleanupCfrPart14Orphan(
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
	const report = await cleanupCfrPart14Orphan({ dryRun });
	const tag = dryRun ? '(dry-run) ' : '';
	if (!report.rowFound) {
		process.stdout.write(`${tag}cleanup-cfr-part-14-orphan: no orphan row found; nothing to do.\n`);
		return;
	}
	if (report.rowDeleted) {
		process.stdout.write(`${tag}cleanup-cfr-part-14-orphan: deleted (slug='14cfr14', edition='current') orphan row.\n`);
		return;
	}
	process.stdout.write(
		`${tag}cleanup-cfr-part-14-orphan: would delete (slug='14cfr14', edition='current') orphan row.\n`,
	);
}

if (import.meta.main) {
	main()
		.catch((err) => {
			process.stderr.write(`cleanup-cfr-part-14-orphan: ${(err as Error).stack ?? err}\n`);
			process.exitCode = 1;
		})
		.finally(() => client.end());
}
