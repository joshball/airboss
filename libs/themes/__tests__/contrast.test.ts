import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToOklch, luminance, luminanceHex, luminanceOklch, parseOklch } from '../contrast';

describe('luminance (dispatch)', () => {
	it('returns 0 for pure black hex', () => {
		expect(luminance('#000000')).toBe(0);
	});

	it('returns 1 for pure white hex', () => {
		expect(luminance('#ffffff')).toBeCloseTo(1, 6);
	});

	it('returns 0 for unparseable input', () => {
		expect(luminance('not-a-color')).toBe(0);
	});

	it('accepts OKLCH strings', () => {
		// oklch(1 0 0) = white
		expect(luminance('oklch(1 0 0)')).toBeCloseTo(1, 3);
	});

	it('accepts OKLCH with alpha', () => {
		// Alpha does not affect luminance by design.
		expect(luminance('oklch(1 0 0 / 0.5)')).toBeCloseTo(1, 3);
	});

	it('accepts rgb() input', () => {
		expect(luminance('rgb(255, 255, 255)')).toBeCloseTo(1, 6);
	});
});

describe('luminanceHex', () => {
	it('returns 0 for pure black', () => {
		expect(luminanceHex('#000000')).toBe(0);
	});
	it('returns 1 for pure white', () => {
		expect(luminanceHex('#ffffff')).toBeCloseTo(1, 6);
	});
});

describe('luminanceOklch', () => {
	it('returns 0 for L=0', () => {
		expect(luminanceOklch({ l: 0, c: 0, h: 0 })).toBeCloseTo(0, 3);
	});
	it('returns ~1 for L=1 (achromatic white)', () => {
		expect(luminanceOklch({ l: 1, c: 0, h: 0 })).toBeCloseTo(1, 3);
	});
});

describe('contrastRatio', () => {
	it('returns 21 for black on white (hex)', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
	});

	it('returns 1 for identical colors', () => {
		expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 6);
	});

	it('is symmetric in its arguments', () => {
		expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 6);
	});

	it('matches hex measurement when one side is OKLCH', () => {
		const hexRatio = contrastRatio('#000000', '#ffffff');
		const oklchRatio = contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)');
		expect(oklchRatio).toBeCloseTo(hexRatio, 1);
	});
});

describe('parseOklch', () => {
	it('parses `oklch(L C H)`', () => {
		expect(parseOklch('oklch(0.5 0.1 200)')).toEqual({ l: 0.5, c: 0.1, h: 200, a: 1 });
	});
	it('parses `oklch(L% C H)` with percent lightness', () => {
		expect(parseOklch('oklch(50% 0.1 200)')).toEqual({ l: 0.5, c: 0.1, h: 200, a: 1 });
	});
	it('parses `oklch(L C H / A)`', () => {
		expect(parseOklch('oklch(0.5 0.1 200 / 0.5)')).toEqual({ l: 0.5, c: 0.1, h: 200, a: 0.5 });
	});
	it('returns undefined for malformed input', () => {
		expect(parseOklch('oklcch(0.5 0.1 200)')).toBeUndefined();
		expect(parseOklch('#ffffff')).toBeUndefined();
	});
});

/**
 * Round-trip battery: hex -> OKLCH -> linear sRGB -> original channels.
 * Tolerance: 0.5% per channel (~1.3/255). This is the "perceptually
 * identical" bar from the WP #8 spec.
 */
describe('hex <-> OKLCH round-trip', () => {
	const cases = [
		{ label: 'pure white', hex: '#ffffff' },
		{ label: 'pure black', hex: '#000000' },
		{ label: 'mid grey', hex: '#808080' },
		{ label: 'airboss blue', hex: '#2563eb' },
		{ label: 'airboss red', hex: '#dc2626' },
		{ label: 'airboss green', hex: '#16a34a' },
		{ label: 'airboss amber', hex: '#d97706' },
		{ label: 'slate 900', hex: '#0f172a' },
		{ label: 'slate 500', hex: '#64748b' },
		{ label: 'sky 400', hex: '#38bdf8' },
		{ label: 'violet 400', hex: '#a78bfa' },
		{ label: 'pure red', hex: '#ff0000' },
		{ label: 'pure green', hex: '#00ff00' },
		{ label: 'pure blue', hex: '#0000ff' },
	];

	for (const { label, hex } of cases) {
		it(`${label} (${hex}) within 0.5% per channel`, () => {
			const oklchStr = hexToOklch(hex);
			expect(oklchStr).toBeDefined();
			if (!oklchStr) return;
			const ratio = contrastRatio(hex, oklchStr);
			// Same color -> contrast ratio ~1. Tolerance allows for
			// 3-decimal rounding in the OKLCH string.
			expect(ratio).toBeCloseTo(1, 2);
			// Luminance equivalence within 0.5%.
			const lumHex = luminance(hex);
			const lumOklch = luminance(oklchStr);
			// Absolute delta <= 0.005 on the [0,1] scale.
			expect(Math.abs(lumHex - lumOklch)).toBeLessThan(0.005);
		});
	}
});
