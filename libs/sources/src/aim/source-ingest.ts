/**
 * Phase 7 (Lane B) -- AIM source-PDF ingestion orchestrator.
 *
 * Bridges the cached-PDF -> derivatives -> registry pipeline. The existing
 * `runAimIngest` (in `ingest.ts`) walks an already-written derivative tree.
 * This file fills the gap: extract the cached PDF (via `extract.ts`), write
 * the manifest + per-entry markdown files in the shape `derivative-reader.ts`
 * expects, then delegate to `runAimIngest` for the registry step.
 *
 * Source of truth: ADR 019 §1.2 ("AIM"), ADR 021 (cache flat naming -- one
 * `aim/manifest.json` corpus-wide), ADR 022 (chapter source ingestion -- AIM
 * manifest carries `primary` + `sections[]` + `appendices[]`), and
 * `docs/work-packages/reference-aim-ingestion/`.
 *
 * Cache layout (input, per ADR 021/022):
 *
 *   $AIRBOSS_HANDBOOK_CACHE/aim/aim.pdf                      bundled (whole-doc)
 *   $AIRBOSS_HANDBOOK_CACHE/aim/chap<CC>_section_<SS>.html   72 section files
 *   $AIRBOSS_HANDBOOK_CACHE/aim/appendix_<NN>.html           5 appendix files
 *   $AIRBOSS_HANDBOOK_CACHE/aim/manifest.json                primary + sections[] + appendices[]
 *
 * The source-ingest currently consumes only `primary` (the bundled PDF). The
 * section/appendix HTML extractor lives in `tools/handbook-ingest/` (Python)
 * and is wired separately; ADR 022 records that boundary.
 *
 * Derivative layout (output) -- consumed by `derivative-reader.ts`:
 *
 *   <derivativeRoot>/<edition>/manifest.json
 *   <derivativeRoot>/<edition>/chapter-<N>/index.md                  (when a body exists; here always empty for now)
 *   <derivativeRoot>/<edition>/chapter-<N>/section-<M>/index.md      (idem)
 *   <derivativeRoot>/<edition>/chapter-<N>/section-<M>/paragraph-<K>.md
 *   <derivativeRoot>/<edition>/glossary/<slug>.md
 *   <derivativeRoot>/<edition>/appendix-<N>.md
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveCacheRoot } from '@ab/constants';
import { writeIfChanged } from '../io/write-if-changed.ts';
import { INGEST_EXIT_CODES, classifySkipReasons } from '../shared/exit-codes.ts';
import { ShaMismatchError, verifyCachedSha } from '../shared/sha-verify.ts';
import type { ManifestEntry, ManifestFile } from './derivative-reader.ts';
import { type ExtractedAim, extractAim } from './extract.ts';
import { type IngestReport, runAimIngest } from './ingest.ts';

export const PHASE_7_SOURCE_REVIEWER_ID = 'phase-7-aim-source-ingestion';

const EDITION_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

/**
 * Per-AIM-cache `ManifestEntry` shape, mirroring the downloader's writer at
 * `scripts/sources/download/manifest.ts:ManifestEntry`. Editions can be null
 * because AIM is `continuous_edition: true` in `aim.yaml`; the operator
 * supplies the edition slug at ingest time when the manifest doesn't carry
 * one.
 */
interface AimManifestEntry {
	readonly corpus: string;
	readonly doc: string;
	readonly edition: string | null;
	readonly source_url: string;
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly size_bytes?: number;
	readonly fetched_at: string;
	readonly last_modified?: string;
	readonly etag?: string;
	readonly schema_version?: number;
}

/**
 * AIM corpus manifest shape, per ADR 021 (one corpus-wide manifest) and
 * ADR 022 (`primary` + `sections[]` + `appendices[]`). Only `primary` is
 * required by this orchestrator; the section/appendix arrays are validated
 * loosely (presence + structure) and not currently consumed.
 */
interface AimCorpusManifestFile {
	readonly schema_version: number;
	readonly corpus: 'aim';
	readonly primary: AimManifestEntry;
	readonly sections: readonly AimManifestEntry[];
	readonly appendices: readonly AimManifestEntry[];
}

function isAimManifestEntry(value: unknown): value is AimManifestEntry {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.corpus === 'string' &&
		typeof v.doc === 'string' &&
		(v.edition === null || typeof v.edition === 'string') &&
		typeof v.source_url === 'string' &&
		typeof v.source_filename === 'string' &&
		typeof v.source_sha256 === 'string' &&
		typeof v.fetched_at === 'string'
	);
}

function readAimCorpusManifest(path: string): AimCorpusManifestFile {
	const raw = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(raw) as Partial<AimCorpusManifestFile>;
	if (typeof parsed.corpus !== 'string' || parsed.corpus !== 'aim') {
		throw new Error(`per-corpus manifest at ${path} has corpus='${String(parsed.corpus)}' (expected 'aim')`);
	}
	if (!isAimManifestEntry(parsed.primary)) {
		throw new Error(
			`per-corpus manifest at ${path} missing or malformed 'primary' entry (expected ManifestEntry per ADR 021/022)`,
		);
	}
	const sections = Array.isArray(parsed.sections) ? parsed.sections.filter(isAimManifestEntry) : [];
	const appendices = Array.isArray(parsed.appendices) ? parsed.appendices.filter(isAimManifestEntry) : [];
	return {
		schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
		corpus: 'aim',
		primary: parsed.primary,
		sections,
		appendices,
	};
}

interface CachedAim {
	/** Effective edition slug (e.g. `'2026-04'`). Falls back to the operator's `--edition` when the manifest carries `null`. */
	readonly edition: string;
	readonly pdfPath: string;
	readonly primary: AimManifestEntry;
}

/**
 * Walk the AIM cache and return the available primary entry. AIM is a
 * single-document corpus (one `aim/manifest.json` per cache, with one
 * `primary` entry per ADR 021/022). The bundled PDF lives alongside the
 * manifest.
 *
 * When the manifest's `primary.edition` is null (current downloader behavior
 * because `aim.yaml` is `continuous_edition: true`), the operator must supply
 * `--edition=YYYY-MM` -- without it we have nowhere to root the per-edition
 * derivative tree. When `primary.edition` is set, an explicit `--edition`
 * filter must match it.
 */
function discoverCachedAim(
	cacheRoot: string,
	editionOverride: string | null,
): { cached: CachedAim | null; skipped: string[] } {
	const aimRoot = join(cacheRoot, 'aim');
	if (!existsSync(aimRoot)) return { cached: null, skipped: [] };
	const manifestPath = join(aimRoot, 'manifest.json');
	if (!existsSync(manifestPath)) {
		return { cached: null, skipped: [`aim/manifest.json: per-corpus manifest not found (skip)`] };
	}
	let parsed: AimCorpusManifestFile;
	try {
		parsed = readAimCorpusManifest(manifestPath);
	} catch (e) {
		return { cached: null, skipped: [`aim/manifest.json: invalid manifest -- ${(e as Error).message} (skip)`] };
	}

	const primary = parsed.primary;
	const manifestEdition = primary.edition;

	let effectiveEdition: string;
	if (manifestEdition !== null) {
		if (editionOverride !== null && editionOverride !== manifestEdition) {
			return {
				cached: null,
				skipped: [
					`aim/manifest.json: --edition='${editionOverride}' does not match cached primary.edition='${manifestEdition}' (skip)`,
				],
			};
		}
		effectiveEdition = manifestEdition;
	} else {
		if (editionOverride === null) {
			return {
				cached: null,
				skipped: [
					`aim/manifest.json: cached primary.edition is null and no --edition=YYYY-MM provided -- cannot root derivative tree (skip)`,
				],
			};
		}
		effectiveEdition = editionOverride;
	}

	const pdfPath = join(aimRoot, primary.source_filename);
	if (!existsSync(pdfPath)) {
		return {
			cached: null,
			skipped: [`${effectiveEdition}: PDF not found at ${primary.source_filename} (skip)`],
		};
	}

	return {
		cached: { edition: effectiveEdition, pdfPath, primary },
		skipped: [],
	};
}

function sha256(input: string): string {
	return createHash('sha256').update(input, 'utf-8').digest('hex');
}

function ensureDir(path: string): void {
	if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

/**
 * Write the AIM derivative tree and manifest from an extracted PDF.
 * Returns the manifest entries as written; caller can then register via
 * `runAimIngest`.
 */
export function writeAimDerivatives(args: {
	readonly extracted: ExtractedAim;
	readonly edition: string;
	readonly primary: AimManifestEntry;
	readonly derivativeRoot: string;
}): { manifestPath: string; entriesWritten: number } {
	const { extracted, edition, primary, derivativeRoot } = args;
	const editionRoot = join(derivativeRoot, edition);
	ensureDir(editionRoot);

	const entries: ManifestEntry[] = [];

	// Chapters
	for (const ch of extracted.chapters) {
		const dir = join(editionRoot, `chapter-${ch.num}`);
		ensureDir(dir);
		const bodyPath = join(dir, 'index.md');
		const body = ch.body.length > 0 ? ch.body : `# ${ch.title}\n`;
		writeIfChanged(bodyPath, body);
		entries.push({
			kind: 'chapter',
			code: ch.num,
			title: ch.title,
			body_path: `aim/${edition}/chapter-${ch.num}/index.md`,
			content_hash: sha256(body),
		});
	}

	// Sections
	for (const sec of extracted.sections) {
		const dir = join(editionRoot, `chapter-${sec.chapter}`, `section-${sec.section}`);
		ensureDir(dir);
		const bodyPath = join(dir, 'index.md');
		const body = sec.body.length > 0 ? sec.body : `# ${sec.title}\n`;
		writeIfChanged(bodyPath, body);
		entries.push({
			kind: 'section',
			code: sec.code,
			title: sec.title,
			body_path: `aim/${edition}/chapter-${sec.chapter}/section-${sec.section}/index.md`,
			content_hash: sha256(body),
		});
	}

	// Paragraphs
	for (const p of extracted.paragraphs) {
		const dir = join(editionRoot, `chapter-${p.chapter}`, `section-${p.section}`);
		ensureDir(dir);
		const bodyPath = join(dir, `paragraph-${p.paragraph}.md`);
		const body = p.body.length > 0 ? `# ${p.title}\n\n${p.body}\n` : `# ${p.title}\n`;
		writeIfChanged(bodyPath, body);
		entries.push({
			kind: 'paragraph',
			code: p.code,
			title: p.title,
			body_path: `aim/${edition}/chapter-${p.chapter}/section-${p.section}/paragraph-${p.paragraph}.md`,
			content_hash: sha256(body),
		});
	}

	// Glossary
	const glossaryDir = join(editionRoot, 'glossary');
	if (extracted.glossary.length > 0) ensureDir(glossaryDir);
	for (const g of extracted.glossary) {
		const bodyPath = join(glossaryDir, `${g.slug}.md`);
		const body = g.body.length > 0 ? `# ${g.title}\n\n${g.body}\n` : `# ${g.title}\n`;
		writeIfChanged(bodyPath, body);
		entries.push({
			kind: 'glossary',
			code: `glossary/${g.slug}`,
			title: g.title,
			body_path: `aim/${edition}/glossary/${g.slug}.md`,
			content_hash: sha256(body),
		});
	}

	// Appendices
	for (const a of extracted.appendices) {
		const bodyPath = join(editionRoot, `appendix-${a.num}.md`);
		const body = a.body.length > 0 ? `# ${a.title}\n\n${a.body}\n` : `# ${a.title}\n`;
		writeIfChanged(bodyPath, body);
		entries.push({
			kind: 'appendix',
			code: `appendix-${a.num}`,
			title: a.title,
			body_path: `aim/${edition}/appendix-${a.num}.md`,
			content_hash: sha256(body),
		});
	}

	const manifest: ManifestFile = {
		edition,
		kind: 'aim',
		title: 'Aeronautical Information Manual',
		publisher: 'FAA',
		source_url: primary.source_url,
		source_checksum: primary.source_sha256,
		fetched_at: primary.fetched_at,
		entries,
	};
	const manifestPath = join(editionRoot, 'manifest.json');
	writeIfChanged(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

	return { manifestPath, entriesWritten: entries.length };
}

// ---------------------------------------------------------------------------
// Public orchestrator
// ---------------------------------------------------------------------------

export interface SourceIngestArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	/**
	 * Edition slug (e.g. `'2026-04'`). Required when the cache manifest's
	 * `primary.edition` is null (AIM is `continuous_edition: true` per
	 * `aim.yaml`). When the manifest carries a non-null edition, `edition`
	 * acts as a guard: ingest skips with a reason if the values disagree.
	 */
	readonly edition?: string;
	/**
	 * Disable per-file SHA-256 verification against the manifest's recorded
	 * `source_sha256`. Default: false (verification ON, per the 2026-05-01
	 * backend review). Production runs must leave this false; only set true
	 * for tests that knowingly pass mutated cache fixtures.
	 */
	readonly skipShaVerify?: boolean;
}

export interface SourceIngestReport {
	readonly editionsScanned: number;
	readonly editionsIngested: number;
	readonly skipReasons: readonly string[];
	readonly perEdition: readonly {
		readonly edition: string;
		readonly entriesWritten: number;
		readonly extractSkipped: readonly string[];
		readonly registry: IngestReport;
	}[];
}

/**
 * Walk the AIM cache, extract each cached PDF, write the derivative tree,
 * register entries via `runAimIngest`. Idempotent: re-running with the same
 * args overwrites derivatives byte-identically and the registry skips entries
 * already accepted.
 *
 * AIM is single-document per ADR 021/022 -- one cached PDF, one corpus-wide
 * `manifest.json`. The report's `editionsScanned` is therefore 0 (cache
 * empty/invalid) or 1.
 */
export async function runAimSourceIngest(args: SourceIngestArgs): Promise<SourceIngestReport> {
	const editionOverride = args.edition ?? null;
	const discovery = discoverCachedAim(args.cacheRoot, editionOverride);
	const skipReasons: string[] = [...discovery.skipped];

	const cached = discovery.cached;
	if (cached === null) {
		return {
			editionsScanned: 0,
			editionsIngested: 0,
			skipReasons,
			perEdition: [],
		};
	}

	ensureDir(args.derivativeRoot);

	const perEdition: SourceIngestReport['perEdition'] = [] as SourceIngestReport['perEdition'];
	let editionsIngested = 0;

	try {
		// SHA verification BEFORE extraction. A poisoned cache must error
		// loudly without writing derivatives or advancing state.
		verifyCachedSha(cached.pdfPath, cached.primary.source_sha256, args.skipShaVerify === true);
		const extracted = extractAim({ pdfPath: cached.pdfPath });
		const { entriesWritten } = writeAimDerivatives({
			extracted,
			edition: cached.edition,
			primary: cached.primary,
			derivativeRoot: args.derivativeRoot,
		});
		const registry = await runAimIngest({
			edition: cached.edition,
			derivativeRoot: args.derivativeRoot,
		});
		(perEdition as Array<SourceIngestReport['perEdition'][number]>).push({
			edition: cached.edition,
			entriesWritten,
			extractSkipped: extracted.skipped,
			registry,
		});
		editionsIngested += 1;
	} catch (e) {
		if (e instanceof ShaMismatchError) {
			skipReasons.push(`${cached.edition}: ${e.message}`);
		} else {
			skipReasons.push(`${cached.edition}: ${(e as Error).message}`);
		}
	}

	return {
		editionsScanned: 1,
		editionsIngested,
		skipReasons,
		perEdition,
	};
}

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

const SOURCE_USAGE = `usage:
  bun run sources register aim [--cache=<path>] [--out=<path>] [--edition=<YYYY-MM>]
  bun run sources register aim --help

  Walk the AIM cache (default $AIRBOSS_HANDBOOK_CACHE/aim/), extract the
  cached primary PDF, write derivatives to <repo>/aim/<edition>/, and
  register entries in the @ab/sources registry. Idempotent.

  --cache=<path>     Cache root (default $AIRBOSS_HANDBOOK_CACHE or
                     ~/Documents/airboss-handbook-cache).
  --out=<path>       Derivative root (default <cwd>/aim).
  --edition=<slug>   AIM is continuous-edition (no edition slug in the
                     downloader manifest), so this flag is required when the
                     manifest's primary.edition is null. When the manifest
                     does carry an edition, --edition guards against a
                     mismatch.
`;

export interface SourceCliArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	readonly edition: string | null;
	readonly skipShaVerify: boolean;
	readonly help: boolean;
}

export function parseSourceCliArgs(argv: readonly string[]): SourceCliArgs | { error: string } {
	let cacheRoot = resolveCacheRoot({ ensureExists: false });
	let derivativeRoot = join(process.cwd(), 'aim');
	let edition: string | null = null;
	let skipShaVerify = false;
	let help = false;
	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg === '--skip-sha-verify') skipShaVerify = true;
		else if (arg.startsWith('--cache=')) cacheRoot = arg.slice('--cache='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else if (arg.startsWith('--edition=')) edition = arg.slice('--edition='.length);
		else return { error: `unknown argument: ${arg}` };
	}
	return { cacheRoot, derivativeRoot, edition, skipShaVerify, help };
}

/**
 * CLI entry point for source-PDF AIM ingestion.
 *
 * Exit codes (per `INGEST_EXIT_CODES` in `shared/exit-codes.ts`):
 *   - 0 OK: every entry either ingested or soft-skipped.
 *   - 1 HARD_SKIPS: at least one entry skipped due to an unrecoverable
 *     failure (extraction error, SHA mismatch, schema mismatch).
 *   - 2 BAD_ARGS: argument parse error.
 */
export async function runSourceIngestCli(argv: readonly string[]): Promise<number> {
	const parsed = parseSourceCliArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${SOURCE_USAGE}`);
		return INGEST_EXIT_CODES.BAD_ARGS;
	}
	if (parsed.help) {
		process.stdout.write(SOURCE_USAGE);
		return INGEST_EXIT_CODES.OK;
	}
	if (parsed.edition !== null && !EDITION_PATTERN.test(parsed.edition)) {
		process.stderr.write(`aim source ingest: --edition must be YYYY-MM (got "${parsed.edition}")\n${SOURCE_USAGE}`);
		return INGEST_EXIT_CODES.BAD_ARGS;
	}
	const report = await runAimSourceIngest({
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
		edition: parsed.edition ?? undefined,
		skipShaVerify: parsed.skipShaVerify,
	});

	const { soft, hard } = classifySkipReasons(report.skipReasons);

	process.stdout.write(
		`aim source ingest:\n` +
			`  editionsScanned=${report.editionsScanned} editionsIngested=${report.editionsIngested}\n`,
	);
	for (const e of report.perEdition) {
		process.stdout.write(
			`  edition=${e.edition} entriesWritten=${e.entriesWritten} ` +
				`registryIngested=${e.registry.entriesIngested} alreadyAccepted=${e.registry.entriesAlreadyAccepted} ` +
				`promotionBatchId=${e.registry.promotionBatchId ?? '(none)'} extractSkipped=${e.extractSkipped.length}\n`,
		);
		for (const reason of e.extractSkipped.slice(0, 5)) {
			process.stdout.write(`    extract-skip: ${reason}\n`);
		}
		if (e.extractSkipped.length > 5) {
			process.stdout.write(`    extract-skip: ... and ${e.extractSkipped.length - 5} more\n`);
		}
	}
	for (const reason of soft) {
		process.stdout.write(`  skip: ${reason}\n`);
	}
	for (const reason of hard) {
		process.stderr.write(`  ERROR-skip: ${reason}\n`);
	}
	return hard.length > 0 ? INGEST_EXIT_CODES.HARD_SKIPS : INGEST_EXIT_CODES.OK;
}

// ---------------------------------------------------------------------------
// Test internals
// ---------------------------------------------------------------------------

/**
 * Test-only access to the cache discovery helper. Tests pass a synthetic
 * cache root and assert on the parsed manifest shape + skip reasons without
 * needing a real PDF on disk.
 */
export const __aim_source_ingest_internal__ = {
	discoverCachedAim,
	readAimCorpusManifest,
};

export type { AimCorpusManifestFile, AimManifestEntry };
