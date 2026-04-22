/**
 * Theme resolution.
 *
 * Two surfaces today -- `web` (reading column, rounded, mixed sans) and
 * `tui` (dense, monospace, 2px corners, full-bleed grid).
 *
 * `resolveThemeForPath` is the single source of "which theme for this URL".
 * Layouts call it with the current path; instrument-style surfaces (today
 * that's just `/dashboard`) return `tui`, everything else returns `web`.
 *
 * When new TUI surfaces come online (avionics, instrument trainer, etc.)
 * extend `TUI_PATH_PREFIXES` here rather than sprinkling theme logic across
 * routes.
 */

export const THEMES = {
	WEB: 'web',
	TUI: 'tui',
} as const;

export type ThemeName = (typeof THEMES)[keyof typeof THEMES];

export const DEFAULT_THEME: ThemeName = THEMES.WEB;

/**
 * Path prefixes that should render in the TUI theme. Checked as prefix
 * matches so `/dashboard` and `/dashboard/anything` both resolve to `tui`.
 */
const TUI_PATH_PREFIXES: readonly string[] = ['/dashboard'];

export function resolveThemeForPath(pathname: string): ThemeName {
	for (const prefix of TUI_PATH_PREFIXES) {
		if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
			return THEMES.TUI;
		}
	}
	return DEFAULT_THEME;
}
