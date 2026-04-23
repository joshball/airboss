/**
 * Theme resolution.
 *
 * The single source of "which theme for this URL, which appearance, which
 * layout". Routes never choose themes directly; they call
 * `resolveThemeForPath(pathname, userAppearance, systemAppearance)` and
 * apply the returned `ThemeSelection` to the provider.
 *
 * Pre-hydration scripts in apps/STAR/src/app.html mirror the core of this
 * function inline so the document element carries data-theme plus
 * data-appearance before SvelteKit boots and ThemeProvider remounts.
 */

import type { AppearanceMode, ThemeId } from './contract';

export interface ThemeSelection {
	theme: ThemeId;
	appearance: AppearanceMode;
	layout: string;
}

/** Default theme for study surfaces that don't match a TUI path. */
export const DEFAULT_THEME_ID: ThemeId = 'study/sectional';
/** Theme used for dashboard / TUI surfaces. */
export const FLIGHTDECK_THEME_ID: ThemeId = 'study/flightdeck';

/**
 * Path prefixes that should render the flightdeck (TUI/dashboard) theme.
 * Prefix match so `/dashboard` and `/dashboard/anything` both resolve to
 * flightdeck. Extend this list as new TUI surfaces come online.
 */
const FLIGHTDECK_PATH_PREFIXES: readonly string[] = ['/dashboard'];

function isFlightdeckPath(pathname: string): boolean {
	for (const prefix of FLIGHTDECK_PATH_PREFIXES) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return true;
	}
	return false;
}

/**
 * Resolve theme + appearance + layout for a given route.
 *
 * Appearance precedence:
 *  1. user cookie pick (`light` | `dark`), if any
 *  2. system preference (`prefers-color-scheme`)
 *  3. theme default
 */
export function resolveThemeForPath(
	pathname: string,
	userAppearance: AppearanceMode | 'system' = 'system',
	systemAppearance: AppearanceMode = 'light',
): ThemeSelection {
	const theme = isFlightdeckPath(pathname) ? FLIGHTDECK_THEME_ID : DEFAULT_THEME_ID;
	const layout = isFlightdeckPath(pathname) ? 'dashboard' : 'reading';
	const appearance = userAppearance === 'system' ? systemAppearance : userAppearance;
	return { theme, appearance, layout };
}

// ----------------------------------------------------------------------------
// Legacy API (retained until package #5 finishes migrating call sites)
// ----------------------------------------------------------------------------

/** @deprecated use `resolveThemeForPath` + `ThemeSelection.theme`. */
export const THEMES = {
	WEB: DEFAULT_THEME_ID,
	TUI: FLIGHTDECK_THEME_ID,
} as const;

/** @deprecated use `ThemeId` from `./contract`. */
export type ThemeName = ThemeId;

/** @deprecated use `DEFAULT_THEME_ID`. */
export const DEFAULT_THEME: ThemeName = DEFAULT_THEME_ID;
