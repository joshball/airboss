// @browser-globals: server-only -- never imported by client .svelte
/**
 * Path helpers for the wx-engine scenario chart artifacts.
 *
 * See [ADR 027](../../../docs/decisions/027-wx-charts-artifact-layout/decision.md).
 * This module is the single source of truth for every slug + path that
 * resolves to a wx-engine scenario chart under `data/charts/wx/` or a
 * scenario bundle under `data/wx-scenarios/`. All wx-engine chart
 * derivations and the scenario build CLI consume from here.
 *
 * # Migration phase
 *
 * Returns the **current flat layout** (`wx-scenario-<scenario-id>-<chart-kind>`
 * on disk; bundle dir at `data/wx-scenarios/<scenario-id>/`). The ADR 027
 * follow-on PR migrates to the nested `wx-scenarios/<scenario-id>/<chart-kind>`
 * shape. Because every consumer reads through these helpers, the migration
 * is a single-file edit at that point.
 *
 * # Browser safety
 *
 * `@ab/constants` is bundled into the browser. Pure-string helpers
 * (`wxScenarioChartSlug`) need no Node and are browser-safe. Path-building
 * helpers (`wxScenarioChartDir`, `wxScenarioArtifactPath`,
 * `wxScenarioBundleDir`) lazy-load `node:path` via
 * `process.getBuiltinModule(...)` per the canonical pattern at
 * [./source-cache.ts](./source-cache.ts). The module is annotated
 * `// @browser-globals: server-only` because callers reach for the
 * path helpers from server-side code; the bundle still loads the module
 * but never executes the function bodies on the client.
 */

import type { WxScenario } from './wx-engine';

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
		throw new Error('wx-engine-paths: node:path unavailable in this runtime (no process.getBuiltinModule). Do not call path helpers from .svelte files.');
	}
	cachedPath = getBuiltin('node:path') as NodePath;
	return cachedPath;
}

/**
 * Artifact filenames inside a chart directory. Used by both the wx-engine
 * scenario family and the wx-charts reference-fixture family. The string
 * values are the literal filenames on disk.
 */
export const WX_CHART_ARTIFACTS = {
	SPEC: 'spec.yaml',
	CHART: 'chart.svg',
	META: 'meta.json',
} as const;

export const WX_CHART_ARTIFACT_VALUES = Object.values(WX_CHART_ARTIFACTS);
export type WxChartArtifact = (typeof WX_CHART_ARTIFACT_VALUES)[number];

/**
 * Slug shape for wx-engine scenario charts.
 *
 * Returns the **current flat layout** (`wx-scenario-<scenario-id>-<chart-kind>`).
 * The chart-kind segment is whatever the derivation function declares
 * (e.g. `'cva'`, `'surface-analysis'`, `'taf-kstl'`, `'prog-12hr'`); for
 * multi-part kinds the caller passes the already-joined string.
 *
 * ADR 027 follow-on PR migrates to the nested
 * `wx-scenarios/<scenario-id>/<chart-kind>` shape.
 */
export function wxScenarioChartSlug(scenarioId: WxScenario, chartKind: string): string {
	return `wx-scenario-${scenarioId}-${chartKind}`;
}

/**
 * Repo-relative directory for a wx-engine scenario chart. Built on top of
 * the chart-root helper so the layout is the single source of truth.
 *
 * Returns the **current flat layout**:
 *   `<repoRoot>/data/charts/wx/wx-scenario-<scenario-id>-<chart-kind>`
 */
export function wxScenarioChartDir(repoRoot: string, scenarioId: WxScenario, chartKind: string): string {
	// Inline the chart root to avoid a cross-module dep; the literal layout
	// is intentionally co-located with the slug shape so a future migration
	// changes both segments in one place.
	const p = nodePath();
	return p.join(repoRoot, 'data', 'charts', 'wx', wxScenarioChartSlug(scenarioId, chartKind));
}

/**
 * Absolute path to an artifact inside a wx-engine scenario chart directory.
 *
 * `artifact` is one of `WX_CHART_ARTIFACTS.SPEC` / `.CHART` / `.META`.
 */
export function wxScenarioArtifactPath(
	repoRoot: string,
	scenarioId: WxScenario,
	chartKind: string,
	artifact: WxChartArtifact,
): string {
	const p = nodePath();
	return p.join(wxScenarioChartDir(repoRoot, scenarioId, chartKind), artifact);
}

/**
 * Repo-relative bundle directory for a wx-engine scenario. Holds
 * `truth.json`, the layer-2 products tree, and the commentary outputs.
 *
 * Returns `<repoRoot>/data/wx-scenarios/<scenario-id>`. This is the bundle
 * tree (engine outputs), not the chart-artifact mirror under
 * `data/charts/wx/`. ADR 027 does not change this path; the chart-artifact
 * tree is reorganized in the follow-on PR but the bundle tree stays put.
 */
export function wxScenarioBundleDir(repoRoot: string, scenarioId: WxScenario): string {
	const p = nodePath();
	return p.join(repoRoot, 'data', 'wx-scenarios', scenarioId);
}
