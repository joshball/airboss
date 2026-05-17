/**
 * `bun run wx-scenario drill`
 *
 * Generates a pack of practice encoded-text products (METAR / TAF /
 * PIREP / FB / AIRMET) annotated by `@ab/wx-explain`, drawn from the
 * truth models of the registered scenarios. Pure CLI shim around
 * `@ab/wx-drill` -- all generation + rendering lives in the lib so the
 * `/practice/wx/drill` route can call the same code.
 *
 * Output: a JSON file (`<basename>.json`) carrying the per-item shape
 * + a markdown file (`<basename>.md`) for reading. The markdown layout
 * is `interleaved` by default (product, explanation, next product),
 * with `two-section` available.
 *
 * Coverage: `balanced` (default) ensures every catalog token-family is
 * exercised at least once across the pack; `random` samples without
 * coverage tracking; `gap-filling` prioritizes families with zero
 * representation.
 *
 * The drill is reproducible -- pass `--seed N` for deterministic output.
 */

import { writeFileSync } from 'node:fs';
import { WX_PRODUCT_VALUES, WX_SCENARIO_VALUES, type WxProduct, type WxScenario } from '@ab/constants';
import {
	buildPack,
	buildTemporalPack,
	renderDrillMarkdown,
	renderTemporalDrillMarkdown,
	validateDrillPack,
} from '@ab/wx-drill';
import { buildAllScenarioSnapshots, buildTemporalDrillBundles, loadCatalogFamilies } from '@ab/wx-drill/server';

/** Flag that switches `drill` into sequence-based temporal-exercise mode. */
const TEMPORAL_FLAG = '--temporal';

type DrillLayout = 'interleaved' | 'two-section';
type DrillCoverage = 'balanced' | 'random' | 'gap-filling';

interface DrillArgs {
	count: number;
	products: WxProduct[];
	layout: DrillLayout;
	seed: number;
	fromScenarios: 'all' | WxScenario[];
	coverage: DrillCoverage;
	output: string;
}

function parseProducts(raw: string): WxProduct[] {
	const tokens = raw.split(',').map((s) => s.trim());
	const out: WxProduct[] = [];
	for (const tok of tokens) {
		const lower = tok.toLowerCase();
		if (!isWxProduct(lower)) {
			console.error(`drill: unknown product '${tok}'. Valid: ${WX_PRODUCT_VALUES.join(', ')}.`);
			process.exit(2);
		}
		out.push(lower);
	}
	return out;
}

function isWxProduct(s: string): s is WxProduct {
	return (WX_PRODUCT_VALUES as readonly string[]).includes(s);
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
	let products: WxProduct[] = ['metar', 'taf'];
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

export async function runDrill(args: readonly string[]): Promise<void> {
	// `--temporal` switches to sequence-based exercises (step 6 of the
	// TruthModel v2 plan). Strip the flag before `parseArgs`, which rejects
	// unknown arguments.
	if (args.includes(TEMPORAL_FLAG)) {
		await runTemporalDrill(args.filter((a) => a !== TEMPORAL_FLAG));
		return;
	}

	const parsed = parseArgs(args);
	const scenarioSlugs: WxScenario[] = parsed.fromScenarios === 'all' ? [...WX_SCENARIO_VALUES] : parsed.fromScenarios;
	const snapshots = buildAllScenarioSnapshots(scenarioSlugs);
	const catalog = loadCatalogFamilies();

	const pack = buildPack({
		args: {
			count: parsed.count,
			products: parsed.products,
			layout: parsed.layout,
			seed: parsed.seed,
			fromScenarios: parsed.fromScenarios,
			coverage: parsed.coverage,
		},
		snapshots,
		catalog,
	});

	const validation = validateDrillPack(pack);
	if (validation.failed) {
		console.error(`drill: round-trip validation FAILED on ${validation.failures.length} item(s).`);
		for (const f of validation.failures) {
			console.error(`drill: [${f.index}] ${f.product}: ${f.reason}`);
			console.error(`       raw: ${f.raw}`);
		}
		process.exit(1);
	}

	const jsonPath = `${parsed.output}.json`;
	const mdPath = `${parsed.output}.md`;
	writeFileSync(jsonPath, `${JSON.stringify(pack, null, '\t')}\n`);
	writeFileSync(mdPath, renderDrillMarkdown(pack));
	console.log(`drill: wrote ${jsonPath}`);
	console.log(`drill: wrote ${mdPath}`);
	console.log(
		`drill: ${pack.items.length} items, ${pack.coverageReport.coveredFamilies}/${pack.coverageReport.totalFamilies} catalog families covered, ${validation.checked} round-trip checks ok`,
	);
}

/**
 * `bun run wx-scenario drill --temporal` -- sequence-based exercise mode.
 *
 * Builds a temporal-drill bundle for each v2 scenario in `--from-scenarios`,
 * runs the three exercise generators (sequence-change, taf-vs-actuals,
 * front-position), and writes a `.json` + `.md` pack. Reuses `--count`,
 * `--seed`, `--from-scenarios`, `--output`; the `--products` / `--layout` /
 * `--coverage` knobs are token-fluency concerns and do not apply here.
 *
 * Only v2 scenarios (those with an `evolution` block) support `--temporal`;
 * a v1 slug surfaces a clear error.
 */
async function runTemporalDrill(args: readonly string[]): Promise<void> {
	const parsed = parseArgs(args);
	// `all` is rejected for temporal: most registered scenarios are v1-only.
	// The caller must name the v2 scenarios explicitly.
	if (parsed.fromScenarios === 'all') {
		console.error(
			`drill --temporal: pass --from-scenarios with explicit v2 scenario slugs (e.g. --from-scenarios frontal-pressure-march). 'all' is not supported because most scenarios are v1-only.`,
		);
		process.exit(2);
	}

	let bundles: ReturnType<typeof buildTemporalDrillBundles>;
	try {
		bundles = buildTemporalDrillBundles(parsed.fromScenarios);
	} catch (err) {
		console.error(`drill --temporal: ${err instanceof Error ? err.message : String(err)}`);
		process.exit(1);
	}

	const pack = buildTemporalPack({ bundles, seed: parsed.seed, count: parsed.count });

	if (pack.exercises.length === 0) {
		console.error('drill --temporal: no exercises generated -- the scenario(s) produced no usable sequences.');
		process.exit(1);
	}

	const jsonPath = `${parsed.output}.json`;
	const mdPath = `${parsed.output}.md`;
	writeFileSync(jsonPath, `${JSON.stringify(pack, null, '\t')}\n`);
	writeFileSync(mdPath, renderTemporalDrillMarkdown(pack));
	console.log(`drill: wrote ${jsonPath}`);
	console.log(`drill: wrote ${mdPath}`);
	console.log(
		`drill --temporal: ${pack.exercises.length} sequence-based exercises across ${bundles.length} scenario(s)`,
	);
}
