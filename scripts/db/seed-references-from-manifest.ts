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
 *                              risk-mgmt / instructor / IFH / IPH /
 *                              mtn-tips). Produces ONE reference_section row
 *                              at depth 0, level 'document'.
 *   - `kind: 'aim'`        -> AIM adapter. Walks a flat entries[] and builds
 *                              the chapter/section/paragraph tree from
 *                              dotted code prefixes; appendices + glossary
 *                              entries land at depth 0 alongside chapters.
 *   - `kind: 'ac'`         -> AC adapter (Advisory Circulars). One body
 *                              row at depth 0 per AC; subjects + primary_cert
 *                              come from `course/references/advisory-circulars.yaml`.
 *   - `kind: 'cfr'`        -> CFR adapter (WP-CFR). Walks the sibling
 *                              sections.json; produces N reference rows
 *                              (one per Part with a matching YAML row) plus
 *                              one `reference_section` per section (depth 0,
 *                              level 'section', flat under the reference).
 *   - `kind: 'acs'`        -> ACS adapter (WP-ACS-V). Produces ONE reference
 *                              row per publication plus a 4-level tree:
 *                              publication (depth 0) -> areas (depth 1) ->
 *                              tasks (depth 2) -> elements (depth 3).
 *                              Deepest tree shipped to date.
 *   - `kind: 'ntsb-alj'`   -> NTSB-ALJ ruling adapter (WP-NTSB-ALJ). Produces
 *                              ONE reference row per ruling plus a 1- or
 *                              2-level tree: document (depth 0) optionally
 *                              with five locked opinion-section children at
 *                              depth 1 (Findings of Fact / Conclusions of
 *                              Law / Order / Discussion / Final). Sections
 *                              array empty = whole-doc; non-empty = section-
 *                              tree.
 *
 * Today this script walks `handbooks/`, `aim/`, `ac/`, `regulations/`, `acs/`,
 * and `ntsb-alj/`. Future corpus WPs extend `CORPUS_DIRS` and add a
 * discriminator member on `manifestSchema` (via the discriminated union at
 * `libs/bc/study/src/manifest-validation.ts`).
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
import { attachSupersededByLatest, type Manifest, manifestSchema } from '@ab/bc-study/build';
import { client } from '@ab/db/connection';
import { seedAcManifest } from '../../libs/bc/study/src/seeders/ac';
import { seedAcsManifest } from '../../libs/bc/study/src/seeders/acs';
import { seedAimManifest } from '../../libs/bc/study/src/seeders/aim';
import { seedCfrManifest } from '../../libs/bc/study/src/seeders/cfr';
import { seedInfoManifest } from '../../libs/bc/study/src/seeders/info';
import { seedNtsbAljManifest } from '../../libs/bc/study/src/seeders/ntsb-alj';
import { seedSafoManifest } from '../../libs/bc/study/src/seeders/safo';
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
const CORPUS_DIRS = ['handbooks', 'aim', 'ac', 'regulations', 'acs', 'safo', 'info', 'ntsb-alj'] as const;

/**
 * Corpora where the single-doc layout (`<corpus>/<child>/manifest.json`)
 * means each `<child>` is its own logical document (and supersede grouping
 * should key on `<child>`, not on `<corpus>`). ACS is the canonical case --
 * each ACS publication has its own slug under `acs/<slug>/`. AIM, by
 * contrast, treats `aim/<edition>/` as editions of one logical document
 * (slug = `aim`). SAFOs and InFOs follow the ACS convention: each bulletin
 * id under `safo/<id>/` is its own logical document (immutable post-
 * publication, no edition grouping). Listed by membership rather than
 * auto-detected so the convention stays explicit.
 */
const SINGLE_DOC_KEY_BY_CHILD: ReadonlySet<string> = new Set(['acs', 'safo', 'info']);

/**
 * Corpora that are rolling publications (not editioned): the dispatcher
 * keeps only the lexicographically-latest on-disk edition and ignores any
 * older snapshots that may still be on disk from a previous ingest. This
 * matches the per-adapter contract -- e.g. the CFR adapter writes to a
 * single `(document_slug, edition='current')` row regardless of which
 * eCFR snapshot date the manifest declares, so seeding two CFR editions
 * back-to-back would clobber the same DB row twice (and crash on missing
 * body files for the older snapshot, which the dev's `.gitignore` keeps
 * out of the repo per ADR 018). Listed by corpus dir name; expand only when
 * a new corpus uses the same rolling-edition convention.
 */
const ROLLING_EDITION_CORPORA: ReadonlySet<string> = new Set(['regulations']);

export interface SeedReferencesOptions {
	/** Filter to a single document slug (e.g. `phak`). Default = all. */
	documentSlug?: string;
	/** Filter to a single edition tag (e.g. `FAA-H-8083-25C`). Requires documentSlug. */
	edition?: string;
	/** Optional dev-seed marker; production runs leave this null. */
	seedOrigin?: string | null;
	/**
	 * Status-line callback, called once per edition with a short detail string
	 * the orchestrator displays as the in-place spinner detail. The verbose
	 * per-edition line still goes to the per-phase log via `console.log`; this
	 * gives the user something live to look at without scroll spam.
	 */
	progress?: (detail: string) => void;
}

export type SeedReferencesSummary = SeedSummary;

/** Walk every CORPUS_DIRS tree and upsert references + sections. */
export async function seedReferencesFromManifest(options: SeedReferencesOptions = {}): Promise<SeedReferencesSummary> {
	const summary = emptySummary();
	let editionsSeen = 0;
	const context: SeedContext = {
		repoRoot: REPO_ROOT,
		seedOrigin: options.seedOrigin ?? null,
		onProgress: (line) => {
			// Verbose per-edition line goes to the log.
			console.log(line);
			// Status line gets a tighter rendering: "(N) phak FAA-H-8083-25C: 855 sections...".
			editionsSeen += 1;
			if (options.progress) {
				options.progress(`(${editionsSeen}) ${line.trim()}`);
			}
		},
	};

	// Run each corpus in parallel: distinct corpora write to disjoint
	// `(document_slug, edition)` row sets in `study.reference`, and the
	// supersede-chain step at the end of each corpus only reads its own
	// per-corpus map. Sections inside a corpus stay serialized (the
	// reference-section index cache fills the win there). Each corpus
	// receives its own per-corpus summary which we reduce into the shared
	// total at the end so accumulation stays race-free.
	const perCorpus = await Promise.all(
		CORPUS_DIRS.map((corpusDir) =>
			seedOneCorpus(corpusDir, context, options).catch((err) => {
				throw new Error(`seedReferencesFromManifest: corpus '${corpusDir}' failed: ${(err as Error).message}`);
			}),
		),
	);
	for (const partial of perCorpus) {
		summary.editionsProcessed += partial.editionsProcessed;
		summary.sectionsTouched += partial.sectionsTouched;
		summary.sectionsChanged += partial.sectionsChanged;
		summary.figuresWritten += partial.figuresWritten;
		summary.supersededLinks += partial.supersededLinks;
	}
	return summary;
}

async function seedOneCorpus(
	corpusDir: string,
	context: SeedContext,
	options: SeedReferencesOptions,
): Promise<SeedSummary> {
	const summary = emptySummary();
	const corpusAbs = resolve(REPO_ROOT, corpusDir);
	if (!existsSync(corpusAbs)) return summary;
	{
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
				// Single-doc layout. Two sub-conventions:
				//   - default (AIM): childDir is the edition; effective slug = corpus dir.
				//   - per-child (ACS): childDir is the slug; one publication per child.
				// `SINGLE_DOC_KEY_BY_CHILD` encodes the per-child convention.
				const keyByChild = SINGLE_DOC_KEY_BY_CHILD.has(corpusDir);
				const effectiveSlug = keyByChild ? childDir : corpusDir;
				if (options.documentSlug !== undefined && options.documentSlug !== effectiveSlug) continue;
				if (!keyByChild && options.edition !== undefined && options.edition !== childDir) continue;
				const refIds = await dispatchManifest(childManifest, context, summary);
				const list = slugToEditionRefIds.get(effectiveSlug) ?? [];
				list.push(...refIds);
				slugToEditionRefIds.set(effectiveSlug, list);
				continue;
			}

			// Multi-doc layout: childDir is the slug; iterate edition subdirs.
			if (options.documentSlug !== undefined && options.documentSlug !== childDir) continue;
			const editions = pickEditions({
				corpusDir,
				childAbs,
				explicitEdition: options.edition,
			});
			for (const edition of editions) {
				const manifestPath = resolve(childAbs, edition, 'manifest.json');
				if (!existsSync(manifestPath)) continue;
				const refIds = await dispatchManifest(manifestPath, context, summary);
				const list = slugToEditionRefIds.get(childDir) ?? [];
				list.push(...refIds);
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

/**
 * Parse one manifest, dispatch on `kind`, return the upserted reference ids.
 *
 * Most adapters (handbook / whole-doc / aim / ac) produce exactly one
 * `reference` row per manifest and return a single string; the CFR adapter
 * produces N rows (one per Part with a matching DB row) and returns an
 * array. The dispatcher uniformizes the contract by wrapping single-result
 * adapters into one-element arrays so the caller's slug-to-edition collector
 * always sees `string[]`.
 */
async function dispatchManifest(manifestPath: string, context: SeedContext, summary: SeedSummary): Promise<string[]> {
	const raw = JSON.parse(await readFile(manifestPath, 'utf-8'));
	const manifest: Manifest = manifestSchema.parse(raw);

	switch (manifest.kind) {
		case 'handbook':
			return [await seedSectionTreeManifest(manifest, context, summary)];
		case 'whole-doc':
			return [await seedWholeDocManifest(manifest, context, summary)];
		case 'aim':
			return [await seedAimManifest(manifest, context, summary)];
		case 'ac':
			return [await seedAcManifest(manifest, context, summary)];
		case 'cfr':
			return seedCfrManifest(manifest, { manifestAbsPath: manifestPath }, context, summary);
		case 'acs':
			return [await seedAcsManifest(manifest, context, summary)];
		case 'safo':
			return [await seedSafoManifest(manifest, context, summary)];
		case 'info':
			return [await seedInfoManifest(manifest, context, summary)];
		case 'ntsb-alj':
			return [await seedNtsbAljManifest(manifest, context, summary)];
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

interface PickEditionsArgs {
	readonly corpusDir: string;
	readonly childAbs: string;
	readonly explicitEdition: string | undefined;
}

/**
 * Resolve which edition subdirs the multi-doc dispatcher should walk.
 *
 * Default: every edition under the slug (the supersede-chain logic at the
 * caller wires older editions to the newest).
 *
 * Rolling-publication corpora (CFR per ADR 019): pick only the
 * lexicographically-latest edition. CFR seeds write to a single
 * `(document_slug, edition='current')` DB row regardless of which on-disk
 * snapshot date the manifest declares -- so seeding two editions back-to-back
 * would clobber the same row twice and crash on the older snapshot's missing
 * body files (kept out of the repo by `.gitignore` per ADR 018). YYYY-MM-DD
 * sorts chronologically, so `.sort().at(-1)` picks the newest snapshot.
 *
 * Explicit `--edition=` overrides everything: the caller is asking for a
 * specific edition by name and we trust them.
 */
export function pickEditions(args: PickEditionsArgs): string[] {
	if (args.explicitEdition !== undefined) return [args.explicitEdition];
	// Sibling dirs starting with `_` are reserved for non-edition siblings of
	// the on-disk edition snapshots (e.g. `regulations/cfr-14/_authoring/`
	// added in PR #670). They never carry a `manifest.json` and would silently
	// shadow the real edition under the rolling-publication latest-wins
	// selector below.
	const all = listChildDirs(args.childAbs).filter((name) => !name.startsWith('_'));
	// Sort deterministically so the supersede-chain caller always wires
	// older -> newer in the same order regardless of `readdirSync`'s
	// filesystem-dependent ordering. Numeric-aware so `FAA-H-8083-3B` sorts
	// before `FAA-H-8083-3C` and `FAA-H-8083-25C` lands after `FAA-H-8083-3C`.
	const sorted = [...all].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
	if (!ROLLING_EDITION_CORPORA.has(args.corpusDir) || sorted.length <= 1) return sorted;
	const latest = sorted[sorted.length - 1];
	return latest === undefined ? [] : [latest];
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
