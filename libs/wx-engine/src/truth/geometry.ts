/**
 * Geometry helpers for truth-model derivations.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/truth/types.ts`
 * (the spike colocated helpers with the type definitions; the production lib
 * splits helpers into this file so the runtime barrel can re-export the types
 * type-only). PR #801 retired the spike src; see
 * `spikes/wx-engine/01-frontal-xc/spike-notes.md` for the verdict.
 *
 * Every helper is pure: no I/O, no mutation. The pressure-sampling model
 * uses the same Gaussian-bump approximation the wx-charts surface-analysis
 * renderer uses, so per-station altimeter readings agree with the rendered
 * isobars.
 */

import type { AirMass, CardinalSide, Front, TruthModel } from './types';

// ----------------------------------------------------------------
// Pressure-field tuning. Kept in the geometry module because samplePressureMb
// is the load-bearing primitive that drives METAR altimeter values + post-
// frontal gust derivation. Tweaking these alters every derivation's pressure
// view of the truth model.
// ----------------------------------------------------------------

/** Background SLP (mb) when no pressure system contributes. */
const BACKGROUND_SLP_DEFAULT = 1015;
/** Gaussian sigma (degrees lat/lon) governing how fast a system's influence falls off. */
const CENTER_SIGMA_DEG = 7;
/** Stepsize (degrees) used by pressureGradientMbPer100km for the finite-difference. */
const GRADIENT_FINITE_DIFF_DEG = 0.5;
/** Kilometers per degree of latitude (great-circle approximation). */
const KM_PER_DEG = 111;
/** Nautical-mile conversion factor for distance helpers. */
const KM_TO_NM = 0.539957;

/**
 * Point-in-polygon (ray casting). Polygon is a sequence of [lon, lat]
 * vertices; the ring is implicitly closed.
 */
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
		const a = polygon[i];
		const b = polygon[j];
		if (a === undefined || b === undefined) continue;
		const xi = a[0];
		const yi = a[1];
		const xj = b[0];
		const yj = b[1];
		const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

/**
 * Approximate great-circle distance in km between two lon/lat pairs.
 * Haversine; good enough for the "within 50 nm" tests the derivations make.
 */
export function distanceKm(a: [number, number], b: [number, number]): number {
	const R = 6371;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const lat1 = toRad(a[1]);
	const lat2 = toRad(b[1]);
	const dLat = toRad(b[1] - a[1]);
	const dLon = toRad(b[0] - a[0]);
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function distanceNm(a: [number, number], b: [number, number]): number {
	return distanceKm(a, b) * KM_TO_NM;
}

/**
 * Find the air mass whose polygon contains the given point. Returns null
 * if no air mass contains it. When polygons overlap (front-zone seam),
 * returns the first match (authors should design polygons so the seam is
 * a thin overlap; the seam side is the post-frontal mass to drive the gust
 * rule).
 */
export function findAirMass(truth: TruthModel, point: [number, number]): AirMass | null {
	for (const am of truth.airMasses) {
		if (pointInPolygon(point, am.polygon)) return am;
	}
	return null;
}

/**
 * Distance from a point to a polyline (km). Walks segments and returns the
 * minimum perpendicular distance via 10-sample interpolation per segment.
 * Used for "is this station within X km of the front?" checks.
 */
export function distanceToPolylineKm(point: [number, number], polyline: [number, number][]): number {
	let minKm = Number.POSITIVE_INFINITY;
	for (let i = 0; i < polyline.length - 1; i += 1) {
		const a = polyline[i];
		const b = polyline[i + 1];
		if (a === undefined || b === undefined) continue;
		// Approximate by sampling 10 points along the segment.
		for (let t = 0; t <= 10; t += 1) {
			const f = t / 10;
			const sample: [number, number] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
			const d = distanceKm(point, sample);
			if (d < minKm) minKm = d;
		}
	}
	return minKm;
}

/**
 * Side-of-front detector. For a given front polyline + a query point,
 * returns 'pip-side' (the side the pip glyphs face) or 'opposite'. Used
 * to decide whether a station is in the post-frontal sector (cold side
 * for cold front, warm side for warm front).
 */
export function sideOfFront(point: [number, number], front: Front): 'pip-side' | 'opposite' {
	// Find the nearest segment.
	let nearestI = 0;
	let nearestKm = Number.POSITIVE_INFINITY;
	for (let i = 0; i < front.points.length - 1; i += 1) {
		const a = front.points[i];
		const b = front.points[i + 1];
		if (a === undefined || b === undefined) continue;
		const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
		const d = distanceKm(point, mid);
		if (d < nearestKm) {
			nearestKm = d;
			nearestI = i;
		}
	}
	const a = front.points[nearestI];
	const b = front.points[nearestI + 1];
	if (a === undefined || b === undefined) return 'opposite';
	// Cross product (a -> b) x (a -> point); sign tells us which side.
	const ax = b[0] - a[0];
	const ay = b[1] - a[1];
	const bx = point[0] - a[0];
	const by = point[1] - a[1];
	const cross = ax * by - ay * bx;
	// Map cross-sign to pipSide. The pip side is at perpendicular = cardinal
	// vector. Perpendicular to the segment "to the left of travel" (CCW) is
	// (-dy, dx); the pip is left of travel when dot(perp, pipVec) >= 0.
	const meanDx = b[0] - a[0];
	const meanDy = b[1] - a[1];
	const pipVec = pipSideVector(front.pipSide);
	const perpX = -meanDy;
	const perpY = meanDx;
	const dot = perpX * pipVec[0] + perpY * pipVec[1];
	const pipIsLeft = dot >= 0;
	const pointIsLeft = cross >= 0;
	return pipIsLeft === pointIsLeft ? 'pip-side' : 'opposite';
}

function pipSideVector(side: CardinalSide): [number, number] {
	switch (side) {
		case 'N':
			return [0, 1];
		case 'S':
			return [0, -1];
		case 'E':
			return [1, 0];
		case 'W':
			return [-1, 0];
	}
}

/**
 * Sample the synoptic SLP field at a lon/lat. Uses the same Gaussian-bump
 * model the wx-charts surface-analysis renderer uses, so the chart's
 * isobars and the engine's per-station altimeter readings agree.
 */
export function samplePressureMb(truth: TruthModel, point: [number, number]): number {
	const [lon, lat] = point;
	let p = BACKGROUND_SLP_DEFAULT;
	for (const c of truth.synoptic.pressureSystems) {
		const dLon = (lon - c.lon) * Math.cos((c.lat * Math.PI) / 180);
		const dLat = lat - c.lat;
		const distDeg = Math.hypot(dLon, dLat);
		const amp = c.centralPressureMb - (c.backgroundPressureMb ?? BACKGROUND_SLP_DEFAULT);
		p += amp * Math.exp(-(distDeg * distDeg) / (2 * CENTER_SIGMA_DEG * CENTER_SIGMA_DEG));
	}
	return p;
}

/**
 * Compute pressure-gradient magnitude (mb / 100 km) at a point. Drives the
 * post-frontal gust derivation (steeper gradient -> stronger gusts).
 */
export function pressureGradientMbPer100km(truth: TruthModel, point: [number, number]): number {
	const here = samplePressureMb(truth, point);
	const east = samplePressureMb(truth, [point[0] + GRADIENT_FINITE_DIFF_DEG, point[1]]);
	const north = samplePressureMb(truth, [point[0], point[1] + GRADIENT_FINITE_DIFF_DEG]);
	const dpDx = (east - here) / GRADIENT_FINITE_DIFF_DEG;
	const dpDy = (north - here) / GRADIENT_FINITE_DIFF_DEG;
	const magPerDeg = Math.hypot(dpDx, dpDy);
	const magPer100km = (magPerDeg * 100) / KM_PER_DEG;
	return magPer100km;
}
