/**
 * Path-based theme resolution tests.
 */

import { describe, expect, it } from 'vitest';
import '../core/defaults/airboss-default/index';
import '../sim/glass/index';
import '../study/flightdeck/index';
import '../study/sectional/index';
import {
	DEFAULT_THEME,
	FLIGHTDECK_THEME,
	forcedAppearanceFor,
	isThemePreference,
	parseThemePreference,
	resolveThemeForPath,
	resolveThemeSelection,
	SIM_THEME,
	THEMES,
} from '../resolve';

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

describe('resolveThemeSelection', () => {
	it('falls back to path-default when user pref is null', () => {
		const sel = resolveThemeSelection({ pathname: '/memory', userTheme: null });
		expect(sel.theme).toBe(DEFAULT_THEME);
	});

	it('user theme overrides path default on a free route', () => {
		const sel = resolveThemeSelection({ pathname: '/memory', userTheme: THEMES.STUDY_FLIGHTDECK });
		expect(sel.theme).toBe(THEMES.STUDY_FLIGHTDECK);
		// Layout stays bound to the route, not to the picked theme.
		expect(sel.layout).toBe('reading');
	});

	it('user theme overrides flightdeck path default too (path defines layout, not theme)', () => {
		const sel = resolveThemeSelection({ pathname: '/dashboard', userTheme: THEMES.STUDY_SECTIONAL });
		expect(sel.theme).toBe(THEMES.STUDY_SECTIONAL);
		expect(sel.layout).toBe('dashboard');
	});

	it('route safety lock wins on /sim regardless of user pref', () => {
		const sel = resolveThemeSelection({
			pathname: '/sim/steep-turn',
			userTheme: THEMES.STUDY_SECTIONAL,
			userAppearance: 'light',
		});
		expect(sel.theme).toBe(SIM_THEME);
		expect(sel.appearance).toBe('dark');
	});

	it('selecting sim/glass on a free route forces dark appearance', () => {
		const sel = resolveThemeSelection({
			pathname: '/memory',
			userTheme: THEMES.SIM_GLASS,
			userAppearance: 'light',
		});
		expect(sel.theme).toBe(SIM_THEME);
		expect(sel.appearance).toBe('dark');
	});

	it('user-picked light theme respects user appearance', () => {
		const sel = resolveThemeSelection({
			pathname: '/memory',
			userTheme: THEMES.STUDY_FLIGHTDECK,
			userAppearance: 'light',
		});
		expect(sel.theme).toBe(THEMES.STUDY_FLIGHTDECK);
		expect(sel.appearance).toBe('light');
	});
});

describe('parseThemePreference', () => {
	it('returns null for missing/empty/invalid values', () => {
		expect(parseThemePreference(null)).toBeNull();
		expect(parseThemePreference(undefined)).toBeNull();
		expect(parseThemePreference('')).toBeNull();
		expect(parseThemePreference('not/a-theme')).toBeNull();
	});

	it('returns the id for a registered theme', () => {
		expect(parseThemePreference(THEMES.STUDY_SECTIONAL)).toBe(THEMES.STUDY_SECTIONAL);
		expect(parseThemePreference(THEMES.SIM_GLASS)).toBe(THEMES.SIM_GLASS);
	});
});

describe('isThemePreference', () => {
	it('passes registered ids', () => {
		expect(isThemePreference(THEMES.STUDY_FLIGHTDECK)).toBe(true);
	});

	it('rejects unknown ids and non-strings', () => {
		expect(isThemePreference('x/y')).toBe(false);
		expect(isThemePreference(null)).toBe(false);
		expect(isThemePreference(42)).toBe(false);
	});
});

describe('forcedAppearanceFor', () => {
	it('forces dark for sim/glass', () => {
		expect(forcedAppearanceFor(SIM_THEME)).toBe('dark');
	});

	it('returns null for free themes', () => {
		expect(forcedAppearanceFor(THEMES.STUDY_SECTIONAL)).toBeNull();
		expect(forcedAppearanceFor(THEMES.STUDY_FLIGHTDECK)).toBeNull();
		expect(forcedAppearanceFor(THEMES.AIRBOSS_DEFAULT)).toBeNull();
	});

	it('FLIGHTDECK_THEME constant matches study/flightdeck and is unforced', () => {
		expect(FLIGHTDECK_THEME).toBe(THEMES.STUDY_FLIGHTDECK);
		expect(forcedAppearanceFor(FLIGHTDECK_THEME)).toBeNull();
	});
});
