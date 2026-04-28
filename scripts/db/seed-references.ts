#!/usr/bin/env bun
/**
 * Reference seed phase for non-handbook references (ACS / PTS / companion
 * guide / endorsement-source publications).
 *
 * Reads `course/references/*.yaml` and upserts one `study.reference` row
 * per `(slug, edition)` pair. Idempotent: re-running with no changes is a
 * no-op apart from updated_at refresh.
 *
 * Handbook references are seeded separately by `scripts/db/seed-handbooks.ts`;
 * this script appends the ACS / PTS / endorsement-source rows the
 * cert-syllabus WP requires.
 *
 * Usage:
 *   bun scripts/db/seed-references.ts          # seed every YAML
 *   bun scripts/db/seed-references.ts <file>   # seed one file
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_KIND_VALUES, type ReferenceKind } from '@ab/constants';
import { upsertReference } from '../../libs/bc/study/src/handbooks';
import { parse } from 'yaml';
import { z } from 'zod';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const REFERENCES_DIR = resolve(REPO_ROOT, 'course/references');

const referenceEntrySchema = z.object({
	slug: z
		.string()
		.min(3)
		.max(32)
		.regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
	kind: z.enum(REFERENCE_KIND_VALUES as [ReferenceKind, ...ReferenceKind[]]),
	edition: z.string().min(1).max(64),
	title: z.string().min(1),
	publisher: z.string().optional(),
	url: z.string().url().optional(),
});

const referencesFileSchema = z.object({
	references: z.array(referenceEntrySchema).min(1),
});

export interface SeedReferencesOptions {
	/** Optional dev-seed marker; production runs leave this null. */
	seedOrigin?: string | null;
	/** Filter to one YAML file. Default = walk every YAML in `course/references/`. */
	filename?: string;
}

export interface SeedReferencesSummary {
	filesRead: number;
	rowsUpserted: number;
}

/** Walk `course/references/*.yaml` and upsert every entry. */
export async function seedReferences(options: SeedReferencesOptions = {}): Promise<SeedReferencesSummary> {
	if (!existsSync(REFERENCES_DIR)) {
		throw new Error(`references directory not found: ${REFERENCES_DIR}`);
	}

	const summary: SeedReferencesSummary = { filesRead: 0, rowsUpserted: 0 };
	const filenames = options.filename
		? [options.filename]
		: readdirSync(REFERENCES_DIR)
				.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
				.sort();

	for (const filename of filenames) {
		const path = resolve(REFERENCES_DIR, filename);
		if (!existsSync(path) || !statSync(path).isFile()) {
			throw new Error(`references file not found: ${path}`);
		}
		const raw = await readFile(path, 'utf8');
		const parsed = parse(raw);
		const validated = referencesFileSchema.parse(parsed);
		summary.filesRead += 1;
		for (const entry of validated.references) {
			await upsertReference({
				kind: entry.kind,
				documentSlug: entry.slug,
				edition: entry.edition,
				title: entry.title,
				publisher: entry.publisher ?? 'FAA',
				url: entry.url ?? null,
				seedOrigin: options.seedOrigin ?? null,
			});
			summary.rowsUpserted += 1;
		}
	}

	return summary;
}

async function main(): Promise<void> {
	const arg = process.argv[2];
	const summary = await seedReferences(arg !== undefined ? { filename: arg } : {});
	process.stdout.write(`seed-references: ${summary.rowsUpserted} rows from ${summary.filesRead} file(s)\n`);
}

if (import.meta.main) {
	main().catch((err) => {
		process.stderr.write(`seed-references: ${(err as Error).stack ?? err}\n`);
		process.exit(1);
	});
}
