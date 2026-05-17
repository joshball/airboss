#!/usr/bin/env bun
/**
 * catalog-build/match-scenarios -- scenario <-> catalog cross-reference matcher.
 *
 * Walks every product (METAR / TAF / PIREP / FB / AIRMET) in every scenario
 * bundle under `data/wx-scenarios/<slug>/` and attempts to match each one
 * to a catalog example by whitespace-normalized `raw` string equality.
 *
 * Output: a single sidecar carrying both directions of the link:
 *
 *   course/knowledge/weather/encoded-text-catalog/scenario-matches.json
 *
 * Shape:
 *
 *   {
 *     matches: { <catalogExampleSlug>: { scenario, station, observationTime } },
 *     coverage: { <scenarioSlug>: [<catalogExampleSlug>, ...] }
 *   }
 *
 * The `matches` map drives the `generatedBy` field on each catalog example
 * in `catalog.json` (merged by `tools/catalog-build/bin.ts`). The `coverage`
 * map is consumed by `scripts/wx-scenario/build.ts` when it writes each
 * scenario bundle's `coverage.json`.
 *
 * The matcher is intentionally separate from the catalog authoring path:
 * a new catalog example can land today and the cross-references populate
 * the next time `bun run wx-scenario build --all && bun tools/catalog-build/match-scenarios.ts`
 * runs.
 *
 * Usage:
 *   bun tools/catalog-build/match-scenarios.ts          # build + write sidecar
 *   bun tools/catalog-build/match-scenarios.ts --check  # validate only
 *                                                       # (exit non-zero if sidecar stale)
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WX_SCENARIO_VALUES, type WxScenario, wxScenarioBundleDir } from '@ab/constants';

// `import.meta.dir` is a Bun-only field -- undefined when this module is
// imported under Vitest (Node ESM). `fileURLToPath(import.meta.url)` resolves
// the same directory in both runtimes, so `match-scenarios.test.ts` can import
// `normalizeRaw` without the path constants crashing at module load.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CATALOG_DIR = resolve(REPO_ROOT, 'course/knowledge/weather/encoded-text-catalog');
const CATALOG_PATH = resolve(CATALOG_DIR, 'catalog.json');
const SCENARIO_MATCHES_PATH = resolve(CATALOG_DIR, 'scenario-matches.json');

export interface GeneratedBy {
	scenario: string;
	station: string;
	observationTime: string;
}

/** Map from catalog example slug -> generatedBy descriptor. */
export type CatalogMatchMap = Record<string, GeneratedBy>;

/** Map from scenario slug -> list of catalog example slugs covered. */
export type ScenarioCoverageMap = Record<string, string[]>;

/**
 * Full sidecar shape. `matches` is the catalog-side view (catalog slug ->
 * generating scenario). `coverage` is the scenario-side view (scenario
 * slug -> catalog example slugs it produces). The two are derived from
 * the same walk and stay in sync by construction.
 */
export interface ScenarioMatchesFile {
	generatedAt: string;
	matches: CatalogMatchMap;
	coverage: ScenarioCoverageMap;
}

interface CatalogExampleLite {
	slug: string;
	product: string;
	raw: string;
}

interface CatalogShape {
	products: Record<string, { examples: CatalogExampleLite[] }>;
}

/**
 * Normalize a raw encoded-text string so trivial whitespace differences
 * (trailing spaces, doubled spaces, line endings) don't defeat the match.
 */
export function normalizeRaw(raw: string): string {
	return raw.trim().replace(/\s+/g, ' ');
}

interface CatalogIndex {
	bySignature: Map<string, CatalogExampleLite>;
}

function loadCatalogIndex(): CatalogIndex {
	if (!existsSync(CATALOG_PATH)) {
		throw new Error(`catalog.json missing at ${CATALOG_PATH}. Run \`bun tools/catalog-build/bin.ts\` first.`);
	}
	const raw = readFileSync(CATALOG_PATH, 'utf8');
	const parsed: unknown = JSON.parse(raw);
	if (typeof parsed !== 'object' || parsed === null) {
		throw new Error('catalog.json: malformed (expected object).');
	}
	const catalog = parsed as CatalogShape;
	const bySignature = new Map<string, CatalogExampleLite>();
	for (const product of Object.values(catalog.products)) {
		for (const ex of product.examples) {
			const sig = signatureFor(ex.product, ex.raw);
			// First-write wins on collision (catalogs SHOULD be raw-unique
			// per product, but if two examples share a raw string we keep
			// the first to avoid nondeterministic match output).
			if (!bySignature.has(sig)) bySignature.set(sig, ex);
		}
	}
	return { bySignature };
}

function signatureFor(product: string, raw: string): string {
	return `${product}::${normalizeRaw(raw)}`;
}

interface ParsedMetar {
	station: string;
	day: number;
	hour: number;
	minute: number;
}

interface ParsedTaf {
	station: string;
	issuedAt: string;
}

interface ParsedPirep {
	station: string;
	timeHhmmZ?: number;
}

function readJson<T>(path: string): T | null {
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readText(path: string): string | null {
	if (!existsSync(path)) return null;
	return readFileSync(path, 'utf8');
}

function readTruth(slug: WxScenario): { scenarioId: string; validAt: string } {
	const truthPath = resolve(wxScenarioBundleDir(REPO_ROOT, slug), 'truth.json');
	const t = readJson<{ scenarioId: string; validAt: string }>(truthPath);
	if (t === null) {
		throw new Error(`scenario "${slug}" has no truth.json at ${truthPath}. Run \`bun run wx-scenario build --all\` first.`);
	}
	return t;
}

/**
 * Build an ISO8601 observation time from the scenario's `validAt`
 * (carries the year + month) and the parsed METAR's day/hour/minute.
 * Falls back to `validAt` when the date is unparseable.
 */
function metarObservationTime(validAt: string, parsed: ParsedMetar): string {
	const base = new Date(validAt);
	if (Number.isNaN(base.getTime())) return validAt;
	const year = base.getUTCFullYear();
	const month = base.getUTCMonth();
	const obs = new Date(Date.UTC(year, month, parsed.day, parsed.hour, parsed.minute));
	return obs.toISOString();
}

/** PIREP time is HHMM Z relative to the same day band as truth.validAt. */
function pirepObservationTime(validAt: string, parsed: ParsedPirep): string {
	const base = new Date(validAt);
	if (Number.isNaN(base.getTime()) || parsed.timeHhmmZ === undefined) return validAt;
	const hour = Math.floor(parsed.timeHhmmZ / 100);
	const minute = parsed.timeHhmmZ % 100;
	const day = base.getUTCDate();
	const obs = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day, hour, minute));
	return obs.toISOString();
}

interface MatchResult {
	matches: CatalogMatchMap;
	perScenarioCoverage: Map<WxScenario, Set<string>>;
}

function splitNonEmpty(text: string, separator: string): string[] {
	return text
		.split(separator)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function recordMatch(
	result: MatchResult,
	index: CatalogIndex,
	scenario: WxScenario,
	product: string,
	raw: string,
	station: string,
	observationTime: string,
): void {
	const sig = signatureFor(product, raw);
	const ex = index.bySignature.get(sig);
	if (ex === undefined) return;
	// First-write wins: if multiple scenarios produce the same raw string,
	// the first scenario in WX_SCENARIO_VALUES order is recorded. Tracking
	// this in coverage still happens for every scenario that produced it.
	if (!Object.hasOwn(result.matches, ex.slug)) {
		result.matches[ex.slug] = { scenario, station, observationTime };
	}
	const set = result.perScenarioCoverage.get(scenario);
	if (set !== undefined) set.add(ex.slug);
}

function matchScenario(result: MatchResult, index: CatalogIndex, slug: WxScenario): void {
	const truth = readTruth(slug);
	const bundleDir = wxScenarioBundleDir(REPO_ROOT, slug);
	const productsDir = resolve(bundleDir, 'products');

	// METARs: one per line; pair with parsed JSON for station + time.
	const metarText = readText(resolve(productsDir, 'metars.txt'));
	const metarJson = readJson<ParsedMetar[]>(resolve(productsDir, 'metars.json'));
	if (metarText !== null && metarJson !== null) {
		const rawLines = splitNonEmpty(metarText, '\n');
		const limit = Math.min(rawLines.length, metarJson.length);
		for (let i = 0; i < limit; i += 1) {
			const raw = rawLines[i];
			const parsed = metarJson[i];
			recordMatch(result, index, slug, 'metar', raw, parsed.station, metarObservationTime(truth.validAt, parsed));
		}
	}

	// TAFs: blank-line-separated blocks (paired with parsed JSON).
	const tafText = readText(resolve(productsDir, 'tafs.txt'));
	const tafJson = readJson<ParsedTaf[]>(resolve(productsDir, 'tafs.json'));
	if (tafText !== null && tafJson !== null) {
		const blocks = splitNonEmpty(tafText, '\n\n');
		const limit = Math.min(blocks.length, tafJson.length);
		for (let i = 0; i < limit; i += 1) {
			const raw = blocks[i];
			const parsed = tafJson[i];
			recordMatch(result, index, slug, 'taf', raw, parsed.station, parsed.issuedAt);
		}
	}

	// PIREPs: one per line.
	const pirepText = readText(resolve(productsDir, 'pireps.txt'));
	const pirepJson = readJson<ParsedPirep[]>(resolve(productsDir, 'pireps.json'));
	if (pirepText !== null && pirepJson !== null) {
		const rawLines = splitNonEmpty(pirepText, '\n');
		const limit = Math.min(rawLines.length, pirepJson.length);
		for (let i = 0; i < limit; i += 1) {
			const raw = rawLines[i];
			const parsed = pirepJson[i];
			recordMatch(result, index, slug, 'pirep', raw, parsed.station, pirepObservationTime(truth.validAt, parsed));
		}
	}

	// FB bulletin: single document. Station = bulletin-wide "FB".
	const fbText = readText(resolve(productsDir, 'fb-bulletin.txt'));
	if (fbText !== null) {
		recordMatch(result, index, slug, 'fb', fbText, 'FB', truth.validAt);
	}

	// AIRMET / SIGMET: no `raw` field on the scenario side -- the bundle
	// stores parsed advisories only. There is nothing to match by the
	// "raw string equality" rule. Skip; coverage stays empty until a
	// future ADR adds a raw FAX-form emitter.
}

export function buildMatches(): MatchResult {
	const index = loadCatalogIndex();
	const matches: CatalogMatchMap = {};
	const perScenarioCoverage = new Map<WxScenario, Set<string>>();
	for (const slug of WX_SCENARIO_VALUES) {
		perScenarioCoverage.set(slug, new Set<string>());
	}
	const result: MatchResult = { matches, perScenarioCoverage };
	for (const slug of WX_SCENARIO_VALUES) {
		matchScenario(result, index, slug);
	}
	return result;
}

function sortedMatches(matches: CatalogMatchMap): CatalogMatchMap {
	const out: CatalogMatchMap = {};
	for (const key of Object.keys(matches).sort()) {
		out[key] = matches[key];
	}
	return out;
}

function sortedCoverage(perScenarioCoverage: Map<WxScenario, Set<string>>): ScenarioCoverageMap {
	const out: ScenarioCoverageMap = {};
	const slugs = [...perScenarioCoverage.keys()].sort();
	for (const slug of slugs) {
		const set = perScenarioCoverage.get(slug);
		if (set === undefined) continue;
		out[slug] = [...set].sort();
	}
	return out;
}

function serializeSidecar(result: MatchResult, generatedAt: string): string {
	const payload: ScenarioMatchesFile = {
		generatedAt,
		matches: sortedMatches(result.matches),
		coverage: sortedCoverage(result.perScenarioCoverage),
	};
	return `${JSON.stringify(payload, null, '\t')}\n`;
}

/** Strip generatedAt for stale-comparison so tick-by-tick rewrites don't diff. */
function stripGeneratedAt(s: string): string {
	return s.replace(/"generatedAt":\s*"[^"]*",?\n?/, '');
}

function writeAll(result: MatchResult): { matchesPath: string } {
	writeFileSync(SCENARIO_MATCHES_PATH, serializeSidecar(result, new Date().toISOString()));
	return { matchesPath: SCENARIO_MATCHES_PATH };
}

interface CheckResult {
	stale: string[];
}

function checkAll(result: MatchResult): CheckResult {
	const stale: string[] = [];
	const existing = existsSync(SCENARIO_MATCHES_PATH) ? readFileSync(SCENARIO_MATCHES_PATH, 'utf8') : '';
	const generated = serializeSidecar(result, '');
	if (stripGeneratedAt(existing) !== stripGeneratedAt(generated)) stale.push(SCENARIO_MATCHES_PATH);
	return { stale };
}

interface CliArgs {
	check: boolean;
	help: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
	const out: CliArgs = { check: false, help: false };
	for (const a of argv) {
		if (a === '--check') out.check = true;
		else if (a === '--help' || a === '-h' || a === 'help') out.help = true;
		else {
			console.error(`catalog-build/match-scenarios: unknown argument '${a}'.`);
			process.exit(2);
		}
	}
	return out;
}

function printHelp(): void {
	console.log('catalog-build/match-scenarios -- scenario <-> catalog cross-reference matcher');
	console.log('');
	console.log('Usage:');
	console.log('  bun tools/catalog-build/match-scenarios.ts           Build + write sidecars');
	console.log('  bun tools/catalog-build/match-scenarios.ts --check   Validate only (exit non-zero if stale)');
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		printHelp();
		return;
	}
	const result = buildMatches();
	if (args.check) {
		const { stale } = checkAll(result);
		if (stale.length > 0) {
			console.error('catalog-build/match-scenarios --check: the following sidecars are stale:');
			for (const p of stale) console.error(`  ${p}`);
			console.error('Run `bun tools/catalog-build/match-scenarios.ts` to regenerate.');
			process.exit(1);
		}
		console.log('catalog-build/match-scenarios --check: OK');
		return;
	}
	const { matchesPath } = writeAll(result);
	const totalMatched = Object.keys(result.matches).length;
	console.log(`catalog-build/match-scenarios: ${totalMatched} catalog example(s) matched`);
	console.log(`  wrote ${matchesPath}`);
	console.log('  scenario coverage.json files are written by `bun run wx-scenario build --all`.');
}

if (import.meta.main) {
	main().catch((err) => {
		console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
		process.exit(1);
	});
}
