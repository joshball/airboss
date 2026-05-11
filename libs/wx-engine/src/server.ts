// @browser-globals: server-only -- never imported by client .svelte
/**
 * `@ab/wx-engine/server` -- server-only barrel.
 *
 * Source of truth: [docs/work-packages/wx-engine/spec.md](
 *   ../../../docs/work-packages/wx-engine/spec.md
 * ) "Browser-safety" section.
 *
 * Every value re-exported here resolves to a module that either performs
 * filesystem I/O (engine bundle writer, knowledge-node resolver) or carries
 * large scenario literals that have no business in a browser bundle. The
 * runtime barrel `./index.ts` re-exports the *types* of these modules for
 * ergonomic `import type { ... }` consumption.
 *
 * Phase A populates this barrel with the Zod schema, geometry helpers,
 * `advanceTruth`, the scenario registry (A.4), and the engine entrypoint
 * (A.5). Phase B / C / D append derivation entrypoints here.
 */

// ----------------------------------------------------------------------
// Engine entrypoint + bundle writer. Phase B: products wired in.
// ----------------------------------------------------------------------
export {
	generateScenario,
	type ScenarioBundle,
	type ScenarioCharts,
	type ScenarioCommentary,
	type ScenarioProducts,
	type ScenarioRunOptions,
	type ScenarioSeed,
	writeScenarioBundle,
} from './engine';
// ----------------------------------------------------------------------
// Layer-2 product derivations. Pure functions of TruthModel + opts.
// ----------------------------------------------------------------------
export { deriveAirmets } from './products/airmet';
export { deriveMetar } from './products/metar';
export { derivePireps } from './products/pirep';
export { deriveTaf } from './products/taf';
export type { AirmetAdvisory, DerivedFbGrid, DerivedMetar, DerivedPirep, DerivedTaf } from './products/types';
export { deriveFbGrid } from './products/winds-aloft';
// ----------------------------------------------------------------------
// Truth-state evolution. The only sanctioned way to move time forward.
// ----------------------------------------------------------------------
export { advanceTruth } from './truth/advance';
// ----------------------------------------------------------------------
// Geometry helpers. Pure functions over TruthModel + lon/lat points.
// ----------------------------------------------------------------------
export {
	distanceKm,
	distanceNm,
	distanceToPolylineKm,
	findAirMass,
	pointInPolygon,
	pressureGradientMbPer100km,
	samplePressureMb,
	sideOfFront,
} from './truth/geometry';
// ----------------------------------------------------------------------
// Scenario registry. Lazy-loads + validates each scenario literal.
// ----------------------------------------------------------------------
export { loadScenario } from './truth/scenarios/registry';
// ----------------------------------------------------------------------
// Truth-model schema (Zod). Validates every scenario literal on load.
// ----------------------------------------------------------------------
export { type TruthModelSchema, truthModelSchema } from './truth/schema';
