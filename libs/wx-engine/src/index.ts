/**
 * `@ab/wx-engine` -- runtime / browser-safe barrel.
 *
 * Source of truth: [docs/work-packages/wx-engine/spec.md](
 *   ../../../docs/work-packages/wx-engine/spec.md
 * ) and [docs/work-packages/wx-engine/design.md](
 *   ../../../docs/work-packages/wx-engine/design.md
 * ).
 *
 * # Browser safety
 *
 * `libs/wx-engine/` is server-only. The bundle writer touches the filesystem;
 * scenario literals are large (~300 lines each, six scenarios total) and have
 * no business in any browser bundle. This barrel re-exports types ONLY.
 *
 * Every value lives in `./server.ts` (`@ab/wx-engine/server`), which is tagged
 * `// @browser-globals: server-only -- never imported by client .svelte`.
 * `scripts/wx-scenario.ts`, server-side tests, and the future course-step
 * `:::scenario` directive consumer's `+page.server.ts` data loader consume the
 * `/server` entry point.
 *
 * Phase A populates the truth-model types, the Zod schema's inferred type,
 * and the engine API types as type-only re-exports. Phase B / C / D append
 * derivation-result types here.
 */

// ----------------------------------------------------------------------
// Engine API types. Values (generateScenario, writeScenarioBundle) live in
// `./server.ts` (`@ab/wx-engine/server`).
// ----------------------------------------------------------------------
export type {
	ScenarioBundle,
	ScenarioCharts,
	ScenarioCommentary,
	ScenarioProducts,
	ScenarioRunOptions,
	ScenarioSeed,
} from './engine';
// ----------------------------------------------------------------------
// Zod schema (inferred type only; the schema value lives in `./server.ts`).
// Re-exporting the schema value from this barrel is intentionally avoided
// so the runtime barrel stays free of value re-exports per spec.md
// "Browser-safety contract".
// ----------------------------------------------------------------------
export type { TruthModelSchema } from './truth/schema';
// ----------------------------------------------------------------------
// Truth-model interfaces. Pure shape; safe at any tier.
// ----------------------------------------------------------------------
export type {
	AirMass,
	AirMassClassification,
	AirMassStability,
	CardinalSide,
	ConvectionState,
	ConvectiveCell,
	DiurnalCycle,
	Front,
	FrontalPrecipBand,
	FrontIntensity,
	FrontKind,
	HazardKind,
	HazardSeverity,
	HazardZone,
	PressureSystem,
	SkyCoverHint,
	StationRecord,
	StationRegistry,
	SynopticState,
	TerrainState,
	TruthModel,
	UpperLevelState,
	WindByAltitudeRow,
} from './truth/types';
