// @browser-globals: server-only -- never imported by client .svelte
/**
 * Path helpers for the wx-charts reference-fixture family and the shared
 * `data/charts/wx/` root.
 *
 * See [ADR 027](../../../docs/decisions/027-wx-charts-artifact-layout/decision.md).
 * This module owns:
 *   - `chartsRootDir(repoRoot)` -- the shared chart-artifact root. Lives
 *     here (and not in `scripts/charts/lib.ts`) so library tests, scripts,
 *     and the engine all read from the same source of truth.
 *   - `referenceFixtureChartSlug` + dir/artifact helpers for the
 *     reference-fixture family.
 *   - `chartSlugToDir(repoRoot, slug)` -- the inverse mapping: given any
 *     chart slug (scenario or reference-fixture), return its on-disk
 *     directory. Path-shaped slugs map directly to the layout.
 *   - `chartSpecFilename(slug)` / `chartArtifactFilename(slug, artifact)`
 *     -- per-family artifact filename. Both reference-fixtures and
 *     wx-scenarios disambiguate filenames with the slug tail prefix so a
 *     stray file on disk is self-identifying.
 *
 * # Layout
 *
 * Returns the **nested layout** introduced by ADR 027 PR 3, with the
 * symmetric filename-disambiguation pass applied to reference-fixtures:
 *
 *   data/charts/wx/reference-fixtures/wx-<chart-kind>-<date-zulu>/
 *     wx-<chart-kind>-<date-zulu>-spec.yaml
 *     wx-<chart-kind>-<date-zulu>-chart.svg
 *     wx-<chart-kind>-<date-zulu>-meta.json
 *
 *   data/charts/wx/wx-scenarios/<scenario-id>/<chart-kind>/
 *     <scenario-id>-<chart-kind>-spec.yaml
 *     <scenario-id>-<chart-kind>-chart.svg
 *     <scenario-id>-<chart-kind>-meta.json
 *
 *   data/charts/wx/mockups/<YYYY-MM-DD>-<short-name>/  (internal; not addressed via slug)
 *
 * # Browser safety
 *
 * `@ab/constants` is bundled into the browser. Pure-string helpers
 * (`referenceFixtureChartSlug`, `chartSpecFilename`, `chartArtifactFilename`)
 * are browser-safe. Path-building helpers lazy-load `node:path` via
 * `process.getBuiltinModule(...)` per the canonical pattern at
 * [./source-cache.ts](./source-cache.ts).
 */

import { WX_CHART_FAMILIES } from './wx-charts-paths-shared';
import { WX_CHART_ARTIFACTS, type WxChartArtifact } from './wx-engine-paths';

export { WX_CHART_FAMILIES, type WxChartFamily } from './wx-charts-paths-shared';

type NodePath = { join: (...parts: string[]) => string };

let cachedPath: NodePath | null = null;

type GetBuiltinModule = (spec: string) => unknown;

function nodePath(): NodePath {
	if (cachedPath !== null) return cachedPath;
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(
			'wx-charts-paths: node:path unavailable in this runtime (no process.getBuiltinModule). Do not call path helpers from .svelte files.',
		);
	}
	cachedPath = getBuiltin('node:path') as NodePath;
	return cachedPath;
}

/**
 * The shared chart-artifact root.
 *
 * Returns `<repoRoot>/data/charts/wx`. Every chart (reference fixture and
 * wx-engine scenario) lives somewhere under this path. The
 * `scripts/charts/lib.ts:chartsDir()` shim defers to this helper so the
 * layout is owned in `libs/constants/`.
 */
export function chartsRootDir(repoRoot: string): string {
	const p = nodePath();
	return p.join(repoRoot, 'data', 'charts', 'wx');
}

/**
 * Slug shape for wx-charts reference-fixture charts.
 *
 * Returns the **nested layout** (`reference-fixtures/wx-<chart-kind>-<date-zulu>`).
 * The chart-kind segment matches the renderer name (e.g.
 * `'surface-analysis'`, `'metar-plot-grid'`, `'winds-aloft-fb'`); the
 * `dateZulu` segment is `YYYY-MM-DD-<HH>z` (lowercase `z`).
 *
 * For fixtures with a frame modifier in the middle (e.g.
 * `wx-prog-chart-12hr-2024-12-23-12z`), pass the joined kind as the
 * chart-kind argument (e.g. `'prog-chart-12hr'`).
 */
export function referenceFixtureChartSlug(chartKind: string, dateZulu: string): string {
	return `${WX_CHART_FAMILIES.REFERENCE_FIXTURES}/wx-${chartKind}-${dateZulu}`;
}

/**
 * Repo-relative directory for a wx-charts reference-fixture chart.
 *
 * Returns `<repoRoot>/data/charts/wx/reference-fixtures/wx-<chart-kind>-<date-zulu>`.
 */
export function referenceFixtureChartDir(repoRoot: string, chartKind: string, dateZulu: string): string {
	const p = nodePath();
	return p.join(chartsRootDir(repoRoot), WX_CHART_FAMILIES.REFERENCE_FIXTURES, `wx-${chartKind}-${dateZulu}`);
}

/**
 * Absolute path to an artifact inside a reference-fixture chart directory.
 *
 * `artifact` is one of the `WX_CHART_ARTIFACTS` values. Reference fixtures
 * disambiguate filenames with the slug tail (`wx-<chart-kind>-<date-zulu>`)
 * prefix so a stray artifact on disk is self-identifying. Mirrors the
 * wx-scenarios convention.
 */
export function referenceFixtureArtifactPath(
	repoRoot: string,
	chartKind: string,
	dateZulu: string,
	artifact: WxChartArtifact,
): string {
	const p = nodePath();
	const slug = referenceFixtureChartSlug(chartKind, dateZulu);
	return p.join(referenceFixtureChartDir(repoRoot, chartKind, dateZulu), chartArtifactFilename(slug, artifact));
}

/**
 * Inverse of the slug builders: given any chart slug (scenario or
 * reference-fixture), return its on-disk directory.
 *
 * Both families use path-shaped slugs so the slug IS the relative path
 * under `chartsRootDir`. This helper exists so call sites are explicit
 * about the slug -> dir mapping (and so a future layout change is again
 * a one-line edit).
 */
export function chartSlugToDir(repoRoot: string, slug: string): string {
	const p = nodePath();
	return p.join(chartsRootDir(repoRoot), slug);
}

/**
 * Per-family spec filename. Both wx-scenarios and reference-fixtures use
 * the disambiguated `<slug-tail>-spec.yaml` filename derived from the
 * slug's path segments.
 */
export function chartSpecFilename(slug: string): string {
	return chartArtifactFilename(slug, WX_CHART_ARTIFACTS.SPEC);
}

/**
 * Per-family artifact filename. Mirrors `chartSpecFilename` for the other
 * artifact kinds (`chart.svg`, `meta.json`).
 *
 * For `wx-scenarios/<scenario-id>/<chart-kind>` slugs returns
 * `<scenario-id>-<chart-kind>-<artifact>`. For
 * `reference-fixtures/wx-<chart-kind>-<date-zulu>` slugs returns
 * `wx-<chart-kind>-<date-zulu>-<artifact>`. Both families flatten the
 * slug tail to a `-` separated prefix so the on-disk filename uniquely
 * identifies its source slug.
 *
 * Slugs outside the two known families fall back to the bare artifact
 * filename; callers that hit that branch are likely mid-migration and the
 * fallback keeps the helper total.
 */
export function chartArtifactFilename(slug: string, artifact: WxChartArtifact): string {
	const scenariosPrefix = `${WX_CHART_FAMILIES.WX_SCENARIOS}/`;
	const referencePrefix = `${WX_CHART_FAMILIES.REFERENCE_FIXTURES}/`;
	if (slug.startsWith(scenariosPrefix)) {
		const tail = slug.slice(scenariosPrefix.length);
		return `${tail.replace(/\//g, '-')}-${artifact}`;
	}
	if (slug.startsWith(referencePrefix)) {
		const tail = slug.slice(referencePrefix.length);
		return `${tail.replace(/\//g, '-')}-${artifact}`;
	}
	return artifact;
}
