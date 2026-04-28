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
 * Cache layout (input):
 *
 *   $AIRBOSS_HANDBOOK_CACHE/aim/<edition>/source.pdf       (or named pdf)
 *   $AIRBOSS_HANDBOOK_CACHE/aim/<edition>/manifest.json    downloader manifest
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
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

interface CachedAim {
	readonly edition: string;
	readonly pdfPath: string;
	readonly downloaderManifest: DownloaderManifest;
}

/**
 * Walk the AIM cache and return every available edition. The downloader writes
 * one directory per edition: `<cache>/aim/<edition>/manifest.json` + the PDF.
 */
function discoverCachedAim(cacheRoot: string): { editions: CachedAim[]; skipped: string[] } {
	const aimRoot = join(cacheRoot, 'aim');
	if (!existsSync(aimRoot)) return { editions: [], skipped: [] };
	const editions: CachedAim[] = [];
	const skipped: string[] = [];
	for (const editionDir of readdirSync(aimRoot)) {
		const editionPath = join(aimRoot, editionDir);
		if (!statSync(editionPath).isDirectory()) continue;
		const downloaderManifestPath = join(editionPath, 'manifest.json');
		if (!existsSync(downloaderManifestPath)) {
			skipped.push(`${editionDir}: no downloader manifest (skip)`);
			continue;
		}
		let dm: DownloaderManifest;
		try {
			dm = readDownloaderManifest(downloaderManifestPath);
		} catch (e) {
			skipped.push(`${editionDir}: invalid downloader manifest -- ${(e as Error).message} (skip)`);
			continue;
		}
		// Prefer the named PDF, fall back to source.pdf (which is a symlink).
		const candidatePdfs = [join(editionPath, dm.source_filename), join(editionPath, 'source.pdf')];
		const pdfPath = candidatePdfs.find((p) => existsSync(p));
		if (pdfPath === undefined) {
			skipped.push(`${editionDir}: PDF not found (looked for ${dm.source_filename}, source.pdf) (skip)`);
			continue;
		}
		editions.push({ edition: dm.edition, pdfPath, downloaderManifest: dm });
	}
	return { editions, skipped };
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
	readonly downloaderManifest: DownloaderManifest;
	readonly derivativeRoot: string;
}): { manifestPath: string; entriesWritten: number } {
	const { extracted, downloaderManifest, derivativeRoot } = args;
	const editionRoot = join(derivativeRoot, downloaderManifest.edition);
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
			body_path: `aim/${downloaderManifest.edition}/chapter-${ch.num}/index.md`,
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
			body_path: `aim/${downloaderManifest.edition}/chapter-${sec.chapter}/section-${sec.section}/index.md`,
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
			body_path: `aim/${downloaderManifest.edition}/chapter-${p.chapter}/section-${p.section}/paragraph-${p.paragraph}.md`,
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
			body_path: `aim/${downloaderManifest.edition}/glossary/${g.slug}.md`,
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
			body_path: `aim/${downloaderManifest.edition}/appendix-${a.num}.md`,
			content_hash: sha256(body),
		});
	}

	const manifest: ManifestFile = {
		edition: downloaderManifest.edition,
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

const EDITION_PATTERN = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

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
		process.stderr.write(`aim source ingest: --edition must be YYYY-MM (got "${parsed.edition}")\n${SOURCE_USAGE}`);
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
