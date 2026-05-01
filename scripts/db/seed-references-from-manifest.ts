#!/usr/bin/env bun
/**
 * Reference seed phase (post-WP-SUB).
 *
 * Walks every `<corpus>/<doc>/<edition>/manifest.json` under the repo root
 * and dispatches on each manifest's `kind` discriminator:
 *
 *   - `kind: 'handbook'`   -> section-tree adapter (PHAK / AFH / AVWX).
 *                              Produces N reference_section rows in a
 *                              chapter/section/subsection tree, plus
 *                              per-section figure rows.
 *   - `kind: 'whole-doc'`  -> whole-doc adapter (post-#384 handbooks-extras
 *                              risk-mgmt / instructor / IFH / IPH / AMT-G /
 *                              AMT-P). Produces ONE reference_section row at
 *                              depth 0, level 'document'.
 *
 * Today this script only walks `handbooks/`. Future corpus WPs (AIM, CFR,
 * AC, ACS) extend `CORPUS_DIRS` so the same dispatch handles them; their
 * manifest schemas register additional members on `manifestSchema` (via
 * the discriminated union at `libs/bc/study/src/manifest-validation.ts`).
 *
 * Idempotent: a section whose content_hash matches the DB row is a no-op
 * (apart from refreshing scaffolding fields like ordinal / parent / locator).
 *
 * Wired into `bun run db seed handbooks` via `seed-all.ts` (the alias name
 * is preserved for muscle memory; the script handles every corpus type
 * underneath).
 *
 * Standalone usage:
 *
 *   bun scripts/db/seed-references-from-manifest.ts                       # all editions, all corpora
 *   bun scripts/db/seed-references-from-manifest.ts phak                  # one document slug
 *   bun scripts/db/seed-references-from-manifest.ts phak FAA-H-8083-25C   # one edition
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Manifest, manifestSchema } from '@ab/bc-study';
import { client } from '@ab/db/connection';
// Build helpers live in the references BC but aren't re-exported from the
// barrel (route handlers should never need them; only seed code does).
import { attachSupersededByLatest } from '../../libs/bc/study/src/references';
import { seedSectionTreeManifest } from '../../libs/bc/study/src/seeders/section-tree';
import { type SeedContext, type SeedSummary, emptySummary } from '../../libs/bc/study/src/seeders/types';
import { seedWholeDocManifest } from '../../libs/bc/study/src/seeders/whole-doc';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Top-level corpus directories the seeder walks. Each entry is a directory
 * relative to the repo root; the seeder enumerates `<dir>/<doc>/<edition>/
 * manifest.json` under it. Add new corpora here as their WPs land.
 */
const CORPUS_DIRS = ['handbooks'] as const;

export interface SeedReferencesOptions {
	/** Filter to a single document slug (e.g. `phak`). Default = all. */
	documentSlug?: string;
	/** Filter to a single edition tag (e.g. `FAA-H-8083-25C`). Requires documentSlug. */
	edition?: string;
	/** Optional dev-seed marker; production runs leave this null. */
	seedOrigin?: string | null;
}

export type SeedReferencesSummary = SeedSummary;

/** Walk every CORPUS_DIRS tree and upsert references + sections. */
export async function seedReferencesFromManifest(
	options: SeedReferencesOptions = {},
): Promise<SeedReferencesSummary> {
	const summary = emptySummary();
	const context: SeedContext = {
		repoRoot: REPO_ROOT,
		seedOrigin: options.seedOrigin ?? null,
	};

	for (const corpusDir of CORPUS_DIRS) {
		const corpusAbs = resolve(REPO_ROOT, corpusDir);
		if (!existsSync(corpusAbs)) continue;

		const documentSlugs = options.documentSlug ? [options.documentSlug] : listChildDirs(corpusAbs);

		for (const slug of documentSlugs) {
			const slugDir = resolve(corpusAbs, slug);
			if (!existsSync(slugDir) || !statSync(slugDir).isDirectory()) continue;

			const editions = options.edition ? [options.edition] : listChildDirs(slugDir);
			const seededReferenceIds: string[] = [];
			for (const edition of editions) {
				const manifestPath = resolve(slugDir, edition, 'manifest.json');
				if (!existsSync(manifestPath)) continue;
				const refId = await dispatchManifest(manifestPath, context, summary);
				seededReferenceIds.push(refId);
			}
			// Wire `superseded_by_id` chains for this document slug (only when we
			// processed > 1 edition this run; otherwise leave existing pointers
			// untouched).
			if (seededReferenceIds.length > 1) {
				const latestId = seededReferenceIds[seededReferenceIds.length - 1];
				await attachSupersededByLatest(slug, latestId);
				summary.supersededLinks += seededReferenceIds.length - 1;
			}
		}
	}

	return summary;
}

/** Parse one manifest, dispatch on `kind`, return the upserted reference id. */
async function dispatchManifest(
	manifestPath: string,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string> {
	const raw = JSON.parse(await readFile(manifestPath, 'utf-8'));
	const manifest: Manifest = manifestSchema.parse(raw);

	switch (manifest.kind) {
		case 'handbook':
			return seedSectionTreeManifest(manifest, context, summary);
		case 'whole-doc':
			return seedWholeDocManifest(manifest, context, summary);
	}
}

function listChildDirs(dir: string): string[] {
	return readdirSync(dir).filter((name) => {
		const full = resolve(dir, name);
		try {
			return statSync(full).isDirectory();
		} catch {
			return false;
		}
	});
}

// CLI entry point.
if (import.meta.main) {
	const [doc, edition] = process.argv.slice(2);
	console.log('seed: references (handbook section-tree + whole-doc)');
	try {
		const summary = await seedReferencesFromManifest({ documentSlug: doc, edition });
		console.log(
			`done: ${summary.editionsProcessed} editions, ${summary.sectionsTouched} sections (${summary.sectionsChanged} changed), ${summary.figuresWritten} figures, ${summary.supersededLinks} superseded links.`,
		);
	} finally {
		await client.end();
	}
}
