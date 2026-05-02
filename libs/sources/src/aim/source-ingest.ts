/**
 * Phase 7 (Lane B) -- AIM source-PDF ingestion orchestrator.
 *
 * Bridges the cached-PDF -> derivatives -> registry pipeline. The existing
 * `runAimIngest` (in `ingest.ts`) walks an already-written derivative tree.
 * This file fills the gap: extract the cached PDF (via `extract.ts`), write
 * the manifest + per-entry markdown files in the shape `derivative-reader.ts`
 * expects, then delegate to `runAimIngest` for the registry step.
 *
 * Source of truth: ADR 019 §1.2 ("AIM"), ADR 018 (derivative storage), and
 * `docs/work-packages/reference-aim-ingestion/`.
 *
 * Cache layout (input, per ADR 021):
 *
 *   $AIRBOSS_HANDBOOK_CACHE/aim/<edition>.pdf
 *   $AIRBOSS_HANDBOOK_CACHE/aim/manifest.json    per-corpus index, one entry per edition
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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ManifestEntry, ManifestFile } from './derivative-reader.ts';
import { type ExtractedAim, extractAim } from './extract.ts';
import { type IngestReport, runAimIngest } from './ingest.ts';

export const PHASE_7_SOURCE_REVIEWER_ID = 'phase-7-aim-source-ingestion';

// Default editor cache (mirrors `scripts/sources/download/`).
function defaultCacheRoot(): string {
	return process.env.AIRBOSS_HANDBOOK_CACHE ?? join(homedir(), 'Documents', 'airboss-handbook-cache');
}

/**
 * Per-entry shape inside the AIM cache manifest. Mirrors the downloader's
 * `ManifestEntry` (see `scripts/sources/download/manifest.ts`) but inlined here
 * because the lib (`@ab/sources`) cannot import from `scripts/`.
 *
 * `edition` is `string | null` per ADR 021 §"Manifest schema" -- AIM's bundled
 * PDF currently records `edition: null` because the downloader has no
 * publication-date metadata to thread through (see correctness#3 follow-up).
 * The loader treats a null edition as the literal slug `'current'` for routing
 * derivative output paths.
 */
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
 * AIM cache manifest as written by `writeAimEntry` in
 * `scripts/sources/download/manifest.ts`. Shape:
 *
 *   { schema_version, corpus: 'aim', primary, sections[], appendices[] }
 *
 * The bundled PDF (`primary`) is the only artifact this ingest path consumes;
 * `sections[]` and `appendices[]` index the per-section HTML cache files but
 * those run through the future HTML extractor, not this PDF-driven path.
 */
interface AimCorpusManifestFile {
	readonly schema_version: number;
	readonly corpus: 'aim';
	readonly primary: Partial<DownloaderManifest>;
	readonly sections?: readonly unknown[];
	readonly appendices?: readonly unknown[];
}

function readAimCorpusManifest(path: string): AimCorpusManifestFile {
	const raw = readFileSync(path, 'utf-8');
	const parsed = JSON.parse(raw) as Partial<AimCorpusManifestFile>;
	if (parsed.corpus !== 'aim') {
		throw new Error(`per-corpus manifest at ${path} has corpus='${String(parsed.corpus)}' (expected 'aim')`);
	}
	if (typeof parsed.primary !== 'object' || parsed.primary === null) {
		throw new Error(`per-corpus manifest at ${path} missing primary{} entry`);
	}
	return {
		schema_version: typeof parsed.schema_version === 'number' ? parsed.schema_version : 1,
		corpus: 'aim',
		primary: parsed.primary,
		sections: Array.isArray(parsed.sections) ? parsed.sections : [],
		appendices: Array.isArray(parsed.appendices) ? parsed.appendices : [],
	};
}

function validatePrimary(entry: Partial<DownloaderManifest>, manifestPath: string): DownloaderManifest {
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
			throw new Error(`per-corpus manifest at ${manifestPath} primary missing required field: ${String(key)}`);
		}
	}
	// `edition` may legitimately be null (AIM downloader records null until a
	// per-edition publication date is threaded through -- see correctness#3).
	if (!('edition' in entry)) {
		throw new Error(`per-corpus manifest at ${manifestPath} primary missing edition field`);
	}
	return entry as DownloaderManifest;
}

interface CachedAim {
	readonly edition: string;
	readonly pdfPath: string;
	readonly downloaderManifest: DownloaderManifest;
}

/** Slug used when the downloader records `edition: null` for the bundled PDF. */
const NULL_EDITION_SLUG = 'current';

/**
 * Walk the AIM cache and return the bundled-PDF edition. The downloader writes
 * a single per-corpus manifest at `<cache>/aim/manifest.json` with `primary`
 * (the bundled PDF) plus `sections[]`/`appendices[]` (per-section HTML); this
 * loader only consumes `primary`. The PDF sits alongside the manifest as
 * `<source_filename>` (currently `aim.pdf`).
 *
 * When `primary.edition` is null, the loader uses the slug `'current'` to route
 * derivative output. This keeps the per-edition derivative tree path stable
 * even before a publication-date is threaded into the AIM downloader.
 */
function discoverCachedAim(cacheRoot: string): { editions: CachedAim[]; skipped: string[] } {
	const aimRoot = join(cacheRoot, 'aim');
	if (!existsSync(aimRoot)) return { editions: [], skipped: [] };
	const manifestPath = join(aimRoot, 'manifest.json');
	if (!existsSync(manifestPath)) {
		return { editions: [], skipped: [`aim/manifest.json: per-corpus manifest not found (skip)`] };
	}
	let parsed: AimCorpusManifestFile;
	try {
		parsed = readAimCorpusManifest(manifestPath);
	} catch (e) {
		return { editions: [], skipped: [`aim/manifest.json: invalid manifest -- ${(e as Error).message} (skip)`] };
	}

	let dm: DownloaderManifest;
	try {
		dm = validatePrimary(parsed.primary, manifestPath);
	} catch (e) {
		return { editions: [], skipped: [`aim/manifest.json: invalid primary -- ${(e as Error).message} (skip)`] };
	}
	const pdfPath = join(aimRoot, dm.source_filename);
	if (!existsSync(pdfPath)) {
		return {
			editions: [],
			skipped: [`aim/manifest.json: PDF not found at ${dm.source_filename} (skip)`],
		};
	}
	const edition = dm.edition ?? NULL_EDITION_SLUG;
	return { editions: [{ edition, pdfPath, downloaderManifest: dm }], skipped: [] };
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
 *
 * The `edition` arg is the resolved edition slug -- either the downloader's
 * `primary.edition` value, or the `'current'` fallback when the downloader
 * recorded null (see `discoverCachedAim`). The derivative tree always lands
 * under `<derivativeRoot>/<edition>/`; the inline manifest's `edition` field
 * carries the same slug for round-trip consistency with `derivative-reader`.
 */
export function writeAimDerivatives(args: {
	readonly extracted: ExtractedAim;
	readonly downloaderManifest: DownloaderManifest;
	readonly edition: string;
	readonly derivativeRoot: string;
}): { manifestPath: string; entriesWritten: number } {
	const { extracted, downloaderManifest, edition, derivativeRoot } = args;
	const editionRoot = join(derivativeRoot, edition);
	ensureDir(editionRoot);

	const entries: ManifestEntry[] = [];

	// Chapters
	for (const ch of extracted.chapters) {
		const dir = join(editionRoot, `chapter-${ch.num}`);
		ensureDir(dir);
		const bodyPath = join(dir, 'index.md');
		const body = ch.body.length > 0 ? ch.body : `# ${ch.title}\n`;
		writeFileSync(bodyPath, body, 'utf-8');
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
		writeFileSync(bodyPath, body, 'utf-8');
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
		writeFileSync(bodyPath, body, 'utf-8');
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
		writeFileSync(bodyPath, body, 'utf-8');
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
		writeFileSync(bodyPath, body, 'utf-8');
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
		source_url: downloaderManifest.source_url,
		source_checksum: downloaderManifest.source_sha256,
		fetched_at: downloaderManifest.fetched_at,
		entries,
	};
	const manifestPath = join(editionRoot, 'manifest.json');
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

	return { manifestPath, entriesWritten: entries.length };
}

// ---------------------------------------------------------------------------
// Public orchestrator
// ---------------------------------------------------------------------------

export interface SourceIngestArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	/** Restrict to a single edition slug (e.g. `'2026-04'`). When omitted, ingests every cached edition. */
	readonly edition?: string;
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
 */
export async function runAimSourceIngest(args: SourceIngestArgs): Promise<SourceIngestReport> {
	const discovery = discoverCachedAim(args.cacheRoot);
	const skipReasons: string[] = [...discovery.skipped];
	const filtered =
		args.edition !== undefined ? discovery.editions.filter((e) => e.edition === args.edition) : discovery.editions;

	if (args.edition !== undefined && filtered.length === 0) {
		skipReasons.push(`edition '${args.edition}' not found in cache`);
	}

	ensureDir(args.derivativeRoot);

	const perEdition: SourceIngestReport['perEdition'] = [] as SourceIngestReport['perEdition'];
	let editionsIngested = 0;

	for (const cached of filtered) {
		try {
			const extracted = extractAim({ pdfPath: cached.pdfPath });
			const { entriesWritten } = writeAimDerivatives({
				extracted,
				downloaderManifest: cached.downloaderManifest,
				edition: cached.edition,
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
			skipReasons.push(`${cached.edition}: ${(e as Error).message}`);
		}
	}

	return {
		editionsScanned: discovery.editions.length,
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

  Walk the AIM cache (default $AIRBOSS_HANDBOOK_CACHE/aim/), extract each
  cached PDF, write derivatives to <repo>/aim/<edition>/, and register entries
  in the @ab/sources registry. Idempotent.

  --cache=<path>     Cache root (default $AIRBOSS_HANDBOOK_CACHE or
                     ~/Documents/airboss-handbook-cache).
  --out=<path>       Derivative root (default <cwd>/aim).
  --edition=<slug>   Restrict to one edition (default: ingest every cached edition).
`;

// Accept both YYYY-MM editions (the future intended slug) and the literal
// `'current'` fallback used when the downloader records `edition: null`.
const EDITION_PATTERN = /^(?:[0-9]{4}-(0[1-9]|1[0-2])|current)$/;

export interface SourceCliArgs {
	readonly cacheRoot: string;
	readonly derivativeRoot: string;
	readonly edition: string | null;
	readonly help: boolean;
}

export function parseSourceCliArgs(argv: readonly string[]): SourceCliArgs | { error: string } {
	let cacheRoot = defaultCacheRoot();
	let derivativeRoot = join(process.cwd(), 'aim');
	let edition: string | null = null;
	let help = false;
	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') help = true;
		else if (arg.startsWith('--cache=')) cacheRoot = arg.slice('--cache='.length);
		else if (arg.startsWith('--out=')) derivativeRoot = arg.slice('--out='.length);
		else if (arg.startsWith('--edition=')) edition = arg.slice('--edition='.length);
		else return { error: `unknown argument: ${arg}` };
	}
	return { cacheRoot, derivativeRoot, edition, help };
}

/**
 * CLI entry point for source-PDF AIM ingestion.
 */
export async function runSourceIngestCli(argv: readonly string[]): Promise<number> {
	const parsed = parseSourceCliArgs(argv);
	if ('error' in parsed) {
		process.stderr.write(`${parsed.error}\n${SOURCE_USAGE}`);
		return 2;
	}
	if (parsed.help) {
		process.stdout.write(SOURCE_USAGE);
		return 0;
	}
	if (parsed.edition !== null && !EDITION_PATTERN.test(parsed.edition)) {
		process.stderr.write(
			`aim source ingest: --edition must be YYYY-MM or 'current' (got "${parsed.edition}")\n${SOURCE_USAGE}`,
		);
		return 2;
	}
	const report = await runAimSourceIngest({
		cacheRoot: parsed.cacheRoot,
		derivativeRoot: parsed.derivativeRoot,
		edition: parsed.edition ?? undefined,
	});

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
	for (const reason of report.skipReasons) {
		process.stdout.write(`  skip: ${reason}\n`);
	}
	return 0;
}
