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
 *     directory. Used by the engine bundle writer to mirror chart specs
 *     into `data/charts/wx/<slug>/` without re-encoding the layout.
 *
 * # Migration phase
 *
 * Returns the **current flat layout** (`wx-<chart-kind>-<date-zulu>` for
 * reference fixtures; `data/charts/wx/<slug>/` for any chart). The ADR 027
 * follow-on PR migrates to nested layouts (`reference-fixtures/wx-...`,
 * `wx-scenarios/<scenario-id>/<chart-kind>`). Because every consumer reads
 * through these helpers, the migration is a one-file edit at that point.
 *
 * # Browser safety
 *
 * `@ab/constants` is bundled into the browser. Pure-string helpers
 * (`referenceFixtureChartSlug`) are browser-safe. Path-building helpers
 * lazy-load `node:path` via `process.getBuiltinModule(...)` per the
 * canonical pattern at [./source-cache.ts](./source-cache.ts).
 */

import type { WxChartArtifact } from './wx-engine-paths';

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
		throw new Error('wx-charts-paths: node:path unavailable in this runtime (no process.getBuiltinModule). Do not call path helpers from .svelte files.');
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
 * Returns the **current flat layout** (`wx-<chart-kind>-<date-zulu>`).
 * The chart-kind segment matches the renderer name (e.g.
 * `'surface-analysis'`, `'metar-plot-grid'`, `'winds-aloft-fb'`); the
 * `dateZulu` segment is `YYYY-MM-DD-<HH>z` (lowercase `z`).
 *
 * For fixtures with a frame modifier in the middle (e.g.
 * `wx-prog-chart-12hr-2024-12-23-12z`), pass the joined kind as the
 * chart-kind argument (e.g. `'prog-chart-12hr'`).
 *
 * ADR 027 follow-on PR migrates to the nested
 * `reference-fixtures/wx-<chart-kind>-<date-zulu>` shape.
 */
export function referenceFixtureChartSlug(chartKind: string, dateZulu: string): string {
	return `wx-${chartKind}-${dateZulu}`;
}

/**
 * Repo-relative directory for a wx-charts reference-fixture chart.
 *
 * Returns the **current flat layout**:
 *   `<repoRoot>/data/charts/wx/wx-<chart-kind>-<date-zulu>`
 */
export function referenceFixtureChartDir(repoRoot: string, chartKind: string, dateZulu: string): string {
	const p = nodePath();
	return p.join(chartsRootDir(repoRoot), referenceFixtureChartSlug(chartKind, dateZulu));
}

/**
 * Absolute path to an artifact inside a reference-fixture chart directory.
 *
 * `artifact` is one of the `WX_CHART_ARTIFACTS` values.
 */
export function referenceFixtureArtifactPath(
	repoRoot: string,
	chartKind: string,
	dateZulu: string,
	artifact: WxChartArtifact,
): string {
	const p = nodePath();
	return p.join(referenceFixtureChartDir(repoRoot, chartKind, dateZulu), artifact);
}

/**
 * Inverse of the slug builders: given any chart slug (scenario or
 * reference-fixture), return its on-disk directory.
 *
 * Used by the wx-engine bundle writer to mirror chart specs into
 * `data/charts/wx/<slug>/spec.yaml` without re-encoding the layout. Today
 * the slug encodes the full directory name; ADR 027 follow-on PR splits
 * scenario slugs (path-shaped: `wx-scenarios/<id>/<kind>`) from
 * reference-fixture slugs (`reference-fixtures/wx-<kind>-<date>`) and
 * routes each into its family directory.
 */
export function chartSlugToDir(repoRoot: string, slug: string): string {
	const p = nodePath();
	return p.join(chartsRootDir(repoRoot), slug);
}
