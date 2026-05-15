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
