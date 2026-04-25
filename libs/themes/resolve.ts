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
import { isValidThemeId } from './registry';

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

// ---------------------------------------------------------------------
// Theme preference (user-selectable override)
// ---------------------------------------------------------------------

/**
 * User-selectable theme preference. `null` means "no preference -- use the
 * route-resolved default". Otherwise a registered `ThemeId`.
 */
export type ThemePreference = ThemeId | null;

/** Cookie name for the persisted user-selected theme. */
export const THEME_COOKIE = 'theme';

/** Default preference when no cookie / invalid cookie is present. */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = null;

/**
 * Type guard for untrusted theme input (cookie, form field, query).
 *
 * Only registered theme ids pass; the registry is the single source of truth
 * for "what themes ship". Unknown ids fall back to the default.
 */
export function isThemePreference(value: unknown): value is ThemeId {
	return typeof value === 'string' && isValidThemeId(value);
}

/** Parse a raw string (e.g. cookie) into a theme preference, falling back to `null`. */
export function parseThemePreference(raw: string | null | undefined): ThemePreference {
	if (raw == null || raw === '') return DEFAULT_THEME_PREFERENCE;
	return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE;
}

/**
 * Themes that hard-require a specific appearance regardless of user preference.
 *
 * Today only `sim/glass` qualifies (dark-only -- emit throws if asked for
 * a light palette). Centralized here so the picker, server, and pre-hydration
 * script all agree.
 */
const FORCED_APPEARANCE_BY_THEME: Readonly<Partial<Record<ThemeId, AppearanceMode>>> = {
	[THEMES.SIM_GLASS]: 'dark',
};

/** Returns the forced appearance for a theme, or `null` if appearance is free. */
export function forcedAppearanceFor(theme: ThemeId): AppearanceMode | null {
	return FORCED_APPEARANCE_BY_THEME[theme] ?? null;
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
	const forced = forcedAppearanceFor(theme);
	const appearance: AppearanceMode = forced ?? (userAppearance === 'system' ? systemAppearance : userAppearance);
	return { theme, appearance, layout };
}

/**
 * Returns true when the route hard-requires a specific theme that the user
 * cannot override (today: only `/sim/*`, which is locked to `sim/glass` for
 * dark-only safety -- the other surfaces are free).
 */
function routeRequiresFixedTheme(pathname: string): boolean {
	return isSimPath(pathname);
}

/**
 * Full theme selection given a route and user preferences.
 *
 * Precedence rule (read this before changing anything):
 *
 *   1. **Route safety lock wins.** If a path hard-requires a specific theme
 *      (today: `/sim/*` -> `sim/glass`), the route's choice is final. The
 *      user's picker preference is ignored on those routes. Reason: sim is
 *      a dark-only cockpit surface; the emit pipeline throws if asked for
 *      a light palette, and other themes' panel chrome would be unsafe in
 *      a flying scenario.
 *   2. **User theme preference wins** over the path-default theme on every
 *      other route. So if a user picks `study/flightdeck`, they get it on
 *      `/memory`, `/reps`, `/dashboard`, etc.
 *   3. **Path default** otherwise (today: `/dashboard*` -> flightdeck,
 *      everything else -> sectional).
 *   4. Some themes force a specific appearance regardless of the user's
 *      light/dark preference (see `forcedAppearanceFor`). The forced value
 *      always wins; otherwise the user's appearance pref applies.
 *
 * The layout still tracks the *route* (path defines whether the surface is
 * a reading column, dashboard grid, or cockpit), independent of which
 * palette the user picked. Layout and palette are orthogonal axes.
 */
export function resolveThemeSelection(args: {
	pathname: string;
	userTheme: ThemePreference;
	userAppearance?: AppearancePreference;
	systemAppearance?: AppearanceMode;
}): ThemeSelection {
	const { pathname, userTheme } = args;
	const userAppearance = args.userAppearance ?? 'system';
	const systemAppearance = args.systemAppearance ?? DEFAULT_APPEARANCE;
	const routeSelection = resolveThemeForPath(pathname, userAppearance, systemAppearance);
	if (routeRequiresFixedTheme(pathname) || userTheme == null) {
		return routeSelection;
	}
	const forced = forcedAppearanceFor(userTheme);
	const appearance: AppearanceMode = forced ?? (userAppearance === 'system' ? systemAppearance : userAppearance);
	return { theme: userTheme, appearance, layout: routeSelection.layout };
}
