/**
 * Shared bulletin (SAFO / InFO) corpus ingestion (WP-SAFO-INFO).
 *
 * Source of truth: ADR 019 §1.2 (`safo` and `info` corpora) + §2.6 (registry
 * population). Mirrors the AC ingest pipeline at a smaller scale --
 * SAFOs and InFOs are 1-3 page bulletins with a stereotyped header band and
 * a closed set of internal headings, so extraction is regex-driven rather
 * than the full handbook section-tree builder AC uses.
 *
 * Steps per bulletin:
 *
 *   1. Read `<cache>/<corpus>/manifest.json` (ADR 021 per-corpus index).
 *   2. SHA-verify the cached PDF and run `extractPdf` over it.
 *   3. Detect the FAA-issued publication date from the header band.
 *   4. Run section extraction (closed-set heading detector); emit either a
 *      flat list of section bodies OR a single whole-bulletin body when no
 *      headings were found.
 *   5. Write the per-bulletin derivative tree under
 *      `<repo>/<corpus>/<bulletin-id>/`:
 *
 *        manifest.json                                  (per-bulletin manifest)
 *        <corpus>-<bulletin-id>.md                      (full text -- audit + fallback)
 *        sections/<NN>-<heading-slug>.md                (one per detected section)
 *
 *   6. Append an entry to corpus-level `<repo>/<corpus>/index.json`.
 *   7. Insert one `SourceEntry` + `Edition` into the `@ab/sources` registry.
 *   8. Record an atomic batch promotion `pending -> accepted`. Skip when
 *      entries are already accepted.
 *
 * Idempotent: re-running with the same `--cache=` and `--out=` is a no-op.
 *
 * Live PDF re-fetching is NOT this script's job. The downloader at
 * `scripts/sources/download/` populates the cache; this script reads it.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeIfChanged } from '../io/write-if-changed.ts';
import { extractPdf } from '../pdf/index.ts';
import { commitIngestBatch, getEntryLifecycle } from '../registry/lifecycle.ts';
import { classifySkipReasons, INGEST_EXIT_CODES } from '../shared/exit-codes.ts';
import { ShaMismatchError, verifyCachedSha } from '../shared/sha-verify.ts';
import type { Edition, SourceEntry, SourceId } from '../types.ts';
import { extractBulletinSections, findBulletinDate } from './bulletin-extract.ts';

export interface BulletinIngestArgs {
	/** Path to the cache root containing `<corpus>/<doc-id>.pdf` + per-corpus manifest. */
	readonly cacheRoot: string;
	/** Path to the in-repo derivative root (`<cwd>/<corpus>`). */
	readonly derivativeRoot: string;
	/** Disable per-file SHA-256 verification. Default false. */
	readonly skipShaVerify?: boolean;
}

export interface BulletinIngestSpec {
	/** `'safo'` or `'info'`. */
	readonly corpus: 'safo' | 'info';
	/** Short tag (`'SAFO'` / `'InFO'`) used in canonical short / titles. */
	readonly shortTag: string;
	/** Long tag (`'FAA Safety Alert for Operators'`) used in formal canonical. */
	readonly formalPrefix: string;
	/** Reviewer id stamped on the atomic ingest batch promotion. */
	readonly reviewerId: string;
}

export interface BulletinIngestReport {
	readonly bulletinsScanned: number;
	readonly bulletinsIngested: number;
	readonly bulletinsAlreadyAccepted: number;
	readonly bulletinsSkipped: number;
	readonly skipReasons: readonly string[];
	readonly promotionBatchId: string | null;
	readonly indexPath: string;
}

interface DownloaderManifestEntry {
	readonly corpus: string;
	readonly doc: string;
	readonly edition: string | null;
	readonly source_url: string;
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly fetched_at: string;
	readonly last_modified?: string;
}

interface CorpusManifestFile {
	readonly schema_version: number;
	readonly corpus: string;
	readonly entries: readonly Partial<DownloaderManifestEntry>[];
}

interface BulletinManifestSectionEntry {
	readonly code: string;
	readonly ordinal: number;
	readonly title: string;
	readonly source_locator: string;
	readonly body_path: string;
	readonly content_hash: string;
}

interface BulletinManifestFile {
	readonly schema_version: number;
	readonly kind: 'safo' | 'info';
	readonly corpus: 'safo' | 'info';
	readonly bulletin_id: string;
	readonly title: string;
	readonly publisher: 'FAA';
	readonly publication_date: string | null;
	readonly audience: string | null;
	readonly source_url: string;
	readonly source_sha256: string;
	readonly fetched_at: string;
	readonly page_count: number;
	readonly body_path: string;
	readonly body_sha256: string;
	readonly sections: readonly BulletinManifestSectionEntry[];
}

interface CorpusIndexEntry {
	readonly bulletin_id: string;
	readonly title: string;
	readonly publication_date: string | null;
	readonly manifest_path: string;
}

interface CorpusIndexFile {
	readonly schema_version: number;
	readonly fetched_at: string;
	readonly entries: readonly CorpusIndexEntry[];
}

interface CachedBulletin {
	readonly bulletinId: string;
	readonly pdfPath: string;
	readonly downloaderManifest: DownloaderManifestEntry;
}

/**
 * Recognised bulletin headings the title-extractor uses to bound the
 * `Subject:` block. Mirrors the closed list in `bulletin-extract.ts`.
 */
const NEXT_HEADING_RE =
	/^[ \t]*(Purpose|Background|Discussion|Recommended Action|Recommended Actions|Action|Conclusion|Recommendation|Contact)\s*:/;

/**
 * Derive the bulletin title from the `Subject:` block. SAFOs/InFOs typically
 * carry a multi-line subject; we capture continuation lines until either a
 * blank line or the next known heading appears, then collapse interior
 * whitespace + trim.
 *
 * Returns null when no `Subject:` line is found (caller falls back to a
 * generic short title like `SAFO 23001`).
 */
function deriveBulletinTitle(body: string): string | null {
	const lines = body.split('\n');
	let startIdx = -1;
	let firstLineSuffix = '';
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? '';
		const m = /^[ \t]*Subject\s*:[ \t]*(.*)$/.exec(line);
		if (m === null) continue;
		startIdx = i;
		firstLineSuffix = (m[1] ?? '').trim();
		break;
	}
	if (startIdx < 0) return null;

	const collected: string[] = [];
	if (firstLineSuffix.length > 0) collected.push(firstLineSuffix);
	for (let i = startIdx + 1; i < lines.length; i++) {
		const raw = lines[i] ?? '';
		if (raw.trim().length === 0) break;
		if (NEXT_HEADING_RE.test(raw)) break;
		collected.push(raw.trim());
	}
	const joined = collected
		.join(' ')
		.replace(/\s+/g, ' ')
		.replace(/\s+\.$/, '.')
		.trim();
	if (joined.length === 0) return null;
	// Trim a trailing period so the canonical title reads naturally; some
	// SAFOs end the subject with a period, others don't.
	return joined.replace(/\.+$/, '');
}

/**
 * Recover the bulletin id from the downloader doc slug. The downloader writes
 * `<corpus>-<id>` (e.g. `safo-23001`); strip the corpus prefix.
 */
function recoverBulletinId(corpus: string, slug: string): string | { skip: string } {
	const prefix = `${corpus}-`;
	if (!slug.startsWith(prefix)) {
		return { skip: `${slug}: doc slug does not start with '${prefix}' (skip)` };
	}
	const id = slug.slice(prefix.length);
	if (!/^[0-9]{2}[0-9]{3}$/.test(id)) {
		return { skip: `${slug}: bulletin id '${id}' is malformed (expected 5 digits) (skip)` };
	}
	return id;
}

function readCorpusManifest(path: string): CorpusManifestFile {
	const raw = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(raw) as Partial<CorpusManifestFile>;
	if (!Array.isArray(parsed.entries)) {
		throw new Error(`per-corpus manifest at ${path} missing entries[] array`);
	}
	return {
		schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
		corpus: typeof parsed.corpus === 'string' ? parsed.corpus : 'unknown',
		entries: parsed.entries,
	};
}

function validateEntry(entry: Partial<DownloaderManifestEntry>, manifestPath: string): DownloaderManifestEntry {
	const required: readonly (keyof DownloaderManifestEntry)[] = [
		'corpus',
		'doc',
		'source_url',
		'source_filename',
		'source_sha256',
		'fetched_at',
	];
	for (const key of required) {
		if (entry[key] === undefined) {
			throw new Error(`per-corpus manifest at ${manifestPath} entry missing required field: ${String(key)}`);
		}
	}
	if (!('edition' in entry)) {
		throw new Error(`per-corpus manifest at ${manifestPath} entry missing edition field`);
	}
	return entry as DownloaderManifestEntry;
}

interface DiscoveryResult {
	readonly bulletins: readonly CachedBulletin[];
	readonly skipped: readonly string[];
}

function discoverCachedBulletins(corpus: 'safo' | 'info', cacheRoot: string): DiscoveryResult {
	const corpusRoot = join(cacheRoot, corpus);
	if (!existsSync(corpusRoot)) return { bulletins: [], skipped: [] };
	const manifestPath = join(corpusRoot, 'manifest.json');
	if (!existsSync(manifestPath)) {
		return { bulletins: [], skipped: [`${corpus}/manifest.json: per-corpus manifest not found (skip)`] };
	}
	let parsed: CorpusManifestFile;
	try {
		parsed = readCorpusManifest(manifestPath);
	} catch (e) {
		return { bulletins: [], skipped: [`${corpus}/manifest.json: invalid manifest -- ${(e as Error).message} (skip)`] };
	}

	const bulletins: CachedBulletin[] = [];
	const skipped: string[] = [];
	for (const raw of parsed.entries) {
		let dm: DownloaderManifestEntry;
		try {
			dm = validateEntry(raw, manifestPath);
		} catch (e) {
			skipped.push(`${corpus}/manifest.json: invalid entry -- ${(e as Error).message} (skip)`);
			continue;
		}
		const recovered = recoverBulletinId(corpus, dm.doc);
		if (typeof recovered !== 'string') {
			skipped.push(recovered.skip);
			continue;
		}
		const pdfPath = join(corpusRoot, dm.source_filename);
		if (!existsSync(pdfPath)) {
			skipped.push(`${dm.doc}: PDF not found at ${dm.source_filename} (skip)`);
			continue;
		}
		bulletins.push({ bulletinId: recovered, pdfPath, downloaderManifest: dm });
	}
	return { bulletins, skipped };
}

function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function ensureDir(path: string): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true });
	}
}

function buildSourceEntry(args: {
	readonly spec: BulletinIngestSpec;
	readonly bulletinId: string;
	readonly title: string;
	readonly publicationDate: Date;
}): SourceEntry {
	const { spec, bulletinId, title, publicationDate } = args;
	const id = `airboss-ref:${spec.corpus}/${bulletinId}` as SourceId;
	return {
		id,
		corpus: spec.corpus,
		canonical_short: `${spec.shortTag} ${bulletinId}`,
		canonical_formal: `${spec.formalPrefix} ${bulletinId}`,
		canonical_title: title,
		last_amended_date: publicationDate,
		lifecycle: 'pending',
	};
}

/**
 * Run bulletin (SAFO / InFO) corpus ingestion. Walks the cache, extracts
 * each PDF, writes per-bulletin derivatives, populates the registry.
 * Idempotent.
 */
export async function runBulletinIngest(
	spec: BulletinIngestSpec,
	args: BulletinIngestArgs,
): Promise<BulletinIngestReport> {
	const discovery = discoverCachedBulletins(spec.corpus, args.cacheRoot);
	const cached = discovery.bulletins;
	const skipReasons: string[] = [...discovery.skipped];
	let bulletinsIngested = 0;
	let bulletinsAlreadyAccepted = 0;
	let bulletinsSkipped = discovery.skipped.length;

	ensureDir(args.derivativeRoot);

	const sourcesAcc: Record<string, SourceEntry> = {};
	const editionsAcc: Map<SourceId, readonly Edition[]> = new Map();
	const indexEntries: CorpusIndexEntry[] = [];
	const entriesToPromote: SourceId[] = [];

	for (const bulletin of cached) {
		try {
			verifyCachedSha(bulletin.pdfPath, bulletin.downloaderManifest.source_sha256, args.skipShaVerify === true);
			const doc = extractPdf(bulletin.pdfPath);

			// Derive title from `Subject:` heading when present; fall back to a
			// generic short title. The `Subject:` block in a SAFO/InFO is often
			// 2-3 lines long; capture continuation lines until the next blank
			// line or the next known heading appears.
			const documentBody = doc.pages.map((p) => p.text).join('\n\n');
			const title = deriveBulletinTitle(documentBody) ?? `${spec.shortTag} ${bulletin.bulletinId}`;

			const detectedDate = findBulletinDate(documentBody);
			const fallbackDate = bulletin.downloaderManifest.last_modified ?? bulletin.downloaderManifest.fetched_at;
			const publicationIso = detectedDate ?? new Date(fallbackDate).toISOString().slice(0, 10);
			const publicationDate = new Date(publicationIso);
			if (Number.isNaN(publicationDate.getTime())) {
				skipReasons.push(`${bulletin.bulletinId}: could not derive publication date`);
				bulletinsSkipped += 1;
				continue;
			}

			// Body markdown + section extraction.
			const bodySha = sha256(documentBody);
			const docDir = join(args.derivativeRoot, bulletin.bulletinId);
			ensureDir(docDir);
			const bodyFilename = `${spec.corpus}-${bulletin.bulletinId}.md`;
			const bodyPath = join(docDir, bodyFilename);
			writeIfChanged(bodyPath, documentBody);

			const extraction = extractBulletinSections(documentBody);
			const sectionEntries: BulletinManifestSectionEntry[] = [];
			if (extraction.sections.length > 0) {
				const sectionsDir = join(docDir, 'sections');
				ensureDir(sectionsDir);
				for (const sec of extraction.sections) {
					const padded = String(sec.ordinal).padStart(2, '0');
					const fileName = `${padded}-${sec.code}.md`;
					const absPath = join(sectionsDir, fileName);
					writeIfChanged(absPath, sec.bodyMd);
					sectionEntries.push({
						code: sec.code,
						ordinal: sec.ordinal,
						title: sec.title,
						source_locator: `${spec.shortTag} ${bulletin.bulletinId} -- ${sec.title}`,
						body_path: `${spec.corpus}/${bulletin.bulletinId}/sections/${fileName}`,
						content_hash: sec.contentHash,
					});
				}
			}

			const manifest: BulletinManifestFile = {
				schema_version: 1,
				kind: spec.corpus,
				corpus: spec.corpus,
				bulletin_id: bulletin.bulletinId,
				title,
				publisher: 'FAA',
				publication_date: detectedDate,
				audience: extraction.audience,
				source_url: bulletin.downloaderManifest.source_url,
				source_sha256: bulletin.downloaderManifest.source_sha256,
				fetched_at: bulletin.downloaderManifest.fetched_at,
				page_count: doc.pageCount,
				body_path: `${spec.corpus}/${bulletin.bulletinId}/${bodyFilename}`,
				body_sha256: bodySha,
				sections: sectionEntries,
			};
			const manifestPath = join(docDir, 'manifest.json');
			writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

			const entry = buildSourceEntry({ spec, bulletinId: bulletin.bulletinId, title, publicationDate });
			const overlay = getEntryLifecycle(entry.id);
			if (overlay === 'accepted') {
				bulletinsAlreadyAccepted += 1;
			} else {
				sourcesAcc[entry.id] = entry;
				bulletinsIngested += 1;
				entriesToPromote.push(entry.id);
			}

			const editionRecord: Edition = {
				id: publicationIso.slice(0, 4),
				published_date: publicationDate,
				source_url: bulletin.downloaderManifest.source_url,
			};
			const existingEditions = editionsAcc.get(entry.id) ?? [];
			const hasEdition = existingEditions.some((e) => e.id === editionRecord.id);
			if (!hasEdition) {
				editionsAcc.set(entry.id, [...existingEditions, editionRecord]);
			}

			indexEntries.push({
				bulletin_id: bulletin.bulletinId,
				title,
				publication_date: detectedDate,
				manifest_path: `${spec.corpus}/${bulletin.bulletinId}/manifest.json`,
			});
		} catch (e) {
			if (e instanceof ShaMismatchError) {
				skipReasons.push(`${bulletin.bulletinId}: ${e.message}`);
			} else {
				skipReasons.push(`${bulletin.bulletinId}: extraction failed -- ${(e as Error).message}`);
			}
			bulletinsSkipped += 1;
		}
	}

	const commit = await commitIngestBatch({
		corpus: spec.corpus,
		reviewerId: spec.reviewerId,
		inputSource: args.cacheRoot,
		targetLifecycle: 'accepted',
		sources: sourcesAcc as Record<SourceId, SourceEntry>,
		editions: editionsAcc,
		scope: entriesToPromote,
	});
	if (!commit.ok) {
		throw new Error(`${spec.corpus} ingest batch promotion failed: ${commit.error}`);
	}
	const promotionBatchId = commit.batchId;

	const sourceFetchedAtValues = cached
		.map((c) => c.downloaderManifest.fetched_at)
		.filter((v): v is string => typeof v === 'string' && v.length > 0);
	const corpusFetchedAt =
		sourceFetchedAtValues.length > 0 ? sourceFetchedAtValues.slice().sort().slice(-1)[0] : '1970-01-01T00:00:00.000Z';
	const corpusIndex: CorpusIndexFile = {
		schema_version: 1,
		fetched_at: corpusFetchedAt ?? '1970-01-01T00:00:00.000Z',
		entries: indexEntries.sort((a, b) => a.bulletin_id.localeCompare(b.bulletin_id)),
	};
	const indexPath = join(args.derivativeRoot, 'index.json');
	writeIfChanged(indexPath, `${JSON.stringify(corpusIndex, null, 2)}\n`);

	return {
		bulletinsScanned: cached.length + discovery.skipped.length,
		bulletinsIngested,
		bulletinsAlreadyAccepted,
		bulletinsSkipped,
		skipReasons,
		promotionBatchId,
		indexPath,
	};
}

export interface BulletinCliArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	readonly skipShaVerify: boolean;
	readonly help: boolean;
}

export function parseBulletinCliArgs(
	argv: readonly string[],
	defaults: BulletinCliArgs,
): BulletinCliArgs | { error: string } {
	let { cacheRoot, derivativeRoot, skipShaVerify, help } = defaults;
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
 * CLI runner. Returns exit code (per `INGEST_EXIT_CODES`).
 */
export async function runBulletinCli(
	spec: BulletinIngestSpec,
	argv: readonly string[],
	defaults: BulletinCliArgs,
	usage: string,
): Promise<number> {
	const parsed = parseBulletinCliArgs(argv, defaults);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${usage}`);
		return INGEST_EXIT_CODES.BAD_ARGS;
	}
	if (parsed.help) {
		process.stdout.write(usage);
		return INGEST_EXIT_CODES.OK;
	}

	const report = await runBulletinIngest(spec, {
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
		skipShaVerify: parsed.skipShaVerify,
	});

	const { soft, hard } = classifySkipReasons(report.skipReasons);

	process.stdout.write(
		`${spec.corpus} ingest:\n` +
			`  scanned=${report.bulletinsScanned} ingested=${report.bulletinsIngested} alreadyAccepted=${report.bulletinsAlreadyAccepted} skipped=${report.bulletinsSkipped}\n` +
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
