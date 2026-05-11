/**
 * Truth-state evolution.
 *
 * `advanceTruth(truth, hours)` is the only sanctioned way to move time
 * forward in the wx-engine. Direct mutation of `truth.validAt` is
 * forbidden because layer-1 would diverge from the layer-2/3/4 derivations
 * that read it.
 *
 * Lifted verbatim from the spike (`spikes/wx-engine/src/truth/types.ts`).
 * Pure function -- returns a new TruthModel; does not mutate. Translates
 * pressure systems, fronts, and convective cells by their motion vectors;
 * air-mass polygons + hazard zones drag with the mean front motion as a
 * cheap barotropic approximation. Production semantics match the spike
 * exactly.
 */

import type { TruthModel } from './types';

const KM_PER_DEG_LAT = 111;
const KM_PER_NM = 1.852;
const MS_PER_HOUR = 3_600_000;

/**
 * Walk the truth model forward in time. Translates pressure systems, fronts,
 * convective cells, the frontal precipitation band, air-mass polygons, and
 * hazard zones by their motion vectors. Air-mass polygons + hazard zones
 * drag with the mean (first) front's motion -- production should drag each
 * polygon by the local barotropic flow, but at +12hr lead the approximation
 * is sufficient.
 *
 * Returns a new TruthModel; does not mutate.
 */
export function advanceTruth(truth: TruthModel, hours: number): TruthModel {
	const advance = (pt: [number, number], dirDeg: number, kt: number): [number, number] => {
		const distNm = kt * hours;
		const distKm = distNm * KM_PER_NM;
		const distLat = distKm / KM_PER_DEG_LAT;
		const distLon = distKm / (KM_PER_DEG_LAT * Math.cos((pt[1] * Math.PI) / 180));
		const rad = (dirDeg * Math.PI) / 180;
		// Motion bearing -> dx/dy in lon/lat. Bearing is degrees true (clockwise from N).
		const dx = distLon * Math.sin(rad);
		const dy = distLat * Math.cos(rad);
		return [pt[0] + dx, pt[1] + dy];
	};

	const newSystems = truth.synoptic.pressureSystems.map((s) => {
		const [newLon, newLat] = advance([s.lon, s.lat], s.motionDegTrue, s.motionKt);
		return { ...s, lon: newLon, lat: newLat };
	});

	const newFronts = truth.synoptic.fronts.map((f) => ({
		...f,
		points: f.points.map((p) => advance(p, f.motionDegTrue, f.motionKt)),
	}));

	const meanFront = truth.synoptic.fronts[0];

	const newCells = truth.convection.cells.map((c) => {
		// Cells track with the mean front motion if any; otherwise no movement.
		if (meanFront === undefined) return c;
		const [newLon, newLat] = advance([c.lon, c.lat], meanFront.motionDegTrue, meanFront.motionKt);
		return { ...c, lon: newLon, lat: newLat };
	});

	const newBand = truth.convection.frontalBand
		? {
				...truth.convection.frontalBand,
				axis: truth.convection.frontalBand.axis.map((p) => {
					if (meanFront === undefined) return p;
					return advance(p, meanFront.motionDegTrue, meanFront.motionKt);
				}),
			}
		: null;

	const newAirMasses = truth.airMasses.map((am) => {
		if (meanFront === undefined) return am;
		return {
			...am,
			polygon: am.polygon.map((p) => advance(p, meanFront.motionDegTrue, meanFront.motionKt)),
		};
	});

	const newHazards = truth.hazardZones.map((h) => {
		if (meanFront === undefined) return h;
		return {
			...h,
			polygon: h.polygon.map((p) => advance(p, meanFront.motionDegTrue, meanFront.motionKt)),
		};
	});

	const newValidAt = new Date(new Date(truth.validAt).getTime() + hours * MS_PER_HOUR).toISOString();

	return {
		...truth,
		validAt: newValidAt,
		synoptic: { pressureSystems: newSystems, fronts: newFronts },
		airMasses: newAirMasses,
		convection: { ...truth.convection, cells: newCells, frontalBand: newBand },
		hazardZones: newHazards,
	};
}
