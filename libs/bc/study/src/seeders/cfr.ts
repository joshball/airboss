/**
 * CFR manifest seed adapter (Code of Federal Regulations, WP-CFR).
 *
 * One CFR top-level manifest covers an entire Title (14 or 49) at one
 * eCFR snapshot date. The sibling `sections.json` carries every section's
 * canonical short, title, body path, and SHA -- keyed by Part number.
 *
 * The DB-side shape is one `study.reference` row per Part (slug:
 * `<title>cfr<part>`). The 11 production rows live in
 * `course/references/cfr-titles.yaml` (14cfr14/23/61/68/71/73/91/135/141 +
 * 49cfr830/1552). Parts in `sections.json` without an authored YAML row
 * are SKIPPED with a log line -- per WP-CFR spec, auto-creating references
 * for the long-tail (Parts 33, 27, etc.) is out of scope.
 *
 * Section laydown: each section becomes one `reference_section` at depth
 * 0, level `'section'`, parent_id null. Subpart rows are skipped (Subpart
 * is a grouping construct, not a separately-citable unit). Paragraph /
 * subparagraph / clause rows are also skipped -- the section is the
 * citable unit; paragraphs are addressed inline within the section body
 * via `(b)(1)(i)` notation.
 *
 * `section_schema = { levels: ['part','subpart','section','paragraph',
 * 'subparagraph','clause'], strict_sequence: false }`. The full level
 * vocabulary is declared even though the initial seed only emits
 * `'section'` rows -- a future WP can lay down Subpart / paragraph rows
 * without a schema migration.
 *
 * Returns `string[]` (one reference id per matched Part), unlike the
 * single-Part adapters (handbook / whole-doc / aim / ac) which return one
 * string. The dispatcher in `seed-references-from-manifest.ts`
 * uniformizes the contract by wrapping single-result adapters into
 * one-element arrays.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { REFERENCE_KINDS, REFERENCE_SECTION_LEVELS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { airbossRefForCfrSubpart } from '@ab/sources';
import { eq } from 'drizzle-orm';
import type { CfrManifest, CfrManifestSubpartEntry, CfrSectionEntry, CfrSectionsFile } from '../manifest-validation';
import { cfrSectionsFileSchema } from '../manifest-validation';
import { type SectionSchema, upsertReference, upsertReferenceSection } from '../references';
import { reference } from '../schema';
import { type CfrPartOverlay, loadCfrPartAuthoring } from './cfr-authoring';
import type { SeedContext, SeedSummary } from './types';

const CFR_SCHEMA: SectionSchema = {
	levels: [
		REFERENCE_SECTION_LEVELS.PART,
		REFERENCE_SECTION_LEVELS.SUBPART,
		REFERENCE_SECTION_LEVELS.SECTION,
		REFERENCE_SECTION_LEVELS.PARAGRAPH,
		REFERENCE_SECTION_LEVELS.SUBPARAGRAPH,
		REFERENCE_SECTION_LEVELS.CLAUSE,
	],
	strictSequence: false,
};

/**
 * The CFR YAML rows author edition `current` (CFR is a rolling
 * publication, not editioned -- ADR 019's annual diff job is future work).
 * The seeded `reference_section` rows attach to that edition; future eCFR
 * snapshots will need a separate edition strategy.
 */
const CFR_DB_EDITION = 'current';

/**
 * Load + validate the sibling `sections.json` file given a CFR manifest's
 * absolute manifest path.
 */
export async function loadCfrSectionsFile(manifestAbsPath: string): Promise<CfrSectionsFile> {
	const sectionsPath = resolve(dirname(manifestAbsPath), 'sections.json');
	if (!existsSync(sectionsPath)) {
		throw new Error(`CFR seed: sections.json missing alongside ${manifestAbsPath} (expected at ${sectionsPath})`);
	}
	const raw = JSON.parse(await readFile(sectionsPath, 'utf-8'));
	return cfrSectionsFileSchema.parse(raw);
}

/**
 * Look up an existing reference by `document_slug` for the rolling CFR
 * edition. Returns `{ id, subjects }` so the caller can merge authored
 * `topics` into the YAML-seeded `subjects` list (the topic-page reverse-
 * lookup at `/library/topic/<topic>` keys off `subjects`, not `metadata`).
 * Returns null when no row exists -- the seed adapter logs a skip and
 * moves on rather than auto-creating long-tail references.
 */
async function findCfrReferenceBySlug(
	documentSlug: string,
): Promise<{ id: string; subjects: readonly string[] } | null> {
	const rows = await db
		.select({ id: reference.id, subjects: reference.subjects })
		.from(reference)
		.where(eq(reference.documentSlug, documentSlug))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	return { id: row.id, subjects: row.subjects };
}

export interface SeedCfrManifestOptions {
	/** Absolute path to the manifest.json so the seeder can find sections.json + body files. */
	manifestAbsPath: string;
}

/**
 * Per-Part metadata produced by `buildCfrPartMetadata` -- exported so
 * unit tests can pin the merge order without round-tripping through the
 * DB. Manifest wins for `officialTitle` (eCFR XML is authoritative);
 * authoring YAML wins for `description` / `whyItMatters` / `scope`
 * (manifest never carries these).
 */
export interface CfrPartMetadata {
	readonly title_number: string;
	readonly part_number: string;
	readonly edition_date: string;
	readonly edition_slug: string;
	readonly section_count: number;
	readonly officialTitle?: string;
	readonly description?: string;
	readonly whyItMatters?: string;
	readonly scope?: string;
	/**
	 * Authored aviation-topic chips for the Part. Each value is in
	 * `AVIATION_TOPIC_VALUES` (validated by the YAML schema). The CfrPartCard
	 * renders these as topic pills below the description; the seeder also
	 * backfills the values into `reference.subjects` so `/library/topic/<x>`
	 * surfaces the Part next to the handbooks tagged with the same topic.
	 */
	readonly topics?: readonly string[];
}

export function buildCfrPartMetadata(input: {
	manifest: CfrManifest;
	partKey: string;
	sectionCount: number;
	manifestPartOfficialTitle: string | undefined;
	authoringOverlay: CfrPartOverlay | undefined;
}): CfrPartMetadata {
	const out: CfrPartMetadata = {
		title_number: input.manifest.title,
		part_number: input.partKey,
		edition_date: input.manifest.editionDate,
		edition_slug: input.manifest.editionSlug,
		section_count: input.sectionCount,
		...(input.manifestPartOfficialTitle !== undefined ? { officialTitle: input.manifestPartOfficialTitle } : {}),
		...(input.authoringOverlay?.description !== undefined ? { description: input.authoringOverlay.description } : {}),
		...(input.authoringOverlay?.whyItMatters !== undefined
			? { whyItMatters: input.authoringOverlay.whyItMatters }
			: {}),
		...(input.authoringOverlay?.scope !== undefined ? { scope: input.authoringOverlay.scope } : {}),
		...(input.authoringOverlay?.topics !== undefined ? { topics: input.authoringOverlay.topics } : {}),
	};
	return out;
}

/**
 * Resolve the absolute path to the per-Title authoring overlay file.
 * Layout: `regulations/cfr-{14,49}/_authoring/parts.yaml`. The seeder
 * walks UP from the manifest directory (`regulations/cfr-14/<edition>/`)
 * to land on the Title-level `_authoring/parts.yaml`.
 */
function authoringFilePathFor(manifestAbsPath: string): string {
	// manifestAbsPath = .../regulations/cfr-14/2026-04-22/manifest.json
	// titleDir       = .../regulations/cfr-14
	const titleDir = dirname(dirname(manifestAbsPath));
	return join(titleDir, '_authoring', 'parts.yaml');
}

export async function seedCfrManifest(
	manifest: CfrManifest,
	options: SeedCfrManifestOptions,
	context: SeedContext,
	summary: SeedSummary,
): Promise<string[]> {
	const sectionsFile = await loadCfrSectionsFile(options.manifestAbsPath);
	const editionDir = dirname(options.manifestAbsPath);
	const refIds: string[] = [];
	// Long-tail Parts that have no `study.reference` row (per WP-CFR scope).
	// We skip the per-Part seed for each one, but printing one line per skip
	// scrolls 130+ lines past the operator on every reset. Collect the slugs
	// here and emit one summary line at the end of the adapter run.
	const skippedSlugs: string[] = [];

	// Per-Part overlay map (description / whyItMatters / scope). Empty when
	// the per-Title authoring file is absent -- a fresh-clone-friendly path.
	const authoring = await loadCfrPartAuthoring(authoringFilePathFor(options.manifestAbsPath));

	// Index manifest.parts by Part number for O(1) lookup. Older manifests
	// (pre-Wave-1 ingest) won't carry `parts`; fall back to undefined and
	// the audit page surfaces the missing officialTitle as a gap.
	const manifestPartTitles: Record<string, string> = {};
	if (manifest.parts !== undefined) {
		for (const p of manifest.parts) {
			manifestPartTitles[p.number] = p.officialTitle;
		}
	}

	// Stable per-Part order so seed logs are deterministic. Numeric-aware
	// sort so Part 91 lands before Part 135 in the output.
	const partKeys = Object.keys(sectionsFile.sectionsByPart).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

	for (const partKey of partKeys) {
		const sections = sectionsFile.sectionsByPart[partKey] ?? [];
		const documentSlug = `${manifest.title}cfr${partKey}`;

		const existingRef = await findCfrReferenceBySlug(documentSlug);
		if (existingRef === null) {
			skippedSlugs.push(documentSlug);
			continue;
		}

		// Upsert the reference to populate `section_schema` while preserving
		// YAML-authored metadata (primary_cert, title, url) via the
		// undefined-on-conflict path in `upsertReference`. The YAML phase
		// runs BEFORE this in `seed-all` and is the canonical author for
		// those fields; we just attach the level vocabulary + per-Part
		// card-copy here. Manifest's `parts[].officialTitle` is the eCFR
		// publisher heading; the authoring YAML overlays
		// description/whyItMatters/scope/topics. See `buildCfrPartMetadata`
		// for the merge precedence.
		const overlay = authoring[partKey];
		const partMetadata = buildCfrPartMetadata({
			manifest,
			partKey,
			sectionCount: sections.length,
			manifestPartOfficialTitle: manifestPartTitles[partKey],
			authoringOverlay: overlay,
		});

		// Topic backfill: union the authored `topics` into the existing
		// `subjects` array so the topic-spine reverse-lookup at
		// `/library/topic/<topic>` surfaces this Part alongside handbooks
		// tagged with the same topic. The CHECK constraint on
		// `study.reference.subjects` enforces enum membership; the YAML
		// schema has already validated each `topics` value against
		// `AVIATION_TOPIC_VALUES`, so the union stays inside the enum.
		// When no topics are authored we leave `subjects` undefined so the
		// upsert preserves the YAML-phase value (`undefined` on the input
		// hits the on-conflict-preserve branch in `upsertReference`).
		let mergedSubjects: readonly string[] | undefined;
		if (overlay?.topics !== undefined && overlay.topics.length > 0) {
			const union = new Set<string>(existingRef.subjects);
			for (const t of overlay.topics) union.add(t);
			mergedSubjects = [...union];
		}

		const ref = await upsertReference({
			kind: REFERENCE_KINDS.CFR,
			documentSlug,
			edition: CFR_DB_EDITION,
			// `title` is a required upsert field; the YAML phase ran just
			// before this and authored the canonical `14 CFR Part 91 -- ...`
			// form. Pre-stamp it with a placeholder that's still
			// recognisable if the YAML phase is somehow skipped.
			title: `${manifest.title} CFR Part ${partKey}`,
			publisher: 'FAA',
			url: `https://www.ecfr.gov/current/title-${manifest.title}/part-${partKey}`,
			sectionSchema: CFR_SCHEMA,
			...(mergedSubjects !== undefined ? { subjects: mergedSubjects } : {}),
			metadata: partMetadata,
			seedOrigin: context.seedOrigin,
		});

		// Sort sections by section number (numeric-aware) so the reader's flat
		// list renders in regulatory order, not the file's reverse insertion
		// order.
		const sortedSections = [...sections].sort((a, b) =>
			a.canonical_short.localeCompare(b.canonical_short, 'en', { numeric: true }),
		);

		// Probe body-file existence up front. Body markdown is gitignored per ADR
		// 018 (developer-local cache derivative); on a fresh dev box it won't
		// exist until `bun run sources register cfr` runs. Distinguish two cases:
		//   - all files missing -> skip this Part with one progress line; the
		//     end-of-run banner tells the user which register command to run.
		//   - some files missing -> a real registration gap (partial extraction
		//     bug); fail loudly so it gets investigated.
		const missingBodyPaths = sortedSections.filter((entry) => !existsSync(resolve(editionDir, entry.body_path)));
		if (missingBodyPaths.length === sortedSections.length && sortedSections.length > 0) {
			context.onProgress?.(
				`  skip ${documentSlug}: body files not yet registered ` +
					`(run \`bun run sources register cfr --title=${manifest.title} ` +
					`--edition=${manifest.editionDate}\` to materialize)`,
			);
			continue;
		}
		if (missingBodyPaths.length > 0) {
			throw new Error(
				`CFR seed: ${missingBodyPaths.length} of ${sortedSections.length} body files missing for ${documentSlug} ` +
					`(first: ${missingBodyPaths[0]?.body_path}). Partial extraction is a bug -- run ` +
					`\`bun run sources register cfr --title=${manifest.title} ` +
					`--edition=${manifest.editionDate}\` to re-extract.`,
			);
		}

		// Subpart laydown (Wave 2). Manifest carries per-Part Subpart structure
		// (id + ordinal + title + section codes). For each Subpart we upsert a
		// `reference_section` row at level=`subpart`, depth=0 (top-level under
		// the reference); each owned Section then upserts with parent_id set
		// to the Subpart row's id and depth=1. Parts with no Subparts (small
		// Parts where sections sit directly under the Part) skip the subpart
		// loop and fall through to the flat laydown -- preserving the
		// pre-Wave-2 shape for those.
		//
		// Subpart `code` is namespaced as `subpart-A` (uppercase letter) so it
		// can never collide with a Section code (`91.103`) under the same
		// reference. The `(reference_id, code)` unique index would otherwise
		// pin two rows together.
		const subparts: readonly CfrManifestSubpartEntry[] =
			manifest.parts?.find((p) => p.number === partKey)?.subparts ?? [];
		const subpartIdByLetter = new Map<string, string>();
		for (const sp of subparts) {
			const subpartLetterUpper = sp.id.toUpperCase();
			const subpartCode = `subpart-${subpartLetterUpper}`;
			const subpartTitle = `Subpart ${subpartLetterUpper} -- ${sp.title}`;
			const { row, changed } = await upsertReferenceSection({
				referenceId: ref.id,
				parentId: null,
				level: REFERENCE_SECTION_LEVELS.SUBPART,
				ordinal: sp.ordinal,
				depth: 0,
				code: subpartCode,
				airbossRef: airbossRefForCfrSubpart(manifest.title, partKey, sp.id),
				title: subpartTitle,
				faaPageStart: null,
				faaPageEnd: null,
				sourceLocator: `${manifest.title} CFR Part ${partKey}, Subpart ${subpartLetterUpper}`,
				// Container row -- the Subpart heading lives in `title`. The
				// per-section markdown bodies carry the regulatory text.
				contentMd: '',
				contentHash: `subpart-${manifest.title}-${partKey}-${sp.id}`,
				hasFigures: false,
				hasTables: false,
				metadata: {
					subpart_letter: subpartLetterUpper,
					subpart_title: sp.title,
				},
				seedOrigin: context.seedOrigin,
			});
			subpartIdByLetter.set(sp.id, row.id);
			summary.sectionsTouched += 1;
			if (changed) summary.sectionsChanged += 1;
		}

		// Per-subpart ordinal counters for sections so each section's ordinal
		// is its position WITHIN its owning Subpart (not a global counter).
		// This matches the rendering contract where rows render in subpart-
		// relative order.
		const ordinalBySubpart = new Map<string | null, number>();

		// Pre-read every section body in parallel (chunked to avoid file-handle
		// exhaustion) so the per-section upsert loop stays purely DB-bound.
		// Sequential `await readFile` was the second-largest cost on a CFR
		// re-seed after the per-row SELECT (now cache-bypassed). One Part can
		// have 200+ sections; reading them serially burns wall time the DB
		// could be doing useful work in.
		const bodyByPath = await readBodiesParallel(
			sortedSections.map((e) => resolve(editionDir, e.body_path)),
			32,
		);

		for (const entry of sortedSections) {
			const bodyAbsPath = resolve(editionDir, entry.body_path);
			const contentMd = bodyByPath.get(bodyAbsPath) ?? '';

			// `canonical_short` is the citation-display form (`§91.103`).
			// `code` must be URL-slug-shape (`91.103`) so the
			// `/library/regulations/14-cfr/91/91.103` route can resolve.
			// SECTION_SHAPE in libs/aviation/src/slugs.ts rejects the `§`,
			// which silently 404s every detail-page link.
			const sectionCode = entry.canonical_short.replace(/^§/, '');
			const subpartLetter = entry.subpart_id;
			const parentId = subpartLetter !== null ? (subpartIdByLetter.get(subpartLetter) ?? null) : null;
			const depth = parentId !== null ? 1 : 0;
			const ordinalKey = subpartLetter ?? null;
			const nextOrdinal = ordinalBySubpart.get(ordinalKey) ?? 0;
			ordinalBySubpart.set(ordinalKey, nextOrdinal + 1);

			const { changed } = await upsertReferenceSection({
				referenceId: ref.id,
				parentId,
				level: REFERENCE_SECTION_LEVELS.SECTION,
				ordinal: nextOrdinal,
				depth,
				code: sectionCode,
				// CFR entries already carry their `airboss-ref:regs/cfr-<title>/...`
				// URI as `entry.id` from the registry's bootstrap (per ADR 019). Use
				// it directly so the URI source-of-truth stays the registry, not
				// this seeder.
				airbossRef: entry.id,
				title: entry.canonical_title,
				sourceLocator: `${manifest.title} CFR ${entry.canonical_short}`,
				contentMd,
				contentHash: entry.body_sha256,
				hasFigures: false,
				hasTables: false,
				metadata: {
					last_amended_date: entry.last_amended_date,
					...(subpartLetter !== null ? { subpart_id: subpartLetter } : {}),
				},
				seedOrigin: context.seedOrigin,
			});
			summary.sectionsTouched += 1;
			if (changed) summary.sectionsChanged += 1;
		}

		summary.editionsProcessed += 1;
		refIds.push(ref.id);
		context.onProgress?.(
			`  ${documentSlug} ${CFR_DB_EDITION}: ${subparts.length} subparts, ${sortedSections.length} sections`,
		);
	}

	if (skippedSlugs.length > 0) {
		// Show the skipped Part numbers (without the "<title>cfr" prefix) so
		// the operator can spot when a Part they expected to see was filtered
		// out. Full slug list is reconstructable from the manifest.
		const partNumbers = skippedSlugs
			.map((slug) => slug.replace(/^\d+cfr/, ''))
			.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
		const titlePrefix = `${manifest.title}cfr`;
		context.onProgress?.(
			`  ${titlePrefix}*: skipped ${skippedSlugs.length} long-tail Parts (out of WP-CFR scope): ${partNumbers.join(', ')}`,
		);
	}

	return refIds;
}

/**
 * Read every body file in parallel with a fixed concurrency cap so we don't
 * exhaust the OS file-handle table on the larger Parts (Part 121 has ~390
 * sections). Returns a map keyed by absolute path so the caller can look up
 * each section's body directly without re-resolving paths.
 */
async function readBodiesParallel(absPaths: ReadonlyArray<string>, concurrency: number): Promise<Map<string, string>> {
	const out = new Map<string, string>();
	let cursor = 0;
	const workers = Array.from({ length: Math.min(concurrency, absPaths.length) }, async () => {
		while (true) {
			const idx = cursor++;
			if (idx >= absPaths.length) return;
			const path = absPaths[idx];
			if (path === undefined) continue;
			const body = await readFile(path, 'utf-8');
			out.set(path, body);
		}
	});
	await Promise.all(workers);
	return out;
}

/**
 * Test-only re-export so unit tests can build synthetic sections.json
 * data and round-trip through the same validator the adapter uses.
 */
export { type CfrSectionEntry, cfrSectionsFileSchema };
