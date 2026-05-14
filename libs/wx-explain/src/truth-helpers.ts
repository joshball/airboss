/**
 * Synoptic-driver helpers for the `explainX` token-walkers.
 *
 * These functions answer "given a station and a TruthModel, is there a
 * convective cell within reach? Is there a front whose post-frontal side
 * covers the station? Is the air mass under a radiation-cooling regime?"
 *
 * Browser-safe -- pure math, no Node built-ins, type-only import of
 * TruthModel.
 */

import type { Front, FrontIntensity, TruthModel } from '@ab/wx-engine';

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

export function kmBetween(lon1: number, lat1: number, lon2: number, lat2: number): number {
	const dLat = (lat2 - lat1) * DEG_TO_RAD;
	const dLon = (lon2 - lon1) * DEG_TO_RAD;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLon / 2) ** 2;
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return EARTH_RADIUS_KM * c;
}

/**
 * Test if the station lies within `radiusKm + buffer` of any convective
 * cell.  Returns the cell + the distance to it, or null.
 */
export function findConvectionDriver(
	truth: TruthModel,
	lon: number,
	lat: number,
	bufferKm = 18,
): { cellId: string; distanceKm: number } | null {
	let best: { cellId: string; distanceKm: number } | null = null;
	for (const cell of truth.convection.cells) {
		const d = kmBetween(lon, lat, cell.lon, cell.lat);
		if (d <= cell.radiusKm + bufferKm) {
			if (best === null || d < best.distanceKm) {
				best = { cellId: cell.id, distanceKm: d };
			}
		}
	}
	return best;
}

interface FrontDriver {
	frontId: string;
	kind: Front['kind'];
	intensity: FrontIntensity;
	/** True if the station lies on the post-frontal (cold) side of the front. */
	coldSectorSide: boolean;
	distanceKm: number;
}

/**
 * For each front, find the closest segment to the station. If the nearest
 * front is within 400 km, return a `FrontDriver` describing which side
 * the station is on.
 *
 * Side detection: for a cold front whose pip side is W (cold air to the
 * west, behind a NE-moving front), if the station is west of the front's
 * nearest segment we call it the cold-sector side.
 */
export function findFrontDriver(truth: TruthModel, lon: number, lat: number): FrontDriver | null {
	let best: FrontDriver | null = null;
	for (const front of truth.synoptic.fronts) {
		const seg = closestSegmentToPoint(front.points, lon, lat);
		if (seg === null) continue;
		if (best !== null && seg.distanceKm >= best.distanceKm) continue;
		const cross = (seg.bx - seg.ax) * (lat - seg.ay) - (seg.by - seg.ay) * (lon - seg.ax);
		const cardinalIsWestOrSouth = front.pipSide === 'W' || front.pipSide === 'S';
		const stationOnPipSide = cardinalIsWestOrSouth ? cross > 0 : cross < 0;
		const coldSectorSide = front.kind === 'cold' ? stationOnPipSide : false;
		if (seg.distanceKm <= 400) {
			best = {
				frontId: front.id,
				kind: front.kind,
				intensity: front.intensity,
				coldSectorSide,
				distanceKm: seg.distanceKm,
			};
		}
	}
	return best;
}

interface SegmentHit {
	ax: number;
	ay: number;
	bx: number;
	by: number;
	distanceKm: number;
}

function closestSegmentToPoint(points: [number, number][], lon: number, lat: number): SegmentHit | null {
	if (points.length < 2) return null;
	let best: SegmentHit | null = null;
	for (let i = 0; i < points.length - 1; i += 1) {
		const a = points[i];
		const b = points[i + 1];
		if (!a || !b) continue;
		const d = pointToSegmentDistanceKm(lon, lat, a[0], a[1], b[0], b[1]);
		if (best === null || d < best.distanceKm) {
			best = { ax: a[0], ay: a[1], bx: b[0], by: b[1], distanceKm: d };
		}
	}
	return best;
}

function pointToSegmentDistanceKm(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
): number {
	const apx = px - ax;
	const apy = py - ay;
	const abx = bx - ax;
	const aby = by - ay;
	const ab2 = abx * abx + aby * aby;
	const ap_ab = apx * abx + apy * aby;
	const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, ap_ab / ab2));
	const cx = ax + t * abx;
	const cy = ay + t * aby;
	return kmBetween(px, py, cx, cy);
}

/**
 * Heuristic: a near-saturated cool low-wind night under a surface high
 * matches the radiation-cooling pattern. We approximate it by looking at
 * the air mass classification at the station's neighborhood + the
 * temp-dew spread.
 */
export function findRadiationCoolingDriver(
	truth: TruthModel,
	tempC: number | null,
	dewpointC: number | null,
): { airMassId: string } | null {
	if (tempC === null || dewpointC === null) return null;
	const spread = tempC - dewpointC;
	if (spread >= 3) return null;
	const stableMass = truth.airMasses.find((m) => m.stability === 'stable');
	if (!stableMass) return null;
	const highPresent = truth.synoptic.pressureSystems.some((p) => p.kind === 'H');
	if (!highPresent) return null;
	return { airMassId: stableMass.id };
}
