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
 *   - `kind: 'aim'`        -> AIM adapter. Walks a flat entries[] and builds
 *                              the chapter/section/paragraph tree from
 *                              dotted code prefixes; appendices + glossary
 *                              entries land at depth 0 alongside chapters.
 *
 * Today this script walks `handbooks/` and `aim/`. Future corpus WPs (CFR,
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
import { seedAcManifest } from '../../libs/bc/study/src/seeders/ac';
import { seedAimManifest } from '../../libs/bc/study/src/seeders/aim';
import { seedSectionTreeManifest } from '../../libs/bc/study/src/seeders/section-tree';
import { emptySummary, type SeedContext, type SeedSummary } from '../../libs/bc/study/src/seeders/types';
import { seedWholeDocManifest } from '../../libs/bc/study/src/seeders/whole-doc';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

/**
 * Top-level corpus directories the seeder walks. Each entry is a directory
 * relative to the repo root; the seeder enumerates `<dir>/<doc>/<edition>/
 * manifest.json` under it. Add new corpora here as their WPs land.
 */
const CORPUS_DIRS = ['handbooks', 'aim', 'ac'] as const;

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
export async function seedReferencesFromManifest(options: SeedReferencesOptions = {}): Promise<SeedReferencesSummary> {
	const summary = emptySummary();
	const context: SeedContext = {
		repoRoot: REPO_ROOT,
		seedOrigin: options.seedOrigin ?? null,
		onProgress: (line) => console.log(line),
	};

	for (const corpusDir of CORPUS_DIRS) {
		const corpusAbs = resolve(REPO_ROOT, corpusDir);
		if (!existsSync(corpusAbs)) continue;

		// Two supported layouts coexist within a corpus:
		//   (a) Multi-doc:  <corpus>/<slug>/<edition>/manifest.json  (handbooks)
		//   (b) Single-doc: <corpus>/<edition>/manifest.json         (aim)
		// We walk the first-level children and decide per-child: if the child
		// directly contains `manifest.json`, treat it as a single-doc edition;
		// otherwise treat it as a slug and recurse one level deeper for editions.
		// This lets test fixtures and real corpora cohabit cleanly.
		const firstLevelDirs = listChildDirs(corpusAbs);

		// Group editions by effective document slug so supersede chains span
		// every edition seen for the same logical document.
		const slugToEditionRefIds = new Map<string, string[]>();

		for (const childDir of firstLevelDirs) {
			const childAbs = resolve(corpusAbs, childDir);
			if (!statSync(childAbs).isDirectory()) continue;

			const childManifest = resolve(childAbs, 'manifest.json');
			if (existsSync(childManifest)) {
				// Single-doc layout: childDir is the edition; effective slug is the corpus dir.
				if (options.edition !== undefined && options.edition !== childDir) continue;
				if (options.documentSlug !== undefined && options.documentSlug !== corpusDir) continue;
				const refId = await dispatchManifest(childManifest, context, summary);
				const list = slugToEditionRefIds.get(corpusDir) ?? [];
				list.push(refId);
				slugToEditionRefIds.set(corpusDir, list);
				continue;
			}

			// Multi-doc layout: childDir is the slug; iterate edition subdirs.
			if (options.documentSlug !== undefined && options.documentSlug !== childDir) continue;
			const editions = options.edition ? [options.edition] : listChildDirs(childAbs);
			for (const edition of editions) {
				const manifestPath = resolve(childAbs, edition, 'manifest.json');
				if (!existsSync(manifestPath)) continue;
				const refId = await dispatchManifest(manifestPath, context, summary);
				const list = slugToEditionRefIds.get(childDir) ?? [];
				list.push(refId);
				slugToEditionRefIds.set(childDir, list);
			}
		}

		// Wire `superseded_by_id` chains per slug (only when > 1 edition seen).
		for (const [slug, refIds] of slugToEditionRefIds) {
			if (refIds.length <= 1) continue;
			const latestId = refIds[refIds.length - 1];
			if (latestId === undefined) continue;
			await attachSupersededByLatest(slug, latestId);
			summary.supersededLinks += refIds.length - 1;
		}
	}

	return summary;
}

/** Parse one manifest, dispatch on `kind`, return the upserted reference id. */
async function dispatchManifest(manifestPath: string, context: SeedContext, summary: SeedSummary): Promise<string> {
	const raw = JSON.parse(await readFile(manifestPath, 'utf-8'));
	const manifest: Manifest = manifestSchema.parse(raw);

	switch (manifest.kind) {
		case 'handbook':
			return seedSectionTreeManifest(manifest, context, summary);
		case 'whole-doc':
			return seedWholeDocManifest(manifest, context, summary);
		case 'aim':
			return seedAimManifest(manifest, context, summary);
		case 'ac':
			return seedAcManifest(manifest, context, summary);
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
