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
 *   `/dashboard*` → `study/flightdeck` (TUI)
 *   everything else → `study/sectional`
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
} as const satisfies Record<string, ThemeId>;

export const DEFAULT_THEME: ThemeId = THEMES.STUDY_SECTIONAL;
export const FLIGHTDECK_THEME: ThemeId = THEMES.STUDY_FLIGHTDECK;
export const DEFAULT_APPEARANCE: AppearanceMode = 'light';

export type AppearancePreference = AppearanceMode | 'system';

const FLIGHTDECK_PATH_PREFIXES: readonly string[] = ['/dashboard'];

function isFlightdeckPath(pathname: string): boolean {
	for (const prefix of FLIGHTDECK_PATH_PREFIXES) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
	}
	return false;
}

export function resolveThemeForPath(
	pathname: string,
	userAppearance: AppearancePreference = 'system',
	systemAppearance: AppearanceMode = DEFAULT_APPEARANCE,
): ThemeSelection {
	const flightdeck = isFlightdeckPath(pathname);
	const theme: ThemeId = flightdeck ? FLIGHTDECK_THEME : DEFAULT_THEME;
	const appearance: AppearanceMode = userAppearance === 'system' ? systemAppearance : userAppearance;
	const layout = flightdeck ? 'dashboard' : 'reading';
	return { theme, appearance, layout };
}
