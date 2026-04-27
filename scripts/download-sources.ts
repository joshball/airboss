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
 *   bun run download-sources --verify                    # HEAD-only audit
 *
 * The script writes per-doc `manifest.json` next to each cached source file
 * with `{ corpus, doc, edition, source_url, source_filename, source_sha256,
 * size_bytes, fetched_at, last_modified?, etag?, schema_version }`. Re-running
 * with the manifest already in place issues a HEAD request and skips the
 * download when content-length matches and (etag matches OR last-modified
 * has not advanced). Pass `--force-refresh` to override.
 *
 * The actual downloads are NOT exercised in CI -- the live FAA / eCFR endpoints
 * are too flaky for that. Tests use `--dry-run` and `--verify` against the URL
 * plan; an opt-in smoke test runs a real fetch when `AIRBOSS_E2E_DOWNLOAD=1`.
 *
 * Filename convention:
 *
 *   New corpora (aim, ac, acs) write a descriptive filename echoing the doc
 *   slug, e.g. `<root>/ac/ac-61-65-j/<edition>/AC_61-65J.pdf`. A `source.pdf`
 *   symlink in the same directory points at the descriptive file so existing
 *   readers that look for `source.<ext>` continue to work.
 *
 *   The regs and handbooks corpora keep `source.<ext>` as the primary
 *   filename for compatibility with `libs/sources/src/regs/cache.ts` and
 *   `libs/sources/src/handbooks/derivative-reader.ts`. The manifest still
 *   records `source_filename` so future migration is mechanical.
 *
 * See `scripts/README.download-sources.md` for the operator runbook.
 */

import { createHash } from 'node:crypto';
import {
	createWriteStream,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	statSync,
	symlinkSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

const USER_AGENT = 'airboss-source-downloader/1.0 (+https://github.com/joshball/airboss)';

type Corpus = 'regs' | 'aim' | 'ac' | 'acs' | 'handbooks';
const ALL_CORPORA: readonly Corpus[] = ['regs', 'aim', 'ac', 'acs', 'handbooks'] as const;

const ECFR_BASE = 'https://www.ecfr.gov/api/versioner/v1/full';
const ECFR_TITLES_URL = 'https://www.ecfr.gov/api/versioner/v1/titles.json';

/**
 * AIM is a single verified URL. The earlier candidate list (sites/, atpubs/)
 * 404s today; only the canonical /publications/media/ path serves the file.
 */
const AIM_PDF_URL = 'https://www.faa.gov/air_traffic/publications/media/aim.pdf';

interface RegsTarget {
	readonly title: '14' | '49';
	readonly partFilter?: ReadonlySet<string>;
	readonly editionDate: string;
}

interface PdfTarget {
	readonly corpus: 'aim' | 'ac' | 'acs' | 'handbooks';
	readonly doc: string;
	readonly edition: string;
	readonly url: string;
	readonly filename: string;
}

const AC_BASE = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular';

const AC_TARGETS: readonly PdfTarget[] = [
	mkAc('00-6', 'B', 'AC_00-6B.pdf'),
	mkAc('60-22', '', 'AC_60-22.pdf'),
	mkAc('61-65', 'J', 'AC_61-65J.pdf'),
	mkAc('61-83', 'J', 'AC_61-83J.pdf'),
	mkAc('61-98', 'D', 'AC_61-98D.pdf'),
	mkAc('90-66', 'C', 'AC_90-66C.pdf'),
	mkAc('91-79', 'A', 'AC_91-79A.pdf'),
	mkAc('91-92', '', 'AC_91-92.pdf'),
	mkAc('120-71', 'B', 'AC_120-71B.pdf'),
	// AC 91-21-1D uses a dot between 91 and 21 in the filename, not a dash.
	mkAc('91-21', '1D', 'AC_91.21-1D.pdf'),
	mkAc('25-7', 'D', 'AC_25-7D.pdf'),
	mkAc('150-5210', '7D', 'AC_150_5210-7D.pdf'),
];

const ACS_BASE = 'https://www.faa.gov/training_testing/testing/acs';

const ACS_TARGETS: readonly PdfTarget[] = [
	mkAcs('faa-s-acs-6', 'private_airplane_acs_6.pdf'),
	mkAcs('faa-s-acs-8', 'instrument_rating_airplane_acs_8.pdf'),
	mkAcs('faa-s-acs-7', 'commercial_airplane_acs_7.pdf'),
	mkAcs('faa-s-acs-11', 'atp_airplane_acs_11.pdf'),
	mkAcs('faa-s-acs-25', 'cfi_airplane_acs_25.pdf'),
];

const HANDBOOKS_BASE = 'https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation';

const HANDBOOKS_EXTRAS_TARGETS: readonly PdfTarget[] = [
	mkHbk('faa-h-8083-2', 'risk_management_handbook.pdf'),
	mkHbk('faa-h-8083-9', 'aviation_instructors_handbook.pdf'),
	mkHbk('faa-h-8083-15', 'instrument_flying_handbook.pdf'),
	mkHbk('faa-h-8083-16', 'instrument_procedures_handbook.pdf'),
	mkHbk('faa-h-8083-27', 'sport_pilot_handbook.pdf'),
	mkHbk('faa-h-8083-30', 'amt_general_handbook.pdf'),
	mkHbk('faa-h-8083-32', 'amt_powerplant_handbook.pdf'),
	mkHbk('faa-h-8083-34', 'risk_management_handbook_for_ga_pilots.pdf'),
];

function mkAc(number: string, revision: string, filename: string): PdfTarget {
	const docId = revision.length > 0 ? `ac-${number}-${revision}`.toLowerCase() : `ac-${number}`.toLowerCase();
	const edition = revision.length > 0 ? revision : 'current';
	return {
		corpus: 'ac',
		doc: docId,
		edition,
		url: `${AC_BASE}/${filename}`,
		filename,
	};
}

function mkAcs(docId: string, filename: string): PdfTarget {
	return {
		corpus: 'acs',
		doc: docId,
		edition: 'current',
		url: `${ACS_BASE}/${filename}`,
		filename,
	};
}

function mkHbk(docId: string, filename: string): PdfTarget {
	return {
		corpus: 'handbooks',
		doc: docId,
		edition: 'current',
		url: `${HANDBOOKS_BASE}/${filename}`,
		filename,
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
	readonly editionDate: string | null;
	readonly verify: boolean;
	readonly help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
	let corpora: Set<Corpus> = new Set(ALL_CORPORA);
	let dryRun = false;
	let forceRefresh = false;
	let verbose = false;
	let includeHandbooksExtras = false;
	let editionDate: string | null = null;
	let verify = false;
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
		if (arg === '--verify') {
			verify = true;
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
			const value = arg.slice('--edition-date='.length);
			if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
				throw new Error(`--edition-date must be YYYY-MM-DD, got "${value}"`);
			}
			editionDate = value;
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}

	return { corpora, dryRun, forceRefresh, verbose, includeHandbooksExtras, editionDate, verify, help };
}

function isCorpus(s: string): s is Corpus {
	return (ALL_CORPORA as readonly string[]).includes(s);
}

// ---------------------------------------------------------------------------
// Plan + summary types
// ---------------------------------------------------------------------------

interface DownloadPlan {
	readonly corpus: Corpus;
	readonly doc: string;
	readonly edition: string;
	readonly url: string;
	readonly destPath: string;
	readonly extension: 'pdf' | 'xml';
	/** When true, also create a `source.<ext>` symlink alongside the descriptive filename. */
	readonly writeSourceSymlink: boolean;
}

interface CorpusResult {
	readonly corpus: Corpus;
	files: number;
	bytes: number;
	errors: number;
	skipped: number;
}

// ---------------------------------------------------------------------------
// eCFR title metadata -- auto-detect latest_amended_on per title
// ---------------------------------------------------------------------------

interface EcfrTitleMeta {
	readonly number: number;
	readonly latest_amended_on: string;
}

interface EcfrTitlesResponse {
	readonly titles: readonly EcfrTitleMeta[];
}

let cachedTitles: EcfrTitlesResponse | null = null;

async function fetchEcfrTitles(fetchImpl: typeof fetch = globalThis.fetch): Promise<EcfrTitlesResponse> {
	if (cachedTitles !== null) return cachedTitles;
	const response = await fetchImpl(ECFR_TITLES_URL, {
		headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
	});
	if (!response.ok) {
		throw new Error(`failed to fetch eCFR titles metadata: HTTP ${response.status}`);
	}
	const parsed = (await response.json()) as EcfrTitlesResponse;
	if (!Array.isArray(parsed.titles)) {
		throw new Error('eCFR titles response missing titles array');
	}
	cachedTitles = parsed;
	return parsed;
}

function latestAmendedOnFor(titles: EcfrTitlesResponse, title: '14' | '49'): string {
	const entry = titles.titles.find((t) => String(t.number) === title);
	if (entry === undefined) {
		throw new Error(`eCFR titles response did not include title ${title}`);
	}
	if (typeof entry.latest_amended_on !== 'string' || entry.latest_amended_on.length === 0) {
		throw new Error(`eCFR title ${title} has no latest_amended_on`);
	}
	return entry.latest_amended_on;
}

/** Test seam: pre-load the titles cache so buildPlans does not need to fetch. */
function _setCachedTitlesForTest(titles: EcfrTitlesResponse | null): void {
	cachedTitles = titles;
}

// ---------------------------------------------------------------------------
// Plan builders
// ---------------------------------------------------------------------------

interface BuildPlansOptions {
	readonly fetchImpl?: typeof fetch;
}

async function buildPlans(args: CliArgs, root: string, opts: BuildPlansOptions = {}): Promise<DownloadPlan[]> {
	const plans: DownloadPlan[] = [];

	if (args.corpora.has('regs')) {
		const editionFor: Record<'14' | '49', string> = await resolveRegsEditions(args, opts.fetchImpl);
		const regsTargets: readonly RegsTarget[] = [
			{ title: '14', editionDate: editionFor['14'] },
			{ title: '49', editionDate: editionFor['49'], partFilter: new Set(['830']) },
			{ title: '49', editionDate: editionFor['49'], partFilter: new Set(['1552']) },
		];
		for (const t of regsTargets) plans.push(buildRegsPlan(t, root));
	}

	if (args.corpora.has('aim')) {
		const edition = currentMonthEdition();
		const filename = `aim-${edition}.pdf`;
		plans.push({
			corpus: 'aim',
			doc: 'aim',
			edition,
			url: AIM_PDF_URL,
			destPath: join(root, 'aim', edition, filename),
			extension: 'pdf',
			writeSourceSymlink: true,
		});
	}

	if (args.corpora.has('ac')) {
		for (const t of AC_TARGETS) plans.push(pdfTargetToPlan(t, root, true));
	}

	if (args.corpora.has('acs')) {
		for (const t of ACS_TARGETS) plans.push(pdfTargetToPlan(t, root, true));
	}

	if (args.corpora.has('handbooks') && args.includeHandbooksExtras) {
		// Handbooks have an existing reader (libs/sources/src/handbooks/derivative-reader.ts)
		// that reads source.<ext>; keep that filename here for compatibility.
		for (const t of HANDBOOKS_EXTRAS_TARGETS) plans.push(pdfTargetToPlan(t, root, false));
	}

	return plans;
}

async function resolveRegsEditions(
	args: CliArgs,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<Record<'14' | '49', string>> {
	if (args.editionDate !== null) {
		return { '14': args.editionDate, '49': args.editionDate };
	}
	const titles = await fetchEcfrTitles(fetchImpl);
	return {
		'14': latestAmendedOnFor(titles, '14'),
		'49': latestAmendedOnFor(titles, '49'),
	};
}

function buildRegsPlan(target: RegsTarget, root: string): DownloadPlan {
	const partSlug =
		target.partFilter !== undefined && target.partFilter.size > 0
			? `parts-${[...target.partFilter].sort().join('-')}`
			: 'full';
	const url = buildEcfrUrl(target);
	// Regs has an existing reader (libs/sources/src/regs/cache.ts) that expects
	// source.xml; keep that as the primary filename to avoid breaking ingestion.
	return {
		corpus: 'regs',
		doc: `cfr-${target.title}-${partSlug}`,
		edition: target.editionDate,
		url,
		destPath: join(root, 'regulations', `cfr-${target.title}`, target.editionDate, `${partSlug}.xml`),
		extension: 'xml',
		writeSourceSymlink: false,
	};
}

function buildEcfrUrl(target: RegsTarget): string {
	const base = `${ECFR_BASE}/${target.editionDate}/title-${target.title}.xml`;
	if (target.partFilter === undefined || target.partFilter.size === 0) return base;
	const params = new URLSearchParams();
	for (const part of target.partFilter) params.append('part', part);
	return `${base}?${params.toString()}`;
}

function pdfTargetToPlan(t: PdfTarget, root: string, writeSourceSymlink: boolean): DownloadPlan {
	const editionSlug = t.edition.length > 0 ? t.edition : 'current';
	const filename = writeSourceSymlink ? t.filename : 'source.pdf';
	const destPath = join(root, t.corpus, t.doc, editionSlug, filename);
	return {
		corpus: t.corpus,
		doc: t.doc,
		edition: editionSlug,
		url: t.url,
		destPath,
		extension: 'pdf',
		writeSourceSymlink,
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
	readonly source_filename: string;
	readonly source_sha256: string;
	readonly size_bytes: number;
	readonly fetched_at: string;
	readonly last_modified?: string;
	readonly etag?: string;
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
// HTTP primitives -- HEAD, fetch, redirects, retry
// ---------------------------------------------------------------------------

interface HeadResult {
	readonly url: string;
	readonly status: number;
	readonly contentLength: number | null;
	readonly lastModified: string | null;
	readonly etag: string | null;
}

async function headRequest(startUrl: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<HeadResult> {
	const finalUrl = await followRedirectsHead(startUrl, fetchImpl, false);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
	let response: Response;
	try {
		response = await fetchImpl(finalUrl, {
			method: 'HEAD',
			redirect: 'manual',
			signal: controller.signal,
			headers: { 'User-Agent': USER_AGENT },
		});
	} finally {
		clearTimeout(timer);
	}
	const cl = response.headers.get('content-length');
	return {
		url: finalUrl,
		status: response.status,
		contentLength: cl === null ? null : Number.parseInt(cl, 10),
		lastModified: response.headers.get('last-modified'),
		etag: response.headers.get('etag'),
	};
}

interface DownloadOptions {
	readonly verbose: boolean;
	readonly fetchImpl?: typeof fetch;
}

interface DownloadOutcome {
	readonly url: string;
	readonly sha256: string;
	readonly bytes: number;
	readonly lastModified: string | null;
	readonly etag: string | null;
}

async function downloadFile(url: string, destPath: string, opts: DownloadOptions): Promise<DownloadOutcome> {
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

	const finalUrl = await followRedirectsHead(url, fetchImpl, opts.verbose);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetchImpl(finalUrl, {
			signal: controller.signal,
			redirect: 'manual',
			headers: { 'User-Agent': USER_AGENT },
		});
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

	return {
		url: finalUrl,
		sha256: hash.digest('hex'),
		bytes,
		lastModified: response.headers.get('last-modified'),
		etag: response.headers.get('etag'),
	};
}

async function followRedirectsHead(startUrl: string, fetchImpl: typeof fetch, verbose: boolean): Promise<string> {
	let url = startUrl;
	for (let i = 0; i < MAX_REDIRECTS; i += 1) {
		const head = await fetchImpl(url, {
			method: 'HEAD',
			redirect: 'manual',
			headers: { 'User-Agent': USER_AGENT },
		});
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
// Symlink helpers -- write a `source.<ext>` alias to the descriptive filename
// ---------------------------------------------------------------------------

function ensureSourceSymlink(plan: DownloadPlan): void {
	if (!plan.writeSourceSymlink) return;
	const linkPath = join(dirname(plan.destPath), `source.${plan.extension}`);
	const target = basename(plan.destPath);
	if (target === `source.${plan.extension}`) return;
	if (existsSync(linkPath) || isBrokenSymlink(linkPath)) {
		try {
			unlinkSync(linkPath);
		} catch {
			// fall through; symlinkSync will throw if it cannot place the link
		}
	}
	try {
		symlinkSync(target, linkPath);
	} catch (error) {
		// On filesystems that do not support symlinks, log and continue. The
		// descriptive file is still present; only the source.<ext> alias is missing.
		console.warn(`  could not create source symlink at ${linkPath}: ${describeError(error)}`);
	}
}

function isBrokenSymlink(path: string): boolean {
	try {
		const lst = lstatSync(path);
		return lst.isSymbolicLink() && !existsSync(path);
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Cache freshness check (HEAD vs manifest + cached file size)
// ---------------------------------------------------------------------------

interface FreshnessDecision {
	readonly fresh: boolean;
	readonly reason: string;
	readonly head: HeadResult | null;
}

async function evaluateFreshness(
	plan: DownloadPlan,
	manifest: Manifest | null,
	fetchImpl: typeof fetch = globalThis.fetch,
): Promise<FreshnessDecision> {
	if (manifest === null) return { fresh: false, reason: 'no manifest', head: null };
	if (!existsSync(plan.destPath)) return { fresh: false, reason: 'cached file missing', head: null };
	const cachedSize = statSync(plan.destPath).size;
	if (cachedSize !== manifest.size_bytes) {
		return { fresh: false, reason: `size drift (cached=${cachedSize}, manifest=${manifest.size_bytes})`, head: null };
	}

	let head: HeadResult;
	try {
		head = await headRequest(plan.url, fetchImpl);
	} catch (error) {
		return { fresh: false, reason: `HEAD failed: ${describeError(error)}`, head: null };
	}

	if (head.status < 200 || head.status >= 300) {
		return { fresh: false, reason: `HEAD HTTP ${head.status}`, head };
	}

	if (head.contentLength !== null && head.contentLength !== cachedSize) {
		return {
			fresh: false,
			reason: `content-length drift (head=${head.contentLength}, cached=${cachedSize})`,
			head,
		};
	}

	const etagMatch =
		head.etag !== null && manifest.etag !== undefined && manifest.etag.length > 0 && head.etag === manifest.etag;
	const lastModNotAdvanced =
		head.lastModified !== null &&
		manifest.last_modified !== undefined &&
		manifest.last_modified.length > 0 &&
		!isLaterHttpDate(head.lastModified, manifest.last_modified);

	if (etagMatch || lastModNotAdvanced) {
		return { fresh: true, reason: etagMatch ? 'etag match' : 'last-modified unchanged', head };
	}

	// No etag/last-modified comparison possible but content-length matches and
	// we have a manifest hash -- treat as fresh. The remote might have
	// silently rotated bytes, but without metadata we have no signal.
	if (head.contentLength === cachedSize) {
		return { fresh: true, reason: 'content-length match (no etag/last-modified)', head };
	}

	return { fresh: false, reason: 'no metadata match', head };
}

function isLaterHttpDate(candidate: string, baseline: string): boolean {
	const c = Date.parse(candidate);
	const b = Date.parse(baseline);
	if (Number.isNaN(c) || Number.isNaN(b)) return false;
	return c > b;
}

// ---------------------------------------------------------------------------
// Per-plan execution
// ---------------------------------------------------------------------------

async function executePlan(plan: DownloadPlan, args: CliArgs, result: CorpusResult): Promise<void> {
	const label = `${plan.corpus}/${plan.doc}@${plan.edition}`;

	if (args.dryRun) {
		console.log(`  [dry-run] ${label}`);
		console.log(`    -> ${plan.destPath}`);
		console.log(`       ${plan.url}`);
		return;
	}

	if (!args.forceRefresh) {
		const existing = readManifest(plan);
		const decision = await evaluateFreshness(plan, existing);
		if (decision.fresh && existing !== null) {
			if (args.verbose) console.log(`  skip (cached, ${decision.reason}) ${label} ${formatBytes(existing.size_bytes)}`);
			result.skipped += 1;
			return;
		}
		if (existing !== null && args.verbose) {
			console.log(`  refetch ${label} -- ${decision.reason}`);
		}
	}

	console.log(`  fetching ${label}`);
	try {
		const outcome = await downloadFile(plan.url, plan.destPath, { verbose: args.verbose });
		ensureSourceSymlink(plan);
		const manifest: Manifest = {
			corpus: plan.corpus,
			doc: plan.doc,
			edition: plan.edition,
			source_url: outcome.url,
			source_filename: basename(plan.destPath),
			source_sha256: outcome.sha256,
			size_bytes: outcome.bytes,
			fetched_at: new Date().toISOString(),
			...(outcome.lastModified !== null ? { last_modified: outcome.lastModified } : {}),
			...(outcome.etag !== null ? { etag: outcome.etag } : {}),
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
// Verify mode -- HEAD-only audit, no downloads
// ---------------------------------------------------------------------------

interface VerifyRow {
	readonly label: string;
	readonly url: string;
	readonly status: number | string;
	readonly contentLength: number | null;
	readonly lastModified: string | null;
	readonly cacheHit: boolean;
	readonly note: string;
}

async function runVerify(plans: readonly DownloadPlan[]): Promise<{ rows: VerifyRow[]; ok: boolean }> {
	const rows: VerifyRow[] = [];
	let ok = true;
	for (const plan of plans) {
		const label = `${plan.corpus}/${plan.doc}@${plan.edition}`;
		const manifest = readManifest(plan);
		try {
			const head = await headRequest(plan.url);
			const cacheHit =
				manifest !== null &&
				existsSync(plan.destPath) &&
				statSync(plan.destPath).size === manifest.size_bytes &&
				(head.contentLength === null || head.contentLength === manifest.size_bytes);
			if (head.status < 200 || head.status >= 300) ok = false;
			rows.push({
				label,
				url: plan.url,
				status: head.status,
				contentLength: head.contentLength,
				lastModified: head.lastModified,
				cacheHit,
				note: '',
			});
		} catch (error) {
			ok = false;
			rows.push({
				label,
				url: plan.url,
				status: 'ERR',
				contentLength: null,
				lastModified: null,
				cacheHit: false,
				note: describeError(error),
			});
		}
	}
	return { rows, ok };
}

function printVerifyTable(rows: readonly VerifyRow[]): void {
	console.log('');
	console.log('URL verification (HEAD only):');
	const labelWidth = Math.max(8, ...rows.map((r) => r.label.length));
	for (const r of rows) {
		const size = r.contentLength === null ? '-' : formatBytes(r.contentLength).padStart(8);
		const lm = r.lastModified ?? '-';
		const hit = r.cacheHit ? 'hit ' : 'miss';
		const status = String(r.status).padStart(3);
		console.log(
			`${r.label.padEnd(labelWidth)}  ${status}  ${size}  ${lm.padEnd(30)}  ${hit}${r.note ? `  ${r.note}` : ''}`,
		);
	}
	const okCount = rows.filter((r) => typeof r.status === 'number' && r.status >= 200 && r.status < 300).length;
	const hits = rows.filter((r) => r.cacheHit).length;
	console.log('');
	console.log(`${okCount}/${rows.length} URLs OK. ${hits} cache hits, ${rows.length - hits} misses.`);
	if (okCount === rows.length) console.log('(Run without --verify to download misses.)');
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
  --verify                     HEAD-only audit, no downloads (exits 1 if any URL fails)
  --force-refresh              Ignore existing cache, re-download
  --include-handbooks-extras   Add 8083-2/9/15/16/27/30/32/34
  --edition-date=YYYY-MM-DD    eCFR snapshot date (default: per-title latest_amended_on)
  --verbose                    Log every URL attempt + redirects
  --help                       Show this help

Cache root:
  $AIRBOSS_HANDBOOK_CACHE (default: ~/Documents/airboss-handbook-cache/)

Per-doc layout:
  <root>/<corpus>/<doc>/<edition>/<descriptive>.<ext>
  <root>/<corpus>/<doc>/<edition>/source.<ext>      (symlink for new corpora)
  <root>/<corpus>/<doc>/<edition>/manifest.json

Idempotent: HEAD-checks each URL and skips files where content-length matches
the cached size and (etag matches OR last-modified has not advanced past the
manifest). Pass --force-refresh to override.
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

	let plans: DownloadPlan[];
	try {
		plans = await buildPlans(args, cacheRoot);
	} catch (error) {
		console.error(`failed to build plans: ${describeError(error)}`);
		return 2;
	}

	if (plans.length === 0) {
		console.log('No corpora selected. Use --corpus= or --include-handbooks-extras to expand.');
		return 0;
	}

	if (args.verify) {
		const { rows, ok } = await runVerify(plans);
		printVerifyTable(rows);
		return ok ? 0 : 1;
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
	evaluateFreshness,
	headRequest,
	fetchEcfrTitles,
	latestAmendedOnFor,
	_setCachedTitlesForTest,
	AC_TARGETS,
	ACS_TARGETS,
	HANDBOOKS_EXTRAS_TARGETS,
	AIM_PDF_URL,
	USER_AGENT,
	ECFR_TITLES_URL,
};

if (import.meta.main) {
	const code = await runDownloadSources();
	process.exit(code);
}
