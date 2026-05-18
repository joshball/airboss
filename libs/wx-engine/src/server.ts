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
 * `advanceTruth`, the scenario registry, and the engine entrypoint. Phase
 * B appends the five product derivations; Phase C appends the 13 chart
 * derivations + the deriveAllCharts orchestrator.
 */

// ----------------------------------------------------------------------
// Phase C: layer-3 chart-spec derivations + the orchestrator.
// ----------------------------------------------------------------------
export { deriveAdvisoryOverlayChart } from './charts/advisory-overlay';
export { deriveConvectiveOutlookChart } from './charts/convective-outlook';
export { deriveCvaChart } from './charts/cva';
export { type ChartProductInputs, deriveAllCharts, getFbStations, getRouteStations } from './charts/derive-all';
export { deriveFreezingLevelChart } from './charts/freezing-level';
export { deriveGAirmetIcingChart } from './charts/g-airmet-icing';
export { deriveGAirmetTurbulenceChart } from './charts/g-airmet-turbulence';
export { deriveGfaChart } from './charts/gfa';
export { deriveMetarPlotChart } from './charts/metar-plot';
export { derivePirepPlotChart } from './charts/pirep-plot';
export { deriveProgChart } from './charts/prog-chart';
export { deriveSurfaceAnalysisChart } from './charts/surface-analysis';
export { deriveTafTimelineChart } from './charts/taf-timeline';
export type { ChartArtifact, ChartArtifactSource } from './charts/types';
export { deriveWindsAloftChart } from './charts/winds-aloft';
// ----------------------------------------------------------------------
// Phase D: layer-4 Socratic commentary derivation + knowledge-node resolver.
// ----------------------------------------------------------------------
export {
	type KnowledgeNodeValidationReport,
	resolveKnowledgeNodeId,
	validateAllKnowledgeNodes,
} from './commentary/knowledge-link';
export { type DeriveCommentaryProducts, deriveCommentary } from './commentary/socratic';
export type { CommentaryCallout, CommentaryCalloutTarget, CommentaryMode } from './commentary/types';
// ----------------------------------------------------------------------
// Engine entrypoint + bundle writer. Phase B: products wired in. Phase C:
// charts wired in.
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
export { deriveAirmetBulletins } from './products/airmet-text';
export { deriveMetar } from './products/metar';
export { derivePireps } from './products/pirep';
export { deriveTaf } from './products/taf';
// ----------------------------------------------------------------------
// v2 temporal derivation surface. Thin wrappers that sample a v2 TruthModel
// then run the unchanged deriveX functions. Server-only because they wrap
// server-only product derivations.
// ----------------------------------------------------------------------
export {
	type AirmetEvent,
	type AirmetTimelineEntry,
	buildTimeline,
	deriveAirmetTimeline,
	deriveMetarAt,
	deriveMetarSequence,
	deriveTafAt,
	deriveTafSequence,
	type TimelineSnapshot,
} from './products/temporal';
// ----------------------------------------------------------------------
// v2 timeline-bundle assembler + writer. Server-only -- the writer touches
// the filesystem. Stores per-hour chart specs (not rendered SVGs, per ADR
// 018); the `/practice/wx/replay` surface renders the specs on demand.
// Powers the `wx-scenario build --timeline` CLI flag.
// ----------------------------------------------------------------------
export {
	type BuildTimelineBundleOptions,
	buildTimelineBundle,
	type TimelineBundle,
	type TimelineBundleSnapshot,
	type TimelineChart,
	type TimelineChartSource,
	type TimelineMetarSample,
	type TimelinePirepEvent,
	type TimelineTafSample,
	writeTimelineBundle,
	zuluHourLabel,
} from './products/timeline-bundle';
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
// ----------------------------------------------------------------------
// Phase F: validate harness -- consistency rules + round-trip primitive.
// Used by `scripts/wx-scenario/{validate,check-round-trip}.ts`.
// ----------------------------------------------------------------------
export {
	type ConsistencyIssue,
	type ConsistencyReport,
	runConsistency,
} from './validate/consistency';
export {
	type ProductRoundTripFailure,
	type ProductRoundTripResult,
	type RoundTripReport,
	runRoundTrip,
	summarizeRoundTrip,
} from './validate/round-trip';
