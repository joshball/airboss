/**
 * Engine entrypoint + bundle writer.
 *
 * `generateScenario(seed)` returns a `ScenarioBundle` with the truth-model
 * populated and (as of Phase B) the five layer-2 product derivations wired in.
 * Phase C wires in the layer-3 chart-spec derivations.
 * `writeScenarioBundle(bundle, opts)` lands the artifacts on disk per the
 * spec's "Output layout" section.
 *
 * # Phase scoping
 *
 * Phase A wired `generateScenario` to load the validated truth via the
 * registry and return empty product / chart / commentary collections.
 *
 * Phase B widened `ScenarioProducts` to the canonical `DerivedMetar[]` /
 * `DerivedTaf[]` / `AirmetAdvisory[]` / `DerivedFbGrid` / `DerivedPirep[]`
 * shapes and runs the five derivation functions over the scenario's
 * `routeStations` + `fbStations` metadata. The writer emits the layer-2
 * products under `data/wx-scenarios/<slug>/products/`.
 *
 * Phase C (this commit) widens `ScenarioCharts` to `ChartArtifact[]` and
 * calls `deriveAllCharts(truth, products, scenarioId)` to fill it in. The
 * writer now emits per-chart spec.yaml + sources, mirrored into
 * `data/charts/wx/<chart-slug>/spec.yaml` for the chart-build CLI and
 * into `~/Documents/airboss-handbook-cache/wx/<source-rel-path>` per
 * ADR 018.
 *
 * Phase D widens `commentary` and appends its writer.
 *
 * # Browser safety
 *
 * `writeScenarioBundle` reaches for `node:fs` / `node:path` / `node:os`.
 * The module is server-only (the runtime barrel re-exports the types,
 * never the values). Node built-ins are lazy-loaded via
 * `process.getBuiltinModule(...)` inside function bodies per the canonical
 * pattern at `libs/constants/src/source-cache.ts`.
 */

import type { WxScenario } from '@ab/constants';
import { stringify as yamlStringify } from 'yaml';
import { type ChartProductInputs, deriveAllCharts } from './charts/derive-all';
import type { ChartArtifact } from './charts/types';
import { deriveAirmets } from './products/airmet';
import { deriveMetar } from './products/metar';
import { derivePireps } from './products/pirep';
import { deriveTaf } from './products/taf';
import type { AirmetAdvisory, DerivedFbGrid, DerivedMetar, DerivedPirep, DerivedTaf } from './products/types';
import { deriveFbGrid } from './products/winds-aloft';
import { loadScenario } from './truth/scenarios/registry';
import type { TruthModel } from './truth/types';

// ----------------------------------------------------------------------
// Engine API surface
// ----------------------------------------------------------------------

/**
 * Tagged union of every registered scenario. Closed at all six slugs in
 * Phase A so Phase E adds scenario literals without touching this surface.
 */
export type ScenarioSeed =
	| { kind: 'frontal-xc-march' }
	| { kind: 'summer-thunderstorms-tx' }
	| { kind: 'winter-icing-great-lakes' }
	| { kind: 'mountain-wave-rockies' }
	| { kind: 'marine-stratus-pacific-nw' }
	| { kind: 'dense-fog-radiation-central-valley' };

/**
 * Layer-2 product collections. Phase B populates each field via the
 * derivation functions; field names match the spec's "Engine API" section.
 * `fbGrid` is null only when `truth.fbStations` is empty (defensive --
 * the Zod schema requires at least one entry).
 */
export interface ScenarioProducts {
	metars: DerivedMetar[];
	tafs: DerivedTaf[];
	airmets: AirmetAdvisory[];
	fbGrid: DerivedFbGrid | null;
	pireps: DerivedPirep[];
}

/**
 * Layer-3 chart artifacts. Phase C widens this to `ChartArtifact[]` and
 * populates the per-chart derivations via `deriveAllCharts`.
 */
export type ScenarioCharts = ChartArtifact[];

/**
 * Layer-4 commentary callouts. Phase A returns an empty array; Phase D
 * narrows to `CommentaryCallout[]` from `./commentary/types.ts`.
 */
export type ScenarioCommentary = never[];

/**
 * Bundle returned by `generateScenario`. Truth is always populated; the
 * derivation layers fill in across phases B / C / D.
 */
export interface ScenarioBundle {
	scenarioId: string;
	truth: TruthModel;
	products: ScenarioProducts;
	charts: ScenarioCharts;
	commentary: ScenarioCommentary;
}

/** Options the bundle writer reads. */
export interface ScenarioRunOptions {
	/** Repo root for resolving `data/wx-scenarios/<slug>/`. */
	repoRoot: string;
	/** Override the source-bytes cache root (default: `~/Documents/airboss-handbook-cache/`). */
	cacheRoot?: string;
	/** Mirror chart specs into `data/charts/wx/<slug>/`. Default `true`. Phase C wires this. */
	mirrorIntoChartsDir?: boolean;
}

// ----------------------------------------------------------------------
// generateScenario
// ----------------------------------------------------------------------

/**
 * Produce a complete ScenarioBundle for the given seed. Phase B populates
 * truth + every layer-2 product. Phase C populates layer-3 chart
 * artifacts via `deriveAllCharts`. Commentary remains empty until Phase D.
 */
export function generateScenario(seed: ScenarioSeed): ScenarioBundle {
	const slug = seed.kind as WxScenario;
	const truth = loadScenario(slug);

	// === Phase B: products ===
	const tafValidHours = truth.tafValidHours ?? 12;
	const metars = truth.routeStations.map((icao) => deriveMetar(truth, icao));
	const tafs = truth.routeStations.map((icao) => deriveTaf(truth, icao, { validHours: tafValidHours }));
	const airmets = deriveAirmets(truth);
	const fbGrid = truth.fbStations.length > 0 ? deriveFbGrid(truth, truth.fbStations) : null;
	const pireps = derivePireps(truth);
	const products: ScenarioProducts = { metars, tafs, airmets, fbGrid, pireps };

	// === Phase C: charts ===
	const charts = deriveAllCharts(truth, products satisfies ChartProductInputs, truth.scenarioId);

	return {
		scenarioId: truth.scenarioId,
		truth,
		products,
		charts,
		commentary: [],
	};
}

// ----------------------------------------------------------------------
// writeScenarioBundle
// ----------------------------------------------------------------------

type NodeFs = {
	existsSync: (p: string) => boolean;
	mkdirSync: (p: string, opts: { recursive: boolean }) => void;
	writeFileSync: (p: string, data: string) => void;
};
type NodePath = {
	resolve: (...parts: string[]) => string;
	dirname: (p: string) => string;
	basename: (p: string) => string;
};
type NodeOs = { homedir: () => string };

const DEFAULT_CACHE_SUBDIR = ['Documents', 'airboss-handbook-cache'] as const;

type GetBuiltinModule = (spec: string) => unknown;

/** Lazy-load a Node built-in via `process.getBuiltinModule` to keep Vite's static
 *  analyzer blind to the specifier. Mirrors `libs/constants/src/source-cache.ts`. */
function loadBuiltin<T>(spec: string): T {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`wx-engine: ${spec} unavailable in this runtime (no process.getBuiltinModule)`);
	}
	return getBuiltin(spec) as T;
}

/**
 * Write the scenario bundle to disk.
 *
 * Phase B writes truth.json plus the layer-2 product collections under
 * `data/wx-scenarios/<slug>/products/`:
 *
 *   metars.{txt,json}      one METAR per line / array of ParsedMetar
 *   tafs.{txt,json}        one TAF per blank-line-separated block / array
 *   fb-bulletin.{txt,json} the bulletin text / the ParsedFbGrid
 *   pireps.{txt,json}      one PIREP per line / array of ParsedPirep
 *   airmets.json           array of AirmetAdvisory
 *
 * Phase C writes the chart artifacts produced by `deriveAllCharts` under
 * `data/wx-scenarios/<slug>/charts/<chart-slug>/spec.yaml`,
 * `data/wx-scenarios/<slug>/charts/<chart-slug>/sources/<name>.json`,
 * mirrored into `data/charts/wx/<chart-slug>/spec.yaml` for `bun run charts
 * build`, and mirrored into the wx cache at
 * `~/Documents/airboss-handbook-cache/wx/<source-rel-path>` per ADR 018.
 *
 * Empty product / chart / commentary arrays skip their writers; commentary
 * writer lands in Phase D.
 */
export async function writeScenarioBundle(bundle: ScenarioBundle, options: ScenarioRunOptions): Promise<void> {
	const fs = loadBuiltin<NodeFs>('node:fs');
	const path = loadBuiltin<NodePath>('node:path');

	const scenarioOut = path.resolve(options.repoRoot, 'data', 'wx-scenarios', bundle.scenarioId);
	const productsOut = path.resolve(scenarioOut, 'products');
	ensureDir(fs, scenarioOut);

	// Truth.json -- the always-written artifact.
	writeFile(fs, path, path.resolve(scenarioOut, 'truth.json'), `${JSON.stringify(bundle.truth, null, 2)}\n`);

	const { products } = bundle;

	if (products.metars.length > 0) {
		ensureDir(fs, productsOut);
		writeFile(fs, path, path.resolve(productsOut, 'metars.txt'), products.metars.map((m) => m.raw).join('\n'));
		writeFile(
			fs,
			path,
			path.resolve(productsOut, 'metars.json'),
			JSON.stringify(
				products.metars.map((m) => m.parsed),
				null,
				2,
			),
		);
	}

	if (products.tafs.length > 0) {
		ensureDir(fs, productsOut);
		writeFile(fs, path, path.resolve(productsOut, 'tafs.txt'), products.tafs.map((t) => t.raw).join('\n\n'));
		writeFile(
			fs,
			path,
			path.resolve(productsOut, 'tafs.json'),
			JSON.stringify(
				products.tafs.map((t) => t.parsed),
				null,
				2,
			),
		);
	}

	if (products.fbGrid !== null) {
		ensureDir(fs, productsOut);
		writeFile(fs, path, path.resolve(productsOut, 'fb-bulletin.txt'), products.fbGrid.raw);
		writeFile(
			fs,
			path,
			path.resolve(productsOut, 'fb-bulletin.json'),
			JSON.stringify(products.fbGrid.parsed, null, 2),
		);
	}

	if (products.pireps.length > 0) {
		ensureDir(fs, productsOut);
		writeFile(fs, path, path.resolve(productsOut, 'pireps.txt'), products.pireps.map((p) => p.raw).join('\n'));
		writeFile(
			fs,
			path,
			path.resolve(productsOut, 'pireps.json'),
			JSON.stringify(
				products.pireps.map((p) => p.parsed),
				null,
				2,
			),
		);
	}

	if (products.airmets.length > 0) {
		ensureDir(fs, productsOut);
		writeFile(fs, path, path.resolve(productsOut, 'airmets.json'), JSON.stringify(products.airmets, null, 2));
	}

	// Charts: write per-chart spec.yaml + source bytes; mirror into the
	// canonical chart-build directory + the wx cache root.
	if (bundle.charts.length > 0) {
		const chartsOut = path.resolve(scenarioOut, 'charts');
		ensureDir(fs, chartsOut);
		const mirrorIntoChartsDir = options.mirrorIntoChartsDir !== false;
		const cacheRoot = resolveCacheRoot(options.cacheRoot);
		const cacheWxRoot = path.resolve(cacheRoot, 'wx');

		for (const chart of bundle.charts) {
			const chartDir = path.resolve(chartsOut, chart.slug);
			const sourcesDir = path.resolve(chartDir, 'sources');
			ensureDir(fs, sourcesDir);

			const specYaml = yamlStringify(chart.spec);
			writeFile(fs, path, path.resolve(chartDir, 'spec.yaml'), specYaml);

			for (const src of chart.sources) {
				const filename = path.basename(src.path);
				writeFile(fs, path, path.resolve(sourcesDir, filename), src.bytes);

				// Mirror into the wx cache root so the chart CLI's cache://
				// resolver finds the bytes via `cache://<rel>`.
				const cacheTarget = path.resolve(cacheWxRoot, src.path);
				writeFile(fs, path, cacheTarget, src.bytes);
			}

			if (mirrorIntoChartsDir) {
				const mirrorDir = path.resolve(options.repoRoot, 'data', 'charts', 'wx', chart.slug);
				ensureDir(fs, mirrorDir);
				writeFile(fs, path, path.resolve(mirrorDir, 'spec.yaml'), specYaml);
			}
		}
	}

	// Phase D appends commentary writer here.
}

function resolveCacheRoot(override: string | undefined): string {
	if (override !== undefined && override.length > 0) return override;
	const envOverride =
		typeof process !== 'undefined' && process.env !== undefined ? process.env.AIRBOSS_HANDBOOK_CACHE : undefined;
	if (envOverride !== undefined && envOverride.length > 0) return envOverride;
	const os = loadBuiltin<NodeOs>('node:os');
	const path = loadBuiltin<NodePath>('node:path');
	return path.resolve(os.homedir(), ...DEFAULT_CACHE_SUBDIR);
}

function ensureDir(fs: NodeFs, p: string): void {
	if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeFile(fs: NodeFs, path: NodePath, p: string, content: string): void {
	ensureDir(fs, path.dirname(p));
	fs.writeFileSync(p, content);
}
