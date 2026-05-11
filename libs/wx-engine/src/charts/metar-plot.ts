/**
 * Layer-3 METAR plot-grid chart spec derivation.
 *
 * Emits the wx-charts `metar-plot-grid` spec for the truth-derived METAR
 * cohort. Each observation in the source JSON carries the station lon/lat
 * + `raw` METAR string + the pre-parsed `parsed` payload; the renderer
 * re-parses `raw` for determinism (per the wx-charts contract).
 *
 * Extent restricts to a midwest bounding box so the 5-station cohort
 * reads cleanly at the spike scenario scale. Future scenarios that span
 * a different region should override the extent at the derivation call
 * site (Phase E concern -- not in scope for Phase C's spike-scenario lift).
 *
 * Lifted from the spike's pre-retirement
 * `spikes/wx-engine/src/charts/product-charts.ts` (PR #801 -- now retired).
 */

import type { DerivedMetar } from '../products/types';
import type { TruthModel } from '../truth/types';
import type { ChartArtifact } from './types';

export function deriveMetarPlotChart(truth: TruthModel, metars: DerivedMetar[], scenarioId: string): ChartArtifact {
	const slug = `wx-scenario-${scenarioId}-metar-plot`;
	const cacheRelPath = `scenarios/${scenarioId}/metar-plot.json`;

	const observations = metars.map((m) => {
		const station = truth.stations[m.parsed.station];
		return {
			station: {
				icao: m.parsed.station,
				lat: station?.lat ?? m.stationLat,
				lon: station?.lon ?? m.stationLon,
			},
			raw: m.raw,
			parsed: m.parsed,
		};
	});

	const sourceJson = {
		targetTimestamp: truth.validAt,
		source: 'wx-engine -- truth-derived synthetic METARs',
		count: observations.length,
		observations,
	};

	const spec = {
		slug,
		type: 'metar-plot-grid' as const,
		title: 'METAR Plot (truth-derived)',
		subtitle: `${truth.validAt} -- ${observations.length} truth-derived stations`,
		projection: {
			kind: 'lambert' as const,
			parallels: [33, 45] as [number, number],
			rotate: [-96, -39] as [number, number],
		},
		extent: { lon_min: -100, lat_min: 32, lon_max: -80, lat_max: 47 },
		sources: {
			observations: `cache://${cacheRelPath}`,
		},
		options: {
			collision_min_distance_px: 36,
			collision_max_iterations: 40,
			show_category_ring: true,
			show_station_model_legend: true,
			show_category_legend: true,
			temp_unit: 'F' as const,
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
