/**
 * Theme contract -- the TypeScript source of truth.
 *
 * A `Theme` is a typed object. CSS is emitted from it via `emit.ts`. This
 * file defines the shape every theme must satisfy. Per
 * `docs/platform/theme-system/02-ARCHITECTURE.md`, themes compose along
 * three axes: `theme`, `appearance` (light/dark), `layout`.
 */

export type AppearanceMode = 'light' | 'dark';

/** `${app}/${name}`, e.g. `study/sectional`, `airboss/default`. */
export type ThemeId = string;

/** Interactive state bundle derived from a single base color. */
export interface InteractiveStates {
	base: string;
	hover: string;
	active: string;
	wash: string;
	edge: string;
	ink: string;
	disabled: string;
}

/** Signal (status/feedback) state bundle derived from a single base color. */
export interface SignalStates {
	solid: string;
	wash: string;
	edge: string;
	ink: string;
}

/**
 * Derived palette -- the output of running `applyDerivations` on a `Palette`.
 *
 * Themes may partially override any derived value via `Palette.overrides`.
 * The emit pipeline always materializes a full `DerivedPalette`; missing
 * values come from the derivation math.
 */
export interface DerivedPalette {
	ink: { body: string; muted: string; subtle: string; faint: string; inverse: string; strong: string };
	surface: { page: string; panel: string; raised: string; sunken: string; muted: string; overlay: string };
	edge: { default: string; strong: string; subtle: string; focus: string };
	action: {
		default: InteractiveStates;
		hazard: InteractiveStates;
		caution: InteractiveStates;
		neutral: InteractiveStates;
		link: InteractiveStates;
	};
	signal: {
		success: SignalStates;
		warning: SignalStates;
		danger: SignalStates;
		info: SignalStates;
	};
	focus: { ring: string; ringStrong: string; ringShadow: string };
	accent: { code: string; reference: string; definition: string };
	overlay: { scrim: string; tooltipBg: string; tooltipInk: string };
	selection: { bg: string; ink: string };
	disabled: { surface: string; ink: string; edge: string };
	link: { default: string; hover: string; visited: string };
}

/**
 * Palette declaration -- base colors only. Variants are derived unless
 * explicitly overridden in `overrides`. All colors are OKLCH strings so
 * derivation math (brightness, alpha) stays predictable across hues.
 */
export interface Palette {
	ink: { body: string; muted: string; subtle: string; faint: string; inverse: string; strong: string };
	surface: { page: string; panel: string; raised: string; sunken: string; muted: string; overlay: string };
	edge: { default: string; strong: string; subtle: string };
	action: {
		default: string;
		hazard: string;
		caution: string;
		neutral: string;
		link: string;
	};
	signal: {
		success: string;
		warning: string;
		danger: string;
		info: string;
	};
	focus: string;
	accent: { code: string; reference: string; definition: string };
	overlay?: Partial<DerivedPalette['overlay']>;
	selection?: Partial<DerivedPalette['selection']>;
	disabled?: Partial<DerivedPalette['disabled']>;
	link?: Partial<DerivedPalette['link']>;
	/**
	 * Opt-in explicit overrides. When the derivation math produces the wrong
	 * result for a specific swatch (e.g. warning ink needs dark text that
	 * contrast would otherwise pick white for), override that leaf here.
	 */
	overrides?: DeepPartial<DerivedPalette>;
}

export interface FontFamilies {
	sans: string;
	mono: string;
	base: string;
}

/**
 * Typography descriptor. The atomic shape ships with Package #1; the full
 * bundle shape (`reading`, `heading`, `ui`, `code`, `definition`) lands in
 * Package #2. Keeping the atomic fields here so current primitives continue
 * to resolve `--font-size-*` / `--line-height-*` / `--letter-spacing-*`.
 */
export interface TypographyPack {
	families: FontFamilies;
	sizes: {
		xs: string;
		sm: string;
		body: string;
		base: string;
		lg: string;
		xl: string;
		'2xl': string;
	};
	weights: {
		regular: number;
		medium: number;
		semibold: number;
		bold: number;
	};
	lineHeights: {
		tight: number;
		normal: number;
		relaxed: number;
	};
	letterSpacings: {
		tight: string;
		normal: string;
		wide: string;
		caps: string;
	};
}

/**
 * Chrome -- the "material" of a theme: radii, shadows, motion, spacing,
 * z-index ladder, layout variables. Palette and typography are separate
 * concerns handled by `Palette` and `TypographyPack`.
 */
export interface Chrome {
	space: {
		'2xs': string;
		xs: string;
		sm: string;
		md: string;
		lg: string;
		xl: string;
		'2xl': string;
	};
	radii: {
		sharp: string;
		xs: string;
		sm: string;
		md: string;
		lg: string;
		pill: string;
	};
	shadows: {
		none: string;
		sm: string;
		md: string;
		lg: string;
	};
	motion: {
		fast: string;
		normal: string;
	};
	zIndex: {
		base: number;
		dropdown: number;
		sticky: number;
		overlay: number;
		modal: number;
		toast: number;
		tooltip: number;
	};
	breakpoints: {
		sm: string;
		md: string;
		lg: string;
		xl: string;
	};
	layout: {
		containerMax: string;
		containerPadding: string;
		gridGap: string;
		panelPadding: string;
		panelGap: string;
		panelHeaderSize: string;
		panelHeaderWeight: number;
		panelHeaderTransform: 'none' | 'uppercase';
		panelHeaderTracking: string;
		panelHeaderFamily: string;
	};
}

/**
 * Component tokens -- Layer 2 surgical overrides. Most values resolve to
 * role tokens (`var(--action-default)`); a theme rebinds one only when it
 * needs to fork the default cascade for a specific component. Leaving a
 * key undefined lets the emit pipeline fall back to the role default.
 */
export interface ComponentTokens {
	button?: Record<string, string>;
	input?: Record<string, string>;
	card?: Record<string, string>;
	dialog?: Record<string, string>;
	badge?: Record<string, string>;
	table?: Record<string, string>;
}

/**
 * App-specific vocabulary extension. Each app can add typed token names
 * that only its own primitives can reference. Shared libs/ui primitives
 * are locked out by TypeScript import boundaries.
 */
export type AppVocabulary = Record<string, `--${string}`>;

export interface Theme {
	id: ThemeId;
	name: string;
	description: string;
	extends?: ThemeId;
	appearances: readonly AppearanceMode[];
	defaultAppearance: AppearanceMode;
	layouts: Record<string, string>;
	defaultLayout: string;
	palette: {
		light?: Palette;
		dark?: Palette;
	};
	typography?: TypographyPack;
	chrome?: Chrome;
	componentTokens?: Partial<ComponentTokens>;
	vocabulary?: AppVocabulary;
}

/** Deep-partial used for `Palette.overrides`. */
export type DeepPartial<T> = T extends object
	? {
			[K in keyof T]?: DeepPartial<T[K]>;
		}
	: T;
