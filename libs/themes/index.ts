/**
 * airboss theme system -- public API.
 *
 * Usage:
 *   // Generated CSS (role tokens + legacy aliases) -- import once in
 *   // the app's root layout:
 *   import '@ab/themes/generated/tokens.css';
 *
 *   // Provider wraps themed content:
 *   import ThemeProvider from '@ab/themes/ThemeProvider.svelte';
 *   <ThemeProvider {theme} {appearance} {layout}>...</ThemeProvider>
 *
 *   // Path-aware resolver:
 *   import { resolveThemeForPath } from '@ab/themes';
 */

export type {
	AppearanceMode,
	Chrome,
	DerivedPalette,
	InteractiveStates,
	Palette,
	SignalStates,
	Theme,
	ThemeId,
	ThemeSelection,
	TypeBundle,
	TypeFamilyKey,
	TypographyAdjustments,
	TypographyFamilies,
	TypographyPack,
} from './contract';
export { contrastRatio, luminance } from './contrast';
export { AIRBOSS_COMPACT_PACK, AIRBOSS_STANDARD_PACK, TYPOGRAPHY_PACKS } from './core/typography-packs';
export {
	adjustBrightness,
	alpha,
	deriveInteractiveStates,
	deriveSignalVariants,
	getContrastingTextColor,
} from './derive';
export { emitAllThemes, themeToCss } from './emit';
// Picker surface (server endpoint factory, cookie reader, pre-hydration
// generator). The Svelte UI component is exposed at the sub-path
// `@ab/themes/picker/ThemePicker.svelte` rather than re-exported here --
// barrel-exporting a .svelte file forces every consumer of this index
// (including vitest, which has no svelte plugin) to compile it. Apps
// import `ThemePicker` directly via that sub-path; node-side code keeps
// using the index without dragging the component in.
export {
	buildPreHydrationCspHash,
	buildPreHydrationScript,
	injectPreHydrationScript,
	PRE_HYDRATION_PLACEHOLDER,
} from './picker/pre-hydration';
export {
	createThemeEndpoint,
	readThemeFromCookies,
} from './picker/server';
export {
	getTheme,
	getThemeSafe,
	isValidThemeId,
	listThemes,
	registerTheme,
} from './registry';
export {
	APPEARANCE_COOKIE,
	APPEARANCE_PREFERENCE_VALUES,
	type AppearancePreference,
	DEFAULT_APPEARANCE,
	DEFAULT_APPEARANCE_PREFERENCE,
	DEFAULT_THEME,
	DEFAULT_THEME_PREFERENCE,
	FLIGHTDECK_THEME,
	forcedAppearanceFor,
	isAppearancePreference,
	isThemePreference,
	parseAppearancePreference,
	parseThemePreference,
	resolveThemeForPath,
	resolveThemeSelection,
	SIM_THEME,
	THEME_COOKIE,
	THEMES,
	type ThemePreference,
} from './resolve';
export { isTone, TONES, type Tone } from './tones';
export { TOKENS, type TokenKey, type TokenName } from './vocab';

// Register every theme that ships today. Import side-effects populate
// the registry; `emit.ts` walks whatever is registered.
import './core/defaults/airboss-default/index';
import './study/sectional/index';
import './study/flightdeck/index';
import './sim/glass/index';
