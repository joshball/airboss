/**
 * Layer-3 chart artifact shape.
 *
 * Each chart-spec derivation in `libs/wx-engine/src/charts/*.ts` is a pure
 * function of `(TruthModel, derived-products) -> ChartArtifact`. The
 * artifact carries:
 *
 *   - `slug`: the chart slug used everywhere downstream
 *     (`wx-scenarios/<scenario-id>/<chart-kind>[-<station>]`, per ADR 027
 *     PR 3). Maps to the on-disk directory under `data/charts/wx/` via
 *     `chartSlugToDir(repoRoot, slug)`. The bundle's per-chart subdirectory
 *     under `data/wx-scenarios/<scenario-id>/charts/` is keyed by the
 *     trailing chart-kind segment.
 *   - `spec`: the wx-charts library's per-chart-type spec object. Each
 *     emitted spec validates against the schema registered at
 *     `CHART_RENDERERS[spec.type].schema` (see
 *     `libs/wx-charts/src/charts/registry.ts`). The wx-charts library
 *     renders the spec into SVG without engine-side modification.
 *   - `sources[]`: the JSON source-byte files the spec's `cache://...`
 *     URIs reference. Each `path` is relative to the wx-cache root
 *     (`~/Documents/airboss-handbook-cache/wx/`); the bundle writer
 *     mirrors `bytes` to that path so `bun run charts build` resolves
 *     the `cache://scenarios/<slug>/<kind>.json` reference cleanly.
 *
 * The spec type is `unknown` at this contract: the load-bearing check is
 * `schema.parse(spec)` invoked at integration-test time. Each derivation
 * function narrows the return type by `satisfies` against the wx-charts
 * spec types it imports (`SurfaceAnalysisSpec`, `ProgChartSpec`, etc.) so
 * the static contract still holds at authoring time. See
 * `docs/work-packages/wx-engine/spec.md` "Data model" + the wx-charts
 * library's per-chart Zod schemas for the canonical spec shapes.
 */

export interface ChartArtifactSource {
	/**
	 * Cache-relative path the spec's `cache://...` URI resolves to. Example:
	 * `scenarios/frontal-xc-march/surface-analysis.json`. The bundle writer
	 * writes the bytes to `~/Documents/airboss-handbook-cache/wx/<path>`
	 * so `bun run charts build` finds the file via the cache resolver.
	 */
	path: string;
	/** JSON-stringified payload (UTF-8). */
	bytes: string;
}

export interface ChartArtifact {
	slug: string;
	/**
	 * The wx-charts library's per-chart-type spec object. Typed as
	 * `unknown` here because the union of every chart's spec shape is
	 * authored per-renderer in `libs/wx-charts/src/charts/`; the integration
	 * test asserts `schema.parse(spec)` for every chart in the bundle
	 * (`__tests__/charts-spike-parity.test.ts`).
	 */
	spec: unknown;
	sources: ChartArtifactSource[];
}
