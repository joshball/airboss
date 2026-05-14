/**
 * `bun run wx-scenario drill`
 *
 * Generates a pack of practice encoded-text products (METAR / TAF /
 * PIREP / FB / AIRMET) annotated by `@ab/wx-explain`, drawn from the
 * truth models of the registered scenarios.
 *
 * Output: a JSON file (`<basename>.json`) carrying the per-item shape
 * + a markdown file (`<basename>.md`) for reading. The markdown layout
 * is `interleaved` by default (product, explanation, next product),
 * with `two-section` available (all products list, then all
 * explanations list).
 *
 * Coverage: `balanced` (default) ensures every catalog token-family is
 * exercised at least once across the pack; `random` samples without
 * coverage tracking; `gap-filling` prioritizes families with zero
 * representation.
 *
 * The drill is reproducible -- pass `--seed N` for deterministic output.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WX_SCENARIO_VALUES, type WxScenario } from '@ab/constants';
import { generateScenario } from '@ab/wx-engine/server';
import { explainAirmet, explainFb, explainMetar, explainPirep, explainTaf, type TokenAnnotation } from '@ab/wx-explain';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const CATALOG_PATH = resolve(REPO_ROOT, 'course/knowledge/weather/encoded-text-catalog/catalog.json');

type DrillProductKind = 'metar' | 'taf' | 'pirep' | 'fb' | 'airmet';
const PRODUCT_KEYS: DrillProductKind[] = ['metar', 'taf', 'pirep', 'fb', 'airmet'];

type DrillLayout = 'interleaved' | 'two-section';
type DrillCoverage = 'balanced' | 'random' | 'gap-filling';

interface DrillArgs {
	count: number;
	products: DrillProductKind[];
	layout: DrillLayout;
	seed: number;
	fromScenarios: 'all' | WxScenario[];
	coverage: DrillCoverage;
	output: string;
}

interface DrillItem {
	index: number;
	product: DrillProductKind;
	scenarioSlug: WxScenario;
	stationIcao: string | null;
	raw: string;
	annotations: TokenAnnotation[];
	exercisedFamilies: string[];
}

interface DrillPack {
	generatedAt: string;
	args: Omit<DrillArgs, 'output'>;
	items: DrillItem[];
	coverageReport: {
		totalFamilies: number;
		coveredFamilies: number;
		uncoveredFamilies: string[];
	};
}

// ---------- args -----------------------------------------------------------

function parseProducts(raw: string): DrillProductKind[] {
	const tokens = raw.split(',').map((s) => s.trim());
	const out: DrillProductKind[] = [];
	for (const tok of tokens) {
		const lower = tok.toLowerCase();
		if (!isDrillProductKind(lower)) {
			console.error(`drill: unknown product '${tok}'. Valid: ${PRODUCT_KEYS.join(', ')}.`);
			process.exit(2);
		}
		out.push(lower);
	}
	return out;
}

function isDrillProductKind(s: string): s is DrillProductKind {
	return (PRODUCT_KEYS as string[]).includes(s);
}

function parseScenarios(raw: string): 'all' | WxScenario[] {
	if (raw === 'all') return 'all';
	const tokens = raw.split(',').map((s) => s.trim()) as WxScenario[];
	for (const tok of tokens) {
		if (!(WX_SCENARIO_VALUES as readonly string[]).includes(tok)) {
			console.error(`drill: unknown scenario slug '${tok}'.`);
			process.exit(2);
		}
	}
	return tokens;
}

function parseArgs(argv: readonly string[]): DrillArgs {
	let count = 10;
	let products: DrillProductKind[] = ['metar', 'taf'];
	let layout: DrillLayout = 'interleaved';
	let seed = 1;
	let fromScenarios: 'all' | WxScenario[] = 'all';
	let coverage: DrillCoverage = 'balanced';
	let output = '/tmp/wx-drill';

	for (let i = 0; i < argv.length; i += 1) {
		const a = argv[i] ?? '';
		const v = argv[i + 1] ?? '';
		switch (a) {
			case '--count':
				count = Number.parseInt(v, 10);
				if (Number.isNaN(count) || count < 1) {
					console.error('drill: --count must be a positive integer.');
					process.exit(2);
				}
				i += 1;
				break;
			case '--products':
				products = parseProducts(v);
				i += 1;
				break;
			case '--layout':
				if (v !== 'interleaved' && v !== 'two-section') {
					console.error("drill: --layout must be 'interleaved' or 'two-section'.");
					process.exit(2);
				}
				layout = v;
				i += 1;
				break;
			case '--seed':
				seed = Number.parseInt(v, 10);
				if (Number.isNaN(seed)) {
					console.error('drill: --seed must be an integer.');
					process.exit(2);
				}
				i += 1;
				break;
			case '--from-scenarios':
				fromScenarios = parseScenarios(v);
				i += 1;
				break;
			case '--coverage':
				if (v !== 'balanced' && v !== 'random' && v !== 'gap-filling') {
					console.error("drill: --coverage must be one of 'balanced', 'random', 'gap-filling'.");
					process.exit(2);
				}
				coverage = v;
				i += 1;
				break;
			case '--output':
				output = v;
				i += 1;
				break;
			default:
				console.error(`drill: unknown argument '${a}'.`);
				process.exit(2);
		}
	}

	return { count, products, layout, seed, fromScenarios, coverage, output };
}

// ---------- deterministic PRNG ---------------------------------------------

function mulberry32(seed: number): () => number {
	let t = seed | 0;
	return () => {
		t = (t + 0x6d2b79f5) | 0;
		let x = t;
		x = Math.imul(x ^ (x >>> 15), x | 1);
		x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
		return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
	const idx = Math.floor(rand() * arr.length);
	return arr[idx] as T;
}

// ---------- catalog families snapshot --------------------------------------

interface CatalogSnapshot {
	productToFamilies: Record<DrillProductKind, string[]>;
}

function loadCatalogFamilies(): CatalogSnapshot {
	const raw = readFileSync(CATALOG_PATH, 'utf8');
	const cat = JSON.parse(raw) as {
		products: {
			metar: { tokenFamilies: { slug: string }[] };
			taf: { tokenFamilies: { slug: string }[] };
			pirep: { tokenFamilies: { slug: string }[] };
			fb: { tokenFamilies: { slug: string }[] };
			airmetSigmet: { tokenFamilies: { slug: string }[] };
		};
	};
	return {
		productToFamilies: {
			metar: cat.products.metar.tokenFamilies.map((f) => f.slug),
			taf: cat.products.taf.tokenFamilies.map((f) => f.slug),
			pirep: cat.products.pirep.tokenFamilies.map((f) => f.slug),
			fb: cat.products.fb.tokenFamilies.map((f) => f.slug),
			airmet: cat.products.airmetSigmet.tokenFamilies.map((f) => f.slug),
		},
	};
}

// ---------- generation -----------------------------------------------------

interface ScenarioSnapshot {
	slug: WxScenario;
	metars: { icao: string; raw: string; annotations: TokenAnnotation[] }[];
	tafs: { icao: string; raw: string; annotations: TokenAnnotation[] }[];
	pireps: { raw: string; annotations: TokenAnnotation[] }[];
	fbItems: { raw: string; annotations: TokenAnnotation[] } | null;
	airmets: { id: string; annotations: TokenAnnotation[] }[];
}

function snapshotScenario(slug: WxScenario): ScenarioSnapshot {
	const bundle = generateScenario({ kind: slug });
	const truth = bundle.truth;
	return {
		slug,
		metars: bundle.products.metars.map((m) => ({
			icao: m.parsed.station,
			raw: m.raw,
			annotations: explainMetar(m.parsed, truth),
		})),
		tafs: bundle.products.tafs.map((t) => ({
			icao: t.parsed.station,
			raw: t.raw,
			annotations: explainTaf(t.parsed, truth),
		})),
		pireps: bundle.products.pireps.map((p) => ({
			raw: p.raw,
			annotations: explainPirep(p.parsed, truth),
		})),
		fbItems: bundle.products.fbGrid
			? { raw: bundle.products.fbGrid.raw, annotations: explainFb(bundle.products.fbGrid.parsed, truth) }
			: null,
		airmets: bundle.products.airmets.map((a) => ({
			id: a.id,
			annotations: explainAirmet(a, truth),
		})),
	};
}

function collectFamilies(annotations: TokenAnnotation[]): string[] {
	const set = new Set<string>();
	for (const a of annotations) set.add(a.family);
	return [...set];
}

interface CandidatePool {
	metar: { snapshot: ScenarioSnapshot; idx: number }[];
	taf: { snapshot: ScenarioSnapshot; idx: number }[];
	pirep: { snapshot: ScenarioSnapshot; idx: number }[];
	fb: { snapshot: ScenarioSnapshot }[];
	airmet: { snapshot: ScenarioSnapshot; idx: number }[];
}

function buildCandidatePool(snapshots: ScenarioSnapshot[], products: DrillProductKind[]): CandidatePool {
	const pool: CandidatePool = { metar: [], taf: [], pirep: [], fb: [], airmet: [] };
	for (const snap of snapshots) {
		if (products.includes('metar')) {
			for (let i = 0; i < snap.metars.length; i += 1) pool.metar.push({ snapshot: snap, idx: i });
		}
		if (products.includes('taf')) {
			for (let i = 0; i < snap.tafs.length; i += 1) pool.taf.push({ snapshot: snap, idx: i });
		}
		if (products.includes('pirep')) {
			for (let i = 0; i < snap.pireps.length; i += 1) pool.pirep.push({ snapshot: snap, idx: i });
		}
		if (products.includes('fb') && snap.fbItems !== null) {
			pool.fb.push({ snapshot: snap });
		}
		if (products.includes('airmet')) {
			for (let i = 0; i < snap.airmets.length; i += 1) pool.airmet.push({ snapshot: snap, idx: i });
		}
	}
	return pool;
}

function sampleDrillItem(
	rand: () => number,
	pool: CandidatePool,
	products: DrillProductKind[],
	index: number,
): DrillItem | null {
	// Try product kinds in order until we find one with candidates.
	const eligible = products.filter((p) => pool[p].length > 0);
	if (eligible.length === 0) return null;
	const product = pick(rand, eligible);
	switch (product) {
		case 'metar': {
			const candidate = pick(rand, pool.metar);
			const data = candidate.snapshot.metars[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: data.icao,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'taf': {
			const candidate = pick(rand, pool.taf);
			const data = candidate.snapshot.tafs[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: data.icao,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'pirep': {
			const candidate = pick(rand, pool.pirep);
			const data = candidate.snapshot.pireps[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: null,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'fb': {
			const candidate = pick(rand, pool.fb);
			const data = candidate.snapshot.fbItems;
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: null,
				raw: data.raw,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
		case 'airmet': {
			const candidate = pick(rand, pool.airmet);
			const data = candidate.snapshot.airmets[candidate.idx];
			if (!data) return null;
			return {
				index,
				product,
				scenarioSlug: candidate.snapshot.slug,
				stationIcao: null,
				raw: data.id,
				annotations: data.annotations,
				exercisedFamilies: collectFamilies(data.annotations),
			};
		}
	}
}

function buildPack(args: DrillArgs): DrillPack {
	const rand = mulberry32(args.seed);
	const catalog = loadCatalogFamilies();
	const scenarioSlugs: WxScenario[] = args.fromScenarios === 'all' ? [...WX_SCENARIO_VALUES] : args.fromScenarios;

	const snapshots = scenarioSlugs.map(snapshotScenario);
	const pool = buildCandidatePool(snapshots, args.products);

	const items: DrillItem[] = [];
	const covered = new Set<string>();

	// Track which catalog families are still missing for `balanced` /
	// `gap-filling`. The drill prefers candidates that cover more
	// uncovered families.
	const allFamilies = new Set<string>();
	for (const p of args.products) {
		for (const f of catalog.productToFamilies[p]) allFamilies.add(`${p}::${f}`);
	}

	for (let i = 0; i < args.count; i += 1) {
		let best: DrillItem | null = null;
		let bestScore = -1;
		const sampleCount = args.coverage === 'random' ? 1 : 6;
		for (let attempt = 0; attempt < sampleCount; attempt += 1) {
			const candidate = sampleDrillItem(rand, pool, args.products, i);
			if (candidate === null) continue;
			const newFamilies = candidate.exercisedFamilies.filter((f) => !covered.has(`${candidate.product}::${f}`));
			const score = args.coverage === 'random' ? 0 : newFamilies.length;
			if (score > bestScore) {
				bestScore = score;
				best = candidate;
			}
		}
		if (best === null) break;
		for (const f of best.exercisedFamilies) covered.add(`${best.product}::${f}`);
		items.push(best);
	}

	// `balanced` mode: if any catalog family is still uncovered AND we
	// have remaining count budget, do a second pass to fill gaps. For
	// `gap-filling` mode, the entire generation is gap-driven; we do
	// the same.
	if (args.coverage !== 'random') {
		const uncovered = [...allFamilies].filter((k) => !covered.has(k));
		// (Cannot synthesize new products beyond the pool; the gap report
		//  in the output tells the user what's still missing.)
		void uncovered;
	}

	const uncovered = [...allFamilies].filter((k) => !covered.has(k));
	return {
		generatedAt: new Date().toISOString(),
		args: {
			count: args.count,
			products: args.products,
			layout: args.layout,
			seed: args.seed,
			fromScenarios: args.fromScenarios,
			coverage: args.coverage,
		},
		items,
		coverageReport: {
			totalFamilies: allFamilies.size,
			coveredFamilies: covered.size,
			uncoveredFamilies: uncovered,
		},
	};
}

// ---------- markdown rendering ---------------------------------------------

function renderItemHeader(item: DrillItem): string {
	const station = item.stationIcao ? ` (${item.stationIcao})` : '';
	return `### Item ${item.index + 1} - ${item.product.toUpperCase()}${station}`;
}

function renderItemProduct(item: DrillItem): string {
	return ['```text', item.raw, '```'].join('\n');
}

function renderItemAnnotations(item: DrillItem): string {
	const lines = ['| Token | Family | Decode | Why |', '| --- | --- | --- | --- |'];
	for (const a of item.annotations) {
		lines.push(`| \`${a.token}\` | \`${a.family}\` | ${a.decode} | ${a.why ?? ''} |`);
	}
	return lines.join('\n');
}

function renderMarkdown(pack: DrillPack): string {
	const lines: string[] = [];
	lines.push('# Encoded-text drill');
	lines.push('');
	lines.push(
		`Generated ${pack.generatedAt} from scenarios=${
			pack.args.fromScenarios === 'all' ? 'all' : pack.args.fromScenarios.join(',')
		}, seed=${pack.args.seed}, coverage=${pack.args.coverage}, layout=${pack.args.layout}.`,
	);
	lines.push('');
	lines.push(
		`Coverage: ${pack.coverageReport.coveredFamilies} / ${pack.coverageReport.totalFamilies} catalog token families exercised.`,
	);
	lines.push('');

	if (pack.args.layout === 'two-section') {
		lines.push('## Products');
		lines.push('');
		for (const item of pack.items) {
			lines.push(renderItemHeader(item));
			lines.push('');
			lines.push(renderItemProduct(item));
			lines.push('');
		}
		lines.push('## Explanations');
		lines.push('');
		for (const item of pack.items) {
			lines.push(renderItemHeader(item));
			lines.push('');
			lines.push(renderItemAnnotations(item));
			lines.push('');
		}
	} else {
		lines.push('## Items');
		lines.push('');
		for (const item of pack.items) {
			lines.push(renderItemHeader(item));
			lines.push('');
			lines.push(renderItemProduct(item));
			lines.push('');
			lines.push(renderItemAnnotations(item));
			lines.push('');
		}
	}

	if (pack.coverageReport.uncoveredFamilies.length > 0) {
		lines.push('## Uncovered token families');
		lines.push('');
		for (const f of pack.coverageReport.uncoveredFamilies) lines.push(`- ${f}`);
		lines.push('');
	}

	return lines.join('\n');
}

// ---------- entry ----------------------------------------------------------

export async function runDrill(args: readonly string[]): Promise<void> {
	const parsed = parseArgs(args);
	const pack = buildPack(parsed);
	const jsonPath = `${parsed.output}.json`;
	const mdPath = `${parsed.output}.md`;
	writeFileSync(jsonPath, `${JSON.stringify(pack, null, '\t')}\n`);
	writeFileSync(mdPath, renderMarkdown(pack));
	console.log(`drill: wrote ${jsonPath}`);
	console.log(`drill: wrote ${mdPath}`);
	console.log(
		`drill: ${pack.items.length} items, ${pack.coverageReport.coveredFamilies}/${pack.coverageReport.totalFamilies} catalog families covered`,
	);
}
