/**
 * Phase 10 (slice) -- ACS corpus ingestion.
 *
 * Source of truth: ADR 019 §1.2 ("ACS"), §2.4 (atomic batch promotion), §2.6
 * (registry population), cert-syllabus WP locked Q7 (2026-04-27).
 *
 * Slice scope: PPL Airplane (`ppl-airplane-6c` / `faa-s-acs-6` family) only.
 * The downloader populates `~/Documents/airboss-handbook-cache/acs/<faa-doc>/<edition>/`
 * for every publication the project tracks; this ingest walks only the
 * entries that map to a registered publication slug and skips the rest with
 * explicit reasons. The mapping from detected ACS edition slug to locked
 * publication slug lives in `ACS_DETECTED_EDITION_TO_SLUG` below; adding a
 * new publication is one entry there plus the matching `ACS_PUBLICATION_SLUGS`
 * + URL + per-slug code-prefix entries.
 *
 * Steps per ACS found in the cache (and matched against the slice):
 *
 *   1. Walk `<cache>/acs/<faa-doc>/<edition-on-disk>/manifest.json` (downloader output).
 *   2. Run `extractPdf` on the ACS PDF; detect the canonical edition slug (e.g.
 *      `faa-s-acs-6c`) from the cover and the effective date.
 *   3. Map the detected edition slug to a locked publication slug
 *      (`faa-s-acs-6c` -> `ppl-airplane-6c`). Skip with explicit reason when
 *      no mapping is registered.
 *   4. Parse the body into Areas of Operation -> Tasks -> Elements using the
 *      heading + element-code regex pack defined here. ACS PDFs are highly
 *      regular: each task block is bounded by `Task <letter>. <title>` and the
 *      element bullets carry deterministic codes (`PA.I.C.K3`, `PA.I.C.K3a`,
 *      etc.) which encode (Area, Task, Triad, Ordinal) directly.
 *   5. Write derivative tree under `<repo>/acs/<slug>/`:
 *        - `manifest.json`                                 per-publication manifest
 *        - `area-<NN>/task-<letter>.md`                    per-task body markdown
 *      `<NN>` is the 2-digit zero-padded numeric area ordinal (locked Q7).
 *   6. Append an entry to corpus-level `<repo>/acs/index.json`.
 *   7. Insert one `SourceEntry` per ACS publication + per Area + per Task + per
 *      Element into the active SOURCES table; insert one `Edition` per
 *      ingested (id, publication_date) into EDITIONS. SourceIds use the
 *      locked Q7 format: `airboss-ref:acs/<slug>/area-<NN>/task-<x>/elem-<TNN>`.
 *   8. Record an atomic batch promotion `pending -> accepted` under
 *      `PHASE_9_REVIEWER_ID`. Skip when entries are already accepted.
 *
 * Idempotent: re-running with the same `--cache=` and `--out=` is a no-op.
 *
 * Live PDF re-fetching is NOT this script's job. The downloader populates the
 * cache; this script reads it.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ExtractedDocument, ExtractedPage } from '../pdf/index.ts';
import { extractPdf, findAcsEditionSlug, findEffectiveDate } from '../pdf/index.ts';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import type {
	AcsCorpusIndex,
	AcsCorpusIndexEntry,
	AcsManifestArea,
	AcsManifestElement,
	AcsManifestFile,
	AcsManifestTask,
} from './derivative-reader.ts';
import { ACS_PUBLICATION_SLUGS, romanToPaddedOrdinal } from './locator.ts';

export const PHASE_9_REVIEWER_ID = 'phase-9-acs-ingestion';

const CORPUS = 'acs';

/**
 * Map from the detected ACS edition slug (the canonical FAA edition id parsed
 * off the PDF cover, e.g. `faa-s-acs-6c`) to the locked-Q7 publication slug
 * used everywhere downstream. Per the cert-syllabus WP locked Q7 (2026-04-27),
 * cert + category + edition collapse into one publication slug per FAA
 * publication. The PPL ACS-6C is one publication covering both ASEL + AMEL;
 * class-restricted tasks are tagged via `syllabus_node.classes`, not via the
 * locator. The slice ships only `ppl-airplane-6c`; siblings parse but skip
 * with an explicit reason until a sibling lane wires them in.
 */
const ACS_DETECTED_EDITION_TO_SLUG: Readonly<Record<string, string>> = {
	'faa-s-acs-6c': 'ppl-airplane-6c',
	// Other publications parse but are skipped with an explicit reason. Add
	// them here once a sibling lane lands them.
	// 'faa-s-acs-7b': 'cpl-airplane-7b',
	// 'faa-s-acs-8c': 'ir-airplane-8c',
	// 'faa-s-acs-25': 'cfi-airplane-25',
	// 'faa-s-acs-11a': 'atp-airplane-11a',
};

/**
 * Per-publication-slug FAA code prefix that begins every K/R/S element id
 * within a given ACS. PPL Airplane uses `PA.`; CFI uses `FA.`; etc. The
 * prefix lives in the ACS body next to every code (`PA.I.C.K3`); we use it
 * to anchor the element regex so the parser cannot confuse, say, the
 * Table-of-Contents reference list with an actual element bullet.
 */
const ACS_SLUG_CODE_PREFIX: Readonly<Record<string, string>> = {
	'ppl-airplane-6c': 'PA',
	'ir-airplane-8c': 'IR',
	'cpl-airplane-7b': 'CA',
	'cfi-airplane-25': 'FA',
	'atp-airplane-11a': 'AA',
};

export interface IngestArgs {
	/** Path to the cache root containing `acs/<faa-doc>/<edition>/<filename>.pdf` + downloader manifest. */
	readonly cacheRoot: string;
	/** Path to the in-repo derivative root (default `<cwd>/acs`). */
	readonly derivativeRoot: string;
	/**
	 * Optional publication-slug filter -- only ingest these publication slugs.
	 * Default: every slug registered in `ACS_DETECTED_EDITION_TO_SLUG`. Useful
	 * for the smoke test which may want to constrain scope, and for operator
	 * runs that are testing a single publication.
	 */
	readonly slugs?: readonly string[];
}

export interface IngestReport {
	readonly publicationsScanned: number;
	readonly publicationsIngested: number;
	readonly publicationsAlreadyAccepted: number;
	readonly publicationsSkipped: number;
	readonly skipReasons: readonly string[];
	readonly entriesIngested: {
		readonly publications: number;
		readonly areas: number;
		readonly tasks: number;
		readonly elements: number;
	};
	readonly promotionBatchId: string | null;
	readonly indexPath: string;
}

interface CachedAcsPublication {
	/** FAA doc-family slug from the cache directory (e.g. `'faa-s-acs-6'`). */
	readonly cacheDocSlug: string;
	/** Edition directory name from the cache (e.g. `'current'`). */
	readonly cacheEditionDir: string;
	/** Absolute path to the PDF. */
	readonly pdfPath: string;
	readonly downloaderManifest: DownloaderManifest;
}

interface DiscoveryResult {
	readonly publications: readonly CachedAcsPublication[];
	readonly skipped: readonly string[];
}

interface DownloaderManifest {
	readonly corpus: string;
	readonly doc: string;
	readonly edition: string;
	readonly source_url: string;
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly fetched_at: string;
	readonly last_modified?: string;
}

function readDownloaderManifest(path: string): DownloaderManifest {
	const raw = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(raw) as Partial<DownloaderManifest>;
	const required: readonly (keyof DownloaderManifest)[] = [
		'corpus',
		'doc',
		'edition',
		'source_url',
		'source_filename',
		'source_sha256',
		'fetched_at',
	];
	for (const key of required) {
		if (parsed[key] === undefined) {
			throw new Error(`downloader manifest at ${path} missing required field: ${String(key)}`);
		}
	}
	return parsed as DownloaderManifest;
}

/**
 * Walk the cache and collect every ACS PDF available for ingestion. The
 * cache stores publications under `<cacheRoot>/acs/<faa-doc>/<edition-dir>/`;
 * we collect each `(doc, edition-dir)` pair that has a valid downloader
 * manifest + PDF on disk. Mapping to the locked publication slug happens
 * after PDF extraction (the detected edition slug from the cover is the key
 * into `ACS_DETECTED_EDITION_TO_SLUG`).
 */
function discoverCachedAcs(cacheRoot: string): DiscoveryResult {
	const root = join(cacheRoot, 'acs');
	if (!existsSync(root)) return { publications: [], skipped: [] };
	const publications: CachedAcsPublication[] = [];
	const skipped: string[] = [];
	for (const docDir of readdirSync(root)) {
		const docPath = join(root, docDir);
		if (!statSync(docPath).isDirectory()) continue;
		for (const editionDir of readdirSync(docPath)) {
			const editionPath = join(docPath, editionDir);
			if (!statSync(editionPath).isDirectory()) continue;
			const downloaderManifestPath = join(editionPath, 'manifest.json');
			if (!existsSync(downloaderManifestPath)) {
				skipped.push(`acs/${docDir}/${editionDir}: no downloader manifest (skip)`);
				continue;
			}
			let dm: DownloaderManifest;
			try {
				dm = readDownloaderManifest(downloaderManifestPath);
			} catch (e) {
				skipped.push(`acs/${docDir}/${editionDir}: invalid downloader manifest -- ${(e as Error).message} (skip)`);
				continue;
			}
			const pdfPath = join(editionPath, dm.source_filename);
			if (!existsSync(pdfPath)) {
				skipped.push(`acs/${docDir}/${editionDir}: PDF not found at ${dm.source_filename} (skip)`);
				continue;
			}
			publications.push({
				cacheDocSlug: docDir,
				cacheEditionDir: editionDir,
				pdfPath,
				downloaderManifest: dm,
			});
		}
	}
	return { publications, skipped };
}

function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

// ---------------------------------------------------------------------------
// ACS body parser
// ---------------------------------------------------------------------------

const ROMAN_RE = /^[IVX]+$/;
const AREA_HEADING_RE = /^Area of Operation\s+([IVX]+)\.\s+(.+?)\s*$/;
const TASK_HEADING_RE = /^Task\s+([A-Z])\.\s+(.+?)\s*$/;

interface ParsedTaskBlock {
	readonly area: string;
	readonly areaTitle: string;
	readonly task: string;
	readonly taskTitle: string;
	readonly bodyLines: readonly string[];
	readonly elements: readonly ParsedElement[];
}

interface ParsedElement {
	readonly triad: 'k' | 'r' | 's';
	readonly ordinal: string;
	readonly code: string;
	readonly title: string;
}

/**
 * Walk the extracted PDF page-by-page and collect every (area, task) block
 * with its body lines + elements.
 *
 * The parser is line-oriented in raw mode -- raw mode flattens column layout
 * to top-to-bottom reading order, which is the right order for ACS body
 * extraction. Repeated headers like the page footer (`Private Pilot for
 * Airplane Category ACS (FAA-S-ACS-6C) 4`) and the running area banner
 * (`Area of Operation I. Preflight Preparation`) are filtered out so the body
 * does not contain page-flow noise.
 */
function parseAcsBody(doc: ExtractedDocument, codePrefix: string): readonly ParsedTaskBlock[] {
	const elementCodeRe = new RegExp(`^${codePrefix}\\.([IVX]+)\\.([A-Z])\\.([KRS])([1-9][0-9]?)([a-z])?\\b\\s*(.*)$`);
	// Page-level filtered text: drop ToC pages, page numbers, repeated banners,
	// and everything after the first "Appendix" header.
	const lines: string[] = [];
	let inAppendix = false;
	for (const page of doc.pages) {
		// ToC pages have many lines with dot-leaders. Body pages have at most
		// one or two (rare; e.g. a "see Appendix..." note). Threshold of 3 is
		// safely above any body-page false positive observed across the FAA's
		// ACS family.
		const dotLeaderLines = page.text.split('\n').filter((l) => /\.{2,}\s*\d+\s*$/.test(l)).length;
		if (dotLeaderLines >= 3) continue;
		// Once we hit an Appendix header on the page, stop accumulating. The
		// appendices restate Task headings in prose ("Task A. Maneuvering
		// During Slow Flight") that would otherwise be matched as new task
		// blocks against the previous Area context and explode the count.
		if (/^Appendix\s+\d+:/m.test(page.text)) {
			inAppendix = true;
		}
		if (inAppendix) continue;
		for (const rawLine of normalizePageLines(page)) {
			lines.push(rawLine);
		}
	}

	const blocks: ParsedTaskBlock[] = [];
	let currentArea: string | null = null;
	let currentAreaTitle: string | null = null;
	let active: { task: string; title: string; lines: string[]; elements: ParsedElement[] } | null = null;

	const flushActive = (): void => {
		if (active === null || currentArea === null || currentAreaTitle === null) return;
		blocks.push({
			area: currentArea,
			areaTitle: currentAreaTitle,
			task: active.task,
			taskTitle: active.title,
			bodyLines: active.lines,
			elements: active.elements,
		});
		active = null;
	};

	for (const line of lines) {
		const areaMatch = AREA_HEADING_RE.exec(line);
		if (areaMatch !== null && ROMAN_RE.test(areaMatch[1])) {
			flushActive();
			currentArea = areaMatch[1].toLowerCase();
			currentAreaTitle = areaMatch[2].trim();
			continue;
		}

		// Skip the running area banner: it appears as a copy of the area heading
		// at the top of every body page. The full-area heading runs only once
		// (at the start of the area block) and is identical to the banner; the
		// dedupe is "if the same area is encountered twice in a row, only the
		// first counts". The current-area state already tolerates this -- we
		// just need to not flush an active task when a banner repeats.

		const taskMatch = TASK_HEADING_RE.exec(line);
		// Reject ToC lines: real task headings never contain dot-leaders or a
		// trailing page number. ToC bleeds past the explicit "Table of Contents"
		// header in some ACS layouts (e.g. multi-line task names that wrap on
		// the second page of the ToC do not re-emit the "Table of Contents"
		// banner), so this guard is the structural backstop.
		if (taskMatch !== null && /\.{2,}/.test(line)) continue;
		if (taskMatch !== null && currentArea !== null) {
			flushActive();
			active = {
				task: taskMatch[1].toLowerCase(),
				title: taskMatch[2].trim(),
				lines: [line],
				elements: [],
			};
			continue;
		}

		if (active === null) continue;

		active.lines.push(line);

		const elementMatch = elementCodeRe.exec(line);
		if (elementMatch !== null) {
			const triadLetter = elementMatch[3].toLowerCase() as 'k' | 'r' | 's';
			const rawOrdinal = elementMatch[4];
			const subLetter = elementMatch[5];
			const remainder = elementMatch[6].trim();
			// Parent elements (`PA.I.C.K3`) are the registry units. Sub-lettered
			// children (`PA.I.C.K3a`) collapse into the parent's body and do NOT
			// produce their own SourceEntry -- the locator scheme stops at the
			// triad+ordinal level.
			if (subLetter !== undefined) continue;
			const ordinalNum = Number.parseInt(rawOrdinal, 10);
			if (ordinalNum > 99) continue;
			// Locked Q7: 2-digit zero-padded element ordinals.
			const ordinal = String(ordinalNum).padStart(2, '0');
			// The PDF prints unpadded ordinals (`PA.I.C.K3`); the `code` field
			// preserves the printed form for in-body element extraction.
			const code = `${codePrefix}.${elementMatch[1]}.${elementMatch[2]}.${elementMatch[3]}${rawOrdinal}`;
			const title = remainder.length > 0 ? truncateTitle(remainder) : `${triadLetter.toUpperCase()}${ordinal}`;
			active.elements.push({ triad: triadLetter, ordinal, code, title });
		}
	}
	flushActive();
	return blocks;
}

/**
 * Page-level pre-filter: drop the running footer and page-number lines.
 * Returns lines in the original order, with whitespace trimmed.
 */
function normalizePageLines(page: ExtractedPage): readonly string[] {
	const text = page.text;
	const out: string[] = [];
	for (const raw of text.split('\n')) {
		const line = raw.trim();
		if (line.length === 0) continue;
		// Footer: `Private Pilot for Airplane Category ACS (FAA-S-ACS-6C) 4`
		if (/\bACS\s+\(FAA-S-ACS-[0-9]+[A-Z]?\)\s+\d+\s*$/.test(line)) continue;
		// Standalone page numbers
		if (/^\d{1,3}$/.test(line)) continue;
		// Roman page numbers (front matter)
		if (/^[ivxlcdm]+$/.test(line)) continue;
		out.push(line);
	}
	return out;
}

/**
 * Best-effort cover-page month + year scraper for ACS publications that print
 * only a month and year (no day). Returns ISO `YYYY-MM-01` when found. Looks
 * for a standalone line of the form `<Month> <Year>` on the cover, ignoring
 * lines that are part of a sentence (e.g. the Foreword's "Material in
 * FAA-S-ACS-6C supersedes FAA-S-ACS-6B" prose).
 */
function findCoverMonthYear(pages: readonly ExtractedPage[]): string | null {
	const months: Record<string, number> = {
		january: 1,
		february: 2,
		march: 3,
		april: 4,
		may: 5,
		june: 6,
		july: 7,
		august: 8,
		september: 9,
		october: 10,
		november: 11,
		december: 12,
	};
	const re = /^([A-Z][a-z]+)\s+(\d{4})\s*$/;
	for (const page of pages) {
		for (const raw of page.text.split('\n')) {
			const line = raw.trim();
			const m = re.exec(line);
			if (m === null) continue;
			const month = months[m[1].toLowerCase()];
			const year = Number.parseInt(m[2], 10);
			if (month === undefined || !Number.isFinite(year)) continue;
			if (year < 1990 || year > 2100) continue;
			const mm = String(month).padStart(2, '0');
			return `${year}-${mm}-01`;
		}
	}
	return null;
}

function truncateTitle(s: string): string {
	const collapsed = s.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= 280) return collapsed;
	return `${collapsed.slice(0, 277)}...`;
}

// ---------------------------------------------------------------------------
// SourceEntry construction
// ---------------------------------------------------------------------------

interface SourceEntryBuildArgs {
	readonly slug: string;
	readonly editionSlug: string;
	readonly publicationDate: Date;
	readonly title: string;
	readonly canonicalShortPrefix: string;
	readonly canonicalFormalPrefix: string;
}

function publicationEntry(args: SourceEntryBuildArgs): SourceEntry {
	const id = `airboss-ref:${CORPUS}/${args.slug}` as SourceId;
	const upper = args.editionSlug.toUpperCase();
	return {
		id,
		corpus: CORPUS,
		canonical_short: args.canonicalShortPrefix,
		canonical_formal: `${args.canonicalFormalPrefix} (${upper})`,
		canonical_title: args.title,
		last_amended_date: args.publicationDate,
		lifecycle: 'pending',
	};
}

function areaEntry(
	args: SourceEntryBuildArgs & { areaPadded: string; areaRomanUpper: string; areaTitle: string },
): SourceEntry {
	const id = `airboss-ref:${CORPUS}/${args.slug}/area-${args.areaPadded}` as SourceId;
	return {
		id,
		corpus: CORPUS,
		canonical_short: `${args.canonicalShortPrefix} Area ${args.areaRomanUpper}`,
		canonical_formal: `${args.canonicalFormalPrefix}, Area of Operation ${args.areaRomanUpper}: ${args.areaTitle}`,
		canonical_title: args.areaTitle,
		last_amended_date: args.publicationDate,
		lifecycle: 'pending',
	};
}

function taskEntry(
	args: SourceEntryBuildArgs & {
		readonly areaPadded: string;
		readonly areaRomanUpper: string;
		readonly areaTitle: string;
		readonly task: string;
		readonly taskTitle: string;
	},
): SourceEntry {
	const id = `airboss-ref:${CORPUS}/${args.slug}/area-${args.areaPadded}/task-${args.task}` as SourceId;
	const upperTask = args.task.toUpperCase();
	return {
		id,
		corpus: CORPUS,
		canonical_short: `${args.canonicalShortPrefix} ${args.areaRomanUpper}.${upperTask}`,
		canonical_formal: `${args.canonicalFormalPrefix}, Area ${args.areaRomanUpper} Task ${upperTask}: ${args.taskTitle}`,
		canonical_title: args.taskTitle,
		last_amended_date: args.publicationDate,
		lifecycle: 'pending',
	};
}

function elementEntry(
	args: SourceEntryBuildArgs & {
		readonly areaPadded: string;
		readonly areaRomanUpper: string;
		readonly task: string;
		readonly element: ParsedElement;
	},
): SourceEntry {
	const id =
		`airboss-ref:${CORPUS}/${args.slug}/area-${args.areaPadded}/task-${args.task}/elem-${args.element.triad}${args.element.ordinal}` as SourceId;
	const upperTask = args.task.toUpperCase();
	const upperTriad = args.element.triad.toUpperCase();
	return {
		id,
		corpus: CORPUS,
		canonical_short: `${args.canonicalShortPrefix} ${args.areaRomanUpper}.${upperTask}.${upperTriad}${args.element.ordinal}`,
		canonical_formal: `${args.canonicalFormalPrefix}, Area ${args.areaRomanUpper} Task ${upperTask} Element ${upperTriad}${args.element.ordinal}`,
		canonical_title: args.element.title,
		last_amended_date: args.publicationDate,
		lifecycle: 'pending',
	};
}

// ---------------------------------------------------------------------------
// Slug -> canonical-name pieces (per-publication title strings).
// ---------------------------------------------------------------------------

interface SlugNames {
	readonly canonicalShortPrefix: string;
	readonly canonicalFormalPrefix: string;
}

const SLUG_NAMES: Readonly<Record<string, SlugNames>> = {
	'ppl-airplane-6c': {
		canonicalShortPrefix: 'PPL ACS',
		canonicalFormalPrefix: 'Private Pilot -- Airplane ACS',
	},
	'ir-airplane-8c': {
		canonicalShortPrefix: 'IR ACS',
		canonicalFormalPrefix: 'Instrument Rating -- Airplane ACS',
	},
	'cpl-airplane-7b': {
		canonicalShortPrefix: 'CPL ACS',
		canonicalFormalPrefix: 'Commercial Pilot -- Airplane ACS',
	},
	'cfi-airplane-25': {
		canonicalShortPrefix: 'CFI ACS',
		canonicalFormalPrefix: 'CFI -- Airplane ACS',
	},
	'atp-airplane-11a': {
		canonicalShortPrefix: 'ATP ACS',
		canonicalFormalPrefix: 'ATP -- Airplane ACS',
	},
};

function getSlugNames(slug: string): SlugNames {
	const names = SLUG_NAMES[slug];
	if (names !== undefined) return names;
	return {
		canonicalShortPrefix: `${slug.toUpperCase()} ACS`,
		canonicalFormalPrefix: `${slug.toUpperCase()} ACS`,
	};
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

/**
 * Run ACS corpus ingestion. Walks the cache, extracts each PDF, writes
 * derivatives, populates the registry. Idempotent.
 */
export async function runAcsIngest(args: IngestArgs): Promise<IngestReport> {
	const allowedSlugs = new Set<string>(args.slugs ?? Object.values(ACS_DETECTED_EDITION_TO_SLUG));
	const discovery = discoverCachedAcs(args.cacheRoot);
	const cached = discovery.publications;
	const skipReasons: string[] = [...discovery.skipped];
	let publicationsIngested = 0;
	let publicationsAlreadyAccepted = 0;
	let publicationsSkipped = discovery.skipped.length;

	ensureDir(args.derivativeRoot);

	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const indexEntries: AcsCorpusIndexEntry[] = [];
	const entriesToPromote: SourceId[] = [];
	let areasIngested = 0;
	let tasksIngested = 0;
	let elementsIngested = 0;

	for (const pub of cached) {
		try {
			// Layout mode preserves column structure; ACS task blocks render with
			// stable indentation (element codes left-justified, body text indented)
			// which makes the heading + element regexes unambiguous. Raw mode also
			// works but sometimes splits a leading capital from a label
			// (`eferences: R ...` instead of `References:`) which breaks `Date:`-
			// adjacent date heuristics.
			const doc = extractPdf(pub.pdfPath, { mode: 'layout' });
			const coverPages = doc.pages.slice(0, 4);

			const editionFromCover = findAcsEditionSlug(coverPages);
			if (editionFromCover === null) {
				skipReasons.push(
					`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: could not detect ACS edition slug on cover (skip)`,
				);
				publicationsSkipped += 1;
				continue;
			}
			const editionSlug = editionFromCover.toLowerCase(); // e.g. 'faa-s-acs-6c'

			const slug = ACS_DETECTED_EDITION_TO_SLUG[editionSlug];
			if (slug === undefined) {
				skipReasons.push(
					`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: detected edition '${editionSlug}' is not yet wired to a publication slug -- add to ACS_DETECTED_EDITION_TO_SLUG (skip)`,
				);
				publicationsSkipped += 1;
				continue;
			}
			if (!allowedSlugs.has(slug)) {
				skipReasons.push(`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: slug '${slug}' not in --slug filter (skip)`);
				publicationsSkipped += 1;
				continue;
			}
			if (!ACS_PUBLICATION_SLUGS.includes(slug)) {
				skipReasons.push(
					`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: slug '${slug}' not in ACS_PUBLICATION_SLUGS (skip)`,
				);
				publicationsSkipped += 1;
				continue;
			}

			// ACS cover pages often print only month + year (`November 2023`)
			// without a day. `findEffectiveDate` requires day + month + year; fall
			// back to a month-year heuristic when the strict matcher returns null.
			const detectedDate = findEffectiveDate(coverPages) ?? findCoverMonthYear(coverPages);
			const fallbackDate = pub.downloaderManifest.last_modified ?? pub.downloaderManifest.fetched_at;
			const publicationIso = detectedDate ?? new Date(fallbackDate).toISOString().slice(0, 10);
			const publicationDate = new Date(publicationIso);
			if (Number.isNaN(publicationDate.getTime())) {
				skipReasons.push(`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: could not derive publication date (skip)`);
				publicationsSkipped += 1;
				continue;
			}

			const codePrefix = ACS_SLUG_CODE_PREFIX[slug] ?? null;
			if (codePrefix === null) {
				skipReasons.push(
					`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: no element-code prefix registered for slug '${slug}' (skip)`,
				);
				publicationsSkipped += 1;
				continue;
			}

			const blocks = parseAcsBody(doc, codePrefix);
			if (blocks.length === 0) {
				skipReasons.push(
					`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: parsed 0 task blocks -- heading regexes did not match (skip)`,
				);
				publicationsSkipped += 1;
				continue;
			}

			const titleFromMeta = (doc.metadata?.title ?? '').trim();
			const title = titleFromMeta.length > 0 ? titleFromMeta : `${getSlugNames(slug).canonicalFormalPrefix}`;

			// Group blocks by area (ordered as encountered).
			const byArea: Map<string, { areaTitle: string; tasks: ParsedTaskBlock[] }> = new Map();
			const areaOrder: string[] = [];
			for (const block of blocks) {
				const existing = byArea.get(block.area);
				if (existing === undefined) {
					byArea.set(block.area, { areaTitle: block.areaTitle, tasks: [block] });
					areaOrder.push(block.area);
				} else {
					existing.tasks.push(block);
				}
			}

			const slugNames = getSlugNames(slug);
			const baseEntryArgs: SourceEntryBuildArgs = {
				slug,
				editionSlug,
				publicationDate,
				title,
				canonicalShortPrefix: slugNames.canonicalShortPrefix,
				canonicalFormalPrefix: slugNames.canonicalFormalPrefix,
			};

			// Write task body files + assemble the manifest's areas list.
			const docDir = join(args.derivativeRoot, slug);
			ensureDir(docDir);

			const manifestAreas: AcsManifestArea[] = [];
			const localEntries: SourceEntry[] = [];

			// Publication-level entry.
			localEntries.push(publicationEntry(baseEntryArgs));

			for (const area of areaOrder) {
				const areaData = byArea.get(area);
				if (areaData === undefined) continue;
				const areaPadded = romanToPaddedOrdinal(area);
				if (areaPadded === null) {
					// Defensive: parser already validates roman shape, but if the area
					// somehow exceeds 99 we drop with an explicit reason.
					skipReasons.push(
						`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: area '${area}' could not be converted to a 2-digit ordinal (skip area)`,
					);
					continue;
				}
				const areaRomanUpper = area.toUpperCase();
				const manifestTasks: AcsManifestTask[] = [];
				localEntries.push(
					areaEntry({
						...baseEntryArgs,
						areaPadded,
						areaRomanUpper,
						areaTitle: areaData.areaTitle,
					}),
				);
				for (const block of areaData.tasks) {
					const bodyText = block.bodyLines.join('\n');
					const bodySha = sha256(bodyText);
					const repoRelativeBody = `acs/${slug}/area-${areaPadded}/task-${block.task}.md`;
					const absBody = join(args.derivativeRoot, slug, `area-${areaPadded}`, `task-${block.task}.md`);
					ensureDir(dirname(absBody));
					writeFileSync(absBody, `${bodyText}\n`, 'utf-8');

					const manifestElements: AcsManifestElement[] = block.elements.map((el) => ({
						triad: el.triad,
						ordinal: el.ordinal,
						code: el.code,
						title: el.title,
					}));

					manifestTasks.push({
						task: block.task,
						title: block.taskTitle,
						body_path: repoRelativeBody,
						body_sha256: bodySha,
						elements: manifestElements,
					});

					localEntries.push(
						taskEntry({
							...baseEntryArgs,
							areaPadded,
							areaRomanUpper,
							areaTitle: areaData.areaTitle,
							task: block.task,
							taskTitle: block.taskTitle,
						}),
					);

					for (const el of block.elements) {
						localEntries.push(
							elementEntry({
								...baseEntryArgs,
								areaPadded,
								areaRomanUpper,
								task: block.task,
								element: el,
							}),
						);
					}
				}
				manifestAreas.push({
					area: areaPadded,
					title: areaData.areaTitle,
					tasks: manifestTasks,
				});
			}

			const manifest: AcsManifestFile = {
				schema_version: 1,
				corpus: 'acs',
				slug,
				title,
				publisher: 'FAA',
				publication_date: detectedDate,
				source_url: pub.downloaderManifest.source_url,
				source_sha256: pub.downloaderManifest.source_sha256,
				fetched_at: pub.downloaderManifest.fetched_at,
				page_count: doc.pageCount,
				areas: manifestAreas,
			};
			const manifestPath = join(docDir, 'manifest.json');
			writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

			// Apply registry patch + count freshly-ingested entries.
			let publicationCounted = false;
			const idPrefix = `airboss-ref:${CORPUS}/${slug}`;
			for (const entry of localEntries) {
				const overlay = getEntryLifecycle(entry.id);
				const existing = sourcesPatch[entry.id];
				if (existing !== undefined && overlay === 'accepted') {
					if (entry.id === idPrefix) {
						publicationsAlreadyAccepted += 1;
						publicationCounted = true;
					}
					continue;
				}
				sourcesPatch[entry.id] = entry;
				entriesToPromote.push(entry.id);
				const tail = entry.id.slice(idPrefix.length);
				if (tail.length === 0) {
					if (!publicationCounted) {
						publicationsIngested += 1;
						publicationCounted = true;
					}
				} else if (/^\/area-\d{2}$/.test(tail)) {
					areasIngested += 1;
				} else if (/^\/area-\d{2}\/task-[a-z]$/.test(tail)) {
					tasksIngested += 1;
				} else if (/^\/area-\d{2}\/task-[a-z]\/elem-[krs]\d{2}$/.test(tail)) {
					elementsIngested += 1;
				}

				const editionRecord: Edition = {
					id: publicationIso,
					published_date: publicationDate,
					source_url: pub.downloaderManifest.source_url,
				};
				const existingEditions = editionsPatch.get(entry.id) ?? [];
				const hasEdition = existingEditions.some((e) => e.id === editionRecord.id);
				if (!hasEdition) {
					editionsPatch.set(entry.id, [...existingEditions, editionRecord]);
				}
			}

			indexEntries.push({
				slug,
				title,
				publication_date: detectedDate,
				manifest_path: `acs/${slug}/manifest.json`,
			});
		} catch (e) {
			skipReasons.push(`acs/${pub.cacheDocSlug}/${pub.cacheEditionDir}: extraction failed -- ${(e as Error).message}`);
			publicationsSkipped += 1;
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

	let promotionBatchId: string | null = null;
	if (entriesToPromote.length > 0) {
		const result = recordPromotion({
			corpus: CORPUS,
			reviewerId: PHASE_9_REVIEWER_ID,
			scope: entriesToPromote,
			inputSource: args.cacheRoot,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`acs ingest batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

	const corpusIndex: AcsCorpusIndex = {
		schema_version: 1,
		fetched_at: new Date().toISOString(),
		entries: indexEntries.sort((a, b) => a.slug.localeCompare(b.slug)),
	};
	const indexPath = join(args.derivativeRoot, 'index.json');
	writeFileSync(indexPath, `${JSON.stringify(corpusIndex, null, 2)}\n`, 'utf-8');

	return {
		publicationsScanned: cached.length + discovery.skipped.length,
		publicationsIngested,
		publicationsAlreadyAccepted,
		publicationsSkipped,
		skipReasons,
		entriesIngested: {
			publications: publicationsIngested,
			areas: areasIngested,
			tasks: tasksIngested,
			elements: elementsIngested,
		},
		promotionBatchId,
		indexPath,
	};
}

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

const USAGE = `usage:
  bun run sources register acs [--cache=<path>] [--out=<path>] [--slug=<slug>]
  bun run sources register acs --help

  Walk the ACS cache (default: $AIRBOSS_HANDBOOK_CACHE/acs/ or
  ~/Documents/airboss-handbook-cache/acs/), extract each PDF, write derivatives
  to <repo>/acs/, and register entries into the @ab/sources registry.

  --slug=<slug> may be repeated (or comma-separated) to limit the run to a
  subset of registered publication slugs. Defaults to every slug wired in
  ACS_DETECTED_EDITION_TO_SLUG (currently: ppl-airplane-6c only).
`;

export interface CliArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	readonly slugs: readonly string[] | null;
	readonly help: boolean;
}

function defaultCacheRoot(): string {
	return process.env.AIRBOSS_HANDBOOK_CACHE ?? join(homedir(), 'Documents', 'airboss-handbook-cache');
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let cacheRoot = defaultCacheRoot();
	let derivativeRoot = join(process.cwd(), 'acs');
	const slugsAccum: string[] = [];
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--cache=')) cacheRoot = arg.slice('--cache='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else if (arg.startsWith('--slug=')) {
			for (const part of arg.slice('--slug='.length).split(',')) {
				const trimmed = part.trim();
				if (trimmed.length > 0) slugsAccum.push(trimmed);
			}
		} else return { error: `unknown argument: ${arg}` };
	}

	return {
		cacheRoot,
		derivativeRoot,
		slugs: slugsAccum.length === 0 ? null : slugsAccum,
		help,
	};
}

/**
 * CLI entry point. Returns exit code. Never throws on user-facing errors;
 * unexpected exceptions propagate.
 */
export async function runIngestCli(argv: readonly string[]): Promise<number> {
	const parsed = parseCliArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${USAGE}`);
		return 2;
	}
	if (parsed.help) {
		process.stdout.write(USAGE);
		return 0;
	}

	const report = await runAcsIngest({
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
		slugs: parsed.slugs ?? undefined,
	});

	process.stdout.write(
		`acs ingest:\n` +
			`  scanned=${report.publicationsScanned} ingested=${report.publicationsIngested} alreadyAccepted=${report.publicationsAlreadyAccepted} skipped=${report.publicationsSkipped}\n` +
			`  entries: publications=${report.entriesIngested.publications} areas=${report.entriesIngested.areas} tasks=${report.entriesIngested.tasks} elements=${report.entriesIngested.elements}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  index=${report.indexPath}\n`,
	);
	for (const reason of report.skipReasons) {
		process.stdout.write(`  skip: ${reason}\n`);
	}
	return 0;
}
