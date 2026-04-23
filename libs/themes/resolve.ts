/**
 * Theme resolution.
 *
 * `resolveThemeForPath(path, userAppearance, systemAppearance)` is the
 * one place that maps a URL + appearance preference to a
 * `ThemeSelection`. Routes never pick themes directly.
 *
 * Returns a `{ theme, appearance, layout }` triple, one per axis
 * per [02-ARCHITECTURE.md](../../docs/platform/theme-system/02-ARCHITECTURE.md).
 *
 * Path policy:
 *   `/sim*`       -> `sim/glass` (dark-only cockpit theme)
 *   `/dashboard*` -> `study/flightdeck` (TUI)
 *   everything else -> `study/sectional`
 *
 * When new dashboard-style surfaces ship (avionics, instrument
 * trainer) extend `FLIGHTDECK_PATH_PREFIXES` here rather than sprinkling
 * theme logic across routes.
 */

import type { AppearanceMode, ThemeId, ThemeSelection } from './contract';

export const THEMES = {
	AIRBOSS_DEFAULT: 'airboss/default',
	STUDY_SECTIONAL: 'study/sectional',
	STUDY_FLIGHTDECK: 'study/flightdeck',
	SIM_GLASS: 'sim/glass',
} as const satisfies Record<string, ThemeId>;

export const DEFAULT_THEME: ThemeId = THEMES.STUDY_SECTIONAL;
export const FLIGHTDECK_THEME: ThemeId = THEMES.STUDY_FLIGHTDECK;
export const SIM_THEME: ThemeId = THEMES.SIM_GLASS;
export const DEFAULT_APPEARANCE: AppearanceMode = 'light';

export type AppearancePreference = AppearanceMode | 'system';

/** Cookie name for the persisted appearance preference. */
export const APPEARANCE_COOKIE = 'appearance';

/** Valid appearance-preference values, in toggle order (system → light → dark). */
export const APPEARANCE_PREFERENCE_VALUES: readonly AppearancePreference[] = ['system', 'light', 'dark'];

/** Default preference when no cookie / invalid cookie is present. */
export const DEFAULT_APPEARANCE_PREFERENCE: AppearancePreference = 'system';

/** Type guard for untrusted input (cookie, form field, query). */
export function isAppearancePreference(value: unknown): value is AppearancePreference {
	return typeof value === 'string' && (APPEARANCE_PREFERENCE_VALUES as readonly string[]).includes(value);
}

/** Parse a raw string (e.g. cookie) into a preference, falling back to the default. */
export function parseAppearancePreference(raw: string | null | undefined): AppearancePreference {
	return isAppearancePreference(raw) ? raw : DEFAULT_APPEARANCE_PREFERENCE;
}

const FLIGHTDECK_PATH_PREFIXES: readonly string[] = ['/dashboard'];
const SIM_PATH_PREFIXES: readonly string[] = ['/sim'];

function matchesAnyPrefix(pathname: string, prefixes: readonly string[]): boolean {
	for (const prefix of prefixes) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
	}
	return false;
}

function isFlightdeckPath(pathname: string): boolean {
	return matchesAnyPrefix(pathname, FLIGHTDECK_PATH_PREFIXES);
}

function isSimPath(pathname: string): boolean {
	return matchesAnyPrefix(pathname, SIM_PATH_PREFIXES);
}

export function resolveThemeForPath(
	pathname: string,
	userAppearance: AppearancePreference = 'system',
	systemAppearance: AppearanceMode = DEFAULT_APPEARANCE,
): ThemeSelection {
	const sim = isSimPath(pathname);
	const flightdeck = !sim && isFlightdeckPath(pathname);
	let theme: ThemeId;
	let layout: string;
	if (sim) {
		theme = SIM_THEME;
		layout = 'cockpit';
	} else if (flightdeck) {
		theme = FLIGHTDECK_THEME;
		layout = 'dashboard';
	} else {
		theme = DEFAULT_THEME;
		layout = 'reading';
	}
	// sim/glass is dark-only; emit throws if asked for a light palette.
	// Force dark so user/system appearance preferences don't crash sim.
	const appearance: AppearanceMode = sim ? 'dark' : userAppearance === 'system' ? systemAppearance : userAppearance;
	return { theme, appearance, layout };
}
