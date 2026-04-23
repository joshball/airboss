/**
 * Theme contract -- the TypeScript shape every theme must satisfy.
 *
 * Themes are TS objects. CSS is emitted from them (see `emit.ts`).
 * The contract is intentionally narrow: a theme declares *base* colors
 * for each role, and derivation math fills in the variants.
 */

export type AppearanceMode = 'light' | 'dark';

/** `${app}/${name}` e.g. `airboss/default`, `study/sectional`. */
export type ThemeId = string;

export interface InteractiveStates {
	base: string;
	hover: string;
	active: string;
	wash: string;
	edge: string;
	ink: string;
	disabled: string;
}

export interface SignalStates {
	solid: string;
	wash: string;
	edge: string;
	ink: string;
}

export interface Palette {
	ink: {
		body: string;
		muted: string;
		subtle: string;
		faint: string;
		strong: string;
		inverse: string;
	};
	surface: {
		page: string;
		panel: string;
		raised: string;
		sunken: string;
		muted: string;
		overlay: string;
	};
	edge: {
		default: string;
		strong: string;
		subtle: string;
	};
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
	accent: {
		code: string;
		reference: string;
		definition: string;
	};
	/** Optional explicit overrides for any derived value. */
	overrides?: Partial<DerivedPalette>;
}

export interface DerivedPalette {
	action: Record<'default' | 'hazard' | 'caution' | 'neutral' | 'link', InteractiveStates>;
	signal: Record<'success' | 'warning' | 'danger' | 'info', SignalStates>;
	overlay: { scrim: string; tooltipBg: string; tooltipInk: string };
	selection: { bg: string; ink: string };
	disabled: { surface: string; ink: string; edge: string };
	link: { default: string; hover: string; visited: string };
	focus: { ring: string; ringStrong: string; ringShadow: string };
}

export interface TypeBundle {
	family: string;
	size: string;
	weight: number;
	lineHeight: number;
	tracking: string;
}

/**
 * Typography pack -- atomic shape in package #1 (just family tokens +
 * optional bundles). Full bundle-per-role surface lands in package #2.
 */
export interface TypographyPack {
	packId: string;
	families: {
		sans: string;
		mono: string;
		base: string;
	};
	scale?: number;
	/** Optional bundles; package #2 populates the full shape. */
	bundles?: {
		reading?: { body?: TypeBundle; lead?: TypeBundle; caption?: TypeBundle; quote?: TypeBundle };
		heading?: Partial<Record<'1' | '2' | '3' | '4' | '5' | '6', TypeBundle>>;
		ui?: { control?: TypeBundle; label?: TypeBundle; caption?: TypeBundle; badge?: TypeBundle };
		code?: { inline?: TypeBundle; block?: TypeBundle };
		definition?: { term?: TypeBundle; body?: TypeBundle };
	};
}

export interface Chrome {
	space: Record<'2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', string>;
	radius: Record<'sharp' | 'xs' | 'sm' | 'md' | 'lg' | 'pill', string>;
	shadow: Record<'none' | 'sm' | 'md' | 'lg', string>;
	motion: Record<'fast' | 'normal', string>;
	layout: {
		containerMax: string;
		containerPadding: string;
		gridGap: string;
		panelPadding: string;
		panelGap: string;
		panelHeaderSize: string;
		panelHeaderWeight: string;
		panelHeaderTransform: string;
		panelHeaderTracking: string;
		panelHeaderFamily: string;
	};
}

/** Surgical component overrides -- rare. Package #4 grows this. */
export interface ComponentTokens {
	button?: Record<string, string>;
	input?: Record<string, string>;
	card?: Record<string, string>;
	dialog?: Record<string, string>;
	badge?: Record<string, string>;
	table?: Record<string, string>;
}

/** App-scoped vocabulary extensions (e.g. sim's instrument-*). */
export type AppVocabulary = Record<string, string>;

export interface Theme {
	id: ThemeId;
	name: string;
	description: string;
	extends?: ThemeId;
	appearances: AppearanceMode[];
	defaultAppearance: AppearanceMode;
	layouts: Record<string, string>;
	defaultLayout: string;
	palette: {
		light?: Palette;
		dark?: Palette;
	};
	typography: TypographyPack;
	chrome: Chrome;
	componentTokens?: Partial<ComponentTokens>;
	vocabulary?: AppVocabulary;
}

export interface ThemeSelection {
	theme: ThemeId;
	appearance: AppearanceMode;
	layout: string;
}
