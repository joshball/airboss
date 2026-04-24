/**
 * CSS emit pipeline.
 *
 * Walks the registry, resolves each theme's extends chain, runs
 * derivation for action/signal variants, applies any explicit
 * `overrides`, and emits one selector block per (theme, appearance)
 * pair.
 *
 * The final output also includes:
 *   - A `:root` block with Layer-0 scale defaults (spacing, radius,
 *     shadow, motion). These form the base vocabulary and never change
 *     per-theme; themes may override values but can't rename the rungs.
 *
 * Option A closed: the legacy `--ab-*` alias block retired alongside
 * hangar's migration. Every app now consumes role tokens directly.
 */

import type {
	AppearanceMode,
	Chrome,
	ControlTokens,
	DerivedPalette,
	InteractiveStates,
	Palette,
	SignalStates,
	SimTokens,
	Theme,
	TypeBundle,
	TypographyPack,
} from './contract';
import { alpha, deriveInteractiveStates, deriveSignalVariants } from './derive';
import { getTheme, listThemes } from './registry';

type ActionKey = 'default' | 'hazard' | 'caution' | 'neutral' | 'link';
type SignalKey = 'success' | 'warning' | 'danger' | 'info';

const ACTION_KEYS: readonly ActionKey[] = ['default', 'hazard', 'caution', 'neutral', 'link'];
const SIGNAL_KEYS: readonly SignalKey[] = ['success', 'warning', 'danger', 'info'];

const READING_VARIANTS = ['body', 'lead', 'caption', 'quote'] as const;
const HEADING_VARIANTS = ['1', '2', '3', '4', '5', '6'] as const;
const UI_VARIANTS = ['control', 'label', 'caption', 'badge'] as const;
const CODE_VARIANTS = ['inline', 'block'] as const;
const DEFINITION_VARIANTS = ['term', 'body'] as const;

const BUTTON_VARIANTS = ['default', 'primary', 'hazard', 'neutral', 'ghost'] as const;
const INPUT_VARIANTS = ['default', 'error'] as const;

interface ResolvedTheme {
	id: string;
	palette: { light?: Palette; dark?: Palette };
	chrome: Chrome;
	typography: TypographyPack;
	control: ControlTokens;
	sim?: SimTokens;
}

/** Walk `extends` chain; later entries win on merge. */
function resolveTheme(theme: Theme): ResolvedTheme {
	if (!theme.extends) {
		return {
			id: theme.id,
			palette: theme.palette,
			chrome: theme.chrome,
			typography: theme.typography,
			control: theme.control,
			sim: theme.sim,
		};
	}
	const parent = resolveTheme(getTheme(theme.extends));
	return {
		id: theme.id,
		palette: {
			light: theme.palette.light ?? parent.palette.light,
			dark: theme.palette.dark ?? parent.palette.dark,
		},
		chrome: theme.chrome ?? parent.chrome,
		typography: theme.typography ?? parent.typography,
		control: theme.control ?? parent.control,
		sim: theme.sim ?? parent.sim,
	};
}

function deriveAction(
	palette: Palette,
	key: ActionKey,
	isDark: boolean,
	overrides: Partial<DerivedPalette> | undefined,
): InteractiveStates {
	const base = palette.action[key];
	const derived = deriveInteractiveStates(base, isDark);
	const override = overrides?.action?.[key];
	return { ...derived, ...(override ?? {}) };
}

function deriveSignal(
	palette: Palette,
	key: SignalKey,
	isDark: boolean,
	overrides: Partial<DerivedPalette> | undefined,
): SignalStates {
	const base = palette.signal[key];
	const derived = deriveSignalVariants(base, isDark);
	const override = overrides?.signal?.[key];
	return { ...derived, ...(override ?? {}) };
}

function paletteBlock(palette: Palette, isDark: boolean): string[] {
	const lines: string[] = [];
	const push = (name: string, value: string) => lines.push(`\t${name}: ${value};`);
	const overrides = palette.overrides;

	// ink
	push('--ink-body', palette.ink.body);
	push('--ink-muted', palette.ink.muted);
	push('--ink-subtle', palette.ink.subtle);
	push('--ink-faint', palette.ink.faint);
	push('--ink-strong', palette.ink.strong);
	push('--ink-inverse', palette.ink.inverse);
	push('--ink-inverse-subtle', alpha(palette.ink.inverse, 0.25));

	// surface
	push('--surface-page', palette.surface.page);
	push('--surface-panel', palette.surface.panel);
	push('--surface-raised', palette.surface.raised);
	push('--surface-sunken', palette.surface.sunken);
	push('--surface-muted', palette.surface.muted);
	push('--surface-overlay', palette.surface.overlay);

	// edge
	push('--edge-default', palette.edge.default);
	push('--edge-strong', palette.edge.strong);
	push('--edge-subtle', palette.edge.subtle);
	push('--edge-focus', overrides?.focus?.ring ?? palette.focus);

	// action (per role)
	for (const key of ACTION_KEYS) {
		const s = deriveAction(palette, key, isDark, overrides);
		push(`--action-${key}`, s.base);
		push(`--action-${key}-hover`, s.hover);
		push(`--action-${key}-active`, s.active);
		push(`--action-${key}-wash`, s.wash);
		push(`--action-${key}-edge`, s.edge);
		push(`--action-${key}-ink`, s.ink);
		push(`--action-${key}-disabled`, s.disabled);
	}

	// signal
	for (const key of SIGNAL_KEYS) {
		const s = deriveSignal(palette, key, isDark, overrides);
		push(`--signal-${key}`, s.solid);
		push(`--signal-${key}-wash`, s.wash);
		push(`--signal-${key}-edge`, s.edge);
		push(`--signal-${key}-ink`, s.ink);
	}

	// focus
	const focusRing = overrides?.focus?.ring ?? palette.focus;
	const focusRingStrong = overrides?.focus?.ringStrong ?? palette.focus;
	const focusRingShadow = overrides?.focus?.ringShadow ?? `0 0 0 3px ${focusRing}`;
	push('--focus-ring', focusRing);
	push('--focus-ring-strong', focusRingStrong);
	push('--focus-ring-shadow', focusRingShadow);

	// accent
	push('--accent-code', palette.accent.code);
	push('--accent-reference', palette.accent.reference);
	push('--accent-definition', palette.accent.definition);

	// overlay
	push('--overlay-scrim', overrides?.overlay?.scrim ?? 'rgba(0, 0, 0, 0.5)');
	push('--overlay-tooltip-bg', overrides?.overlay?.tooltipBg ?? palette.ink.body);
	push('--overlay-tooltip-ink', overrides?.overlay?.tooltipInk ?? palette.ink.inverse);

	// selection
	push('--selection-bg', overrides?.selection?.bg ?? deriveAction(palette, 'default', isDark, overrides).wash);
	push('--selection-ink', overrides?.selection?.ink ?? palette.ink.body);

	// disabled
	push('--disabled-surface', overrides?.disabled?.surface ?? palette.surface.muted);
	push('--disabled-ink', overrides?.disabled?.ink ?? palette.ink.faint);
	push('--disabled-edge', overrides?.disabled?.edge ?? palette.edge.default);

	// link
	push('--link-default', overrides?.link?.default ?? palette.action.link);
	push('--link-hover', overrides?.link?.hover ?? deriveAction(palette, 'link', isDark, overrides).hover);
	push('--link-visited', overrides?.link?.visited ?? deriveAction(palette, 'link', isDark, overrides).active);

	return lines;
}

function resolveBundleFamily(pack: TypographyPack, family: TypeBundle['family']): string {
	if (family === 'sans') return pack.families.sans;
	if (family === 'serif') return pack.families.serif;
	if (family === 'mono') return pack.families.mono;
	if (family === 'base') return pack.families.base;
	if (family === 'display') return pack.families.display ?? pack.families.base;
	return pack.families.base;
}

function resolveFamilyAdjustment(pack: TypographyPack, family: TypeBundle['family']): number {
	if (family === 'sans') return pack.adjustments.sans;
	if (family === 'serif') return pack.adjustments.serif;
	if (family === 'mono') return pack.adjustments.mono;
	if (family === 'base') return pack.adjustments.base;
	if (family === 'display') return pack.adjustments.display ?? pack.adjustments.base;
	return pack.adjustments.base;
}

// Match a CSS size token like `1.25rem`, `0.9375em`, `14px`. Anything
// else (calc(), var(), unitless numbers, etc.) passes through wrapped
// in a `calc(<value> * <mult>)` when a multiplier is active.
const SIZE_PATTERN = /^(\d+(?:\.\d+)?)(rem|em|px|pt|%)$/;

function applyFamilyAdjustment(size: string, multiplier: number): string {
	if (multiplier === 1) return size;
	const match = SIZE_PATTERN.exec(size.trim());
	if (match) {
		const raw = Number.parseFloat(match[1]);
		const unit = match[2];
		const scaled = raw * multiplier;
		// Trim to 5 decimals; strip trailing zeros for deterministic,
		// readable output (`0.95rem` not `0.95000rem`).
		const rounded = Math.round(scaled * 1e5) / 1e5;
		const cleaned = rounded.toString();
		return `${cleaned}${unit}`;
	}
	return `calc(${size} * ${multiplier})`;
}

function typographyBundleBlock(pack: TypographyPack, role: string, variant: string, bundle: TypeBundle): string[] {
	const prefix = `--type-${role}-${variant}`;
	const family = resolveBundleFamily(pack, bundle.family);
	const adjustment = resolveFamilyAdjustment(pack, bundle.family);
	const size = applyFamilyAdjustment(bundle.size, adjustment);
	return [
		`\t${prefix}-family: ${family};`,
		`\t${prefix}-size: ${size};`,
		`\t${prefix}-weight: ${bundle.weight};`,
		`\t${prefix}-line-height: ${bundle.lineHeight};`,
		`\t${prefix}-tracking: ${bundle.tracking};`,
	];
}

function typographyBlock(pack: TypographyPack): string[] {
	const lines: string[] = [];
	const push = (name: string, value: string) => lines.push(`\t${name}: ${value};`);
	push('--font-family-sans', pack.families.sans);
	push('--font-family-serif', pack.families.serif);
	push('--font-family-mono', pack.families.mono);
	push('--font-family-base', pack.families.base);
	if (pack.families.display !== undefined) {
		push('--font-family-display', pack.families.display);
	}
	// Atomic size / weight / line-height / tracking tokens sourced from
	// bundle role tokens so a pack swap propagates without touching
	// page-level CSS.
	push('--font-size-xs', 'var(--type-ui-caption-size)');
	push('--font-size-sm', 'var(--type-ui-label-size)');
	push('--font-size-body', 'var(--type-definition-body-size)');
	push('--font-size-base', 'var(--type-reading-body-size)');
	push('--font-size-lg', 'var(--type-reading-lead-size)');
	push('--font-size-xl', 'var(--type-heading-2-size)');
	push('--font-size-2xl', 'var(--type-heading-1-size)');
	push('--font-weight-regular', 'var(--type-reading-body-weight)');
	push('--font-weight-medium', 'var(--type-ui-control-weight)');
	push('--font-weight-semibold', 'var(--type-heading-3-weight)');
	push('--font-weight-bold', 'var(--type-heading-1-weight)');
	push('--line-height-tight', 'var(--type-heading-1-line-height)');
	push('--line-height-normal', 'var(--type-ui-label-line-height)');
	push('--line-height-relaxed', 'var(--type-reading-body-line-height)');
	push('--letter-spacing-tight', 'var(--type-heading-1-tracking)');
	push('--letter-spacing-normal', 'var(--type-reading-body-tracking)');
	push('--letter-spacing-wide', 'var(--type-ui-caption-tracking)');
	push('--letter-spacing-caps', 'var(--type-ui-badge-tracking)');

	// Bundle role tokens (--type-{role}-{variant}-{field}).
	for (const variant of READING_VARIANTS) {
		lines.push(...typographyBundleBlock(pack, 'reading', variant, pack.bundles.reading[variant]));
	}
	for (const variant of HEADING_VARIANTS) {
		lines.push(...typographyBundleBlock(pack, 'heading', variant, pack.bundles.heading[variant]));
	}
	for (const variant of UI_VARIANTS) {
		lines.push(...typographyBundleBlock(pack, 'ui', variant, pack.bundles.ui[variant]));
	}
	for (const variant of CODE_VARIANTS) {
		lines.push(...typographyBundleBlock(pack, 'code', variant, pack.bundles.code[variant]));
	}
	for (const variant of DEFINITION_VARIANTS) {
		lines.push(...typographyBundleBlock(pack, 'definition', variant, pack.bundles.definition[variant]));
	}
	return lines;
}

function controlsAtomicBlock(): string[] {
	// Atomic control sizing. Package #4 grows per-size control-height
	// tokens (--button-height-*, --input-height-*, --badge-height-*) on
	// top of the legacy atomic padding set so migrated primitives have a
	// stable surface while new primitives can dispatch on role tokens.
	return [
		'\t--control-radius: var(--radius-md);',
		'\t--control-padding-x-sm: 0.5rem;',
		'\t--control-padding-y-sm: 0.375rem;',
		'\t--control-padding-x-md: 0.75rem;',
		'\t--control-padding-y-md: 0.5rem;',
		'\t--control-padding-x-lg: 1rem;',
		'\t--control-padding-y-lg: 0.625rem;',
		'\t--control-font-size-sm: var(--font-size-sm);',
		'\t--control-font-size-md: var(--font-size-base);',
		'\t--control-font-size-lg: var(--font-size-lg);',
		// Per-size control heights (package #4)
		'\t--button-height-sm: 1.75rem;',
		'\t--button-height-md: 2.25rem;',
		'\t--button-height-lg: 2.75rem;',
		'\t--input-height-sm: 1.75rem;',
		'\t--input-height-md: 2.25rem;',
		'\t--input-height-lg: 2.75rem;',
		'\t--badge-height-sm: 1rem;',
		'\t--badge-height-md: 1.25rem;',
		'\t--badge-height-lg: 1.5rem;',
		// Underline-offset scale for primitives that need sub-px decorative offsets.
		'\t--underline-offset-2xs: 2px;',
		// Dialog component tokens
		'\t--dialog-bg: var(--surface-panel);',
		'\t--dialog-edge: var(--edge-default);',
		'\t--dialog-radius: var(--radius-lg);',
		'\t--dialog-shadow: var(--shadow-lg);',
		'\t--dialog-scrim: var(--overlay-scrim);',
		// Table component tokens
		'\t--table-header-bg: var(--surface-muted);',
		'\t--table-header-ink: var(--ink-strong);',
		'\t--table-row-edge: var(--edge-subtle);',
		'\t--table-row-bg-hover: var(--surface-muted);',
		'\t--table-row-bg-selected: var(--action-default-wash);',
	];
}

function controlTokensBlock(control: ControlTokens): string[] {
	const lines: string[] = [];
	const push = (name: string, value: string) => lines.push(`\t${name}: ${value};`);
	for (const variant of BUTTON_VARIANTS) {
		const s = control.button[variant];
		push(`--button-${variant}-bg`, s.bg);
		push(`--button-${variant}-ink`, s.ink);
		push(`--button-${variant}-border`, s.border);
		push(`--button-${variant}-hover-bg`, s.hoverBg);
		push(`--button-${variant}-hover-ink`, s.hoverInk);
		push(`--button-${variant}-active-bg`, s.activeBg);
		push(`--button-${variant}-disabled-bg`, s.disabledBg);
		push(`--button-${variant}-disabled-ink`, s.disabledInk);
		push(`--button-${variant}-ring`, s.ring);
	}
	for (const variant of INPUT_VARIANTS) {
		const s = control.input[variant];
		push(`--input-${variant}-bg`, s.bg);
		push(`--input-${variant}-ink`, s.ink);
		push(`--input-${variant}-border`, s.border);
		push(`--input-${variant}-hover-bg`, s.hoverBg);
		push(`--input-${variant}-hover-ink`, s.hoverInk);
		push(`--input-${variant}-active-bg`, s.activeBg);
		push(`--input-${variant}-disabled-bg`, s.disabledBg);
		push(`--input-${variant}-disabled-ink`, s.disabledInk);
		push(`--input-${variant}-ring`, s.ring);
	}
	return lines;
}

function simBlock(sim: SimTokens): string[] {
	const lines: string[] = [];
	const push = (name: string, value: string) => lines.push(`\t${name}: ${value};`);
	// panel
	push('--sim-panel-bg', sim.panel.bg);
	push('--sim-panel-bg-darker', sim.panel.bgDarker);
	push('--sim-panel-bg-elevated', sim.panel.bgElevated);
	push('--sim-panel-border', sim.panel.border);
	push('--sim-panel-fg', sim.panel.fg);
	push('--sim-panel-fg-dim', sim.panel.fgDim);
	push('--sim-panel-fg-faint', sim.panel.fgFaint);
	push('--sim-panel-fg-light', sim.panel.fgLight);
	push('--sim-panel-fg-lighter', sim.panel.fgLighter);
	push('--sim-panel-fg-lightest', sim.panel.fgLightest);
	push('--sim-panel-fg-muted', sim.panel.fgMuted);
	push('--sim-panel-fg-note', sim.panel.fgNote);
	push('--sim-panel-fg-subtle', sim.panel.fgSubtle);
	// instrument
	push('--sim-instrument-bezel', sim.instrument.bezel);
	push('--sim-instrument-bezel-outer', sim.instrument.bezelOuter);
	push('--sim-instrument-face', sim.instrument.face);
	push('--sim-instrument-face-inner', sim.instrument.faceInner);
	push('--sim-instrument-pointer', sim.instrument.pointer);
	push('--sim-instrument-pointer-pivot', sim.instrument.pointerPivot);
	push('--sim-instrument-tick', sim.instrument.tick);
	push('--sim-instrument-tick-dim', sim.instrument.tickDim);
	push('--sim-instrument-tick-faint', sim.instrument.tickFaint);
	push('--sim-instrument-tick-minor', sim.instrument.tickMinor);
	push('--sim-instrument-tick-subtle', sim.instrument.tickSubtle);
	// horizon
	push('--sim-horizon-ground', sim.horizon.ground);
	push('--sim-horizon-sky', sim.horizon.sky);
	// arc
	push('--sim-arc-green', sim.arc.green);
	push('--sim-arc-red', sim.arc.red);
	push('--sim-arc-white', sim.arc.white);
	push('--sim-arc-yellow', sim.arc.yellow);
	// status
	push('--sim-status-danger', sim.status.danger);
	push('--sim-status-danger-bg', sim.status.dangerBg);
	push('--sim-status-danger-border', sim.status.dangerBorder);
	push('--sim-status-danger-fg', sim.status.dangerFg);
	push('--sim-status-danger-strong', sim.status.dangerStrong);
	push('--sim-status-primary', sim.status.primary);
	push('--sim-status-primary-fg', sim.status.primaryFg);
	push('--sim-status-primary-hover', sim.status.primaryHover);
	push('--sim-status-success', sim.status.success);
	push('--sim-status-success-bg', sim.status.successBg);
	push('--sim-status-success-border', sim.status.successBorder);
	push('--sim-status-success-fg', sim.status.successFg);
	push('--sim-status-warning', sim.status.warning);
	push('--sim-status-warning-bg', sim.status.warningBg);
	push('--sim-status-warning-border', sim.status.warningBorder);
	// banner
	push('--sim-banner-info-bg', sim.banner.infoBg);
	push('--sim-banner-info-border', sim.banner.infoBorder);
	push('--sim-banner-info-fg', sim.banner.infoFg);
	push('--sim-banner-success-bg', sim.banner.successBg);
	push('--sim-banner-success-border', sim.banner.successBorder);
	// readout + muted
	push('--sim-readout-warning-bg', sim.readout.warningBg);
	push('--sim-muted-state-bg', sim.muted.stateBg);
	return lines;
}

function chromeBlock(chrome: Chrome): string[] {
	const lines: string[] = [];
	const push = (name: string, value: string) => lines.push(`\t${name}: ${value};`);

	for (const [key, value] of Object.entries(chrome.space)) push(`--space-${key}`, value);
	for (const [key, value] of Object.entries(chrome.radius)) push(`--radius-${key}`, value);
	for (const [key, value] of Object.entries(chrome.shadow)) push(`--shadow-${key}`, value);
	for (const [key, value] of Object.entries(chrome.motion)) push(`--motion-${key}`, value);

	push('--layout-container-max', chrome.layout.containerMax);
	push('--layout-container-padding', chrome.layout.containerPadding);
	push('--layout-grid-gap', chrome.layout.gridGap);
	push('--layout-panel-padding', chrome.layout.panelPadding);
	push('--layout-panel-gap', chrome.layout.panelGap);
	push('--layout-panel-header-size', chrome.layout.panelHeaderSize);
	push('--layout-panel-header-weight', chrome.layout.panelHeaderWeight);
	push('--layout-panel-header-transform', chrome.layout.panelHeaderTransform);
	push('--layout-panel-header-tracking', chrome.layout.panelHeaderTracking);
	push('--layout-panel-header-family', chrome.layout.panelHeaderFamily);
	return lines;
}

/**
 * Emit a single `[data-theme][data-appearance]` block.
 */
export function themeToCss(theme: Theme, appearance: AppearanceMode): string {
	const resolved = resolveTheme(theme);
	const palette = resolved.palette[appearance];
	if (!palette) {
		throw new Error(`Theme ${theme.id} has no palette for appearance ${appearance}`);
	}
	const isDark = appearance === 'dark';
	const lines = [
		...paletteBlock(palette, isDark),
		...typographyBlock(resolved.typography),
		...chromeBlock(resolved.chrome),
		...controlsAtomicBlock(),
		...controlTokensBlock(resolved.control),
		...(resolved.sim ? simBlock(resolved.sim) : []),
	];
	const selector = `[data-theme="${theme.id}"][data-appearance="${appearance}"]`;
	return `${selector} {\n${lines.join('\n')}\n}\n`;
}

/**
 * Emit a `:root` fallback block with Layer-0 scale defaults. Elements
 * outside a `[data-theme]` ancestor (notably `<body>` before hydration)
 * resolve tokens against these defaults.
 */
function rootFallbackBlock(): string {
	const theme = listThemes().find((t) => t.id === 'airboss/default');
	if (!theme) return '';
	return themeToCss(theme, 'light').replace(`[data-theme="${theme.id}"][data-appearance="light"]`, ':root');
}

/**
 * Reduced-motion override -- shared across every theme.
 */
const REDUCED_MOTION_BLOCK = `@media (prefers-reduced-motion: reduce) {\n\t:root, [data-theme] {\n\t\t--motion-fast: 0ms;\n\t\t--motion-normal: 0ms;\n\t\t--motion-slow: 0ms;\n\t}\n}\n`;

/**
 * Render the full tokens.css output. Deterministic: for a given
 * registry state, output is byte-identical across runs.
 */
export function emitAllThemes(): string {
	const themes = listThemes()
		.slice()
		.sort((a, b) => a.id.localeCompare(b.id));
	const banner =
		'/*\n * Generated by libs/themes/emit.ts. Do not edit by hand.\n *\n' +
		' * Run `bun run themes:emit` after changing any theme .ts file.\n' +
		' * The pre-commit / CI check will flag a stale generated CSS.\n */\n';
	const root = rootFallbackBlock();
	const blocks: string[] = [];
	for (const theme of themes) {
		for (const appearance of theme.appearances) {
			blocks.push(themeToCss(theme, appearance));
		}
	}
	return `${banner}\n${root}\n${blocks.join('\n')}\n${REDUCED_MOTION_BLOCK}`;
}
