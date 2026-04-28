/**
 * Phase 8 -- Advisory Circular corpus ingestion.
 *
 * Source of truth: ADR 019 §1.2 ("AC"), §2.4 (atomic batch promotion), §2.6
 * (registry population), and the WP at `docs/work-packages/reference-ac-ingestion/`.
 *
 * Steps per AC found in the cache:
 *
 *   1. Walk `<cache>/ac/<doc-slug>/<rev>/manifest.json` (downloader output).
 *   2. Run `extractPdf` on the AC PDF; confirm cover-page slug + detect the
 *      effective date.
 *   3. Write derivative tree under `<repo>/ac/<doc-slug>/<rev>/`:
 *        - `document.md`     full PDF text
 *        - `manifest.json`   per-AC manifest with body_sha256 audit trail
 *   4. Append an entry to corpus-level `<repo>/ac/index.json`.
 *   5. Insert one `SourceEntry` per AC into the active SOURCES table; insert
 *      one `Edition` per ingested (id, publication_date) into EDITIONS.
 *   6. Record an atomic batch promotion `pending -> accepted` under
 *      `PHASE_8_REVIEWER_ID`. Skip when entries are already accepted.
 *
 * Idempotent: re-running with the same `--cache=` and `--out=` is a no-op.
 *
 * Live PDF re-fetching is NOT this script's job. The downloader
 * (`scripts/download-sources.ts`) populates the cache; this script reads it.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { extractPdf, findEffectiveDate } from '../pdf/index.ts';
import { __editions_internal__ } from '../registry/editions.ts';
import { getEntryLifecycle, recordPromotion } from '../registry/lifecycle.ts';
import { __sources_internal__ } from '../registry/sources.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import type { AcCorpusIndex, AcCorpusIndexEntry, AcManifestFile } from './derivative-reader.ts';

export const PHASE_8_REVIEWER_ID = 'phase-8-ac-ingestion';

const CORPUS = 'ac';
const DOC_SHORT = 'AC';
const DOC_FORMAL_PREFIX = 'FAA Advisory Circular';

export interface IngestArgs {
	/** Path to the cache root containing `ac/<doc-slug>/<rev>/<filename>.pdf` + downloader manifest. */
	readonly cacheRoot: string;
	/** Path to the in-repo derivative root (default `<cwd>/ac`). */
	readonly derivativeRoot: string;
}

export interface IngestReport {
	readonly acsScanned: number;
	readonly acsIngested: number;
	readonly acsAlreadyAccepted: number;
	readonly acsSkipped: number;
	readonly skipReasons: readonly string[];
	readonly promotionBatchId: string | null;
	readonly indexPath: string;
}

interface CachedAc {
	readonly docSlug: string;
	readonly docNumber: string;
	readonly revision: string;
	readonly pdfPath: string;
	readonly downloaderManifest: DownloaderManifest;
}

interface DiscoveryResult {
	readonly acs: readonly CachedAc[];
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

/**
 * Resolve the canonical doc number and revision letter from the downloader's
 * manifest. The downloader's `edition` field is authoritative: it preserves
 * the FAA's edition string (e.g. `J`, `1D`, `7D`) verbatim. The doc number is
 * everything before the trailing letter.
 *
 * Cases:
 *   edition='J'   doc='61-65'      -> docNumber='61-65'   rev='j'
 *   edition='1D'  doc='91-21.1'    -> docNumber='91-21.1' rev='d'  (the '1' is the doc's trailing component, not the revision)
 *   edition='7D'  doc='150-5210-7' -> docNumber='150/5210-7' rev='d'  (the '7' is the sub-document number)
 *   edition='current' (no revision) -> null  (caller skips with reason)
 *
 * The 'edition' field encodes "the rest of the AC name after the doc number".
 * When it's a single letter, that's the revision. When it's `<digits><letter>`,
 * the digits are the trailing component of the doc number that the downloader
 * tucked into the edition for filesystem layout purposes -- we put it back
 * onto the doc number and treat the trailing letter as the revision.
 */
function resolveDocAndRevision(
	dm: DownloaderManifest,
	cacheDocDir: string,
): { docNumber: string; revision: string } | { skip: string } {
	const edition = dm.edition;
	if (edition === 'current' || edition.length === 0) {
		return { skip: `${cacheDocDir}: edition='${edition}' -- unrevisioned ACs are rejected by ADR 019 §1.2 validator (skip)` };
	}

	// Pull the trailing letter as revision.
	const m = /^([0-9-_.]*)([A-Za-z])$/.exec(edition);
	if (m === null) {
		return { skip: `${cacheDocDir}: edition='${edition}' has no trailing revision letter (skip)` };
	}
	const editionDigitsTail = m[1] ?? '';
	const revLetter = m[2];
	if (revLetter === undefined) {
		return { skip: `${cacheDocDir}: edition='${edition}' parse error (skip)` };
	}

	// The downloader doc-dir is `ac-<doc-number-with-dots-as-dashes>-<edition-lowercased>`.
	// Strip the `ac-` prefix and the trailing edition to recover the doc number's
	// filesystem-safe form. Then convert filesystem dashes back to the FAA's
	// canonical separators (dots for the last group when needed; slash is left
	// out because FAA slash-style ACs (e.g. 150/5210-7) are not yet supported
	// by the locator scheme -- they get skipped here for a follow-up WP).
	if (!cacheDocDir.startsWith('ac-')) {
		return { skip: `${cacheDocDir}: directory does not start with 'ac-' (skip)` };
	}
	const editionLower = edition.toLowerCase();
	const tail = cacheDocDir.slice('ac-'.length);
	if (!tail.endsWith(`-${editionLower}`)) {
		return { skip: `${cacheDocDir}: directory tail does not match edition suffix '-${editionLower}' (skip)` };
	}
	const docDigits = tail.slice(0, tail.length - editionLower.length - 1);

	// Re-attach any leading-edition digits to the doc number. This handles
	// edition='1D' (digits='1') where the '1' belongs to the doc number, not
	// the revision -- the downloader's filesystem layout split it off.
	let docNumber = docDigits;
	if (editionDigitsTail.length > 0) {
		docNumber = `${docDigits}.${editionDigitsTail}`;
	}

	// Detect FAA slash-style doc numbers (e.g. 150/5210-7). The downloader
	// flattens slashes to dashes; we cannot deterministically reverse that.
	// For now, skip these with a reason -- they need an explicit lookup table
	// of slash-style AC series (a follow-up WP).
	if (/^[0-9]{3}-[0-9]{4}/.test(docNumber)) {
		return {
			skip: `${cacheDocDir}: doc number '${docNumber}' looks like FAA slash-style (e.g. 150/5210-7) -- not yet supported by ac/ locator (skip)`,
		};
	}

	return { docNumber, revision: revLetter.toLowerCase() };
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
 * Walk the cache and collect every AC ready for ingestion. The downloader
 * places each AC under `<cache>/ac/<doc-dir>/<edition-as-on-disk>/{<filename>.pdf,manifest.json}`.
 * The downloader manifest's `edition` field is authoritative for the revision.
 */
function discoverCachedAcs(cacheRoot: string): DiscoveryResult {
	const acRoot = join(cacheRoot, 'ac');
	if (!existsSync(acRoot)) return { acs: [], skipped: [] };
	const acs: CachedAc[] = [];
	const skipped: string[] = [];
	for (const docDir of readdirSync(acRoot)) {
		const docPath = join(acRoot, docDir);
		if (!statSync(docPath).isDirectory()) continue;
		// Each doc-dir contains one or more edition subdirs; each holds a manifest.
		for (const revDir of readdirSync(docPath)) {
			const revPath = join(docPath, revDir);
			if (!statSync(revPath).isDirectory()) continue;
			const downloaderManifestPath = join(revPath, 'manifest.json');
			if (!existsSync(downloaderManifestPath)) {
				skipped.push(`${docDir}/${revDir}: no downloader manifest (skip)`);
				continue;
			}
			let dm: DownloaderManifest;
			try {
				dm = readDownloaderManifest(downloaderManifestPath);
			} catch (e) {
				skipped.push(`${docDir}/${revDir}: invalid downloader manifest -- ${(e as Error).message} (skip)`);
				continue;
			}
			const resolved = resolveDocAndRevision(dm, docDir);
			if ('skip' in resolved) {
				skipped.push(resolved.skip);
				continue;
			}
			const pdfPath = join(revPath, dm.source_filename);
			if (!existsSync(pdfPath)) {
				skipped.push(`${docDir}/${revDir}: PDF not found at ${dm.source_filename} (skip)`);
				continue;
			}
			acs.push({
				docSlug: resolved.docNumber.replace(/\./g, '-'),
				docNumber: resolved.docNumber,
				revision: resolved.revision,
				pdfPath,
				downloaderManifest: dm,
			});
		}
	}
	return { acs, skipped };
}

function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function buildSourceEntry(args: { ac: CachedAc; title: string; publicationDate: Date }): SourceEntry {
	const { ac, title, publicationDate } = args;
	const id = `airboss-ref:${CORPUS}/${ac.docNumber}/${ac.revision}` as SourceId;
	const revUpper = ac.revision.toUpperCase();
	return {
		id,
		corpus: CORPUS,
		canonical_short: `${DOC_SHORT} ${ac.docNumber}${revUpper}`,
		canonical_formal: `${DOC_FORMAL_PREFIX} ${ac.docNumber}${revUpper}`,
		canonical_title: title,
		last_amended_date: publicationDate,
		lifecycle: 'pending',
	};
}

/**
 * Run AC corpus ingestion. Walks the cache, extracts each PDF, writes
 * derivatives, populates the registry. Idempotent.
 */
export async function runAcIngest(args: IngestArgs): Promise<IngestReport> {
	const discovery = discoverCachedAcs(args.cacheRoot);
	const cached = discovery.acs;
	const skipReasons: string[] = [...discovery.skipped];
	let acsIngested = 0;
	let acsAlreadyAccepted = 0;
	let acsSkipped = discovery.skipped.length;

	ensureDir(args.derivativeRoot);

	const sourcesPatch: Record<string, SourceEntry> = { ...__sources_internal__.getActiveTable() };
	const editionsPatch = new Map(__editions_internal__.getActiveTable());

	const indexEntries: AcCorpusIndexEntry[] = [];
	const entriesToPromote: SourceId[] = [];

	for (const ac of cached) {
		try {
			const doc = extractPdf(ac.pdfPath);
			const coverPages = doc.pages.slice(0, 3);

			// Title is hard to detect deterministically across AC layouts. Use
			// the PDF's metadata title when present, else fall back to the
			// downloader's filename basename. Authors/reviewers can correct
			// canonical_title inline in the manifest later.
			const titleFromMeta = (doc.metadata?.title ?? '').trim();
			const titleFromFilename = ac.downloaderManifest.source_filename
				.replace(/\.pdf$/i, '')
				.replace(/^AC[_-]/i, '')
				.replace(/_/g, ' ');
			const title = titleFromMeta.length > 0 ? titleFromMeta : titleFromFilename;

			const detectedDate = findEffectiveDate(coverPages);
			const fallbackDate = ac.downloaderManifest.last_modified ?? ac.downloaderManifest.fetched_at;
			const publicationIso = detectedDate ?? new Date(fallbackDate).toISOString().slice(0, 10);
			const publicationDate = new Date(publicationIso);
			if (Number.isNaN(publicationDate.getTime())) {
				skipReasons.push(`${ac.docNumber}/${ac.revision}: could not derive publication date`);
				acsSkipped += 1;
				continue;
			}

			// Compose the full document body. AC PDFs render reasonably under
			// the default `-layout` mode; section-level extraction is a follow-up.
			const documentBody = doc.pages.map((p) => p.text).join('\n\n');
			const bodySha = sha256(documentBody);

			const docDir = join(args.derivativeRoot, ac.docSlug, ac.revision);
			ensureDir(docDir);
			const bodyPath = join(docDir, 'document.md');
			writeFileSync(bodyPath, documentBody, 'utf-8');

			const manifest: AcManifestFile = {
				schema_version: 1,
				corpus: 'ac',
				doc_slug: ac.docSlug,
				doc_number: ac.docNumber,
				revision: ac.revision,
				title,
				publisher: 'FAA',
				publication_date: detectedDate,
				source_url: ac.downloaderManifest.source_url,
				source_sha256: ac.downloaderManifest.source_sha256,
				fetched_at: ac.downloaderManifest.fetched_at,
				page_count: doc.pageCount,
				body_path: `ac/${ac.docSlug}/${ac.revision}/document.md`,
				body_sha256: bodySha,
				sections: [],
				changes: [],
			};
			const manifestPath = join(docDir, 'manifest.json');
			writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

			const entry = buildSourceEntry({ ac, title, publicationDate });
			const existing = sourcesPatch[entry.id];
			const overlay = getEntryLifecycle(entry.id);
			if (existing !== undefined && overlay === 'accepted') {
				acsAlreadyAccepted += 1;
			} else {
				sourcesPatch[entry.id] = entry;
				acsIngested += 1;
				entriesToPromote.push(entry.id);
			}

			const editionRecord: Edition = {
				id: publicationIso,
				published_date: publicationDate,
				source_url: ac.downloaderManifest.source_url,
			};
			const existingEditions = editionsPatch.get(entry.id) ?? [];
			const hasEdition = existingEditions.some((e) => e.id === editionRecord.id);
			if (!hasEdition) {
				editionsPatch.set(entry.id, [...existingEditions, editionRecord]);
			}

			indexEntries.push({
				doc_slug: ac.docSlug,
				doc_number: ac.docNumber,
				revision: ac.revision,
				title,
				publication_date: detectedDate,
				manifest_path: `ac/${ac.docSlug}/${ac.revision}/manifest.json`,
			});
		} catch (e) {
			skipReasons.push(`${ac.docNumber}/${ac.revision}: extraction failed -- ${(e as Error).message}`);
			acsSkipped += 1;
		}
	}

	__sources_internal__.setActiveTable(sourcesPatch as Record<SourceId, SourceEntry>);
	__editions_internal__.setActiveTable(editionsPatch);

	let promotionBatchId: string | null = null;
	if (entriesToPromote.length > 0) {
		const result = recordPromotion({
			corpus: CORPUS,
			reviewerId: PHASE_8_REVIEWER_ID,
			scope: entriesToPromote,
			inputSource: args.cacheRoot,
			targetLifecycle: 'accepted',
		});
		if (!result.ok) {
			throw new Error(`ac ingest batch promotion failed: ${result.error}`);
		}
		promotionBatchId = result.batch.id;
	}

	const corpusIndex: AcCorpusIndex = {
		schema_version: 1,
		fetched_at: new Date().toISOString(),
		entries: indexEntries.sort((a, b) => a.doc_slug.localeCompare(b.doc_slug)),
	};
	const indexPath = join(args.derivativeRoot, 'index.json');
	writeFileSync(indexPath, `${JSON.stringify(corpusIndex, null, 2)}\n`, 'utf-8');

	return {
		acsScanned: cached.length + discovery.skipped.length,
		acsIngested,
		acsAlreadyAccepted,
		acsSkipped,
		skipReasons,
		promotionBatchId,
		indexPath,
	};
}

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

const USAGE = `usage:
  bun run ingest ac [--cache=<path>] [--out=<path>]
  bun run ingest ac --help

  Walk the AC cache (default: $AIRBOSS_HANDBOOK_CACHE/ac/ or
  ~/Documents/airboss-handbook-cache/ac/), extract each PDF, write derivatives
  to <repo>/ac/, and register entries into the @ab/sources registry.
`;

export interface CliArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	readonly help: boolean;
}

function defaultCacheRoot(): string {
	return process.env.AIRBOSS_HANDBOOK_CACHE ?? join(homedir(), 'Documents', 'airboss-handbook-cache');
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let cacheRoot = defaultCacheRoot();
	let derivativeRoot = join(process.cwd(), 'ac');
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

	const report = await runAcIngest({
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
	});

	process.stdout.write(
		`ac ingest:\n` +
			`  scanned=${report.acsScanned} ingested=${report.acsIngested} alreadyAccepted=${report.acsAlreadyAccepted} skipped=${report.acsSkipped}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  index=${report.indexPath}\n`,
	);
	for (const reason of report.skipReasons) {
		process.stdout.write(`  skip: ${reason}\n`);
	}
	return 0;
}
