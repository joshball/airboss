/**
 * Phase A test plan -- advanceTruth (WXENG-3).
 *
 * Asserts:
 *   - advanceTruth(truth, 0) returns a deep-equal copy and does not mutate
 *   - advanceTruth(truth, 12) translates pressure-system centers by their
 *     motion vectors
 *   - advanceTruth(truth, 12) is pure (input remains structurally equal to
 *     its pre-call snapshot)
 *   - validAt advances by the requested number of hours
 */

import { describe, expect, it } from 'vitest';
import { advanceTruth } from '../truth/advance';
import { FRONTAL_XC_MARCH } from '../truth/scenarios/frontal-xc-march';

const KM_PER_DEG_LAT = 111;
const KM_PER_NM = 1.852;
const MS_PER_HOUR = 3_600_000;

describe('advanceTruth', () => {
	it('returns a structurally-equal copy at hours=0 (validAt-normalized)', () => {
		const result = advanceTruth(FRONTAL_XC_MARCH, 0);
		// `validAt` round-trips through Date.toISOString(), which inserts ms
		// precision (`.000Z`). The input is `19:00:00Z` without ms. Compare
		// validAt by instant (Date-equal), then assert structural equality on
		// the remaining payload.
		expect(new Date(result.validAt).getTime()).toBe(new Date(FRONTAL_XC_MARCH.validAt).getTime());
		const { validAt: _resAt, ...restResult } = result;
		const { validAt: _inAt, ...restInput } = FRONTAL_XC_MARCH;
		expect(restResult).toEqual(restInput);
		// The result is a separate object (no mutation).
		expect(result).not.toBe(FRONTAL_XC_MARCH);
	});

	it('does not mutate the input at hours=12', () => {
		const snapshot = JSON.parse(JSON.stringify(FRONTAL_XC_MARCH));
		advanceTruth(FRONTAL_XC_MARCH, 12);
		expect(FRONTAL_XC_MARCH).toEqual(snapshot);
	});

	it('advances validAt by the requested hours', () => {
		const result = advanceTruth(FRONTAL_XC_MARCH, 12);
		const before = new Date(FRONTAL_XC_MARCH.validAt).getTime();
		const after = new Date(result.validAt).getTime();
		expect(after - before).toBe(12 * MS_PER_HOUR);
	});

	it('translates pressure-system centers by their motion vector', () => {
		const hours = 12;
		const result = advanceTruth(FRONTAL_XC_MARCH, hours);
		for (let i = 0; i < FRONTAL_XC_MARCH.synoptic.pressureSystems.length; i += 1) {
			const before = FRONTAL_XC_MARCH.synoptic.pressureSystems[i];
			const after = result.synoptic.pressureSystems[i];
			expect(before).toBeDefined();
			expect(after).toBeDefined();
			if (!before || !after) continue;
			const distNm = before.motionKt * hours;
			const distKm = distNm * KM_PER_NM;
			const distLat = distKm / KM_PER_DEG_LAT;
			const distLon = distKm / (KM_PER_DEG_LAT * Math.cos((before.lat * Math.PI) / 180));
			const rad = (before.motionDegTrue * Math.PI) / 180;
			const expectedLon = before.lon + distLon * Math.sin(rad);
			const expectedLat = before.lat + distLat * Math.cos(rad);
			expect(after.lon).toBeCloseTo(expectedLon, 6);
			expect(after.lat).toBeCloseTo(expectedLat, 6);
		}
	});

	it('translates front polylines by their motion vector', () => {
		const result = advanceTruth(FRONTAL_XC_MARCH, 6);
		for (let i = 0; i < FRONTAL_XC_MARCH.synoptic.fronts.length; i += 1) {
			const before = FRONTAL_XC_MARCH.synoptic.fronts[i];
			const after = result.synoptic.fronts[i];
			expect(before).toBeDefined();
			expect(after).toBeDefined();
			if (!before || !after) continue;
			expect(after.points.length).toBe(before.points.length);
			// At least one point must have moved -- non-zero motion implies translation.
			const moved = after.points.some((pt, idx) => {
				const original = before.points[idx];
				if (!original) return false;
				return pt[0] !== original[0] || pt[1] !== original[1];
			});
			if (before.motionKt > 0) {
				expect(moved).toBe(true);
			}
		}
	});
});
