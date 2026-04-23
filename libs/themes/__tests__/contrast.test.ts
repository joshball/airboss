import { describe, expect, it } from 'vitest';
import { contrastRatio, luminance } from '../contrast';

describe('luminance', () => {
	it('returns 0 for pure black', () => {
		expect(luminance('#000000')).toBe(0);
	});

	it('returns 1 for pure white', () => {
		expect(luminance('#ffffff')).toBeCloseTo(1, 6);
	});

	it('returns 0 for unparseable input', () => {
		expect(luminance('not-a-color')).toBe(0);
	});
});

describe('contrastRatio', () => {
	it('returns 21 for black on white', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
	});

	it('returns 1 for identical colors', () => {
		expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
	});

	it('is symmetric in its arguments', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 6);
	});
});
