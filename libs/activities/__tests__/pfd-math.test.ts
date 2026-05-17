/**
 * Pure-helper tests for the PFD instrument tape math.
 *
 * Mirrors what every tape / dial component does internally; pinning the
 * mappings here means a drift in the readout convention shows up as a unit
 * failure rather than a manual visual regression.
 */

import { describe, expect, it } from 'vitest';
import {
	altitudeLowDigits,
	cardinalFor,
	clampVerticalSpeed,
	counterTranslateY,
	linearToAngle,
	majorLabelFor,
	normalizeHeadingForLabel,
	tapeY,
	vsiTickLabel,
} from '../src/pfd/pfd-math';

describe('tapeY', () => {
	it('places value=0 on the centerline', () => {
		expect(tapeY(0, 160, 3)).toBe(160);
	});

	it('larger values land above the centerline (smaller y)', () => {
		expect(tapeY(10, 160, 3)).toBe(160 - 30);
	});

	it('negative values land below the centerline', () => {
		expect(tapeY(-100, 160, 0.06)).toBeCloseTo(166, 5);
	});

	it('scales linearly with pixelsPerUnit', () => {
		expect(tapeY(100, 0, 1)).toBe(-100);
		expect(tapeY(100, 0, 2)).toBe(-200);
	});
});

describe('cardinalFor', () => {
	it.each([
		[0, 'N'],
		[90, 'E'],
		[180, 'S'],
		[270, 'W'],
	])('exact compass %i -> %s', (deg, label) => {
		expect(cardinalFor(deg)).toBe(label);
	});

	it('returns null for non-cardinals', () => {
		expect(cardinalFor(30)).toBeNull();
		expect(cardinalFor(330)).toBeNull();
		expect(cardinalFor(45)).toBeNull();
	});
});

describe('majorLabelFor', () => {
	it('drops the trailing zero per glass-cockpit convention (30 -> "3")', () => {
		expect(majorLabelFor(30, 30)).toBe('3');
	});

	it('handles three-digit majors (330 -> "33")', () => {
		expect(majorLabelFor(330, 30)).toBe('33');
	});

	it('returns null for cardinals (those render as letters elsewhere)', () => {
		expect(majorLabelFor(0, 30)).toBeNull();
		expect(majorLabelFor(90, 30)).toBeNull();
		expect(majorLabelFor(180, 30)).toBeNull();
		expect(majorLabelFor(270, 30)).toBeNull();
	});

	it('returns null for non-major values', () => {
		expect(majorLabelFor(15, 30)).toBeNull();
		expect(majorLabelFor(45, 30)).toBeNull();
	});
});

describe('normalizeHeadingForLabel', () => {
	it('treats raw 0 as 360 for display', () => {
		expect(normalizeHeadingForLabel(0)).toBe(360);
	});

	it('rounds to integer degrees', () => {
		expect(normalizeHeadingForLabel(45.4)).toBe(45);
		expect(normalizeHeadingForLabel(45.6)).toBe(46);
	});

	it('wraps negatives into 0..360', () => {
		expect(normalizeHeadingForLabel(-90)).toBe(270);
	});

	it('wraps multi-revolution input', () => {
		expect(normalizeHeadingForLabel(720)).toBe(360);
		expect(normalizeHeadingForLabel(450)).toBe(90);
	});

	it('falls back to 360 for non-finite input', () => {
		expect(normalizeHeadingForLabel(Number.NaN)).toBe(360);
		expect(normalizeHeadingForLabel(Number.POSITIVE_INFINITY)).toBe(360);
	});
});

describe('vsiTickLabel', () => {
	it('renders 0 as "0"', () => {
		expect(vsiTickLabel(0)).toBe('0');
	});

	it('scales hundreds (-2000 -> "20", 1500 -> "15")', () => {
		expect(vsiTickLabel(-2000)).toBe('20');
		expect(vsiTickLabel(1500)).toBe('15');
		expect(vsiTickLabel(500)).toBe('5');
	});

	it('uses absolute value (sign is conveyed by tape position, not label)', () => {
		expect(vsiTickLabel(-1000)).toBe('10');
	});
});

describe('clampVerticalSpeed', () => {
	it('passes through values inside the range', () => {
		expect(clampVerticalSpeed(500, 2000)).toBe(500);
		expect(clampVerticalSpeed(-1500, 2000)).toBe(-1500);
	});

	it('pins values above the range to +rangeFpm', () => {
		expect(clampVerticalSpeed(3500, 2000)).toBe(2000);
	});

	it('pins values below the range to -rangeFpm', () => {
		expect(clampVerticalSpeed(-3500, 2000)).toBe(-2000);
	});

	it('returns 0 for non-finite input', () => {
		expect(clampVerticalSpeed(Number.NaN, 2000)).toBe(0);
		expect(clampVerticalSpeed(Number.POSITIVE_INFINITY, 2000)).toBe(0);
	});
});

describe('linearToAngle', () => {
	it('returns minAngle at the value floor', () => {
		expect(linearToAngle(40, 40, 180, -150, 150)).toBe(-150);
	});

	it('returns maxAngle at the value ceiling', () => {
		expect(linearToAngle(180, 40, 180, -150, 150)).toBe(150);
	});

	it('returns midpoint for value at midrange', () => {
		// 110 is the midpoint of 40..180; the mapping is symmetric so result is 0
		expect(linearToAngle(110, 40, 180, -150, 150)).toBe(0);
	});

	it('clamps below floor', () => {
		expect(linearToAngle(0, 40, 180, -150, 150)).toBe(-150);
	});

	it('clamps above ceiling', () => {
		expect(linearToAngle(300, 40, 180, -150, 150)).toBe(150);
	});
});

describe('counterTranslateY', () => {
	it('returns 0 at exact thousand boundaries', () => {
		// Math result is `-0` at zero altitude; treat that as numerically zero.
		expect(counterTranslateY(0, 26)).toBeCloseTo(0, 10);
		expect(counterTranslateY(1000, 26)).toBe(-26);
		expect(counterTranslateY(2000, 26)).toBe(-52);
	});

	it('slides smoothly across boundaries', () => {
		// At 3500 ft the thousands counter sits halfway between 3 and 4.
		expect(counterTranslateY(3500, 20)).toBe(-(3.5 * 20));
	});

	it('wraps every 10 thousand feet', () => {
		// 11_000 ft mod 10 = 1.0 -> same offset as 1_000 ft
		expect(counterTranslateY(11_000, 26)).toBeCloseTo(counterTranslateY(1_000, 26), 5);
	});

	it('treats non-finite altitude as zero rather than injecting NaN', () => {
		expect(counterTranslateY(Number.NaN, 26)).toBeCloseTo(0, 10);
		expect(counterTranslateY(Number.POSITIVE_INFINITY, 26)).toBeCloseTo(0, 10);
	});
});

describe('altitudeLowDigits', () => {
	it('zero pads to 3 digits', () => {
		expect(altitudeLowDigits(50)).toBe('050');
		expect(altitudeLowDigits(7)).toBe('007');
	});

	it('takes the trailing 3 digits across a thousand boundary', () => {
		expect(altitudeLowDigits(3450)).toBe('450');
		expect(altitudeLowDigits(10_999)).toBe('999');
	});

	it('floors fractional altitudes', () => {
		expect(altitudeLowDigits(123.7)).toBe('123');
	});

	it('clamps negatives to 000', () => {
		expect(altitudeLowDigits(-100)).toBe('000');
	});

	it('falls back to 000 for non-finite input', () => {
		expect(altitudeLowDigits(Number.NaN)).toBe('000');
	});
});
