/**
 * Layer-3 CVA (Ceiling and Visibility Analysis) chart spec derivation.
 *
 * Per AC 00-45H Chapter 5 + AIM 7-1-6 + AWC CVA product, the CVA shows
 * current ceiling and visibility flight categories (VFR / MVFR / IFR / LIFR)
 * across CONUS. The wx-charts CVA renderer accepts both
 *
 *   - per-station METAR observations (it parses each via `parseMetar`
 *     and computes the flight category at render time), and
 *   - optional CVA area polygons hand-traced by an author.
 *
 * The truth-aware engine emits per-station observations only -- area
 * polygons are deferred to a future authoring pass where the
 * `truth.hazardZones[*]` of kind `ifr` and `mountain-obscuration` are
 * lowered into CVA polygons (the spike scenario already has a
 * post-frontal `HZ-postfrontal-ifr` zone that would map to an `IFR`
 * area polygon). Phase D could promote this; for Phase C we let the
 * wx-charts renderer derive the categories itself from the per-station
 * METARs the truth engine already emits.
 */

import { FAA_FLIGHT_CATEGORIES } from '@ab/constants';
import type { DerivedMetar } from '../products/types';
import type { TruthModel } from '../truth/types';
import type { ChartArtifact } from './types';

export function deriveCvaChart(truth: TruthModel, metars: DerivedMetar[], scenarioId: string): ChartArtifact {
	const slug = `wx-scenario-${scenarioId}-cva`;
	const cacheRelPath = `scenarios/${scenarioId}/cva.json`;

	const observations = metars.map((m) => {
		const station = truth.stations[m.parsed.station];
		return {
			station: {
				icao: m.parsed.station,
				lat: station?.lat ?? m.stationLat,
				lon: station?.lon ?? m.stationLon,
			},
			raw: m.raw,
		};
	});

	// Lower the spike's hazard-zone IFR polygons into CVA area polygons so the
	// rendered chart shows the post-frontal IFR region at scenario scale.
	const polygons = truth.hazardZones
		.filter((hz) => hz.kind === 'ifr' || hz.kind === 'mountain-obscuration')
		.map((hz) => ({
			id: `${hz.id}-cva`,
			category: hz.severity === 'severe' ? FAA_FLIGHT_CATEGORIES.LIFR : FAA_FLIGHT_CATEGORIES.IFR,
			label: hz.severity === 'severe' ? 'LIFR' : 'IFR',
			labelLonLat: polygonCentroid(hz.polygon),
			rings: [closeRing(hz.polygon)],
		}));

	const sourceJson = {
		targetTimestamp: truth.validAt,
		source: 'wx-engine -- truth-derived synthetic CVA',
		count: observations.length,
		_source_note: 'Stations from per-station METARs; polygons lowered from truth.hazardZones.',
		observations,
		polygons,
	};

	const spec = {
		slug,
		type: 'cva' as const,
		title: 'Ceiling and Visibility Analysis (truth-derived)',
		subtitle: `${truth.validAt} -- ${observations.length} stations, ${polygons.length} area polygons`,
		projection: {
			kind: 'lambert' as const,
			parallels: [33, 45] as [number, number],
			rotate: [-96, -39] as [number, number],
		},
		extent: 'conus' as const,
		sources: {
			observations: `cache://${cacheRelPath}`,
		},
		options: {
			show_legend: true,
			show_station_labels: true,
			show_polygons: true,
			dot_radius_px: 7,
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

function polygonCentroid(poly: [number, number][]): [number, number] {
	let sx = 0;
	let sy = 0;
	for (const p of poly) {
		sx += p[0];
		sy += p[1];
	}
	const n = poly.length > 0 ? poly.length : 1;
	return [sx / n, sy / n];
}

function closeRing(ring: [number, number][]): [number, number][] {
	if (ring.length < 3) return ring;
	const first = ring[0];
	const last = ring[ring.length - 1];
	if (first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]) return ring;
	const closed = [...ring];
	if (first !== undefined) closed.push(first);
	return closed;
}
