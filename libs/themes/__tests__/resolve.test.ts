/**
 * Path-based theme resolution tests.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, FLIGHTDECK_THEME, resolveThemeForPath, SIM_THEME, THEMES } from '../resolve';

describe('resolveThemeForPath', () => {
	it('maps /sim to sim/glass + cockpit + dark', () => {
		const sel = resolveThemeForPath('/sim');
		expect(sel.theme).toBe(SIM_THEME);
		expect(sel.theme).toBe(THEMES.SIM_GLASS);
		expect(sel.layout).toBe('cockpit');
		expect(sel.appearance).toBe('dark');
	});

	it('maps /sim/[scenarioId] to sim/glass', () => {
		const sel = resolveThemeForPath('/sim/steep-turn');
		expect(sel.theme).toBe(SIM_THEME);
		expect(sel.layout).toBe('cockpit');
		expect(sel.appearance).toBe('dark');
	});

	it('forces dark on sim even when user asked for light', () => {
		const sel = resolveThemeForPath('/sim', 'light');
		expect(sel.theme).toBe(SIM_THEME);
		expect(sel.appearance).toBe('dark');
	});

	it('does not match /simulator/x (prefix boundary)', () => {
		const sel = resolveThemeForPath('/simulator/overview');
		expect(sel.theme).toBe(DEFAULT_THEME);
	});

	it('maps /dashboard to study/flightdeck', () => {
		const sel = resolveThemeForPath('/dashboard');
		expect(sel.theme).toBe(FLIGHTDECK_THEME);
		expect(sel.layout).toBe('dashboard');
	});

	it('maps other paths to the default theme + reading layout', () => {
		const sel = resolveThemeForPath('/quiz/intro');
		expect(sel.theme).toBe(DEFAULT_THEME);
		expect(sel.layout).toBe('reading');
	});

	it('respects system appearance on non-sim routes', () => {
		const sel = resolveThemeForPath('/quiz', 'system', 'dark');
		expect(sel.appearance).toBe('dark');
	});
});
