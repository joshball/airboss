// @browser-globals: server-only -- never imported by client .svelte
/**
 * `@ab/spatial-engine/server` -- server-only barrel.
 *
 * Source of truth: `docs/work-packages/xc-viewer-v1/design.md`
 * "Browser-safety contract".
 *
 * Every value re-exported here resolves to a module that performs
 * filesystem I/O (geography loader, weather-view loader, sectional
 * ingester, bundle writer) or carries large hand-authored literals
 * (route / aircraft / scenario specs). The runtime barrel `./index.ts`
 * re-exports the *types* of these modules for `import type { ... }`.
 *
 * `scripts/xc-scenario.ts`, `scripts/sectionals.ts`, server-side tests,
 * and the SvelteKit `+page.server.ts` data loader consume this entry
 * point.
 */

// ----------------------------------------------------------------------
// Bundle writer.
// ----------------------------------------------------------------------
export { routeGeoJson, type WriteOpts, writeScenarioBundle, xcScenarioDir } from './bundle';
export { C172N_SKYHAWK } from './flight/aircraft/c172n-skyhawk';
export { greatCircleBearing, greatCircleNm, midpoint, normalizeBearing } from './flight/geometry';
export { loadAircraft, loadFlight, loadRoute } from './flight/loader';
export { cruiseGph, cruiseTasKt, derivePerformance, EMPTY_PERFORMANCE, type PerfArgs } from './flight/performance';
export { KMEM_KMKL_KOLV } from './flight/routes/kmem-kmkl-kolv';
export {
	type AircraftSpecSchema,
	aircraftSpecSchema,
	type FlightSchema,
	flightSchema,
	type RouteSpecSchema,
	routeSpecSchema,
} from './flight/schema';
// ----------------------------------------------------------------------
// Layer-2 flight: types, schema, loaders, geometry, wind, performance.
// ----------------------------------------------------------------------
export type {
	AircraftSpec,
	Flight,
	LegPerformance,
	PerformanceTable,
	RouteSpec,
	Waypoint,
} from './flight/types';
export {
	type ApplyWindArgs,
	type ApplyWindResult,
	applyWind,
	interpolateWindAtAltitude,
	type Wind,
} from './flight/wind';
export { ingestSectional } from './geography/ingest';
export { clearGeographyCache, loadGeography, regionDir } from './geography/loader';
export {
	airportSchema,
	airspacePolygonSchema,
	CONUS_BOUNDS,
	type GeographySchema,
	geographySchema,
	navaidSchema,
	regionSchema,
} from './geography/schema';
// ----------------------------------------------------------------------
// Layer-1 geography: types, schema, loader, ingester.
// ----------------------------------------------------------------------
export type {
	AirportRecord,
	AirspaceClass,
	AirspacePolygon,
	BasemapFeatureCollection,
	Geography,
	NavaidRecord,
	Region,
	RegionBounds,
} from './geography/types';
// ----------------------------------------------------------------------
// Projection helper.
// ----------------------------------------------------------------------
export {
	type FitTarget,
	type RegionalProjectionOptions,
	regionalLambertProjection,
	SECTIONAL_MARGIN,
	SECTIONAL_SVG_HEIGHT,
	SECTIONAL_SVG_WIDTH,
} from './projection';
export { composeBundle, composeScenario } from './scenario/compose';
export { listScenarioSlugs, loadScenario } from './scenario/registry';
export { KMEM_KMKL_KOLV_FRONTAL_MARCH } from './scenario/scenarios/kmem-kmkl-kolv-frontal-march';
export { type ScenarioSpecSchema, scenarioSpecSchema, timedEventSchema } from './scenario/schema';
// ----------------------------------------------------------------------
// Layer-4 scenario: types, schema, registry, composition.
// ----------------------------------------------------------------------
export type { ComposeArgs, ScenarioBundle, ScenarioSpec, TimedEvent } from './scenario/types';
// ----------------------------------------------------------------------
// Cross-layer consistency validator.
// ----------------------------------------------------------------------
export { type ConsistencyIssue, type ConsistencyReport, runConsistency } from './validate/consistency';
// ----------------------------------------------------------------------
// Scenario validation entrypoint -- schema + consistency, no disk writes.
// Used by `scripts/xc-scenario/validate.ts`.
// ----------------------------------------------------------------------
export { type ScenarioValidationResult, validateScenario } from './validate/scenario-check';
export { type CloudLayer, classifyFlightCategory, lowestCeilingFtAgl } from './weather/flight-category';
// ----------------------------------------------------------------------
// Layer-3 weather: view loader + projection helpers.
// ----------------------------------------------------------------------
export type { AirmetView, WaypointWxView, WxBundleView } from './weather/types';
export { clearWeatherCache, loadWeatherForScenario, pointInRing, wxScenarioDir } from './weather/view';
