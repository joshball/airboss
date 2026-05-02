/**
 * `handbooks-extras` corpus ingestion -- whole-doc-only Class C handbooks.
 *
 * Source of truth: ADR 019 §1.2 (Handbooks corpus), ADR 021 (cache layout),
 * library-broad-extraction-survey gap 5, and
 * `docs/work-packages/handbooks-extras-ingestion/spec.md`.
 *
 * Six FAA handbooks ship as whole-doc-only PDFs (no per-chapter PDFs from
 * the publisher): risk management, aviation instructor, IFH, IPH, AMT-G,
 * AMT-P. The chapter-aware `handbooks` ingest at
 * `libs/sources/src/handbooks/ingest.ts` walks a Python-extracted manifest
 * with `sections[]`; that pipeline never produced one for these six. This
 * module fills that gap by mirroring AC's whole-doc pipeline:
 *
 *   1. Walk `scripts/sources/config/handbooks-extras.yaml` via
 *      `loadHandbooksExtrasConfig`.
 *   2. For each entry: locate the cached PDF + manifest under
 *      `<cache>/handbooks/<doc_id>/<doc_id>.pdf` (per ADR 021's flat layout
 *      for whole-doc-only handbooks, written by the downloader's `flatPlan`).
 *   3. `extractPdf` the PDF; concatenate page text into a single document body.
 *   4. Map the FAA `doc_id` (e.g. `faa-h-8083-2`) + edition (`2A`) to a
 *      friendly slug + edition slug (`risk-management` + `8083-2A`) via
 *      `DOC_ID_TO_FRIENDLY` -- the locator/registry vocabulary.
 *   5. Write derivatives under `<repo>/handbooks/<friendly-slug>/<faaDir>/`:
 *        - `document.md`     full whole-doc markdown
 *        - `manifest.json`   `ManifestFile` with `body_path` + empty
 *                            `sections[]` (so the existing `handbooks`
 *                            resolver picks up whole-doc references).
 *   6. Insert one `SourceEntry` per (friendly-slug, edition) into the active
 *      `SOURCES` table; insert one `Edition` into `EDITIONS`.
 *   7. Record an atomic batch promotion `pending -> accepted` under
 *      `HANDBOOKS_EXTRAS_REVIEWER_ID`. Skip when entries are already accepted.
 *
 * Idempotent: re-running with the same `--cache=` and `--out=` is a no-op.
 *
 * Live PDF re-fetching is NOT this script's job. The downloader populates
 * the cache (`bun run sources download --include-handbooks-extras`); this
 * script reads it.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { type AviationTopic, type CertApplicability, resolveCacheRoot } from '@ab/constants';
import { writeIfChanged } from '../io/write-if-changed.ts';
import { extractPdf } from '../pdf/index.ts';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import {
	type ExtrasCorpusIndex,
	type ExtrasCorpusIndexEntry,
	type ExtrasManifestFile,
	loadHandbooksExtrasYaml,
	readCacheManifest,
} from './derivative-reader.ts';

export const HANDBOOKS_EXTRAS_REVIEWER_ID = 'handbooks-extras-ingestion';

const CORPUS = 'handbooks';

/**
 * Map from FAA `doc_id` (as the YAML / cache writes it) to the friendly-slug
 * + edition-slug pair the locator and registry consume.
 *
 * Keys come from `scripts/sources/config/handbooks-extras.yaml`; values match
 * `HANDBOOK_DOC_SLUGS` in `libs/sources/src/handbooks/locator.ts` and
 * `HANDBOOK_DOC_EDITIONS` in `.../handbooks/resolver.ts`. Adding a new entry
 * means updating all three locations plus `HANDBOOK_LIVE_URLS` and
 * `DOC_DISPLAY` (in `handbooks/ingest.ts`).
 */
export const DOC_ID_TO_FRIENDLY: Readonly<
	Record<string, { readonly slug: string; readonly editionSlug: string; readonly faaDir: string }>
> = {
	'faa-h-8083-2': { slug: 'risk-management', editionSlug: '8083-2A', faaDir: 'FAA-H-8083-2A' },
	'faa-h-8083-9': { slug: 'aviation-instructor', editionSlug: '8083-9', faaDir: 'FAA-H-8083-9' },
	'faa-h-8083-15': { slug: 'ifh', editionSlug: '8083-15B', faaDir: 'FAA-H-8083-15B' },
	'faa-h-8083-16': { slug: 'iph', editionSlug: '8083-16B', faaDir: 'FAA-H-8083-16B' },
	'faa-h-8083-30': { slug: 'amt-general', editionSlug: '8083-30B', faaDir: 'FAA-H-8083-30B' },
	'faa-h-8083-32': { slug: 'amt-powerplant', editionSlug: '8083-32B', faaDir: 'FAA-H-8083-32B' },
	// Non-H-numbered FAA pamphlet. Synthetic doc_id since FAA never assigned
	// a Handbook number to Tips on Mountain Flying.
	'faa-mtn-tips': { slug: 'tips-mountain-flying', editionSlug: 'mtn-2003', faaDir: 'MTN-2003' },
};

/**
 * Per-friendly-slug display strings used to build canonical_short /
 * canonical_formal. Mirrors the entries `handbooks/ingest.ts` exports as
 * `DOC_DISPLAY` for the chapter-aware handbooks; we duplicate the relevant
 * subset here so a missing entry surfaces as a build error in this module
 * rather than a runtime null deref.
 */
const FRIENDLY_DISPLAY: Readonly<Record<string, { readonly short: string; readonly formal: string }>> = {
	'risk-management': { short: 'RMH', formal: 'Risk Management Handbook' },
	'aviation-instructor': { short: 'AIH', formal: "Aviation Instructor's Handbook" },
	ifh: { short: 'IFH', formal: 'Instrument Flying Handbook' },
	iph: { short: 'IPH', formal: 'Instrument Procedures Handbook' },
	'amt-general': { short: 'AMT-G', formal: 'Aviation Maintenance Technician Handbook -- General' },
	'amt-powerplant': { short: 'AMT-P', formal: 'Aviation Maintenance Technician Handbook -- Powerplant' },
	'tips-mountain-flying': { short: 'MTN', formal: 'Tips on Mountain Flying' },
};

export interface IngestArgs {
	/** Path to the cache root containing `handbooks/<doc_id>/<doc_id>.pdf` (ADR 021). */
	readonly cacheRoot: string;
	/** Path to the in-repo derivative root (default `<cwd>/handbooks`). */
	readonly derivativeRoot: string;
}

export interface IngestReport {
	readonly scanned: number;
	readonly ingested: number;
	readonly alreadyAccepted: number;
	readonly skipped: number;
	readonly skipReasons: readonly string[];
	readonly promotionBatchId: string | null;
	readonly indexPath: string;
}

interface CachedExtra {
	readonly docId: string;
	readonly edition: string | null;
	readonly slug: string;
	readonly editionSlug: string;
	readonly faaDir: string;
	readonly pdfPath: string;
	readonly sourceUrl: string;
	readonly sourceSha256: string;
	readonly fetchedAt: string;
	readonly lastModified?: string;
	readonly subjects: readonly AviationTopic[];
	readonly primaryCert: CertApplicability | null;
}

interface DiscoveryResult {
	readonly extras: readonly CachedExtra[];
	readonly skipped: readonly string[];
}

/**
 * Walk the YAML config + cache and collect every handbook-extra ready for
 * ingestion. The YAML is the source-of-truth list; the cache supplies the
 * actual bytes. Missing cache entries are reported as `skipped` (the
 * downloader gates these behind `--include-handbooks-extras`, so it's
 * normal to see misses on machines that haven't run the opt-in fetch).
 */
function discover(cacheRoot: string): DiscoveryResult {
	const yaml = loadHandbooksExtrasYaml();
	const extras: CachedExtra[] = [];
	const skipped: string[] = [];

	for (const entry of yaml.entries) {
		const friendly = DOC_ID_TO_FRIENDLY[entry.doc_id];
		if (friendly === undefined) {
			skipped.push(`${entry.doc_id}: no friendly-slug mapping in DOC_ID_TO_FRIENDLY (skip)`);
			continue;
		}

		const cacheDir = join(cacheRoot, 'handbooks', entry.doc_id);
		const pdfPath = join(cacheDir, `${entry.doc_id}.pdf`);
		const manifestPath = join(cacheDir, 'manifest.json');

		if (!existsSync(pdfPath)) {
			skipped.push(
				`${entry.doc_id}: PDF not cached at ${pdfPath} (run \`sources download --include-handbooks-extras\`)`,
			);
			continue;
		}
		if (!existsSync(manifestPath)) {
			skipped.push(`${entry.doc_id}: cache manifest not found at ${manifestPath} (skip)`);
			continue;
		}

		let cacheManifest: ReturnType<typeof readCacheManifest>;
		try {
			cacheManifest = readCacheManifest(manifestPath);
		} catch (e) {
			skipped.push(`${entry.doc_id}: cache manifest invalid -- ${(e as Error).message} (skip)`);
			continue;
		}
		if (cacheManifest === null) {
			skipped.push(`${entry.doc_id}: cache manifest at ${manifestPath} is malformed (skip)`);
			continue;
		}

		extras.push({
			docId: entry.doc_id,
			edition: entry.edition,
			slug: friendly.slug,
			editionSlug: friendly.editionSlug,
			faaDir: friendly.faaDir,
			pdfPath,
			sourceUrl: cacheManifest.primary.source_url,
			sourceSha256: cacheManifest.primary.source_sha256,
			fetchedAt: cacheManifest.primary.fetched_at,
			...(cacheManifest.primary.last_modified !== undefined
				? { lastModified: cacheManifest.primary.last_modified }
				: {}),
			subjects: entry.subjects,
			primaryCert: entry.primary_cert,
		});
	}

	return { extras, skipped };
}

function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function buildSourceEntry(args: { extra: CachedExtra; title: string; publishedDate: Date }): SourceEntry {
	const { extra, title, publishedDate } = args;
	const display = FRIENDLY_DISPLAY[extra.slug];
	if (display === undefined) {
		throw new Error(`handbooks-extras: no FRIENDLY_DISPLAY for slug "${extra.slug}"`);
	}
	const id = `airboss-ref:${CORPUS}/${extra.slug}/${extra.editionSlug}` as SourceId;
	return {
		id,
		corpus: CORPUS,
		canonical_short: display.short,
		canonical_formal: `${display.formal} (${extra.faaDir})`,
		canonical_title: title,
		last_amended_date: publishedDate,
		lifecycle: 'pending',
	};
}

/**
 * Run handbooks-extras ingestion. Walks the cache, extracts each PDF,
 * writes derivatives, populates the registry. Idempotent.
 */
export async function runHandbooksExtrasIngest(args: IngestArgs): Promise<IngestReport> {
	const discovery = discover(args.cacheRoot);
	const cached = discovery.extras;
	const skipReasons: string[] = [...discovery.skipped];
	let ingested = 0;
	let alreadyAccepted = 0;
	let skipped = discovery.skipped.length;

	ensureDir(args.derivativeRoot);

	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const indexEntries: ExtrasCorpusIndexEntry[] = [];
	const entriesToPromote: SourceId[] = [];

	for (const extra of cached) {
		try {
			const doc = extractPdf(extra.pdfPath);

			// Title detection: prefer PDF metadata title; fall back to the
			// friendly display formal name. Authors can correct
			// canonical_title inline in the manifest later.
			const titleFromMeta = (doc.metadata?.title ?? '').trim();
			const display = FRIENDLY_DISPLAY[extra.slug];
			const title = titleFromMeta.length > 0 ? titleFromMeta : (display?.formal ?? extra.docId);

			// Publication date: derive from the cache manifest's last_modified
			// HTTP header when present, else fetched_at. The YAML edition
			// field carries the FAA's publication revision letter, not a
			// date; we surface that on the SourceEntry's canonical strings
			// instead.
			const fallbackDate = extra.lastModified ?? extra.fetchedAt;
			const publishedDate = new Date(fallbackDate);
			if (Number.isNaN(publishedDate.getTime())) {
				skipReasons.push(`${extra.docId}: could not derive publication date from "${fallbackDate}"`);
				skipped += 1;
				continue;
			}
			const publicationIso = publishedDate.toISOString().slice(0, 10);

			// Compose the full document body. Whole-doc PDFs render under the
			// default `-layout` mode; chapter-level extraction is not
			// applicable for these Class C handbooks.
			const documentBody = doc.pages.map((p) => p.text).join('\n\n');
			const bodySha = sha256(documentBody);

			const docDir = join(args.derivativeRoot, extra.slug, extra.faaDir);
			ensureDir(docDir);
			const bodyPath = join(docDir, 'document.md');
			writeIfChanged(bodyPath, documentBody);

			const manifest: ExtrasManifestFile = {
				document_slug: extra.slug,
				edition: extra.editionSlug,
				kind: 'whole-doc',
				title,
				publisher: 'FAA',
				source_url: extra.sourceUrl,
				source_checksum: extra.sourceSha256,
				fetched_at: extra.fetchedAt,
				sections: [],
				body_path: `handbooks/${extra.slug}/${extra.faaDir}/document.md`,
				body_sha256: bodySha,
				page_count: doc.pageCount,
				doc_id: extra.docId,
				faa_edition: extra.edition,
				subjects: extra.subjects,
				primary_cert: extra.primaryCert,
			};
			const manifestPath = join(docDir, 'manifest.json');
			writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

			const entry = buildSourceEntry({ extra, title, publishedDate });
			const existing = sourcesPatch[entry.id];
			const overlay = getEntryLifecycle(entry.id);
			if (existing !== undefined && overlay === 'accepted') {
				alreadyAccepted += 1;
			} else {
				sourcesPatch[entry.id] = entry;
				ingested += 1;
				entriesToPromote.push(entry.id);
			}

			const editionRecord: Edition = {
				id: extra.editionSlug,
				published_date: publishedDate,
				source_url: extra.sourceUrl,
			};
			const existingEditions = editionsPatch.get(entry.id) ?? [];
			const hasEdition = existingEditions.some((e) => e.id === editionRecord.id);
			if (!hasEdition) {
				editionsPatch.set(entry.id, [...existingEditions, editionRecord]);
			}

			indexEntries.push({
				doc_id: extra.docId,
				slug: extra.slug,
				edition_slug: extra.editionSlug,
				faa_dir: extra.faaDir,
				title,
				publication_date: publicationIso,
				manifest_path: `handbooks/${extra.slug}/${extra.faaDir}/manifest.json`,
			});
		} catch (e) {
			skipReasons.push(`${extra.docId}: extraction failed -- ${(e as Error).message}`);
			skipped += 1;
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

	let promotionBatchId: string | null = null;
	if (entriesToPromote.length > 0) {
		const result = await recordPromotion({
			corpus: CORPUS,
			reviewerId: HANDBOOKS_EXTRAS_REVIEWER_ID,
			scope: entriesToPromote,
			inputSource: args.cacheRoot,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`handbooks-extras ingest batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

	// Use the max per-source `fetched_at` so re-running with no upstream
	// change leaves the index byte-equal (ADR 022 idempotent regen).
	// Stamping `new Date()` here would mtime-bump the file every run.
	const sourceFetchedAtValues = cached.map((c) => c.fetchedAt).filter((v) => v.length > 0);
	const corpusFetchedAt =
		sourceFetchedAtValues.length > 0 ? sourceFetchedAtValues.slice().sort().slice(-1)[0] : '1970-01-01T00:00:00.000Z';
	const corpusIndex: ExtrasCorpusIndex = {
		schema_version: 1,
		fetched_at: corpusFetchedAt ?? '1970-01-01T00:00:00.000Z',
		entries: indexEntries.sort((a, b) => a.slug.localeCompare(b.slug)),
	};
	const indexPath = join(args.derivativeRoot, 'handbooks-extras-index.json');
	writeIfChanged(indexPath, `${JSON.stringify(corpusIndex, null, 2)}\n`);

	return {
		scanned: cached.length + discovery.skipped.length,
		ingested,
		alreadyAccepted,
		skipped,
		skipReasons,
		promotionBatchId,
		indexPath,
	};
}

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

const USAGE = `usage:
  bun run sources register handbooks-extras [--cache=<path>] [--out=<path>]
  bun run sources register handbooks-extras --help

  Walk the handbooks-extras cache (default: $AIRBOSS_HANDBOOK_CACHE/handbooks/
  or ~/Documents/airboss-handbook-cache/handbooks/), extract each whole-doc
  PDF, write per-doc manifest.json + document.md under
  <repo>/handbooks/<friendly-slug>/<faa-dir>/, and register entries into the
  @ab/sources registry. Idempotent.
`;

export interface CliArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	readonly help: boolean;
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let cacheRoot = resolveCacheRoot({ ensureExists: false });
	let derivativeRoot = join(process.cwd(), 'handbooks');
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--cache=')) cacheRoot = arg.slice('--cache='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else return { error: `unknown argument: ${arg}` };
	}

	return { cacheRoot, derivativeRoot, help };
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

	const report = await runHandbooksExtrasIngest({
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
	});

	process.stdout.write(
		`handbooks-extras ingest:\n` +
			`  scanned=${report.scanned} ingested=${report.ingested} alreadyAccepted=${report.alreadyAccepted} skipped=${report.skipped}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  index=${report.indexPath}\n`,
	);
	for (const reason of report.skipReasons) {
		process.stdout.write(`  skip: ${reason}\n`);
	}
	return 0;
}
