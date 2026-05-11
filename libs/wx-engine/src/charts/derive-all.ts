/**
 * Phase C chart-derivation orchestrator.
 *
 * `deriveAllCharts(truth, products, scenarioId)` calls every chart-spec
 * derivation in the deterministic ordering documented in
 * `docs/work-packages/wx-engine/design.md` "Per-scenario chart count":
 *
 *   1. surface-analysis
 *   2. prog-chart (+12hr)
 *   3. advisory-overlay
 *   4. metar-plot
 *   5. pirep-plot
 *   6. winds-aloft
 *   7. taf-timeline -- one per route station (in route order)
 *   8. gfa
 *   9. convective-outlook
 *   10. cva
 *   11. freezing-level
 *   12. g-airmet-icing
 *   13. g-airmet-turbulence
 *
 * For the spike's 5-station scenario the total is 12 single + 5 TAF
 * timelines = 17 chart artifacts.
 *
 * Pure function: returns a fresh array; does not mutate inputs.
 *
 * # Route + FB stations
 *
 * The route + FB station lists are Phase B's responsibility (Phase B
 * extends `TruthModel` with `routeStations`/`fbStations`). Phase C lands
 * before Phase B's rebase carries that change, so the spike's hard-coded
 * five-station route + five-station FB roster lives here as the
 * Phase-C-only fallback. When Phase B merges + the rebase widens the
 * truth model, this module switches to `truth.routeStations` /
 * `truth.fbStations` -- a 4-line change.
 */

import type { AirmetAdvisory, DerivedFbGrid, DerivedMetar, DerivedPirep, DerivedTaf } from '../products/types';
import type { TruthModel } from '../truth/types';
import { deriveAdvisoryOverlayChart } from './advisory-overlay';
import { deriveConvectiveOutlookChart } from './convective-outlook';
import { deriveCvaChart } from './cva';
import { deriveFreezingLevelChart } from './freezing-level';
import { deriveGAirmetIcingChart } from './g-airmet-icing';
import { deriveGAirmetTurbulenceChart } from './g-airmet-turbulence';
import { deriveGfaChart } from './gfa';
import { deriveMetarPlotChart } from './metar-plot';
import { derivePirepPlotChart } from './pirep-plot';
import { deriveProgChart } from './prog-chart';
import { deriveSurfaceAnalysisChart } from './surface-analysis';
import { deriveTafTimelineChart } from './taf-timeline';
import type { ChartArtifact } from './types';
import { deriveWindsAloftChart } from './winds-aloft';

/**
 * Phase B's ScenarioProducts shape (Phase B owns this contract; we
 * accept a structural subset so the chart layer doesn't depend on the
 * Phase B module names directly while the worktrees are independent).
 */
export interface ChartProductInputs {
	metars: DerivedMetar[];
	tafs: DerivedTaf[];
	airmets: AirmetAdvisory[];
	fbGrid: DerivedFbGrid | null;
	pireps: DerivedPirep[];
}

/**
 * Per-scenario route + FB station rosters. Phase B will hoist these onto
 * `TruthModel.routeStations` / `TruthModel.fbStations`; until then we
 * carry the spike scenario's roster here so Phase C is self-contained.
 */
const SCENARIO_ROUTE_STATIONS: Record<string, readonly string[]> = {
	'frontal-xc-march': ['KSTL', 'KCPS', 'KSPI', 'KMLI', 'KORD'],
};

const SCENARIO_FB_STATIONS: Record<string, readonly string[]> = {
	'frontal-xc-march': ['KSTL', 'KORD', 'KMSP', 'KIND', 'KDSM'],
};

export function getRouteStations(scenarioId: string): readonly string[] {
	return SCENARIO_ROUTE_STATIONS[scenarioId] ?? [];
}

export function getFbStations(scenarioId: string): readonly string[] {
	return SCENARIO_FB_STATIONS[scenarioId] ?? [];
}

export function deriveAllCharts(truth: TruthModel, products: ChartProductInputs, scenarioId: string): ChartArtifact[] {
	const routeStations = getRouteStations(scenarioId);
	const fbStations = getFbStations(scenarioId);
	const charts: ChartArtifact[] = [];

	charts.push(deriveSurfaceAnalysisChart(truth, products.metars, scenarioId));
	charts.push(deriveProgChart(truth, scenarioId));
	charts.push(deriveAdvisoryOverlayChart(truth, products.airmets, scenarioId));
	charts.push(deriveMetarPlotChart(truth, products.metars, scenarioId));
	charts.push(derivePirepPlotChart(truth, products.pireps, scenarioId));
	if (products.fbGrid !== null) {
		charts.push(deriveWindsAloftChart(truth, products.fbGrid, [...fbStations], scenarioId));
	}

	// One TAF timeline per route station -- joined by index against the TAF array.
	for (let i = 0; i < routeStations.length; i++) {
		const station = routeStations[i];
		const taf = products.tafs[i];
		if (station === undefined || taf === undefined) continue;
		charts.push(deriveTafTimelineChart(truth, taf, station, scenarioId));
	}

	charts.push(deriveGfaChart(truth, products.airmets, products.tafs, scenarioId));
	charts.push(deriveConvectiveOutlookChart(truth, scenarioId));
	charts.push(deriveCvaChart(truth, products.metars, scenarioId));
	charts.push(deriveFreezingLevelChart(truth, scenarioId));
	charts.push(deriveGAirmetIcingChart(truth, products.airmets, scenarioId));
	charts.push(deriveGAirmetTurbulenceChart(truth, products.airmets, scenarioId));

	return charts;
}
