#!/usr/bin/env bun

/**
 * `bun run download-sources` -- one-shot downloader for every source corpus
 * the project consumes (CFR, AIM, ACs, ACS, optional handbook extras).
 *
 * Source of truth: ADR 018 (storage policy) + docs/platform/STORAGE.md.
 * Cache root: `$AIRBOSS_HANDBOOK_CACHE` (default `~/Documents/airboss-handbook-cache/`).
 *
 * Usage:
 *
 *   bun run download-sources
 *   bun run download-sources --corpus=regs               # only CFR
 *   bun run download-sources --corpus=regs,aim,ac        # subset
 *   bun run download-sources --dry-run                   # preview, no fetch
 *   bun run download-sources --include-handbooks-extras  # 8083-2/9/15/16/...
 *   bun run download-sources --force-refresh             # ignore cached sha
 *   bun run download-sources --verbose                   # log every URL attempt
 *
 * The script writes per-doc `manifest.json` next to each cached `source.<ext>`
 * with `{ corpus, doc, edition, source_url, source_sha256, size_bytes,
 * fetched_at, schema_version }`. Re-running with the manifest already in place
 * skips the download unless `--force-refresh` is passed.
 *
 * The actual downloads are NOT exercised in CI -- the live FAA / eCFR endpoints
 * are too flaky for that. Tests use `--dry-run` against the URL plan, plus an
 * opt-in smoke test guarded by `AIRBOSS_E2E_DOWNLOAD=1`.
 *
 * See `scripts/README.download-sources.md` for the operator runbook.
 */

import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

/**
 * Resolve the cache root. Honors `AIRBOSS_HANDBOOK_CACHE`, defaults to
 * `~/Documents/airboss-handbook-cache/`. Mirrors the helper in
 * `libs/sources/src/regs/cache.ts` -- duplicated here so this script does
 * not pull in the rest of `@ab/sources` (and its `fast-xml-parser` etc.
 * transitive deps) for a one-shot byte fetcher.
 */
function resolveCacheRoot(): string {
	const fromEnv = process.env.AIRBOSS_HANDBOOK_CACHE;
	const expanded =
		fromEnv !== undefined && fromEnv.length > 0
			? expandHome(fromEnv)
			: join(homedir(), 'Documents', 'airboss-handbook-cache');
	if (!existsSync(expanded)) {
		mkdirSync(expanded, { recursive: true });
	}
	return expanded;
}

function expandHome(p: string): string {
	if (p.startsWith('~/')) return join(homedir(), p.slice(2));
	if (p === '~') return homedir();
	return p;
}

// ---------------------------------------------------------------------------
// Constants -- per-corpus URL plans
// ---------------------------------------------------------------------------

const SCHEMA_VERSION = 1;
const MAX_REDIRECTS = 5;
const RETRY_DELAY_MS = 5000;
const NETWORK_TIMEOUT_MS = 120_000;

type Corpus = 'regs' | 'aim' | 'ac' | 'acs' | 'handbooks';
const ALL_CORPORA: readonly Corpus[] = ['regs', 'aim', 'ac', 'acs', 'handbooks'] as const;

const ECFR_BASE = 'https://www.ecfr.gov/api/versioner/v1/full';
const AIM_PDF_CANDIDATES: readonly string[] = [
	'https://www.faa.gov/sites/faa.gov/files/air_traffic/publications/atpubs/aim/aim.pdf',
	'https://www.faa.gov/air_traffic/publications/atpubs/aim_html/media/aim.pdf',
	'https://www.faa.gov/air_traffic/publications/media/aim.pdf',
];

interface RegsTarget {
	readonly title: '14' | '49';
	readonly partFilter?: ReadonlySet<string>;
	readonly editionDate: string;
}

interface PdfTarget {
	readonly corpus: 'aim' | 'ac' | 'acs' | 'handbooks';
	readonly doc: string;
	readonly edition: string;
	readonly urls: readonly string[];
}

const AC_TARGETS: readonly PdfTarget[] = [
	mkAc('00-6', 'B', 'AC_00-6B.pdf'),
	mkAc('60-22', '', 'AC_60-22.pdf'),
	mkAc('61-65', 'J', 'AC_61-65J.pdf'),
	mkAc('61-83', 'J', 'AC_61-83J.pdf'),
	mkAc('61-98', 'D', 'AC_61-98D.pdf'),
	mkAc('90-66', 'C', 'AC_90-66C.pdf'),
	mkAc('91-79', 'A', 'AC_91-79A.pdf'),
	mkAc('91-92', '', 'AC_91-92.pdf'),
	mkAc('120-71', 'C', 'AC_120-71C.pdf'),
	mkAc('91-21', '1D', 'AC_91-21-1D.pdf'),
	mkAc('25-7', 'D', 'AC_25-7D.pdf'),
	mkAc('150-5210', '7D', 'AC_150_5210-7D.pdf'),
];

const ACS_TARGETS: readonly PdfTarget[] = [
	mkAcs('faa-s-acs-6', 'private_airplane_acs.pdf', 'private_airplane_acs_change_1.pdf'),
	mkAcs('faa-s-acs-8', 'instrument_rating_acs.pdf', 'instrument_airplane_acs_change_1.pdf'),
	mkAcs('faa-s-acs-7', 'commercial_airplane_acs.pdf', 'commercial_airplane_acs_change_1.pdf'),
	mkAcs('faa-s-acs-11', 'atp_airplane_acs.pdf', 'atp_airplane_type_rating_acs.pdf'),
	mkAcs('faa-s-acs-25', 'cfi_airplane_acs.pdf'),
];

const HANDBOOKS_EXTRAS_TARGETS: readonly PdfTarget[] = [
	mkHbk('faa-h-8083-2', 'risk_management_handbook.pdf', 'faa-h-8083-2.pdf'),
	mkHbk('faa-h-8083-9', 'aviation_instructors_handbook.pdf', 'faa-h-8083-9a.pdf'),
	mkHbk('faa-h-8083-15', 'instrument_flying_handbook.pdf', 'FAA-H-8083-15B.pdf'),
	mkHbk('faa-h-8083-16', 'instrument_procedures_handbook.pdf'),
	mkHbk('faa-h-8083-27', 'sport_pilot_airplane_acs.pdf', 'sport_pilot_handbook.pdf'),
	mkHbk('faa-h-8083-30', 'amt_general_handbook.pdf'),
	mkHbk('faa-h-8083-32', 'amt_powerplant_handbook.pdf'),
	mkHbk('faa-h-8083-34', 'risk_management_handbook_for_ga_pilots.pdf'),
];

function mkAc(number: string, revision: string, ...filenames: string[]): PdfTarget {
	const docId = revision.length > 0 ? `ac-${number}-${revision}`.toLowerCase() : `ac-${number}`.toLowerCase();
	const edition = revision.length > 0 ? revision : 'current';
	const base = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular';
	return {
		corpus: 'ac',
		doc: docId,
		edition,
		urls: filenames.map((f) => `${base}/${f}`),
	};
}

function mkAcs(docId: string, ...filenames: string[]): PdfTarget {
	const base = 'https://www.faa.gov/training_testing/testing/acs/media';
	return {
		corpus: 'acs',
		doc: docId,
		edition: 'current',
		urls: filenames.map((f) => `${base}/${f}`),
	};
}

function mkHbk(docId: string, ...filenames: string[]): PdfTarget {
	const base = 'https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation';
	return {
		corpus: 'handbooks',
		doc: docId,
		edition: 'current',
		urls: filenames.map((f) => `${base}/${f}`),
	};
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

interface CliArgs {
	readonly corpora: ReadonlySet<Corpus>;
	readonly dryRun: boolean;
	readonly forceRefresh: boolean;
	readonly verbose: boolean;
	readonly includeHandbooksExtras: boolean;
	readonly editionDate: string;
	readonly help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
	let corpora: Set<Corpus> = new Set(ALL_CORPORA);
	let dryRun = false;
	let forceRefresh = false;
	let verbose = false;
	let includeHandbooksExtras = false;
	let editionDate = todayIsoDate();
	let help = false;

	for (const arg of argv) {
		if (arg === '--help' || arg === '-h') {
			help = true;
			continue;
		}
		if (arg === '--dry-run') {
			dryRun = true;
			continue;
		}
		if (arg === '--force-refresh') {
			forceRefresh = true;
			continue;
		}
		if (arg === '--verbose' || arg === '-v') {
			verbose = true;
			continue;
		}
		if (arg === '--include-handbooks-extras') {
			includeHandbooksExtras = true;
			continue;
		}
		if (arg.startsWith('--corpus=')) {
			const requested = arg
				.slice('--corpus='.length)
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			const validated = new Set<Corpus>();
			for (const c of requested) {
				if (!isCorpus(c)) {
					throw new Error(`unknown corpus "${c}" -- valid: ${ALL_CORPORA.join(', ')}`);
				}
				validated.add(c);
			}
			corpora = validated;
			continue;
		}
		if (arg.startsWith('--edition-date=')) {
			editionDate = arg.slice('--edition-date='.length);
			if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(editionDate)) {
				throw new Error(`--edition-date must be YYYY-MM-DD, got "${editionDate}"`);
			}
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}

	return { corpora, dryRun, forceRefresh, verbose, includeHandbooksExtras, editionDate, help };
}

function isCorpus(s: string): s is Corpus {
	return (ALL_CORPORA as readonly string[]).includes(s);
}

function todayIsoDate(): string {
	const d = new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Plan + summary types
// ---------------------------------------------------------------------------

interface DownloadPlan {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string;
	readonly urls: readonly string[];
	readonly destPath: string;
	readonly extension: 'pdf' | 'xml';
}

interface CorpusResult {
	readonly corpus: Corpus;
	files: number;
	bytes: number;
	errors: number;
	skipped: number;
}

// ---------------------------------------------------------------------------
// Plan builders
// ---------------------------------------------------------------------------

function buildPlans(args: CliArgs, root: string): DownloadPlan[] {
	const plans: DownloadPlan[] = [];

	if (args.corpora.has('regs')) {
		const regsTargets: readonly RegsTarget[] = [
			{ title: '14', editionDate: args.editionDate },
			{ title: '49', editionDate: args.editionDate, partFilter: new Set(['830']) },
			{ title: '49', editionDate: args.editionDate, partFilter: new Set(['1552']) },
		];
		for (const t of regsTargets) plans.push(buildRegsPlan(t, root));
	}

	if (args.corpora.has('aim')) {
		const edition = currentMonthEdition();
		plans.push({
			corpus: 'aim',
			doc: 'aim',
			edition,
			urls: AIM_PDF_CANDIDATES,
			destPath: join(root, 'aim', edition, 'source.pdf'),
			extension: 'pdf',
		});
	}

	if (args.corpora.has('ac')) {
		for (const t of AC_TARGETS) plans.push(pdfTargetToPlan(t, root));
	}

	if (args.corpora.has('acs')) {
		for (const t of ACS_TARGETS) plans.push(pdfTargetToPlan(t, root));
	}

	if (args.corpora.has('handbooks') && args.includeHandbooksExtras) {
		for (const t of HANDBOOKS_EXTRAS_TARGETS) plans.push(pdfTargetToPlan(t, root));
	}

	return plans;
}

function buildRegsPlan(target: RegsTarget, root: string): DownloadPlan {
	const partSlug =
		target.partFilter !== undefined && target.partFilter.size > 0
			? `parts-${[...target.partFilter].sort().join('-')}`
			: 'full';
	const url = buildEcfrUrl(target);
	return {
		corpus: 'regs',
		doc: `cfr-${target.title}-${partSlug}`,
		edition: target.editionDate,
		urls: [url],
		destPath: join(root, 'regulations', `cfr-${target.title}`, target.editionDate, `${partSlug}.xml`),
		extension: 'xml',
	};
}

function buildEcfrUrl(target: RegsTarget): string {
	const base = `${ECFR_BASE}/${target.editionDate}/title-${target.title}.xml`;
	if (target.partFilter === undefined || target.partFilter.size === 0) return base;
	const params = new URLSearchParams();
	for (const part of target.partFilter) params.append('part', part);
	return `${base}?${params.toString()}`;
}

function pdfTargetToPlan(t: PdfTarget, root: string): DownloadPlan {
	const editionSlug = t.edition.length > 0 ? t.edition : 'current';
	const destPath = join(root, t.corpus, t.corpus === 'ac' ? t.doc : t.doc, editionSlug, 'source.pdf');
	return {
		corpus: t.corpus,
		doc: t.doc,
		edition: editionSlug,
		urls: t.urls,
		destPath,
		extension: 'pdf',
	};
}

function currentMonthEdition(): string {
	const d = new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	return `${yyyy}-${mm}`;
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

interface Manifest {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string;
	readonly source_url: string;
	readonly source_sha256: string;
	readonly size_bytes: number;
	readonly fetched_at: string;
	readonly schema_version: number;
}

function manifestPathFor(plan: DownloadPlan): string {
	return join(dirname(plan.destPath), 'manifest.json');
}

function readManifest(plan: DownloadPlan): Manifest | null {
	const path = manifestPathFor(plan);
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<Manifest>;
		if (
			typeof parsed.source_sha256 === 'string' &&
			typeof parsed.source_url === 'string' &&
			typeof parsed.size_bytes === 'number'
		) {
			return parsed as Manifest;
		}
	} catch {
		return null;
	}
	return null;
}

function writeManifest(plan: DownloadPlan, manifest: Manifest): void {
	const path = manifestPathFor(plan);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
}

// ---------------------------------------------------------------------------
// Download primitive -- streaming fetch + sha256 + redirects + retry
// ---------------------------------------------------------------------------

interface DownloadOptions {
	readonly verbose: boolean;
	readonly fetchImpl?: typeof fetch;
}

interface DownloadOutcome {
	readonly url: string;
	readonly sha256: string;
	readonly bytes: number;
}

async function downloadFileStreaming(
	urls: readonly string[],
	destPath: string,
	opts: DownloadOptions,
): Promise<DownloadOutcome> {
	let lastError: unknown = null;
	for (const url of urls) {
		try {
			const result = await downloadOne(url, destPath, opts);
			return result;
		} catch (error) {
			lastError = error;
			if (opts.verbose) console.warn(`  candidate failed: ${url} -- ${describeError(error)}`);
		}
	}
	throw new Error(`all candidate URLs failed for ${destPath}: ${urls.join(', ')}: ${describeError(lastError)}`);
}

async function downloadOne(url: string, destPath: string, opts: DownloadOptions): Promise<DownloadOutcome> {
	let attempt = 0;
	while (true) {
		attempt += 1;
		try {
			return await downloadOnce(url, destPath, opts);
		} catch (error) {
			if (attempt >= 2 || !isTransient(error)) throw error;
			if (opts.verbose) console.warn(`  transient error on ${url}, retrying in ${RETRY_DELAY_MS}ms`);
			await sleep(RETRY_DELAY_MS);
		}
	}
}

async function downloadOnce(url: string, destPath: string, opts: DownloadOptions): Promise<DownloadOutcome> {
	const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		throw new Error('no fetch implementation available in this runtime');
	}

	const finalUrl = await followRedirects(url, fetchImpl, opts.verbose);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetchImpl(finalUrl, { signal: controller.signal, redirect: 'manual' });
	} finally {
		clearTimeout(timer);
	}

	if (!response.ok) {
		throw new HttpError(`HTTP ${response.status} for ${finalUrl}`, response.status);
	}

	if (response.body === null) {
		throw new Error(`response body was null for ${finalUrl}`);
	}

	mkdirSync(dirname(destPath), { recursive: true });

	const hash = createHash('sha256');
	let bytes = 0;
	const fileStream = createWriteStream(destPath);
	const nodeStream = Readable.fromWeb(response.body as unknown as import('node:stream/web').ReadableStream);

	nodeStream.on('data', (chunk: Buffer | string) => {
		const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
		hash.update(buf);
		bytes += buf.byteLength;
	});

	await pipeline(nodeStream, fileStream);

	return { url: finalUrl, sha256: hash.digest('hex'), bytes };
}

async function followRedirects(startUrl: string, fetchImpl: typeof fetch, verbose: boolean): Promise<string> {
	let url = startUrl;
	for (let i = 0; i < MAX_REDIRECTS; i += 1) {
		const head = await fetchImpl(url, { method: 'HEAD', redirect: 'manual' });
		if (head.status >= 300 && head.status < 400) {
			const next = head.headers.get('location');
			if (next === null) return url;
			url = new URL(next, url).toString();
			if (verbose) console.warn(`  redirect ${head.status} -> ${url}`);
			continue;
		}
		return url;
	}
	throw new Error(`too many redirects starting at ${startUrl}`);
}

class HttpError extends Error {
	readonly status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
	}
}

function isTransient(error: unknown): boolean {
	if (error instanceof HttpError) {
		return error.status >= 500 && error.status < 600;
	}
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return msg.includes('timeout') || msg.includes('network') || msg.includes('socket') || error.name === 'AbortError';
	}
	return false;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

// ---------------------------------------------------------------------------
// Per-plan execution
// ---------------------------------------------------------------------------

async function executePlan(plan: DownloadPlan, args: CliArgs, result: CorpusResult): Promise<void> {
	const label = `${plan.corpus}/${plan.doc}@${plan.edition}`;

	if (args.dryRun) {
		console.log(`  [dry-run] ${label}`);
		console.log(`    -> ${plan.destPath}`);
		for (const u of plan.urls) console.log(`       ${u}`);
		return;
	}

	if (!args.forceRefresh) {
		const existing = readManifest(plan);
		if (existing !== null && existsSync(plan.destPath)) {
			const stat = statSync(plan.destPath);
			if (stat.size === existing.size_bytes) {
				if (args.verbose) console.log(`  skip (cached) ${label} ${formatBytes(existing.size_bytes)}`);
				result.skipped += 1;
				return;
			}
		}
	}

	console.log(`  fetching ${label}`);
	try {
		const outcome = await downloadFileStreaming(plan.urls, plan.destPath, { verbose: args.verbose });
		const manifest: Manifest = {
			corpus: plan.corpus,
			doc: plan.doc,
			edition: plan.edition,
			source_url: outcome.url,
			source_sha256: outcome.sha256,
			size_bytes: outcome.bytes,
			fetched_at: new Date().toISOString(),
			schema_version: SCHEMA_VERSION,
		};
		writeManifest(plan, manifest);
		result.files += 1;
		result.bytes += outcome.bytes;
		console.log(`    ok ${formatBytes(outcome.bytes)} sha256=${outcome.sha256.slice(0, 12)}...`);
	} catch (error) {
		result.errors += 1;
		console.error(`    error ${label}: ${describeError(error)}`);
	}
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function formatBytes(n: number): string {
	if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(1)} MB`;
	if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${n} B`;
}

function printSummary(results: readonly CorpusResult[], cacheRoot: string, dryRun: boolean): void {
	console.log('');
	console.log('Source download summary');
	console.log('=======================');
	let totalFiles = 0;
	let totalBytes = 0;
	let totalErrors = 0;
	for (const r of results) {
		const summary = `${r.files} files, ${formatBytes(r.bytes)}, ${r.errors} errors${
			r.skipped > 0 ? `, ${r.skipped} skipped` : ''
		}`;
		console.log(`${r.corpus.padEnd(10)} ${summary}`);
		totalFiles += r.files;
		totalBytes += r.bytes;
		totalErrors += r.errors;
	}
	console.log('');
	console.log(`Total: ${totalFiles} files, ${formatBytes(totalBytes)}, ${totalErrors} errors`);
	console.log(`Cache root: ${cacheRoot}`);
	if (dryRun) console.log('(dry-run -- nothing was fetched)');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const HELP_TEXT = `bun run download-sources -- one-shot source-corpus downloader.

Usage:
  bun run download-sources [flags]

Flags:
  --corpus=<list>              Comma-separated subset (regs,aim,ac,acs,handbooks)
  --dry-run                    Plan only, no network calls
  --force-refresh              Ignore existing cache, re-download
  --include-handbooks-extras   Add 8083-2/9/15/16/27/30/32/34
  --edition-date=YYYY-MM-DD    eCFR snapshot date (default: today UTC)
  --verbose                    Log every URL attempt + redirects
  --help                       Show this help

Cache root:
  $AIRBOSS_HANDBOOK_CACHE (default: ~/Documents/airboss-handbook-cache/)

Per-doc layout:
  <root>/<corpus>/<doc>/<edition>/source.<ext>
  <root>/<corpus>/<doc>/<edition>/manifest.json

Idempotent: re-running skips files whose cached size matches the manifest.
Pass --force-refresh to override.
`;

export interface RunOptions {
	readonly argv?: readonly string[];
	readonly cacheRoot?: string;
}

export async function runDownloadSources(opts: RunOptions = {}): Promise<number> {
	const argv = opts.argv ?? process.argv.slice(2);
	let args: CliArgs;
	try {
		args = parseArgs(argv);
	} catch (error) {
		console.error(describeError(error));
		console.error('');
		console.error(HELP_TEXT);
		return 2;
	}

	if (args.help) {
		console.log(HELP_TEXT);
		return 0;
	}

	const cacheRoot = opts.cacheRoot ?? resolveCacheRoot();
	const plans = buildPlans(args, cacheRoot);

	if (plans.length === 0) {
		console.log('No corpora selected. Use --corpus= or --include-handbooks-extras to expand.');
		return 0;
	}

	if (args.dryRun) {
		console.log(`Dry run -- ${plans.length} planned downloads (cache root ${cacheRoot}):`);
	} else {
		console.log(`Fetching ${plans.length} sources to ${cacheRoot}`);
	}

	const results: CorpusResult[] = ALL_CORPORA.filter((c) => args.corpora.has(c)).map((corpus) => ({
		corpus,
		files: 0,
		bytes: 0,
		errors: 0,
		skipped: 0,
	}));

	for (const corpus of ALL_CORPORA) {
		if (!args.corpora.has(corpus)) continue;
		const corpusPlans = plans.filter((p) => p.corpus === corpus);
		if (corpusPlans.length === 0) {
			if (corpus === 'handbooks' && !args.includeHandbooksExtras) {
				console.log(`\n${corpus}: skipped (already cached; pass --include-handbooks-extras to fetch more)`);
			}
			continue;
		}
		console.log(`\n${corpus}:`);
		const result = results.find((r) => r.corpus === corpus);
		if (result === undefined) continue;
		for (const plan of corpusPlans) {
			await executePlan(plan, args, result);
		}
	}

	printSummary(results, cacheRoot, args.dryRun);

	const totalErrors = results.reduce((acc, r) => acc + r.errors, 0);
	return totalErrors > 0 ? 1 : 0;
}

// Test-only export.
export const __download_internal__ = {
	parseArgs,
	buildPlans,
	buildEcfrUrl,
	currentMonthEdition,
	manifestPathFor,
	AC_TARGETS,
	ACS_TARGETS,
	HANDBOOKS_EXTRAS_TARGETS,
	AIM_PDF_CANDIDATES,
};

if (import.meta.main) {
	const code = await runDownloadSources();
	process.exit(code);
}
