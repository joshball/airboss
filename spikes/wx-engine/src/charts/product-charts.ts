/**
 * Spike 01 -- Layer 3 product-chart spec derivations:
 *   - METAR plot grid
 *   - TAF timeline
 *   - winds-aloft FB
 *   - PIREP plot grid
 *
 * Each takes layer-2 product output + truth registry and emits the
 * wx-charts library spec.yaml + the source JSON file it references.
 */

import type { DerivedMetar } from '../products/metar';
import type { DerivedTaf } from '../products/taf';
import type { DerivedFbGrid } from '../products/winds-aloft';
import type { DerivedPirep } from '../products/pirep';
import type { TruthModel } from '../truth/types';
import type { ChartArtifact } from './types';

const CONUS_PROJECTION = {
	kind: 'lambert',
	parallels: [33, 45] as [number, number],
	rotate: [-96, -39] as [number, number],
};

export function deriveMetarPlotChart(truth: TruthModel, metars: DerivedMetar[], scenarioId: string): ChartArtifact {
	const slug = `wx-scenario-${scenarioId}-metar-plot`;

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
		source: 'Spike 01 wx-engine -- truth-derived synthetic METARs',
		count: observations.length,
		observations,
	};

	const spec = {
		slug,
		type: 'metar-plot-grid',
		title: 'METAR Plot (truth-derived)',
		subtitle: `${truth.validAt} -- ${observations.length} truth-derived stations across midwest XC`,
		projection: CONUS_PROJECTION,
		// Restrict extent to the midwest so the 5-station model is readable.
		extent: { lon_min: -100, lat_min: 32, lon_max: -80, lat_max: 47 },
		sources: { observations: `cache://scenarios/${scenarioId}/metar-plot.json` },
		options: {
			collision_min_distance_px: 36,
			collision_max_iterations: 40,
			show_category_ring: true,
			show_station_model_legend: true,
			show_category_legend: true,
			temp_unit: 'F',
			source_attribution: 'Spike 01 wx-engine -- truth-derived synthetic',
		},
	};

	return {
		slug,
		spec,
		sources: [
			{
				cacheRelPath: `scenarios/${scenarioId}/metar-plot.json`,
				content: JSON.stringify(sourceJson, null, 2),
			},
		],
	};
}

export function deriveTafTimelineChart(truth: TruthModel, taf: DerivedTaf, stationIcao: string, scenarioId: string): ChartArtifact {
	const slug = `wx-scenario-${scenarioId}-taf-${stationIcao.toLowerCase()}`;

	const sourceJson = {
		stationIcao,
		issuedAt: taf.issuedAt,
		validFrom: taf.validFrom,
		validTo: taf.validTo,
		source: 'Spike 01 wx-engine -- truth-derived synthetic TAF',
		raw: taf.raw,
	};

	const spec = {
		slug,
		type: 'taf-timeline',
		title: `TAF Timeline -- ${stationIcao} (truth-derived)`,
		subtitle: `${taf.issuedAt} TAF -- valid ${taf.validFrom} to ${taf.validTo}`,
		extent: 'time',
		stationIcao,
		projection: CONUS_PROJECTION, // not used by renderer but schema requires it
		sources: { taf: `cache://scenarios/${scenarioId}/taf-${stationIcao.toLowerCase()}.json` },
		options: {
			axis_tick_hours: 3,
			show_legend: true,
			source_attribution: 'Spike 01 wx-engine -- truth-derived synthetic',
		},
	};

	return {
		slug,
		spec,
		sources: [
			{
				cacheRelPath: `scenarios/${scenarioId}/taf-${stationIcao.toLowerCase()}.json`,
				content: JSON.stringify(sourceJson, null, 2),
			},
		],
	};
}

export function deriveWindsAloftChart(truth: TruthModel, fb: DerivedFbGrid, stationIcaos: string[], scenarioId: string): ChartArtifact {
	const slug = `wx-scenario-${scenarioId}-winds-aloft`;

	const stations = stationIcaos
		.map((icao) => truth.stations[icao])
		.filter((s): s is NonNullable<typeof s> => s !== undefined)
		.map((s) => ({
			icao: s.icao.length === 4 && s.icao.startsWith('K') ? s.icao.slice(1) : s.icao,
			lat: s.lat,
			lon: s.lon,
		}));

	const sourceJson = {
		validAt: truth.validAt,
		basedOn: new Date(new Date(truth.validAt).getTime() - 6 * 3600_000).toISOString(),
		source: 'Spike 01 wx-engine -- truth-derived synthetic FB bulletin',
		stations,
		raw: fb.raw,
	};

	const spec = {
		slug,
		type: 'winds-aloft-fb',
		title: 'Winds and Temperatures Aloft (truth-derived)',
		subtitle: `${truth.validAt} -- ${stationIcaos.length} forecast points`,
		projection: CONUS_PROJECTION,
		extent: 'conus',
		sources: { bulletin: `cache://scenarios/${scenarioId}/winds-aloft.json` },
		options: {
			altitudes_ft: [3000, 6000, 9000, 12000, 18000],
			show_legend: true,
			source_attribution: 'Spike 01 wx-engine -- truth-derived synthetic',
		},
	};

	return {
		slug,
		spec,
		sources: [
			{
				cacheRelPath: `scenarios/${scenarioId}/winds-aloft.json`,
				content: JSON.stringify(sourceJson, null, 2),
			},
		],
	};
}

export function derivePirepPlotChart(truth: TruthModel, pireps: DerivedPirep[], scenarioId: string): ChartArtifact {
	const slug = `wx-scenario-${scenarioId}-pirep-plot`;

	const reports = pireps.map((p) => ({
		raw: p.raw,
		lat: p.lat,
		lon: p.lon,
	}));

	const sourceJson = {
		targetTimestamp: truth.validAt,
		source: 'Spike 01 wx-engine -- truth-derived synthetic PIREPs',
		count: reports.length,
		reports,
	};

	const spec = {
		slug,
		type: 'pirep-plot-grid',
		title: 'PIREP Plot (truth-derived)',
		subtitle: `${truth.validAt} -- ${reports.length} truth-derived reports across midwest XC`,
		projection: CONUS_PROJECTION,
		extent: { lon_min: -100, lat_min: 32, lon_max: -80, lat_max: 47 },
		sources: { reports: `cache://scenarios/${scenarioId}/pirep-plot.json` },
		options: {
			collision_min_distance_px: 28,
			collision_max_iterations: 40,
			show_altitude_label: true,
			show_legend: true,
			source_attribution: 'Spike 01 wx-engine -- truth-derived synthetic',
		},
	};

	return {
		slug,
		spec,
		sources: [
			{
				cacheRelPath: `scenarios/${scenarioId}/pirep-plot.json`,
				content: JSON.stringify(sourceJson, null, 2),
			},
		],
	};
}
