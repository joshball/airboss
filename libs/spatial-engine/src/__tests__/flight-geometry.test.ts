/**
 * Layer-2 geometry + wind helper tests.
 *
 * `greatCircleNm` / `greatCircleBearing` against known city pairs;
 * `applyWind` against hand-computed wind-triangle inputs.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` A.6.
 */

import { describe, expect, it } from 'vitest';
import { greatCircleBearing, greatCircleNm, midpoint, normalizeBearing } from '../flight/geometry';
import { applyWind, interpolateWindAtAltitude } from '../flight/wind';

// KMEM, KMKL, KOLV reference coordinates (from the airport records).
const KMEM = { lon: -89.9767, lat: 35.0424 };
const KMKL = { lon: -88.9156, lat: 35.5999 };
const KOLV = { lon: -89.7869, lat: 34.9786 };

describe('greatCircleNm', () => {
	it('returns ~62 nm for KMEM -> KMKL', () => {
		const d = greatCircleNm(KMEM.lon, KMEM.lat, KMKL.lon, KMKL.lat);
		expect(d).toBeGreaterThan(55);
		expect(d).toBeLessThan(68);
	});

	it('returns ~11 nm for KMEM -> KOLV', () => {
		const d = greatCircleNm(KMEM.lon, KMEM.lat, KOLV.lon, KOLV.lat);
		expect(d).toBeGreaterThan(7);
		expect(d).toBeLessThan(14);
	});

	it('returns zero for identical points', () => {
		expect(greatCircleNm(KMEM.lon, KMEM.lat, KMEM.lon, KMEM.lat)).toBeCloseTo(0, 5);
	});
});

describe('greatCircleBearing', () => {
	it('returns a northeasterly course for KMEM -> KMKL', () => {
		const course = greatCircleBearing(KMEM.lon, KMEM.lat, KMKL.lon, KMKL.lat);
		expect(course).toBeGreaterThan(30);
		expect(course).toBeLessThan(75);
	});

	it('returns due north (~0) for a due-north leg', () => {
		const course = greatCircleBearing(-89.0, 35.0, -89.0, 36.0);
		expect(course).toBeCloseTo(0, 0);
	});

	it('returns due east (~90) for a short due-east leg', () => {
		const course = greatCircleBearing(-89.0, 35.0, -88.9, 35.0);
		expect(course).toBeGreaterThan(89);
		expect(course).toBeLessThan(91);
	});
});

describe('midpoint', () => {
	it('returns a point between the two endpoints', () => {
		const m = midpoint([KMEM.lon, KMEM.lat], [KMKL.lon, KMKL.lat]);
		expect(m[0]).toBeGreaterThan(Math.min(KMEM.lon, KMKL.lon));
		expect(m[0]).toBeLessThan(Math.max(KMEM.lon, KMKL.lon));
		expect(m[1]).toBeGreaterThan(Math.min(KMEM.lat, KMKL.lat));
		expect(m[1]).toBeLessThan(Math.max(KMEM.lat, KMKL.lat));
	});
});

describe('normalizeBearing', () => {
	it('wraps 370 to 10', () => {
		expect(normalizeBearing(370)).toBe(10);
	});
	it('wraps -10 to 350', () => {
		expect(normalizeBearing(-10)).toBe(350);
	});
});

describe('applyWind', () => {
	it('a direct headwind reduces ground speed by the full wind speed', () => {
		// Course 360, wind from 360 at 20 kt -- pure headwind.
		const r = applyWind({ trueCourse: 360, tas: 110, wind: { directionDeg: 360, speedKt: 20 } });
		expect(r.groundSpeedKt).toBeCloseTo(90, 0);
		expect(r.windCorrectionAngleDeg).toBeCloseTo(0, 1);
	});

	it('a direct tailwind raises ground speed by the full wind speed', () => {
		// Course 360, wind from 180 at 20 kt -- pure tailwind.
		const r = applyWind({ trueCourse: 360, tas: 110, wind: { directionDeg: 180, speedKt: 20 } });
		expect(r.groundSpeedKt).toBeCloseTo(130, 0);
	});

	it('a direct crosswind produces a crab and a small ground-speed loss', () => {
		// Course 360, wind from 090 at 20 kt -- pure crosswind from the right.
		const r = applyWind({ trueCourse: 360, tas: 110, wind: { directionDeg: 90, speedKt: 20 } });
		expect(r.windCorrectionAngleDeg).toBeGreaterThan(8);
		expect(r.windCorrectionAngleDeg).toBeLessThan(12);
		expect(r.groundSpeedKt).toBeLessThan(110);
		expect(r.groundSpeedKt).toBeGreaterThan(105);
	});

	it('subtracts easterly magnetic variation from the true heading', () => {
		const r = applyWind({
			trueCourse: 360,
			tas: 110,
			wind: { directionDeg: 360, speedKt: 0 },
			magneticVariationDeg: 4,
		});
		// True heading 360, 4 deg E variation -> magnetic 356.
		expect(r.magneticHeading).toBeCloseTo(356, 0);
	});
});

describe('interpolateWindAtAltitude', () => {
	const rows = [
		{ altitudeFtMsl: 3000, directionDeg: 220, speedKt: 22 },
		{ altitudeFtMsl: 6000, directionDeg: 240, speedKt: 30 },
	];

	it('interpolates linearly between two altitude rows', () => {
		const w = interpolateWindAtAltitude(rows, 4500);
		expect(w.directionDeg).toBeCloseTo(230, 0);
		expect(w.speedKt).toBeCloseTo(26, 0);
	});

	it('clamps to the lowest row below the range', () => {
		const w = interpolateWindAtAltitude(rows, 1000);
		expect(w.directionDeg).toBe(220);
		expect(w.speedKt).toBe(22);
	});

	it('clamps to the highest row above the range', () => {
		const w = interpolateWindAtAltitude(rows, 12000);
		expect(w.directionDeg).toBe(240);
		expect(w.speedKt).toBe(30);
	});

	it('returns calm air for an empty row set', () => {
		const w = interpolateWindAtAltitude([], 4500);
		expect(w.speedKt).toBe(0);
	});
});
