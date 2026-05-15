/**
 * `bun run wx-scenario coverage`
 *
 * Reads `course/knowledge/weather/encoded-text-catalog/catalog.json` plus
 * every `data/wx-scenarios/<slug>/coverage.json` and reports:
 *
 *   - Total catalog example + token-family counts
 *   - How many examples the registered scenarios cover (union)
 *   - The token families that have zero covered examples (gap list)
 *   - Per-scenario contribution counts (sorted high to low)
 *
 * Flags:
 *   --format json   Emit a machine-readable JSON document instead of
 *                   the human-readable text report.
 *
 * The per-scenario `coverage.json` files are written by
 * `bun run wx-scenario build`, sourced from the matcher sidecar
 * (`scenario-matches.json`). The catalog match staleness itself is
 * surfaced (warn-only) by `bun run wx-scenario check-catalog`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WX_SCENARIO_LABELS, WX_SCENARIO_VALUES, type WxScenario, wxScenarioBundleDir } from '@ab/constants';
import { REPO_ROOT } from './lib';

interface CatalogExampleLite {
	slug: string;
	product: string;
	tokenFamilies: string[];
}

interface CatalogTokenFamily {
	slug: string;
	label: string;
}

interface CatalogShape {
	products: Record<string, { tokenFamilies: CatalogTokenFamily[]; examples: CatalogExampleLite[] }>;
}

interface ScenarioCoverageFile {
	scenario: string;
	coversCatalogExamples: string[];
}

interface CoverageReport {
	totals: {
		examples: number;
		tokenFamilies: number;
		coveredExamples: number;
		coveredTokenFamilies: number;
	};
	uncoveredTokenFamilies: { product: string; slug: string; label: string }[];
	perScenario: { scenario: WxScenario; label: string; covered: number }[];
}

const CATALOG_PATH = resolve(REPO_ROOT, 'course/knowledge/weather/encoded-text-catalog/catalog.json');

function loadCatalog(): CatalogShape {
	if (!existsSync(CATALOG_PATH)) {
		throw new Error(`catalog.json missing at ${CATALOG_PATH}. Run \`bun tools/catalog-build/bin.ts\` first.`);
	}
	return JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as CatalogShape;
}

function loadScenarioCoverage(slug: WxScenario): ScenarioCoverageFile | null {
	const path = resolve(wxScenarioBundleDir(REPO_ROOT, slug), 'coverage.json');
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf8')) as ScenarioCoverageFile;
}

export function buildCoverageReport(): CoverageReport {
	const catalog = loadCatalog();
	let totalExamples = 0;
	let totalFamilies = 0;
	const tokenFamilyToExamples = new Map<
		string,
		{ product: string; slug: string; label: string; examples: Set<string> }
	>();
	for (const [productKey, product] of Object.entries(catalog.products)) {
		totalFamilies += product.tokenFamilies.length;
		for (const tf of product.tokenFamilies) {
			const key = `${productKey}::${tf.slug}`;
			tokenFamilyToExamples.set(key, { product: productKey, slug: tf.slug, label: tf.label, examples: new Set() });
		}
		for (const ex of product.examples) {
			totalExamples += 1;
			for (const tfSlug of ex.tokenFamilies) {
				const key = `${productKey}::${tfSlug}`;
				const bucket = tokenFamilyToExamples.get(key);
				if (bucket !== undefined) bucket.examples.add(ex.slug);
			}
		}
	}

	const allCovered = new Set<string>();
	const perScenarioRows: { scenario: WxScenario; label: string; covered: number }[] = [];
	for (const slug of WX_SCENARIO_VALUES) {
		const cov = loadScenarioCoverage(slug);
		const covered = cov?.coversCatalogExamples ?? [];
		for (const exSlug of covered) allCovered.add(exSlug);
		perScenarioRows.push({ scenario: slug, label: WX_SCENARIO_LABELS[slug], covered: covered.length });
	}
	perScenarioRows.sort((a, b) => b.covered - a.covered || a.scenario.localeCompare(b.scenario));

	// A token family counts as covered when at least one of its examples
	// appears in the union of per-scenario coverage.
	const coveredFamilyKeys = new Set<string>();
	const uncoveredFamilies: { product: string; slug: string; label: string }[] = [];
	for (const [key, bucket] of tokenFamilyToExamples) {
		const hit = [...bucket.examples].some((ex) => allCovered.has(ex));
		if (hit) coveredFamilyKeys.add(key);
		else uncoveredFamilies.push({ product: bucket.product, slug: bucket.slug, label: bucket.label });
	}

	return {
		totals: {
			examples: totalExamples,
			tokenFamilies: totalFamilies,
			coveredExamples: allCovered.size,
			coveredTokenFamilies: coveredFamilyKeys.size,
		},
		uncoveredTokenFamilies: uncoveredFamilies,
		perScenario: perScenarioRows,
	};
}

function pad(label: string, width: number): string {
	if (label.length >= width) return label;
	return label + ' '.repeat(width - label.length);
}

function pct(numerator: number, denominator: number): string {
	if (denominator === 0) return '0%';
	return `${Math.round((100 * numerator) / denominator)}%`;
}

function printHumanReport(report: CoverageReport): void {
	const { totals, perScenario, uncoveredTokenFamilies } = report;
	console.log(`Catalog: ${totals.examples} examples across ${totals.tokenFamilies} token families`);
	console.log(
		`Scenarios cover: ${totals.coveredExamples} examples (${pct(totals.coveredExamples, totals.examples)}), ` +
			`${totals.coveredTokenFamilies} token families (${pct(totals.coveredTokenFamilies, totals.tokenFamilies)})`,
	);
	console.log('');

	const headerWidth = Math.max(...perScenario.map((r) => r.scenario.length), 'Scenario'.length) + 2;
	console.log('Per-scenario contribution:');
	for (const row of perScenario) {
		console.log(`  ${pad(`${row.scenario}:`, headerWidth)} ${row.covered.toString().padStart(3)} examples`);
	}
	console.log('');

	if (uncoveredTokenFamilies.length === 0) {
		console.log('All catalog token families have at least one covering example. Nice.');
		return;
	}
	console.log(`Uncovered token families (${uncoveredTokenFamilies.length}):`);
	const grouped = new Map<string, { slug: string; label: string }[]>();
	for (const tf of uncoveredTokenFamilies) {
		const bucket = grouped.get(tf.product) ?? [];
		bucket.push({ slug: tf.slug, label: tf.label });
		grouped.set(tf.product, bucket);
	}
	for (const [product, rows] of grouped) {
		console.log(`  [${product}]`);
		for (const r of rows) {
			console.log(`    ${r.slug}  -- ${r.label}`);
		}
	}
}

function printJsonReport(report: CoverageReport): void {
	console.log(JSON.stringify(report, null, 2));
}

interface CoverageArgs {
	format: 'text' | 'json';
}

function parseArgs(args: readonly string[]): CoverageArgs {
	const out: CoverageArgs = { format: 'text' };
	for (let i = 0; i < args.length; i += 1) {
		const a = args[i];
		if (a === '--format') {
			const v = args[i + 1];
			if (v !== 'json' && v !== 'text') {
				throw new Error(`wx-scenario coverage: --format expects 'text' or 'json' (got '${v ?? ''}').`);
			}
			out.format = v;
			i += 1;
		} else if (a === '--format=json') out.format = 'json';
		else if (a === '--format=text') out.format = 'text';
		else if (a === '--help' || a === '-h') {
			console.log('Usage: bun run wx-scenario coverage [--format text|json]');
			process.exit(0);
		} else {
			throw new Error(`wx-scenario coverage: unknown argument '${a}'.`);
		}
	}
	return out;
}

export function runCoverage(rawArgs: readonly string[]): void {
	const args = parseArgs(rawArgs);
	const report = buildCoverageReport();
	if (args.format === 'json') printJsonReport(report);
	else printHumanReport(report);
}
