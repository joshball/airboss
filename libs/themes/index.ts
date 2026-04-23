/**
 * airboss theme system -- public API.
 *
 * - CSS tokens: import `@ab/themes/generated/tokens.css` once in your app's
 *   root layout. The file is emitted by `scripts/themes/emit.ts` from the
 *   TS source of truth and committed so diffs stay reviewable.
 * - Provider: `ThemeProvider.svelte` sets `data-theme` + `data-appearance`
 *   (+ optional `data-layout`) on a `display: contents` wrapper.
 * - Resolver: `resolveThemeForPath(pathname, userAppearance, systemAppearance)`
 *   returns a `ThemeSelection { theme, appearance, layout }`.
 * - Registry: `getTheme` / `getThemeSafe` / `isValidThemeId` / `listThemes`.
 * - Vocabulary: `TOKENS` (Layer 0 role-token names) and `TONES` (shared
 *   primitive tone enum).
 *
 * Importing this barrel registers every shipped theme as a side effect.
 */

// Side-effect: register shipped themes. Order is base -> app so `extends`
// lookups resolve at emit time.
import './core/defaults/airboss-default';
import './study/sectional';
import './study/flightdeck';

export type {
	AppearanceMode,
	Chrome,
	ComponentTokens,
	DerivedPalette,
	InteractiveStates,
	Palette,
	SignalStates,
	Theme,
	ThemeId,
	TypographyPack,
} from './contract';
export { alpha, adjustBrightness, deriveInteractiveStates, deriveSignalVariants, getContrastingTextColor } from './derive';
export { contrastRatio, relativeLuminance } from './contrast';
export { applyDerivations, emitAllThemes, resolveTheme, themeToCss } from './emit';
export { getTheme, getThemeSafe, isValidThemeId, listThemes, registerTheme } from './registry';
export {
	DEFAULT_THEME,
	DEFAULT_THEME_ID,
	FLIGHTDECK_THEME_ID,
	resolveThemeForPath,
	THEMES,
	type ThemeName,
	type ThemeSelection,
} from './resolve';
export { TOKENS, type TokenCssName, type TokenName } from './vocab';
export { TONES, type Tone } from './tones';
