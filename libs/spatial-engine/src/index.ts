/**
 * `@ab/spatial-engine` -- runtime / browser-safe barrel.
 *
 * Source of truth: `docs/work-packages/xc-viewer-v1/spec.md` and
 * `design.md` "Browser-safety contract".
 *
 * # Browser safety
 *
 * `libs/spatial-engine/` is server-only: the geography loader, the
 * weather-view loader, the sectional ingester, and the bundle writer all
 * touch the filesystem; the scenario / route / aircraft literals carry
 * large data. This barrel re-exports TYPES ONLY.
 *
 * Every value lives in `./server.ts` (`@ab/spatial-engine/server`),
 * tagged `// @browser-globals: server-only`. `scripts/xc-scenario.ts`,
 * server-side tests, and the SvelteKit `+page.server.ts` data loader
 * consume the `/server` entry point. `.svelte` components in
 * `libs/spatial-ui/` import `type` declarations from this barrel only.
 *
 * `check-browser-globals.ts` walks every value re-export from this barrel
 * and fails on any leak. Keep this file `export type` only.
 */

// ----------------------------------------------------------------------
// Bundle writer option type (the writer value lives in `./server.ts`).
// ----------------------------------------------------------------------
export type { WriteOpts } from './bundle';
// ----------------------------------------------------------------------
// Pure-math helpers. `geometry.ts` + `wind.ts` import nothing from Node
// and touch no browser globals -- they are safe to re-export as values
// from the runtime barrel. The renderer uses them to compute leg
// placeholders before the performance table lands.
// ----------------------------------------------------------------------
export { greatCircleBearing, greatCircleNm, midpoint, normalizeBearing } from './flight/geometry';
export type { PerfArgs } from './flight/performance';
export type { AircraftSpecSchema, FlightSchema, RouteSpecSchema } from './flight/schema';
// ----------------------------------------------------------------------
// Layer-2 flight types.
// ----------------------------------------------------------------------
export type {
	AircraftSpec,
	AltitudeStep,
	ComEquipment,
	CruisePolarPoint,
	EquipmentList,
	Flight,
	FuelBurnCurve,
	LegPerformance,
	LegPlaceholder,
	NavEquipment,
	PerformancePolar,
	PerformanceTable,
	PilotProfile,
	RouteSpec,
	SpeedStep,
	TransponderEquipment,
	Waypoint,
	WbEnvelopeVertex,
	WeightBalanceEnvelope,
} from './flight/types';
export type { ApplyWindArgs, ApplyWindResult, Wind } from './flight/wind';
export { applyWind, interpolateWindAtAltitude } from './flight/wind';
// ----------------------------------------------------------------------
// Layer-1 geography schema type (the schema value lives in `./server.ts`).
// ----------------------------------------------------------------------
export type { GeographySchema } from './geography/schema';
// ----------------------------------------------------------------------
// Layer-1 geography types.
// ----------------------------------------------------------------------
export type {
	AirportRecord,
	AirspaceClass,
	AirspacePolygon,
	BasemapFeature,
	BasemapFeatureCollection,
	BasemapFeatureProperties,
	FboRecord,
	FrequencyRecord,
	Geography,
	LonLat,
	NavaidKind,
	NavaidRecord,
	Region,
	RegionBounds,
	RunwayRecord,
} from './geography/types';
// ----------------------------------------------------------------------
// Projection-options types. The projection helper itself is a value and
// lives in `./server.ts`.
// ----------------------------------------------------------------------
export type { FitTarget, RegionalProjectionOptions } from './projection';
export type { ScenarioSpecSchema } from './scenario/schema';
// ----------------------------------------------------------------------
// Layer-4 scenario types + the composed bundle.
// ----------------------------------------------------------------------
export type {
	AcFailureEvent,
	AtcChangeEvent,
	ComposeArgs,
	NotamActivationEvent,
	PirepDropEvent,
	ScenarioBundle,
	ScenarioSpec,
	TimedEvent,
	WxChangeEvent,
} from './scenario/types';
// ----------------------------------------------------------------------
// Validation report types (the validator value lives in `./server.ts`).
// ----------------------------------------------------------------------
export type { ConsistencyIssue, ConsistencyReport } from './validate/consistency';
export type { CloudLayer } from './weather/flight-category';
export { classifyFlightCategory, lowestCeilingFtAgl } from './weather/flight-category';
// ----------------------------------------------------------------------
// Layer-3 weather view types.
// ----------------------------------------------------------------------
export type {
	AirmetView,
	ChartRef,
	FlightCategory,
	WaypointMetarView,
	WaypointTafView,
	WaypointWxView,
	WindAtWaypoint,
	WxBundleView,
} from './weather/types';
