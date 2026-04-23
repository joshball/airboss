/**
 * Derivation tests.
 *
 * Ported from peepfood-mono `libs/design-system/src/themes/utils.test.ts`
 * (the alpha / adjustBrightness / getContrastingTextColor / interactive
 * core). Extended here with the wash/edge/ink/disabled surface + the
 * signal variants, which are airboss-specific.
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

	it('handles a range of opacity values', () => {
		const color = 'oklch(0.7 0.15 150)';
		expect(alpha(color, 0.1)).toBe('oklch(0.7 0.15 150 / 0.1)');
		expect(alpha(color, 0.25)).toBe('oklch(0.7 0.15 150 / 0.25)');
		expect(alpha(color, 1)).toBe('oklch(0.7 0.15 150 / 1)');
	});

	it('returns the input unchanged when parsing fails', () => {
		const invalid = 'rgb(255, 0, 0)';
		expect(alpha(invalid, 0.5)).toBe(invalid);
	});
});

describe('adjustBrightness', () => {
	it('increases lightness when the amount is positive', () => {
		expect(adjustBrightness('oklch(0.5 0.15 150)', 0.1)).toBe('oklch(0.6 0.15 150)');
	});

	it('decreases lightness when the amount is negative', () => {
		expect(adjustBrightness('oklch(0.5 0.15 150)', -0.1)).toBe('oklch(0.4 0.15 150)');
	});

	it('clamps lightness to the [0, 1] range', () => {
		expect(adjustBrightness('oklch(0.9 0.15 150)', 0.5)).toBe('oklch(1 0.15 150)');
		expect(adjustBrightness('oklch(0.1 0.15 150)', -0.5)).toBe('oklch(0 0.15 150)');
	});

	it('preserves chroma and hue', () => {
		expect(adjustBrightness('oklch(0.5 0.2 270)', 0.1)).toMatch(/^oklch\(0\.6 0\.2 270\)$/);
	});

	it('returns the input unchanged when parsing fails', () => {
		const invalid = 'rgb(255, 0, 0)';
		expect(adjustBrightness(invalid, 0.1)).toBe(invalid);
	});
});

describe('getContrastingTextColor', () => {
	it('returns black for light backgrounds', () => {
		expect(getContrastingTextColor('oklch(0.9 0.1 150)')).toBe('#000000');
	});

	it('returns white for dark backgrounds', () => {
		expect(getContrastingTextColor('oklch(0.2 0.1 150)')).toBe('#ffffff');
	});

	it('returns white at the 0.5 boundary (> 0.5 → black)', () => {
		expect(getContrastingTextColor('oklch(0.5 0.1 150)')).toBe('#ffffff');
	});

	it('returns white for unparseable colors', () => {
		expect(getContrastingTextColor('rgb(255, 0, 0)')).toBe('#ffffff');
	});
});

describe('deriveInteractiveStates', () => {
	const base = 'oklch(0.6 0.2 30)';

	it('derives darker hover / active for light themes', () => {
		const states = deriveInteractiveStates(base, false);
		expect(states.base).toBe(base);
		expect(states.hover).toBe('oklch(0.5 0.2 30)');
		expect(states.active).toBe('oklch(0.4 0.2 30)');
	});

	it('derives lighter hover / active for dark themes', () => {
		const states = deriveInteractiveStates(base, true);
		expect(states.base).toBe(base);
		expect(states.hover).toBe('oklch(0.7 0.2 30)');
		expect(states.active).toBe('oklch(0.8 0.2 30)');
	});

	it('produces wash / edge / disabled as OKLCH alphas', () => {
		const light = deriveInteractiveStates(base, false);
		expect(light.wash).toBe('oklch(0.6 0.2 30 / 0.08)');
		expect(light.edge).toBe('oklch(0.6 0.2 30 / 0.24)');
		expect(light.disabled).toBe('oklch(0.6 0.2 30 / 0.4)');

		const dark = deriveInteractiveStates(base, true);
		expect(dark.wash).toBe('oklch(0.6 0.2 30 / 0.18)');
		expect(dark.edge).toBe('oklch(0.6 0.2 30 / 0.4)');
		expect(dark.disabled).toBe('oklch(0.6 0.2 30 / 0.4)');
	});

	it('picks contrasting ink based on base lightness', () => {
		expect(deriveInteractiveStates('oklch(0.9 0.2 30)', false).ink).toBe('#000000');
		expect(deriveInteractiveStates('oklch(0.3 0.2 30)', true).ink).toBe('#ffffff');
	});
});

describe('deriveSignalVariants', () => {
	const base = 'oklch(0.7 0.15 150)';

	it('returns the solid base color unchanged', () => {
		expect(deriveSignalVariants(base, false).solid).toBe(base);
	});

	it('derives light-mode wash and edge alphas', () => {
		const light = deriveSignalVariants(base, false);
		expect(light.wash).toBe('oklch(0.7 0.15 150 / 0.1)');
		expect(light.edge).toBe('oklch(0.7 0.15 150 / 0.2)');
	});

	it('uses higher alphas in dark mode', () => {
		const dark = deriveSignalVariants(base, true);
		expect(dark.wash).toBe('oklch(0.7 0.15 150 / 0.15)');
		expect(dark.edge).toBe('oklch(0.7 0.15 150 / 0.3)');
	});

	it('picks contrasting ink', () => {
		expect(deriveSignalVariants('oklch(0.9 0.15 150)', false).ink).toBe('#000000');
		expect(deriveSignalVariants('oklch(0.3 0.15 150)', true).ink).toBe('#ffffff');
	});
});
