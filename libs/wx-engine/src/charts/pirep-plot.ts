/**
 * Layer-3 PIREP plot-grid chart spec derivation.
 *
 * Emits the wx-charts `pirep-plot-grid` spec for the truth-derived PIREP
 * cohort. The wx-charts library's PIREP parser captures the `OV` block
 * (station + radial + distance) but does NOT resolve lon/lat -- the
 * source envelope provides resolved lon/lat per report. The Phase B
 * PIREP derivation already records the resolved coords on each
 * `DerivedPirep`; we forward them directly.
 *
 * Lifted from the spike's pre-retirement
 * `spikes/wx-engine/src/charts/product-charts.ts` (PR #801).
 */

import { wxScenarioChartSlug } from '@ab/constants';
import type { DerivedPirep } from '../products/types';
import type { TruthModel } from '../truth/types';
import type { ChartArtifact } from './types';
import { CONUS_CENTRAL_MERIDIAN } from '@ab/wx-charts';

export function derivePirepPlotChart(truth: TruthModel, pireps: DerivedPirep[], scenarioId: string): ChartArtifact {
	const slug = wxScenarioChartSlug(scenarioId, 'pirep-plot');
	const cacheRelPath = `scenarios/${scenarioId}/pirep-plot.json`;

	const reports = pireps.map((p) => ({
		raw: p.raw,
		lat: p.lat,
		lon: p.lon,
	}));

	const sourceJson = {
		targetTimestamp: truth.validAt,
		source: 'wx-engine -- truth-derived synthetic PIREPs',
		count: reports.length,
		reports,
	};

	const spec = {
		slug,
		type: 'pirep-plot-grid' as const,
		title: 'PIREP Plot (truth-derived)',
		subtitle: `${truth.validAt} -- ${reports.length} truth-derived reports`,
		projection: {
			kind: 'lambert' as const,
			parallels: [33, 45] as [number, number],
			rotate: [CONUS_CENTRAL_MERIDIAN, 0] as [number, number],
		},
		extent: { lon_min: -100, lat_min: 32, lon_max: -80, lat_max: 47 },
		sources: {
			reports: `cache://${cacheRelPath}`,
		},
		options: {
			collision_min_distance_px: 28,
			collision_max_iterations: 40,
			show_altitude_label: true,
			show_legend: true,
			source_attribution: 'wx-engine -- truth-derived synthetic',
		},
	};

	return {
		slug,
		spec,
		sources: [
			{
				path: cacheRelPath,
				bytes: JSON.stringify(sourceJson, null, 2),
			},
		],
	};
}
