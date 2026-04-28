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

// ---------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------

/**
 * One typography slot. `family` is a pack family key
 * (`sans | serif | mono | base | display`). All other fields are raw
 * CSS values the emitter pipes into `--type-{role}-{variant}-{field}`.
 * Sizes are multiplied by `pack.adjustments[family]` at emit time.
 */
export type TypeFamilyKey = 'sans' | 'serif' | 'mono' | 'base' | 'display';

export interface TypeBundle {
	family: TypeFamilyKey;
	size: string;
	weight: number;
	lineHeight: number;
	tracking: string;
}

export type TypographyRole = 'reading' | 'heading' | 'ui' | 'code' | 'definition';

export interface ReadingBundles {
	body: TypeBundle;
	lead: TypeBundle;
	caption: TypeBundle;
	quote: TypeBundle;
}

export interface HeadingBundles {
	1: TypeBundle;
	2: TypeBundle;
	3: TypeBundle;
	4: TypeBundle;
	5: TypeBundle;
	6: TypeBundle;
}

export interface UiBundles {
	control: TypeBundle;
	label: TypeBundle;
	caption: TypeBundle;
	badge: TypeBundle;
}

export interface CodeBundles {
	inline: TypeBundle;
	block: TypeBundle;
}

export interface DefinitionBundles {
	term: TypeBundle;
	body: TypeBundle;
}

export interface TypographyBundles {
	reading: ReadingBundles;
	heading: HeadingBundles;
	ui: UiBundles;
	code: CodeBundles;
	definition: DefinitionBundles;
}

/**
 * Typography pack -- families + a full bundle-per-role surface.
 *
 * Package #1 lands the shape; `airbossDefaultPack` provides bundle
 * values derived from today's atomic typography scale. Package #2 ships
 * curated packs (compact, display-serif, etc.) and refactors call
 * sites; do not invent new packs here.
 */
/** Font stacks per family key. `base` is the default family used by
 * bundles that don't specify one explicitly. `serif` and `display` are
 * optional; if a bundle references them and the pack doesn't provide
 * one, the emitter falls back to `base`. */
export interface TypographyFamilies {
	sans: string;
	serif: string;
	mono: string;
	base: string;
	display?: string;
}

/** Per-family size multipliers applied to every bundle whose `family`
 * key matches. Defaults to 1.0 for any missing key. Used so visual
 * weight stays consistent when a pack swaps in a serif or mono face. */
export interface TypographyAdjustments {
	sans: number;
	serif: number;
	mono: number;
	base: number;
	display?: number;
}

export interface TypographyPack {
	packId: string;
	families: TypographyFamilies;
	adjustments: TypographyAdjustments;
	bundles: TypographyBundles;
}

// ---------------------------------------------------------------------
// Control tokens (button / input slots)
// ---------------------------------------------------------------------

/**
 * Slot set used by interactive controls. Every field is a raw CSS value
 * the emitter writes as `--{component}-{variant}-{slot}`. Variants
 * resolve their values from role tokens by default (e.g. `bg:
 * 'var(--action-default)'`) so theme swaps propagate automatically.
 */
export interface ControlSlots {
	bg: string;
	ink: string;
	border: string;
	hoverBg: string;
	hoverInk: string;
	activeBg: string;
	disabledBg: string;
	disabledInk: string;
	ring: string;
}

export type ButtonVariant = 'default' | 'primary' | 'hazard' | 'neutral' | 'ghost';
export type InputVariant = 'default' | 'error';

export interface ControlTokens {
	button: Record<ButtonVariant, ControlSlots>;
	input: Record<InputVariant, ControlSlots>;
}

// ---------------------------------------------------------------------
// Sim tokens (optional; only populated by sim-surface themes)
// ---------------------------------------------------------------------

/**
 * Sim-surface tokens. Shape matches the legacy `--ab-sim-*` families
 * grepped from `apps/sim/src`. Package #7 populates real values; until
 * then all sim themes leave this undefined and `apps/sim` resolves via
 * the legacy-alias block's TODO sentinels.
 */
export interface SimPanelTokens {
	bg: string;
	bgDarker: string;
	bgElevated: string;
	border: string;
	fg: string;
	fgDim: string;
	fgFaint: string;
	fgLight: string;
	fgLighter: string;
	fgLightest: string;
	fgMuted: string;
	fgNote: string;
	fgSubtle: string;
}

export interface SimInstrumentTokens {
	bezel: string;
	bezelOuter: string;
	face: string;
	faceInner: string;
	pointer: string;
	pointerPivot: string;
	tick: string;
	tickDim: string;
	tickFaint: string;
	tickMinor: string;
	tickSubtle: string;
}

export interface SimHorizonTokens {
	ground: string;
	sky: string;
}

export interface SimArcTokens {
	green: string;
	red: string;
	white: string;
	yellow: string;
}

export interface SimStatusTokens {
	danger: string;
	dangerBg: string;
	dangerBorder: string;
	dangerFg: string;
	dangerStrong: string;
	primary: string;
	primaryFg: string;
	primaryHover: string;
	success: string;
	successBg: string;
	successBorder: string;
	successFg: string;
	warning: string;
	warningBg: string;
	warningBorder: string;
}

export interface SimBannerTokens {
	infoBg: string;
	infoBorder: string;
	infoFg: string;
	successBg: string;
	successBorder: string;
}

export interface SimTokens {
	panel: SimPanelTokens;
	instrument: SimInstrumentTokens;
	horizon: SimHorizonTokens;
	arc: SimArcTokens;
	status: SimStatusTokens;
	banner: SimBannerTokens;
	readout: { warningBg: string };
	muted: { stateBg: string };
}

// ---------------------------------------------------------------------
// Avionics tokens (PFD / MFD instrument roles, light + dark)
// ---------------------------------------------------------------------

/**
 * Avionics-surface tokens.
 *
 * Unlike `sim`, avionics is a global token set: every theme contributes
 * a value per role per appearance so the avionics PFD renders correctly
 * inside any theme the picker exposes. The roles match the table in
 * `docs/products/avionics/work-packages/avionics-app-scaffold/design.md`
 * under "PFD rendering: light and dark":
 *
 *   - sky / ground -- attitude indicator horizon halves
 *   - pointer      -- attitude bank pointer + readout-box accent
 *   - arc.white    -- ASI Vs0..Vfe band (flap operating range)
 *   - arc.green    -- ASI Vs1..Vno band (normal operating)
 *   - arc.yellow   -- ASI Vno..Vne band (caution)
 *   - arc.red      -- ASI Vne line (never-exceed)
 *
 * Values are emitted as `--avionics-sky`, `--avionics-ground`,
 * `--avionics-pointer`, `--avionics-arc-{white,green,yellow,red}`.
 */
export interface AvionicsTokens {
	sky: string;
	ground: string;
	pointer: string;
	arc: {
		white: string;
		green: string;
		yellow: string;
		red: string;
	};
}

export interface AvionicsThemeBlock {
	light: AvionicsTokens;
	dark: AvionicsTokens;
}

// ---------------------------------------------------------------------
// Chrome + component overrides
// ---------------------------------------------------------------------

export interface Chrome {
	space: Record<'2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl', string>;
	radius: Record<'sharp' | 'xs' | 'sm' | 'md' | 'lg' | 'pill', string>;
	shadow: Record<'none' | 'sm' | 'md' | 'lg', string>;
	motion: Record<'fast' | 'normal' | 'slow', string>;
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
	control: ControlTokens;
	/** Populated only by sim-surface themes. Package #7 fills. */
	sim?: SimTokens;
	/**
	 * Avionics PFD/MFD token roles. Defined on the base theme
	 * (`airboss/default`); descendants inherit via the `extends` chain
	 * unless they override. Optional on the contract to keep the
	 * registry lenient for synthetic test fixtures, but every theme that
	 * ships from this lib MUST resolve a value for both appearances --
	 * the `avionics` contract test asserts coverage at runtime.
	 */
	avionics?: AvionicsThemeBlock;
	componentTokens?: Partial<ComponentTokens>;
	vocabulary?: AppVocabulary;
}

export interface ThemeSelection {
	theme: ThemeId;
	appearance: AppearanceMode;
	layout: string;
}
