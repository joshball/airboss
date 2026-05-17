/**
 * `@ab/wx-drill/server` -- server-only entry point.
 *
 * Exposes `snapshotScenario` (calls `@ab/wx-engine/server`) and
 * `loadCatalogFamilies` (reads the catalog JSON via `node:fs`). Consumers:
 * the `bun run wx-scenario drill` CLI and `+page.server.ts` /
 * `+server.ts` endpoints under `/practice/wx/drill`.
 *
 * Browser-bundled code must NOT import this barrel; the runtime barrel at
 * `@ab/wx-drill` re-exports types only.
 */

export { buildAllScenarioSnapshots } from './build-snapshots';
export { type CatalogLoadOptions, loadCatalogFamilies } from './catalog-loader';
export type { CatalogFamiliesByProduct } from './sample';
export { type ScenarioSnapshot, snapshotScenario } from './snapshot';
// ----------------------------------------------------------------------
// Temporal-drill bundle builder. Server-only -- runs the wx-engine to
// derive METAR / TAF sequences + per-hour front geometry for a v2 scenario.
// The pure exercise generators (`buildTemporalPack`) live in the runtime
// barrel `@ab/wx-drill`.
// ----------------------------------------------------------------------
export { buildTemporalDrillBundle, buildTemporalDrillBundles } from './temporal-bundle';
