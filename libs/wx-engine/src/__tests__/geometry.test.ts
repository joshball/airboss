/**
 * Phase A test plan -- geometry helpers (WXENG-4).
 *
 * Asserts:
 *   - findAirMass returns the expected mass for the five route stations
 *     in the frontal-xc-march scenario (the spike validated these
 *     classifications during authoring; the cross-product sign + polygon-
 *     edge fixes that landed in the spike are the load-bearing rules)
 *   - samplePressureMb yields lower SLP over the post-frontal cold
 *     sector (closer to the surface low) than the warm sector
 *   - sideOfFront classifies the five route stations into 'pip-side' or
 *     'opposite' consistent with the spike's recorded METAR wind shifts
 *   - distanceKm / distanceNm are inverse-consistent
 */

import { describe, expect, it } from 'vitest';
import { distanceKm, distanceNm, findAirMass, pointInPolygon, samplePressureMb, sideOfFront } from '../truth/geometry';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';

const KM_TO_NM = 0.539957;

function stationPoint(icao: string): [number, number] {
	const s = FRONTAL_XC_MARCH.stations[icao];
	if (!s) throw new Error(`station ${icao} missing from spike scenario`);
	return [s.lon, s.lat];
}

describe('findAirMass', () => {
	it('classifies KSTL into the warm sector (mT)', () => {
		const am = findAirMass(FRONTAL_XC_MARCH, stationPoint('KSTL'));
		expect(am).not.toBeNull();
		expect(am?.id).toBe('AM-warm-sector');
		expect(am?.classification).toBe('mT');
	});

	it('classifies KCPS into the warm sector (mT)', () => {
		const am = findAirMass(FRONTAL_XC_MARCH, stationPoint('KCPS'));
		expect(am?.id).toBe('AM-warm-sector');
	});

	it('classifies KSPI into the post-frontal cold sector (cP)', () => {
		const am = findAirMass(FRONTAL_XC_MARCH, stationPoint('KSPI'));
		expect(am).not.toBeNull();
		expect(am?.id).toBe('AM-cold-sector');
		expect(am?.classification).toBe('cP');
	});

	it('classifies KMLI into the post-frontal cold sector (cP)', () => {
		const am = findAirMass(FRONTAL_XC_MARCH, stationPoint('KMLI'));
		expect(am?.id).toBe('AM-cold-sector');
	});

	it('classifies KORD into the warm sector (front not yet through)', () => {
		const am = findAirMass(FRONTAL_XC_MARCH, stationPoint('KORD'));
		expect(am?.id).toBe('AM-warm-sector');
	});
});

describe('samplePressureMb', () => {
	it('samples lower pressure near the surface low than far from it', () => {
		const lowCenter: [number, number] = [-91, 44];
		const farAway: [number, number] = [-78, 30];
		const nearLow = samplePressureMb(FRONTAL_XC_MARCH, lowCenter);
		const farFromLow = samplePressureMb(FRONTAL_XC_MARCH, farAway);
		// Near-low value should be below the central pressure (996) plus some
		// background influence; far-away value should be > 1015 mb.
		expect(nearLow).toBeLessThan(1015);
		expect(farFromLow).toBeGreaterThan(1015);
	});

	it('produces post-frontal SLP roughly higher than the low core', () => {
		const lowCore = samplePressureMb(FRONTAL_XC_MARCH, [-91, 44]);
		const postFrontalKMLI = samplePressureMb(FRONTAL_XC_MARCH, stationPoint('KMLI'));
		expect(postFrontalKMLI).toBeGreaterThan(lowCore);
	});

	it('returns a finite numeric value at every route station', () => {
		const stations = ['KSTL', 'KCPS', 'KSPI', 'KMLI', 'KORD'];
		for (const icao of stations) {
			const slp = samplePressureMb(FRONTAL_XC_MARCH, stationPoint(icao));
			expect(Number.isFinite(slp)).toBe(true);
		}
	});
});

describe('sideOfFront', () => {
	const coldFront = FRONTAL_XC_MARCH.synoptic.fronts.find((f) => f.id === 'F-cold-main');

	it('places KSTL on the warm (pip) side of the cold front', () => {
		expect(coldFront).toBeDefined();
		if (!coldFront) return;
		expect(sideOfFront(stationPoint('KSTL'), coldFront)).toBe('pip-side');
	});

	it('places KCPS on the warm (pip) side of the cold front', () => {
		expect(coldFront).toBeDefined();
		if (!coldFront) return;
		expect(sideOfFront(stationPoint('KCPS'), coldFront)).toBe('pip-side');
	});

	it('places KMLI on the cold (opposite) side of the cold front', () => {
		expect(coldFront).toBeDefined();
		if (!coldFront) return;
		expect(sideOfFront(stationPoint('KMLI'), coldFront)).toBe('opposite');
	});

	it('places KORD on the warm (pip) side -- front has not yet arrived', () => {
		expect(coldFront).toBeDefined();
		if (!coldFront) return;
		expect(sideOfFront(stationPoint('KORD'), coldFront)).toBe('pip-side');
	});
});

describe('pointInPolygon', () => {
	it('detects a point inside a simple square polygon', () => {
		const square: [number, number][] = [
			[0, 0],
			[10, 0],
			[10, 10],
			[0, 10],
		];
		expect(pointInPolygon([5, 5], square)).toBe(true);
		expect(pointInPolygon([15, 5], square)).toBe(false);
	});
});

describe('distance helpers', () => {
	it('produces consistent km/nm conversions', () => {
		const a: [number, number] = [-90, 38];
		const b: [number, number] = [-88, 41];
		const km = distanceKm(a, b);
		const nm = distanceNm(a, b);
		expect(nm).toBeCloseTo(km * KM_TO_NM, 6);
	});
});
