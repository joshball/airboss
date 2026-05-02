/**
 * Pure-helper tests for the CrosswindComponent math.
 *
 * The activity computes its readouts entirely from these helpers; pinning
 * them as a unit covers the rotation / normalisation / decomposition logic
 * without mounting the SVG.
 */

import { describe, expect, it } from 'vitest';
import {
	clampDecomp,
	compassToRadians,
	crosswindKts,
	degToRad,
	formatHeading,
	formatSigned,
	headwindKts,
	normalizeSigned,
	pointToCompass,
} from '../src/crosswind-component/crosswind-math';

describe('compassToRadians', () => {
	it('maps compass 90 (East) to SVG 0 rad (+x axis)', () => {
		expect(compassToRadians(90)).toBeCloseTo(0, 10);
	});

	it('maps compass 0 (North) to -PI/2 rad (-y / up in SVG)', () => {
		expect(compassToRadians(0)).toBeCloseTo(-Math.PI / 2, 10);
	});

	it('maps compass 180 (South) to +PI/2 rad (+y / down in SVG)', () => {
		expect(compassToRadians(180)).toBeCloseTo(Math.PI / 2, 10);
	});

	it('maps compass 270 (West) to PI rad (-x axis)', () => {
		expect(Math.abs(compassToRadians(270))).toBeCloseTo(Math.PI, 10);
	});
});

describe('degToRad', () => {
	it('converts 180 degrees to PI radians', () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI, 10);
	});

	it('converts 0 to 0', () => {
		expect(degToRad(0)).toBe(0);
	});

	it('round-trips with 360 -> 2PI', () => {
		expect(degToRad(360)).toBeCloseTo(2 * Math.PI, 10);
	});
});

describe('normalizeSigned', () => {
	it('passes through zero', () => {
		expect(normalizeSigned(0)).toBe(0);
	});

	it('keeps small positive deltas', () => {
		expect(normalizeSigned(45)).toBe(45);
	});

	it('wraps 270 -> -90', () => {
		expect(normalizeSigned(270)).toBe(-90);
	});

	it('wraps -270 -> 90', () => {
		expect(normalizeSigned(-270)).toBe(90);
	});

	it('collapses -180 to +180 (display stability)', () => {
		expect(normalizeSigned(-180)).toBe(180);
	});

	it('returns 180 for an exact +180', () => {
		expect(normalizeSigned(180)).toBe(180);
	});

	it('handles multi-revolution input', () => {
		expect(normalizeSigned(720)).toBe(0);
		expect(normalizeSigned(-720)).toBe(0);
		expect(normalizeSigned(450)).toBe(90);
	});
});

describe('crosswindKts', () => {
	it('is zero when wind is aligned with runway', () => {
		expect(crosswindKts(20, 0)).toBeCloseTo(0, 10);
	});

	it('equals wind speed at perpendicular (90 deg)', () => {
		expect(crosswindKts(15, 90)).toBeCloseTo(15, 10);
	});

	it('equals wind speed at perpendicular (-90 deg)', () => {
		expect(crosswindKts(15, -90)).toBeCloseTo(15, 10);
	});

	it('is always non-negative', () => {
		for (const angle of [-170, -45, 45, 170]) {
			expect(crosswindKts(20, angle)).toBeGreaterThanOrEqual(0);
		}
	});

	it('matches sine at 30 deg (15 kt -> 7.5)', () => {
		expect(crosswindKts(15, 30)).toBeCloseTo(7.5, 5);
	});
});

describe('headwindKts', () => {
	it('equals full wind speed when wind is on the nose', () => {
		expect(headwindKts(20, 0)).toBeCloseTo(20, 10);
	});

	it('is zero at 90 deg (pure crosswind)', () => {
		expect(headwindKts(20, 90)).toBeCloseTo(0, 10);
	});

	it('is negative on a tailwind (signedAngle 180)', () => {
		expect(headwindKts(20, 180)).toBeCloseTo(-20, 10);
	});

	it('matches cosine at 60 deg (20 kt -> 10)', () => {
		expect(headwindKts(20, 60)).toBeCloseTo(10, 5);
	});
});

describe('pointToCompass', () => {
	const center = 200;

	it('point directly north of center -> 0', () => {
		expect(pointToCompass({ x: 200, y: 0 }, center)).toBe(0);
	});

	it('point directly east of center -> 90', () => {
		expect(pointToCompass({ x: 400, y: 200 }, center)).toBe(90);
	});

	it('point directly south of center -> 180', () => {
		expect(pointToCompass({ x: 200, y: 400 }, center)).toBe(180);
	});

	it('point directly west of center -> 270', () => {
		expect(pointToCompass({ x: 0, y: 200 }, center)).toBe(270);
	});

	it('returns an integer 0..359', () => {
		const result = pointToCompass({ x: 250, y: 50 }, center);
		expect(Number.isInteger(result)).toBe(true);
		expect(result).toBeGreaterThanOrEqual(0);
		expect(result).toBeLessThan(360);
	});
});

describe('formatHeading', () => {
	it('zero pads single digits to 3 chars', () => {
		expect(formatHeading(7)).toBe('007');
	});

	it('zero pads two digits to 3 chars', () => {
		expect(formatHeading(30)).toBe('030');
	});

	it('passes through three-digit headings', () => {
		expect(formatHeading(270)).toBe('270');
	});

	it('wraps 360 to 000', () => {
		expect(formatHeading(360)).toBe('000');
	});

	it('rounds before padding', () => {
		expect(formatHeading(7.4)).toBe('007');
		expect(formatHeading(7.6)).toBe('008');
	});

	it('handles negatives by wrapping into 0..359', () => {
		expect(formatHeading(-30)).toBe('330');
	});
});

describe('formatSigned', () => {
	it('uses an explicit + for positive values', () => {
		expect(formatSigned(5)).toBe('+5');
	});

	it('omits leading + for negatives (sign is implicit)', () => {
		expect(formatSigned(-3)).toBe('-3');
	});

	it('renders zero with a leading space for column alignment', () => {
		expect(formatSigned(0)).toBe(' 0');
	});

	it('respects the digits argument', () => {
		expect(formatSigned(2.345, 2)).toBe('+2.35');
	});

	it('rounds values that flatten to zero so sign uses the leading space', () => {
		expect(formatSigned(0.1)).toBe(' 0');
	});
});

describe('clampDecomp', () => {
	it('scales kts by the pixel scale within range', () => {
		expect(clampDecomp(10, 4, 130)).toBe(40);
	});

	it('clamps the upper rail', () => {
		expect(clampDecomp(40, 4, 130)).toBe(130);
	});

	it('clamps the lower rail (negatives)', () => {
		expect(clampDecomp(-40, 4, 130)).toBe(-130);
	});

	it('passes through zero', () => {
		expect(clampDecomp(0, 4, 130)).toBe(0);
	});
});
