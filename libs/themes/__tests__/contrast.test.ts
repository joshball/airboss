import { describe, expect, it } from 'vitest';
import { contrastRatio, relativeLuminance } from '../contrast';

describe('relativeLuminance', () => {
	it('returns 1 for white', () => {
		expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 6);
	});

	it('returns 0 for black', () => {
		expect(relativeLuminance('#000000')).toBeCloseTo(0, 6);
	});

	it('returns the WCAG reference value for 50% grey', () => {
		// W3C reference: sRGB 128/128/128 -> ~0.21586
		expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3);
	});

	it('accepts 3-digit hex', () => {
		expect(relativeLuminance('#fff')).toBeCloseTo(1, 6);
		expect(relativeLuminance('#000')).toBeCloseTo(0, 6);
	});

	it('returns 0 for unparseable input', () => {
		expect(relativeLuminance('not-a-color')).toBe(0);
	});
});

describe('contrastRatio', () => {
	it('is 21 for black on white', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
	});

	it('is 1 for white on white', () => {
		expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
	});

	it('is symmetric', () => {
		const a = contrastRatio('#000000', '#ffffff');
		const b = contrastRatio('#ffffff', '#000000');
		expect(a).toBeCloseTo(b, 6);
	});

	it('returns the WCAG reference value for blue-on-white (#2563eb)', () => {
		// #2563eb on white is the airboss primary; WCAG reports 5.17.
		expect(contrastRatio('#2563eb', '#ffffff')).toBeCloseTo(5.17, 1);
	});
});
