/**
 * Phase 8 -- Advisory Circular corpus ingestion.
 *
 * Source of truth: ADR 019 §1.2 ("AC"), §2.4 (atomic batch promotion), §2.6
 * (registry population), and the WP at `docs/work-packages/reference-ac-ingestion/`.
 *
 * Steps per AC found in the cache:
 *
 *   1. Read `<cache>/ac/manifest.json` (per-corpus index, ADR 021); each entry
 *      points at a flat `<cache>/ac/<doc-id>.pdf`.
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
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCacheRoot } from '@ab/constants';
import { writeIfChanged } from '../io/write-if-changed.ts';
import { extractPdf, findEffectiveDate } from '../pdf/index.ts';
import { commitIngestBatch, getEntryLifecycle } from '../registry/lifecycle.ts';
import { classifySkipReasons, INGEST_EXIT_CODES } from '../shared/exit-codes.ts';
import { ShaMismatchError, verifyCachedSha } from '../shared/sha-verify.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import type { AcCorpusIndex, AcCorpusIndexEntry, AcManifestFile } from './derivative-reader.ts';

export const PHASE_8_REVIEWER_ID = 'phase-8-ac-ingestion';

const CORPUS = 'ac';
const DOC_SHORT = 'AC';
const DOC_FORMAL_PREFIX = 'FAA Advisory Circular';

export interface IngestArgs {
	/** Path to the cache root containing `ac/<doc-id>.pdf` + per-corpus `ac/manifest.json` (ADR 021). */
	readonly cacheRoot: string;
	/** Path to the in-repo derivative root (default `<cwd>/ac`). */
	readonly derivativeRoot: string;
	/**
	 * Disable per-file SHA-256 verification against the manifest's recorded
	 * `source_sha256`. Default: false (verification ON, per the 2026-05-01
	 * backend review). Production runs must leave this false; only set true
	 * for tests that knowingly pass mutated cache fixtures.
	 */
	readonly skipShaVerify?: boolean;
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
	readonly edition: string | null;
	readonly source_url: string;
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly fetched_at: string;
	readonly last_modified?: string;
}

/**
 * Resolve the canonical doc number and revision letter from the downloader's
 * manifest. The downloader's `edition` field is authoritative: it preserves
 * the FAA's edition string (e.g. `J`, `1D`, `7D`) verbatim, or `null` for
 * unrevisioned ACs. The doc number is recovered from `dm.doc` (a slug like
 * `ac-61-65-j` or `ac-91-21-1d`).
 *
 * Cases:
 *   edition='J'   doc='ac-61-65-j'   -> docNumber='61-65'   rev='j'
 *   edition='1D'  doc='ac-91-21-1d'  -> docNumber='91-21.1' rev='d'  (the '1' is the doc's trailing component, not the revision)
 *   edition=null  doc='ac-91-92'     -> null  (caller skips: unrevisioned ACs rejected by ADR 019 §1.2)
 *
 * The 'edition' field encodes "the rest of the AC name after the doc number".
 * When it's a single letter, that's the revision. When it's `<digits><letter>`,
 * the digits are the trailing component of the doc number that the downloader
 * tucked into the edition for filesystem layout purposes -- we put it back
 * onto the doc number and treat the trailing letter as the revision.
 */
function resolveDocAndRevision(dm: DownloaderManifest): { docNumber: string; revision: string } | { skip: string } {
	const edition = dm.edition;
	const slug = dm.doc;
	if (edition === null || edition === undefined || edition.length === 0) {
		return {
			skip: `${slug}: edition is null -- unrevisioned ACs are rejected by ADR 019 §1.2 validator (skip)`,
		};
	}

	// Pull the trailing letter as revision.
	const m = /^([0-9-_.]*)([A-Za-z])$/.exec(edition);
	if (m === null) {
		return { skip: `${slug}: edition='${edition}' has no trailing revision letter (skip)` };
	}
	const editionDigitsTail = m[1] ?? '';
	const revLetter = m[2];
	if (revLetter === undefined) {
		return { skip: `${slug}: edition='${edition}' parse error (skip)` };
	}

	// `dm.doc` is `ac-<doc-number-with-dots-as-dashes>-<edition-lowercased>`.
	// Strip the `ac-` prefix and the trailing edition to recover the doc number's
	// filesystem-safe form. Then convert filesystem dashes back to the FAA's
	// canonical separators (dots for the last group when needed; slash is left
	// out because FAA slash-style ACs (e.g. 150/5210-7) are not yet supported
	// by the locator scheme -- they get skipped here for a follow-up WP).
	if (!slug.startsWith('ac-')) {
		return { skip: `${slug}: doc slug does not start with 'ac-' (skip)` };
	}
	const editionLower = edition.toLowerCase();
	const tail = slug.slice('ac-'.length);
	if (!tail.endsWith(`-${editionLower}`)) {
		return { skip: `${slug}: doc slug tail does not match edition suffix '-${editionLower}' (skip)` };
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
			skip: `${slug}: doc number '${docNumber}' looks like FAA slash-style (e.g. 150/5210-7) -- not yet supported by ac/ locator (skip)`,
		};
	}

	return { docNumber, revision: revLetter.toLowerCase() };
}

interface CorpusManifestFile {
	readonly schema_version: number;
	readonly corpus: string;
	readonly entries: readonly Partial<DownloaderManifest>[];
}

function readCorpusManifest(path: string): CorpusManifestFile {
	const raw = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(raw) as Partial<CorpusManifestFile>;
	if (!Array.isArray(parsed.entries)) {
		throw new Error(`per-corpus manifest at ${path} missing entries[] array`);
	}
	return {
		schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
		corpus: typeof parsed.corpus === 'string' ? parsed.corpus : 'ac',
		entries: parsed.entries,
	};
}

function validateEntry(entry: Partial<DownloaderManifest>, manifestPath: string): DownloaderManifest {
	const required: readonly (keyof DownloaderManifest)[] = [
		'corpus',
		'doc',
		'source_url',
		'source_filename',
		'source_sha256',
		'fetched_at',
	];
	for (const key of required) {
		if (entry[key] === undefined) {
			throw new Error(`per-corpus manifest at ${manifestPath} has entry missing required field: ${String(key)}`);
		}
	}
	// `edition` may legitimately be null for unrevisioned ACs.
	if (!('edition' in entry)) {
		throw new Error(`per-corpus manifest at ${manifestPath} has entry missing edition field`);
	}
	return entry as DownloaderManifest;
}

/**
 * Walk the cache and collect every AC ready for ingestion. Per ADR 021, the
 * downloader writes a single per-corpus manifest at `<cache>/ac/manifest.json`
 * with one entry per cached AC; the PDFs sit alongside as `<doc-id>.pdf`.
 */
function discoverCachedAcs(cacheRoot: string): DiscoveryResult {
	const acRoot = join(cacheRoot, 'ac');
	if (!existsSync(acRoot)) return { acs: [], skipped: [] };
	const manifestPath = join(acRoot, 'manifest.json');
	if (!existsSync(manifestPath)) {
		return { acs: [], skipped: [`ac/manifest.json: per-corpus manifest not found (skip)`] };
	}
	let parsed: CorpusManifestFile;
	try {
		parsed = readCorpusManifest(manifestPath);
	} catch (e) {
		return { acs: [], skipped: [`ac/manifest.json: invalid manifest -- ${(e as Error).message} (skip)`] };
	}

	const acs: CachedAc[] = [];
	const skipped: string[] = [];
	for (const raw of parsed.entries) {
		let dm: DownloaderManifest;
		try {
			dm = validateEntry(raw, manifestPath);
		} catch (e) {
			skipped.push(`ac/manifest.json: invalid entry -- ${(e as Error).message} (skip)`);
			continue;
		}
		const resolved = resolveDocAndRevision(dm);
		if ('skip' in resolved) {
			skipped.push(resolved.skip);
			continue;
		}
		const pdfPath = join(acRoot, dm.source_filename);
		if (!existsSync(pdfPath)) {
			skipped.push(`${dm.doc}: PDF not found at ${dm.source_filename} (skip)`);
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

	const sourcesAcc: Record<string, SourceEntry> = {};
	const editionsAcc: Map<SourceId, readonly Edition[]> = new Map();

	const indexEntries: AcCorpusIndexEntry[] = [];
	const entriesToPromote: SourceId[] = [];

	for (const ac of cached) {
		try {
			// SHA verification BEFORE extraction. A poisoned cache must error
			// loudly without writing derivatives or advancing state.
			verifyCachedSha(ac.pdfPath, ac.downloaderManifest.source_sha256, args.skipShaVerify === true);
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
			writeIfChanged(bodyPath, documentBody);

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
			writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

			const entry = buildSourceEntry({ ac, title, publicationDate });
			const overlay = getEntryLifecycle(entry.id);
			if (overlay === 'accepted') {
				acsAlreadyAccepted += 1;
			} else {
				sourcesAcc[entry.id] = entry;
				acsIngested += 1;
				entriesToPromote.push(entry.id);
			}

			const editionRecord: Edition = {
				id: publicationIso,
				published_date: publicationDate,
				source_url: ac.downloaderManifest.source_url,
			};
			const existingEditions = editionsAcc.get(entry.id) ?? [];
			const hasEdition = existingEditions.some((e) => e.id === editionRecord.id);
			if (!hasEdition) {
				editionsAcc.set(entry.id, [...existingEditions, editionRecord]);
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
			if (e instanceof ShaMismatchError) {
				skipReasons.push(`${ac.docNumber}/${ac.revision}: ${e.message}`);
			} else {
				skipReasons.push(`${ac.docNumber}/${ac.revision}: extraction failed -- ${(e as Error).message}`);
			}
			acsSkipped += 1;
		}
	}

	const commit = await commitIngestBatch({
		corpus: CORPUS,
		reviewerId: PHASE_8_REVIEWER_ID,
		inputSource: args.cacheRoot,
		targetLifecycle: 'accepted',
		sources: sourcesAcc as Record<SourceId, SourceEntry>,
		editions: editionsAcc,
		scope: entriesToPromote,
	});
	if (!commit.ok) {
		throw new Error(`ac ingest batch promotion failed: ${commit.error}`);
	}
	const promotionBatchId = commit.batchId;

	// Use the max per-source `fetched_at` so re-running with no upstream
	// change leaves the index byte-equal (ADR 022 idempotent regen).
	const sourceFetchedAtValues = cached
		.map((c) => c.downloaderManifest.fetched_at)
		.filter((v): v is string => typeof v === 'string' && v.length > 0);
	const corpusFetchedAt =
		sourceFetchedAtValues.length > 0 ? sourceFetchedAtValues.slice().sort().slice(-1)[0] : '1970-01-01T00:00:00.000Z';
	const corpusIndex: AcCorpusIndex = {
		schema_version: 1,
		fetched_at: corpusFetchedAt ?? '1970-01-01T00:00:00.000Z',
		entries: indexEntries.sort((a, b) => a.doc_slug.localeCompare(b.doc_slug)),
	};
	const indexPath = join(args.derivativeRoot, 'index.json');
	writeIfChanged(indexPath, `${JSON.stringify(corpusIndex, null, 2)}\n`);

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
	readonly skipShaVerify: boolean;
	readonly help: boolean;
}

export function parseCliArgs(argv: readonly string[]): CliArgs | { error: string } {
	let cacheRoot = resolveCacheRoot({ ensureExists: false });
	let derivativeRoot = join(process.cwd(), 'ac');
	let skipShaVerify = false;
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg === '--skip-sha-verify') skipShaVerify = true;
		else if (arg.startsWith('--cache=')) cacheRoot = arg.slice('--cache='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else return { error: `unknown argument: ${arg}` };
	}

	return { cacheRoot, derivativeRoot, skipShaVerify, help };
}

/**
 * CLI entry point. Returns exit code. Never throws on user-facing errors;
 * unexpected exceptions propagate.
 *
 * Exit codes (per `INGEST_EXIT_CODES` in `shared/exit-codes.ts`):
 *   - 0 OK: every entry either ingested or soft-skipped (out of scope, etc.).
 *   - 1 HARD_SKIPS: at least one entry skipped due to an unrecoverable
 *     failure (extraction error, SHA mismatch, schema mismatch).
 *   - 2 BAD_ARGS: argument parse error.
 */
export async function runIngestCli(argv: readonly string[]): Promise<number> {
	const parsed = parseCliArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${USAGE}`);
		return INGEST_EXIT_CODES.BAD_ARGS;
	}
	if (parsed.help) {
		process.stdout.write(USAGE);
		return INGEST_EXIT_CODES.OK;
	}

	const report = await runAcIngest({
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
		skipShaVerify: parsed.skipShaVerify,
	});

	const { soft, hard } = classifySkipReasons(report.skipReasons);

	process.stdout.write(
		`ac ingest:\n` +
			`  scanned=${report.acsScanned} ingested=${report.acsIngested} alreadyAccepted=${report.acsAlreadyAccepted} skipped=${report.acsSkipped}\n` +
			`  promotionBatchId=${report.promotionBatchId ?? '(none)'}\n` +
			`  index=${report.indexPath}\n`,
	);
	for (const reason of soft) {
		process.stdout.write(`  skip: ${reason}\n`);
	}
	for (const reason of hard) {
		process.stderr.write(`  ERROR-skip: ${reason}\n`);
	}
	return hard.length > 0 ? INGEST_EXIT_CODES.HARD_SKIPS : INGEST_EXIT_CODES.OK;
}
