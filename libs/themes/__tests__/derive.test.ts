/**
 * Derivation tests.
 *
 * Ported from peepfood-mono's `themes/utils.test.ts`. Same structure for
 * `alpha` / `adjustBrightness` / `getContrastingTextColor` and expanded
 * coverage for the airboss-specific `deriveInteractiveStates` /
 * `deriveSignalVariants` (which return wash/edge/disabled variants
 * peepfood's simpler pair didn't emit).
 */

import { describe, expect, it } from 'vitest';
import {
	adjustBrightness,
	alpha,
	deriveInteractiveStates,
	deriveSignalVariants,
	getContrastingTextColor,
} from '../derive';

describe('alpha', () => {
	it('adds an alpha channel to an OKLCH color', () => {
		expect(alpha('oklch(0.7 0.15 150)', 0.5)).toBe('oklch(0.7 0.15 150 / 0.5)');
	});

	it('handles a range of opacities', () => {
		const color = 'oklch(0.7 0.15 150)';
		expect(alpha(color, 0.1)).toBe('oklch(0.7 0.15 150 / 0.1)');
		expect(alpha(color, 0.25)).toBe('oklch(0.7 0.15 150 / 0.25)');
		expect(alpha(color, 1)).toBe('oklch(0.7 0.15 150 / 1)');
	});

	it('returns the original color when the input is not OKLCH', () => {
		expect(alpha('rgb(255, 0, 0)', 0.5)).toBe('rgb(255, 0, 0)');
		expect(alpha('#ffffff', 0.5)).toBe('#ffffff');
	});
});

describe('adjustBrightness', () => {
	it('increases lightness when amount is positive', () => {
		expect(adjustBrightness('oklch(0.5 0.15 150)', 0.1)).toBe('oklch(0.6 0.15 150)');
	});

	it('decreases lightness when amount is negative', () => {
		expect(adjustBrightness('oklch(0.5 0.15 150)', -0.1)).toBe('oklch(0.4 0.15 150)');
	});

	it('clamps lightness to the 0..1 range', () => {
		expect(adjustBrightness('oklch(0.9 0.15 150)', 0.5)).toBe('oklch(1 0.15 150)');
		expect(adjustBrightness('oklch(0.1 0.15 150)', -0.5)).toBe('oklch(0 0.15 150)');
	});

	it('preserves chroma and hue', () => {
		expect(adjustBrightness('oklch(0.5 0.2 270)', 0.1)).toMatch(/^oklch\(0\.6 0\.2 270\)$/);
	});

	it('rounds lightness to three decimals (determinism)', () => {
		// 0.123 + 0.456 = 0.579 exactly; assert we don't drift to 0.5790000001.
		const out = adjustBrightness('oklch(0.123 0.1 150)', 0.456);
		expect(out).toBe('oklch(0.579 0.1 150)');
	});

	it('returns the original color when the input is not OKLCH', () => {
		expect(adjustBrightness('rgb(255, 0, 0)', 0.1)).toBe('rgb(255, 0, 0)');
	});
});

describe('getContrastingTextColor', () => {
	it('returns black for light backgrounds', () => {
		expect(getContrastingTextColor('oklch(0.9 0.1 150)')).toBe('#000000');
	});

	it('returns white for dark backgrounds', () => {
		expect(getContrastingTextColor('oklch(0.2 0.1 150)')).toBe('#ffffff');
	});

	it('returns white at the 0.5 boundary (strict > comparison)', () => {
		expect(getContrastingTextColor('oklch(0.5 0.1 150)')).toBe('#ffffff');
	});

	it('returns white for unparseable inputs (safe default)', () => {
		expect(getContrastingTextColor('rgb(255, 0, 0)')).toBe('#ffffff');
	});
});

describe('deriveInteractiveStates', () => {
	it('darkens hover/active in light mode', () => {
		const states = deriveInteractiveStates('oklch(0.6 0.2 30)', false);
		expect(states.base).toBe('oklch(0.6 0.2 30)');
		expect(states.hover).toBe('oklch(0.52 0.2 30)');
		expect(states.active).toBe('oklch(0.44 0.2 30)');
	});

	it('lightens hover/active in dark mode', () => {
		const states = deriveInteractiveStates('oklch(0.6 0.2 30)', true);
		expect(states.base).toBe('oklch(0.6 0.2 30)');
		expect(states.hover).toBe('oklch(0.68 0.2 30)');
		expect(states.active).toBe('oklch(0.76 0.2 30)');
	});

	it('emits wash/edge as alpha composites of the base', () => {
		const base = 'oklch(0.6 0.2 30)';
		const light = deriveInteractiveStates(base, false);
		const dark = deriveInteractiveStates(base, true);
		expect(light.wash).toBe('oklch(0.6 0.2 30 / 0.08)');
		expect(light.edge).toBe('oklch(0.6 0.2 30 / 0.24)');
		expect(dark.wash).toBe('oklch(0.6 0.2 30 / 0.18)');
		expect(dark.edge).toBe('oklch(0.6 0.2 30 / 0.4)');
	});

	it('emits a disabled variant at 40% alpha', () => {
		expect(deriveInteractiveStates('oklch(0.6 0.2 30)', false).disabled).toBe('oklch(0.6 0.2 30 / 0.4)');
	});

	it('picks contrasting ink for the base', () => {
		expect(deriveInteractiveStates('oklch(0.9 0.2 30)', false).ink).toBe('#000000');
		expect(deriveInteractiveStates('oklch(0.3 0.2 30)', true).ink).toBe('#ffffff');
	});
});

describe('deriveSignalVariants', () => {
	it('derives wash/edge as alpha composites', () => {
		const base = 'oklch(0.7 0.15 150)';
		const light = deriveSignalVariants(base, false);
		expect(light.solid).toBe(base);
		expect(light.wash).toBe('oklch(0.7 0.15 150 / 0.08)');
		expect(light.edge).toBe('oklch(0.7 0.15 150 / 0.25)');
	});

	it('uses larger alphas in dark mode', () => {
		const base = 'oklch(0.7 0.15 150)';
		const dark = deriveSignalVariants(base, true);
		expect(dark.wash).toBe('oklch(0.7 0.15 150 / 0.12)');
		expect(dark.edge).toBe('oklch(0.7 0.15 150 / 0.35)');
	});

	it('picks contrasting ink', () => {
		expect(deriveSignalVariants('oklch(0.9 0.1 150)', false).ink).toBe('#000000');
		expect(deriveSignalVariants('oklch(0.2 0.1 150)', true).ink).toBe('#ffffff');
	});
});
