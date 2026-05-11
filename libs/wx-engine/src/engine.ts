/**
 * Engine entrypoint + bundle writer.
 *
 * `generateScenario(seed)` returns a `ScenarioBundle` with the truth-model
 * populated. `writeScenarioBundle(bundle, opts)` lands the artifacts on
 * disk per the spec's "Output layout" section.
 *
 * # Phase scoping
 *
 * Phase A (this commit) wires `generateScenario` to load the validated
 * truth via the registry and return:
 *
 *   { scenarioId, truth, products: <empty>, charts: [], commentary: [] }
 *
 * `writeScenarioBundle` writes `data/wx-scenarios/<slug>/truth.json` and
 * SKIPS the per-product / per-chart / commentary writes when their arrays
 * are empty -- the WXENG-5 acceptance test for Phase A explicitly requires
 * the existing spike outputs at `data/wx-scenarios/frontal-xc-march/products/*`
 * to be untouched. Phase B / C / D widen `ScenarioProducts.<field>` from
 * the `never[]` placeholder types to the canonical `DerivedX[]` arrays and
 * append the per-array writers.
 *
 * The `ScenarioSeed` tagged union ships all six variants in Phase A so
 * Phase E adds scenarios with no retroactive edits to the engine surface.
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
 * Layer-2 product collections. Phase A populates each field as an empty
 * `never[]` placeholder (or `null` for the single `fbGrid`); Phase B
 * widens these to the canonical `DerivedMetar[]` / `DerivedTaf[]` /
 * `AirmetAdvisory[]` / `DerivedFbGrid` / `DerivedPirep[]` types and
 * populates them via the derivation functions.
 *
 * The field names match the spec's "Engine API" section so the surface
 * stays stable across phases.
 */
export interface ScenarioProducts {
	metars: never[];
	tafs: never[];
	airmets: never[];
	fbGrid: null;
	pireps: never[];
}

/**
 * Layer-3 chart artifacts. Phase A returns an empty array; Phase C
 * narrows to the `ChartArtifact[]` type from `./charts/types.ts` and
 * populates the per-chart derivations.
 */
export type ScenarioCharts = never[];

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
 * Produce a complete ScenarioBundle for the given seed. Phase A populates
 * the truth field via the registry; products / charts / commentary are
 * empty placeholders (filled in across Phase B / C / D).
 */
export function generateScenario(seed: ScenarioSeed): ScenarioBundle {
	const slug = seed.kind as WxScenario;
	const truth = loadScenario(slug);
	return {
		scenarioId: truth.scenarioId,
		truth,
		products: emptyProducts(),
		charts: [],
		commentary: [],
	};
}

function emptyProducts(): ScenarioProducts {
	return {
		metars: [],
		tafs: [],
		airmets: [],
		fbGrid: null,
		pireps: [],
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
};
type NodeOs = { homedir: () => string };

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
 * Phase A writes `data/wx-scenarios/<slug>/truth.json` only. Empty products
 * / charts / commentary arrays SKIP their respective writers -- the spike
 * outputs already on disk under `data/wx-scenarios/<slug>/products/*` and
 * `data/wx-scenarios/<slug>/charts/*` stay untouched until Phase B / C / D
 * widen the bundle and overwrite them with the production lib's derivations.
 *
 * Phase B / C / D append product / chart / commentary writers here.
 */
export async function writeScenarioBundle(bundle: ScenarioBundle, options: ScenarioRunOptions): Promise<void> {
	const fs = loadBuiltin<NodeFs>('node:fs');
	const path = loadBuiltin<NodePath>('node:path');

	const scenarioOut = path.resolve(options.repoRoot, 'data', 'wx-scenarios', bundle.scenarioId);
	ensureDir(fs, scenarioOut);

	// Truth.json -- the always-written artifact.
	writeFile(fs, path, path.resolve(scenarioOut, 'truth.json'), `${JSON.stringify(bundle.truth, null, 2)}\n`);

	// Phase A: products / charts / commentary are empty placeholders. Skip
	// their writers so the existing spike outputs on disk stay untouched
	// until Phase B / C / D widen the bundle types and overwrite them.
	// Phase B will branch here on `bundle.products.metars.length > 0` etc.
	// and append the per-product / per-chart / commentary writers.
	void options.cacheRoot;
	void options.mirrorIntoChartsDir;
	// Resolve `os` lazily once Phase B needs the default cache root.
	void loadBuiltin<NodeOs>;
}

function ensureDir(fs: NodeFs, p: string): void {
	if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeFile(fs: NodeFs, path: NodePath, p: string, content: string): void {
	ensureDir(fs, path.dirname(p));
	fs.writeFileSync(p, content);
}
