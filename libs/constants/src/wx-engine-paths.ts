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
 * # Layout
 *
 * Returns the **nested layout** introduced by ADR 027 PR 3:
 *
 *   data/charts/wx/wx-scenarios/<scenario-id>/<chart-kind>/
 *     <scenario-id>-<chart-kind>-spec.yaml
 *     <scenario-id>-<chart-kind>-chart.svg
 *     <scenario-id>-<chart-kind>-meta.json
 *
 * Slugs are path-shaped (`wx-scenarios/<scenario-id>/<chart-kind>`) so
 * consumers see the family at a glance and the listing code walks the
 * tree with a single family-aware traversal.
 *
 * # Browser safety
 *
 * `@ab/constants` is bundled into the browser. Pure-string helpers
 * (`wxScenarioChartSlug`, `wxScenarioArtifactFilename`) need no Node and
 * are browser-safe. Path-building helpers (`wxScenarioChartDir`,
 * `wxScenarioArtifactPath`, `wxScenarioBundleDir`) lazy-load `node:path`
 * via `process.getBuiltinModule(...)` per the canonical pattern at
 * [./source-cache.ts](./source-cache.ts). The module is annotated
 * `// @browser-globals: server-only` because callers reach for the
 * path helpers from server-side code; the bundle still loads the module
 * but never executes the function bodies on the client.
 */

import { WX_CHART_FAMILIES } from './wx-charts-paths-shared';
import type { WxScenario } from './wx-engine';

/**
 * Argument shape for scenario-id parameters in the helpers below.
 *
 * `WxScenario` is the closed enum of six production scenarios. The engine
 * call chain carries the scenario id as a plain `string` (the truth-model
 * literal stores it as a string, and helper functions like `getRouteStations`
 * accept any string). Widening helper inputs to `string` keeps the engine
 * code path single-typed; the closed enum constraint is enforced at the
 * scenario-registration boundary, not at every chart-derivation site.
 */
export type WxScenarioIdInput = WxScenario | string;

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
			'wx-engine-paths: node:path unavailable in this runtime (no process.getBuiltinModule). Do not call path helpers from .svelte files.',
		);
	}
	cachedPath = getBuiltin('node:path') as NodePath;
	return cachedPath;
}

/**
 * Artifact filenames inside a chart directory. Used by both the wx-engine
 * scenario family and the wx-charts reference-fixture family. The string
 * values are the literal filenames on disk.
 *
 * For the wx-scenarios family these are the **suffix** portion: the
 * actual on-disk filename is `<scenario-id>-<chart-kind>-<artifact>`
 * (see `wxScenarioArtifactFilename`). For reference-fixtures, the values
 * here are the literal on-disk filenames (the slug-named directory
 * already encodes the chart kind and date).
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
 * Returns the **nested layout** (`wx-scenarios/<scenario-id>/<chart-kind>`).
 * The chart-kind segment is whatever the derivation function declares
 * (e.g. `'cva'`, `'surface-analysis'`, `'taf-kstl'`, `'prog-12hr'`); for
 * multi-part kinds the caller passes the already-joined string.
 */
export function wxScenarioChartSlug(scenarioId: WxScenarioIdInput, chartKind: string): string {
	return `${WX_CHART_FAMILIES.WX_SCENARIOS}/${scenarioId}/${chartKind}`;
}

/**
 * Disambiguated artifact filename for a wx-engine scenario chart.
 *
 * Returns `<scenario-id>-<chart-kind>-<artifact>` so a stray file on disk
 * is self-identifying. The bundle writer and the chart-build CLI both
 * read/write artifacts via this helper.
 */
export function wxScenarioArtifactFilename(
	scenarioId: WxScenarioIdInput,
	chartKind: string,
	artifact: WxChartArtifact,
): string {
	return `${scenarioId}-${chartKind}-${artifact}`;
}

/**
 * Repo-relative directory for a wx-engine scenario chart. Built on top of
 * the chart-root helper so the layout is the single source of truth.
 *
 * Returns `<repoRoot>/data/charts/wx/wx-scenarios/<scenario-id>/<chart-kind>`.
 */
export function wxScenarioChartDir(repoRoot: string, scenarioId: WxScenarioIdInput, chartKind: string): string {
	const p = nodePath();
	return p.join(repoRoot, 'data', 'charts', 'wx', WX_CHART_FAMILIES.WX_SCENARIOS, scenarioId, chartKind);
}

/**
 * Absolute path to an artifact inside a wx-engine scenario chart directory.
 *
 * `artifact` is one of `WX_CHART_ARTIFACTS.SPEC` / `.CHART` / `.META`.
 * The on-disk filename is disambiguated: `<scenario-id>-<chart-kind>-<artifact>`.
 */
export function wxScenarioArtifactPath(
	repoRoot: string,
	scenarioId: WxScenarioIdInput,
	chartKind: string,
	artifact: WxChartArtifact,
): string {
	const p = nodePath();
	return p.join(
		wxScenarioChartDir(repoRoot, scenarioId, chartKind),
		wxScenarioArtifactFilename(scenarioId, chartKind, artifact),
	);
}

/**
 * Repo-relative bundle directory for a wx-engine scenario. Holds
 * `truth.json`, the layer-2 products tree, and the commentary outputs.
 *
 * Returns `<repoRoot>/data/wx-scenarios/<scenario-id>`. This is the bundle
 * tree (engine outputs), not the chart-artifact mirror under
 * `data/charts/wx/`. ADR 027 does not change this path; the chart-artifact
 * tree was reorganized in PR 3 but the bundle tree stays put.
 */
export function wxScenarioBundleDir(repoRoot: string, scenarioId: WxScenarioIdInput): string {
	const p = nodePath();
	return p.join(repoRoot, 'data', 'wx-scenarios', scenarioId);
}
