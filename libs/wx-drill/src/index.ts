/**
 * `@ab/wx-drill` -- runtime barrel.
 *
 * Browser-safe surface for the drill sampler. Pure functions over
 * pre-computed scenario snapshots + a catalog families table. The server
 * barrel (`./server`) provides `snapshotScenario` + `loadCatalogFamilies`
 * for callers that can synthesise scenarios or read the catalog from disk
 * (CLI, `+page.server.ts`, scripts).
 *
 * Both CLI and study app consume `buildPack` + `renderDrillMarkdown` from
 * this barrel, ensuring sampler behaviour stays identical across surfaces.
 */

export { mulberry32, pick } from './prng';
export { renderDrillMarkdown } from './render-md';
export { type BuildPackInput, buildPack, type CatalogFamiliesByProduct } from './sample';
export type { ScenarioSnapshot } from './snapshot';
// ----------------------------------------------------------------------
// Temporal-drill exercise generators. Pure functions over a slim
// `TemporalDrillBundle`; browser-safe. The server-only bundle BUILDER
// (`buildTemporalDrillBundle`) lives in `./server`.
// ----------------------------------------------------------------------
export { type BuildTemporalPackInput, buildTemporalPack, renderTemporalDrillMarkdown } from './temporal-drill';
export type {
	TemporalDrillBundle,
	TemporalDrillPack,
	TemporalExercise,
	TemporalExerciseKind,
	TemporalFrontSnapshot,
	TemporalMetar,
	TemporalSnapshot,
	TemporalStation,
	TemporalTaf,
} from './temporal-types';
export type {
	DrillCoverage,
	DrillCoverageReport,
	DrillItem,
	DrillLayout,
	DrillPack,
	DrillPackArgs,
} from './types';
export { type DrillValidationFailure, type DrillValidationResult, validateDrillPack } from './validate';
