#!/usr/bin/env bun
/**
 * Course-primitive WP, Phase 7 -- defensive diagnostic.
 *
 * Lists every `study.syllabus` row whose `kind` is `school` or `personal`.
 * Per the spec ("Migration guard" / "Existing `syllabus.kind='school'` and
 * `'personal'` rows" subsection), pre-existing research confirmed zero such
 * rows in shipped data; the diagnostic exists so that if any surface later
 * the human can decide per-row whether to leave them, archive them, or
 * hand-migrate to `study.course`. There is no automatic data migration.
 *
 * Output is informational, never a gate -- exits 0 in both the empty and
 * non-empty cases so the dispatcher can pipe it from `bun run db
 * diagnose:school-personal-syllabi` without short-circuiting downstream
 * commands.
 *
 * Usage:
 *   bun scripts/db/diagnose-school-personal-syllabi.ts
 */

import { syllabus } from '@ab/bc-study';
import { client, db } from '@ab/db/connection';
import { asc, inArray } from 'drizzle-orm';

const TARGET_KINDS: readonly string[] = ['school', 'personal'];

async function main(): Promise<void> {
	const rows = await db
		.select({
			id: syllabus.id,
			slug: syllabus.slug,
			kind: syllabus.kind,
			title: syllabus.title,
			edition: syllabus.edition,
			createdAt: syllabus.createdAt,
		})
		.from(syllabus)
		.where(inArray(syllabus.kind, [...TARGET_KINDS]))
		.orderBy(asc(syllabus.createdAt), asc(syllabus.slug));

	if (rows.length === 0) {
		process.stdout.write(`0 row(s) found with kind IN ('school','personal').\n`);
		await client.end();
		return;
	}

	process.stdout.write(`${rows.length} row(s) found with kind IN ('school','personal'):\n`);
	for (const r of rows) {
		const createdIso = r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt);
		process.stdout.write(`${r.id} | ${r.slug} | ${r.kind} | ${r.title} | ${r.edition} | ${createdIso}\n`);
	}

	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
