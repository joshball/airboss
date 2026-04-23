/**
 * Emit pipeline -- TS Theme -> CSS.
 *
 * `themeToCss(theme, appearance)` produces the CSS block for a single
 * (theme, appearance) tuple. `emitAllThemes()` walks the registry and
 * concatenates every pair, prepending a `:root` block with Layer 0 scale
 * fallbacks so elements outside `[data-theme]` still resolve tokens
 * before hydration.
 *
 * Output is deterministic: key order is fixed by the catalog, numbers are
 * rounded upstream in `derive.ts`, and the joiner is a single newline.
 * Running the emitter twice over the same registry produces byte-identical
 * output. Package #3 wires a CI check that fails if the generated file
 * drifts from the committed one.
 */

import type {
	AppearanceMode,
	Chrome,
	ComponentTokens,
	DerivedPalette,
	Palette,
	Theme,
	ThemeId,
	TypographyPack,
} from './contract';
import { deriveInteractiveStates, deriveSignalVariants } from './derive';
import { getTheme, listThemes } from './registry';

// -----------------------------------------------------------------------------
// Extends-chain resolution
// -----------------------------------------------------------------------------

/** Resolve a theme down its `extends` chain, merging palette/typography/chrome. */
export function resolveTheme(theme: Theme): ResolvedTheme {
	const chain: Theme[] = [];
	let current: Theme | undefined = theme;
	const seen = new Set<ThemeId>();
	while (current) {
		if (seen.has(current.id)) {
			throw new Error(`Cycle in theme extends chain at ${current.id}`);
		}
		seen.add(current.id);
		chain.unshift(current);
		current = current.extends ? getTheme(current.extends) : undefined;
	}
	// Fold from base (first) to child (last); later overrides earlier.
	const folded = chain.reduce<Partial<ResolvedTheme>>((acc, t) => {
		return {
			id: t.id,
			name: t.name,
			description: t.description,
			appearances: t.appearances,
			defaultAppearance: t.defaultAppearance,
			layouts: { ...(acc.layouts ?? {}), ...t.layouts },
			defaultLayout: t.defaultLayout,
			palette: {
				light: mergePalette(acc.palette?.light, t.palette.light),
				dark: mergePalette(acc.palette?.dark, t.palette.dark),
			},
			typography: t.typography ?? acc.typography,
			chrome: t.chrome ?? acc.chrome,
			componentTokens: { ...(acc.componentTokens ?? {}), ...(t.componentTokens ?? {}) },
			vocabulary: { ...(acc.vocabulary ?? {}), ...(t.vocabulary ?? {}) },
		};
	}, {});
	const id = folded.id ?? theme.id;
	const palette = folded.palette ?? { light: undefined, dark: undefined };
	const typography = folded.typography;
	const chrome = folded.chrome;
	if (!typography) throw new Error(`Theme ${id} has no typography after extends resolution`);
	if (!chrome) throw new Error(`Theme ${id} has no chrome after extends resolution`);
	return {
		id,
		name: folded.name ?? theme.name,
		description: folded.description ?? theme.description,
		appearances: folded.appearances ?? theme.appearances,
		defaultAppearance: folded.defaultAppearance ?? theme.defaultAppearance,
		layouts: folded.layouts ?? {},
		defaultLayout: folded.defaultLayout ?? theme.defaultLayout,
		palette,
		typography,
		chrome,
		componentTokens: folded.componentTokens ?? {},
		vocabulary: folded.vocabulary ?? {},
	};
}

function mergePalette(base: Palette | undefined, child: Palette | undefined): Palette | undefined {
	if (!base) return child;
	if (!child) return base;
	return {
		ink: { ...base.ink, ...child.ink },
		surface: { ...base.surface, ...child.surface },
		edge: { ...base.edge, ...child.edge },
		action: { ...base.action, ...child.action },
		signal: { ...base.signal, ...child.signal },
		focus: child.focus ?? base.focus,
		accent: { ...base.accent, ...child.accent },
		overlay: { ...(base.overlay ?? {}), ...(child.overlay ?? {}) },
		selection: { ...(base.selection ?? {}), ...(child.selection ?? {}) },
		disabled: { ...(base.disabled ?? {}), ...(child.disabled ?? {}) },
		link: { ...(base.link ?? {}), ...(child.link ?? {}) },
		overrides: deepMerge(base.overrides ?? {}, child.overrides ?? {}),
	};
}

function deepMerge<T>(base: T, child: T): T {
	if (typeof base !== 'object' || base === null) return child ?? base;
	if (typeof child !== 'object' || child === null) return child ?? base;
	const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [k, v] of Object.entries(child as Record<string, unknown>)) {
		const existing = out[k];
		if (v !== undefined && typeof v === 'object' && v !== null && typeof existing === 'object' && existing !== null) {
			out[k] = deepMerge(existing, v);
		} else if (v !== undefined) {
			out[k] = v;
		}
	}
	return out as T;
}

export interface ResolvedTheme {
	id: ThemeId;
	name: string;
	description: string;
	appearances: readonly AppearanceMode[];
	defaultAppearance: AppearanceMode;
	layouts: Record<string, string>;
	defaultLayout: string;
	palette: { light?: Palette; dark?: Palette };
	typography: TypographyPack;
	chrome: Chrome;
	componentTokens: Partial<ComponentTokens>;
	vocabulary: Record<string, string>;
}

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

/** Run derivation math over a declared palette to produce the full variant set. */
export function applyDerivations(palette: Palette, appearance: AppearanceMode): DerivedPalette {
	const isDark = appearance === 'dark';
	const action = {
		default: deriveInteractiveStates(palette.action.default, isDark),
		hazard: deriveInteractiveStates(palette.action.hazard, isDark),
		caution: deriveInteractiveStates(palette.action.caution, isDark),
		neutral: deriveInteractiveStates(palette.action.neutral, isDark),
		link: deriveInteractiveStates(palette.action.link, isDark),
	};
	const signal = {
		success: deriveSignalVariants(palette.signal.success, isDark),
		warning: deriveSignalVariants(palette.signal.warning, isDark),
		danger: deriveSignalVariants(palette.signal.danger, isDark),
		info: deriveSignalVariants(palette.signal.info, isDark),
	};
	const derived: DerivedPalette = {
		ink: { ...palette.ink },
		surface: { ...palette.surface },
		edge: { ...palette.edge, focus: palette.focus },
		action,
		signal,
		focus: {
			ring: palette.focus,
			ringStrong: palette.focus,
			ringShadow: `0 0 0 3px ${palette.focus}`,
		},
		accent: { ...palette.accent },
		overlay: {
			scrim: palette.overlay?.scrim ?? `oklch(0 0 0 / ${isDark ? 0.6 : 0.5})`,
			tooltipBg: palette.overlay?.tooltipBg ?? palette.ink.body,
			tooltipInk: palette.overlay?.tooltipInk ?? palette.ink.inverse,
		},
		selection: {
			bg: palette.selection?.bg ?? action.default.wash,
			ink: palette.selection?.ink ?? palette.ink.body,
		},
		disabled: {
			surface: palette.disabled?.surface ?? palette.surface.muted,
			ink: palette.disabled?.ink ?? palette.ink.faint,
			edge: palette.disabled?.edge ?? palette.edge.subtle,
		},
		link: {
			default: palette.link?.default ?? palette.action.link,
			hover: palette.link?.hover ?? action.link.hover,
			visited: palette.link?.visited ?? palette.action.link,
		},
	};
	// Apply explicit overrides on top (last-write-wins per leaf).
	if (palette.overrides) applyOverrides(derived, palette.overrides);
	return derived;
}

function applyOverrides(target: DerivedPalette, overrides: Record<string, unknown>): void {
	const t = target as unknown as Record<string, unknown>;
	for (const [k, v] of Object.entries(overrides)) {
		if (v === undefined) continue;
		if (typeof v === 'object' && v !== null) {
			const existing = t[k];
			if (typeof existing === 'object' && existing !== null) {
				applyOverrides(existing as DerivedPalette, v as Record<string, unknown>);
				continue;
			}
		}
		t[k] = v;
	}
}

// -----------------------------------------------------------------------------
// Block generators
// -----------------------------------------------------------------------------

function line(name: string, value: string | number): string {
	return `\t${name}: ${value};`;
}

function rolesBlock(p: DerivedPalette): string {
	return [
		line('--ink-body', p.ink.body),
		line('--ink-muted', p.ink.muted),
		line('--ink-subtle', p.ink.subtle),
		line('--ink-faint', p.ink.faint),
		line('--ink-strong', p.ink.strong),
		line('--ink-inverse', p.ink.inverse),

		line('--surface-page', p.surface.page),
		line('--surface-panel', p.surface.panel),
		line('--surface-raised', p.surface.raised),
		line('--surface-sunken', p.surface.sunken),
		line('--surface-muted', p.surface.muted),
		line('--surface-overlay', p.surface.overlay),

		line('--edge-default', p.edge.default),
		line('--edge-strong', p.edge.strong),
		line('--edge-subtle', p.edge.subtle),
		line('--edge-focus', p.edge.focus),

		...actionBlock('default', p.action.default),
		...actionBlock('hazard', p.action.hazard),
		...actionBlock('caution', p.action.caution),
		...actionBlock('neutral', p.action.neutral),
		...actionBlock('link', p.action.link),

		...signalBlock('success', p.signal.success),
		...signalBlock('warning', p.signal.warning),
		...signalBlock('danger', p.signal.danger),
		...signalBlock('info', p.signal.info),

		line('--focus-ring', p.focus.ring),
		line('--focus-ring-strong', p.focus.ringStrong),
		line('--focus-ring-shadow', p.focus.ringShadow),

		line('--accent-code', p.accent.code),
		line('--accent-reference', p.accent.reference),
		line('--accent-definition', p.accent.definition),

		line('--overlay-scrim', p.overlay.scrim),
		line('--overlay-tooltip-bg', p.overlay.tooltipBg),
		line('--overlay-tooltip-ink', p.overlay.tooltipInk),

		line('--selection-bg', p.selection.bg),
		line('--selection-ink', p.selection.ink),

		line('--disabled-surface', p.disabled.surface),
		line('--disabled-ink', p.disabled.ink),
		line('--disabled-edge', p.disabled.edge),

		line('--link-default', p.link.default),
		line('--link-hover', p.link.hover),
		line('--link-visited', p.link.visited),
	].join('\n');
}

function actionBlock(
	role: 'default' | 'hazard' | 'caution' | 'neutral' | 'link',
	states: DerivedPalette['action']['default'],
): string[] {
	return [
		line(`--action-${role}`, states.base),
		line(`--action-${role}-hover`, states.hover),
		line(`--action-${role}-active`, states.active),
		line(`--action-${role}-wash`, states.wash),
		line(`--action-${role}-edge`, states.edge),
		line(`--action-${role}-ink`, states.ink),
		line(`--action-${role}-disabled`, states.disabled),
	];
}

function signalBlock(
	role: 'success' | 'warning' | 'danger' | 'info',
	states: DerivedPalette['signal']['success'],
): string[] {
	return [
		line(`--signal-${role}`, states.solid),
		line(`--signal-${role}-wash`, states.wash),
		line(`--signal-${role}-edge`, states.edge),
		line(`--signal-${role}-ink`, states.ink),
	];
}

function typographyBlock(t: TypographyPack): string {
	return [
		line('--font-family-sans', t.families.sans),
		line('--font-family-mono', t.families.mono),
		line('--font-family-base', t.families.base),
		line('--font-size-xs', t.sizes.xs),
		line('--font-size-sm', t.sizes.sm),
		line('--font-size-body', t.sizes.body),
		line('--font-size-base', t.sizes.base),
		line('--font-size-lg', t.sizes.lg),
		line('--font-size-xl', t.sizes.xl),
		line('--font-size-2xl', t.sizes['2xl']),
		line('--font-weight-regular', t.weights.regular),
		line('--font-weight-medium', t.weights.medium),
		line('--font-weight-semibold', t.weights.semibold),
		line('--font-weight-bold', t.weights.bold),
		line('--line-height-tight', t.lineHeights.tight),
		line('--line-height-normal', t.lineHeights.normal),
		line('--line-height-relaxed', t.lineHeights.relaxed),
		line('--letter-spacing-tight', t.letterSpacings.tight),
		line('--letter-spacing-normal', t.letterSpacings.normal),
		line('--letter-spacing-wide', t.letterSpacings.wide),
		line('--letter-spacing-caps', t.letterSpacings.caps),
	].join('\n');
}

function chromeBlock(c: Chrome): string {
	return [
		line('--space-2xs', c.space['2xs']),
		line('--space-xs', c.space.xs),
		line('--space-sm', c.space.sm),
		line('--space-md', c.space.md),
		line('--space-lg', c.space.lg),
		line('--space-xl', c.space.xl),
		line('--space-2xl', c.space['2xl']),

		line('--radius-sharp', c.radii.sharp),
		line('--radius-xs', c.radii.xs),
		line('--radius-sm', c.radii.sm),
		line('--radius-md', c.radii.md),
		line('--radius-lg', c.radii.lg),
		line('--radius-pill', c.radii.pill),

		line('--shadow-none', c.shadows.none),
		line('--shadow-sm', c.shadows.sm),
		line('--shadow-md', c.shadows.md),
		line('--shadow-lg', c.shadows.lg),

		line('--motion-fast', c.motion.fast),
		line('--motion-normal', c.motion.normal),

		line('--z-base', c.zIndex.base),
		line('--z-dropdown', c.zIndex.dropdown),
		line('--z-sticky', c.zIndex.sticky),
		line('--z-overlay', c.zIndex.overlay),
		line('--z-modal', c.zIndex.modal),
		line('--z-toast', c.zIndex.toast),
		line('--z-tooltip', c.zIndex.tooltip),

		line('--breakpoint-sm', c.breakpoints.sm),
		line('--breakpoint-md', c.breakpoints.md),
		line('--breakpoint-lg', c.breakpoints.lg),
		line('--breakpoint-xl', c.breakpoints.xl),
	].join('\n');
}

function layoutBlock(c: Chrome): string {
	return [
		line('--layout-container-max', c.layout.containerMax),
		line('--layout-container-padding', c.layout.containerPadding),
		line('--layout-grid-gap', c.layout.gridGap),
		line('--layout-panel-padding', c.layout.panelPadding),
		line('--layout-panel-gap', c.layout.panelGap),
		line('--layout-panel-header-size', c.layout.panelHeaderSize),
		line('--layout-panel-header-weight', c.layout.panelHeaderWeight),
		line('--layout-panel-header-transform', c.layout.panelHeaderTransform),
		line('--layout-panel-header-tracking', c.layout.panelHeaderTracking),
		line('--layout-panel-header-family', c.layout.panelHeaderFamily),
	].join('\n');
}

function componentTokensBlock(ct: Partial<ComponentTokens>): string {
	const out: string[] = [];
	// Sort components and keys so output is deterministic even if a theme
	// adds an override in an arbitrary iteration order.
	const sortedComps = Object.keys(ct).sort() as (keyof ComponentTokens)[];
	for (const comp of sortedComps) {
		const entries = ct[comp];
		if (!entries) continue;
		const sortedKeys = Object.keys(entries).sort();
		for (const k of sortedKeys) {
			// Keys are already CSS custom-property names, per the vocabulary.
			out.push(line(k, entries[k] ?? ''));
		}
	}
	return out.join('\n');
}

// -----------------------------------------------------------------------------
// Legacy aliases (transition layer)
// -----------------------------------------------------------------------------

/**
 * During packages #1..#5, pages and sim surfaces still reference `--ab-*`
 * tokens. Emitting aliases here keeps those surfaces rendering unchanged
 * while primitives migrate to role names. Package #5 removes every call
 * site, then Package #5 (final commit) deletes these aliases.
 *
 * The alias list is intentionally a subset -- only the tokens legacy pages
 * read today. Do not expand it for new work.
 */
function legacyAliasBlock(p: DerivedPalette, t: TypographyPack, c: Chrome): string {
	return [
		// fg / bg
		line('--ab-color-fg', p.ink.body),
		line('--ab-color-fg-muted', p.ink.muted),
		line('--ab-color-fg-subtle', p.ink.subtle),
		line('--ab-color-fg-faint', p.ink.faint),
		line('--ab-color-fg-strong', p.ink.strong),
		line('--ab-color-fg-inverse', p.ink.inverse),
		line('--ab-color-bg', p.surface.page),
		line('--ab-color-surface', p.surface.panel),
		line('--ab-color-surface-raised', p.surface.raised),
		line('--ab-color-surface-sunken', p.surface.sunken),
		line('--ab-color-surface-muted', p.surface.muted),
		line('--ab-color-border', p.edge.default),
		line('--ab-color-border-strong', p.edge.strong),
		line('--ab-color-border-subtle', p.edge.subtle),

		// primary
		line('--ab-color-primary', p.action.default.base),
		line('--ab-color-primary-hover', p.action.default.hover),
		line('--ab-color-primary-active', p.action.default.active),
		line('--ab-color-primary-subtle', p.action.default.wash),
		line('--ab-color-primary-subtle-border', p.action.default.edge),
		line('--ab-color-primary-fg', p.action.default.ink),

		// danger
		line('--ab-color-danger', p.action.hazard.base),
		line('--ab-color-danger-hover', p.action.hazard.hover),
		line('--ab-color-danger-active', p.action.hazard.active),
		line('--ab-color-danger-subtle', p.action.hazard.wash),
		line('--ab-color-danger-subtle-border', p.action.hazard.edge),
		line('--ab-color-danger-fg', p.action.hazard.ink),

		// success
		line('--ab-color-success', p.signal.success.solid),
		line('--ab-color-success-hover', p.action.default.hover),
		line('--ab-color-success-active', p.action.default.active),
		line('--ab-color-success-subtle', p.signal.success.wash),
		line('--ab-color-success-subtle-border', p.signal.success.edge),
		line('--ab-color-success-fg', p.signal.success.ink),

		// warning
		line('--ab-color-warning', p.signal.warning.solid),
		line('--ab-color-warning-hover', p.action.caution.hover),
		line('--ab-color-warning-active', p.action.caution.active),
		line('--ab-color-warning-subtle', p.signal.warning.wash),
		line('--ab-color-warning-subtle-border', p.signal.warning.edge),
		line('--ab-color-warning-fg', p.signal.warning.ink),

		// info
		line('--ab-color-info', p.signal.info.solid),
		line('--ab-color-info-hover', p.action.default.hover),
		line('--ab-color-info-active', p.action.default.active),
		line('--ab-color-info-subtle', p.signal.info.wash),
		line('--ab-color-info-subtle-border', p.signal.info.edge),
		line('--ab-color-info-fg', p.signal.info.ink),

		// muted
		line('--ab-color-muted', p.action.neutral.base),
		line('--ab-color-muted-hover', p.action.neutral.hover),
		line('--ab-color-muted-subtle', p.action.neutral.wash),
		line('--ab-color-muted-subtle-border', p.action.neutral.edge),
		line('--ab-color-muted-fg', p.action.neutral.ink),

		// accent (keep flat -- accent is not an interactive role)
		line('--ab-color-accent', p.accent.code),
		line('--ab-color-accent-hover', p.accent.code),
		line('--ab-color-accent-subtle', p.action.default.wash),
		line('--ab-color-accent-subtle-border', p.action.default.edge),
		line('--ab-color-accent-fg', p.accent.code),

		// focus
		line('--ab-color-focus-ring', p.focus.ring),
		line('--ab-color-focus-ring-strong', p.focus.ringStrong),
		line('--ab-focus-ring', p.focus.ring),
		line('--ab-focus-ring-offset', '2px'),
		line('--ab-focus-ring-width', '2px'),
		line('--ab-shadow-focus-ring', p.focus.ringShadow),
		line('--ab-shadow-success-glow', `0 0 0 3px ${p.signal.success.solid}`),

		// typography
		line('--ab-font-family-sans', t.families.sans),
		line('--ab-font-family-mono', t.families.mono),
		line('--ab-font-family-base', t.families.base),
		line('--ab-font-size-xs', t.sizes.xs),
		line('--ab-font-size-sm', t.sizes.sm),
		line('--ab-font-size-body', t.sizes.body),
		line('--ab-font-size-base', t.sizes.base),
		line('--ab-font-size-lg', t.sizes.lg),
		line('--ab-font-size-xl', t.sizes.xl),
		line('--ab-font-size-2xl', t.sizes['2xl']),
		line('--ab-font-weight-regular', t.weights.regular),
		line('--ab-font-weight-medium', t.weights.medium),
		line('--ab-font-weight-semibold', t.weights.semibold),
		line('--ab-font-weight-bold', t.weights.bold),
		line('--ab-line-height-tight', t.lineHeights.tight),
		line('--ab-line-height-normal', t.lineHeights.normal),
		line('--ab-line-height-relaxed', t.lineHeights.relaxed),
		line('--ab-letter-spacing-tight', t.letterSpacings.tight),
		line('--ab-letter-spacing-normal', t.letterSpacings.normal),
		line('--ab-letter-spacing-wide', t.letterSpacings.wide),
		line('--ab-letter-spacing-caps', t.letterSpacings.caps),

		// spacing / radius / shadow / layout / motion
		line('--ab-space-2xs', c.space['2xs']),
		line('--ab-space-xs', c.space.xs),
		line('--ab-space-sm', c.space.sm),
		line('--ab-space-md', c.space.md),
		line('--ab-space-lg', c.space.lg),
		line('--ab-space-xl', c.space.xl),
		line('--ab-space-2xl', c.space['2xl']),
		line('--ab-radius-sharp', c.radii.sharp),
		line('--ab-radius-xs', c.radii.xs),
		line('--ab-radius-sm', c.radii.sm),
		line('--ab-radius-md', c.radii.md),
		line('--ab-radius-lg', c.radii.lg),
		line('--ab-radius-pill', c.radii.pill),
		line('--ab-shadow-none', c.shadows.none),
		line('--ab-shadow-sm', c.shadows.sm),
		line('--ab-shadow-md', c.shadows.md),
		line('--ab-shadow-lg', c.shadows.lg),
		line('--ab-transition-fast', c.motion.fast),
		line('--ab-transition-normal', c.motion.normal),
		line('--ab-breakpoint-sm', c.breakpoints.sm),
		line('--ab-breakpoint-md', c.breakpoints.md),
		line('--ab-breakpoint-lg', c.breakpoints.lg),
		line('--ab-breakpoint-xl', c.breakpoints.xl),
		line('--ab-layout-container-max', c.layout.containerMax),
		line('--ab-layout-container-padding', c.layout.containerPadding),
		line('--ab-layout-grid-gap', c.layout.gridGap),
		line('--ab-layout-panel-padding', c.layout.panelPadding),
		line('--ab-layout-panel-gap', c.layout.panelGap),
		line('--ab-layout-panel-header-size', c.layout.panelHeaderSize),
		line('--ab-layout-panel-header-weight', c.layout.panelHeaderWeight),
		line('--ab-layout-panel-header-transform', c.layout.panelHeaderTransform),
		line('--ab-layout-panel-header-tracking', c.layout.panelHeaderTracking),
		line('--ab-layout-panel-header-family', c.layout.panelHeaderFamily),

		// legacy control-* tokens still referenced by primitives that package
		// #4 will retire. Map to role defaults that match current behavior.
		line('--ab-control-radius', c.radii.md),
		line('--ab-control-padding-x-sm', c.space.sm),
		line('--ab-control-padding-y-sm', c.space.xs),
		line('--ab-control-padding-x-md', c.space.md),
		line('--ab-control-padding-y-md', c.space.sm),
		line('--ab-control-padding-x-lg', c.space.lg),
		line('--ab-control-padding-y-lg', c.space.sm),
		line('--ab-control-font-size-sm', t.sizes.sm),
		line('--ab-control-font-size-md', t.sizes.base),
		line('--ab-control-font-size-lg', t.sizes.lg),
	].join('\n');
}

// -----------------------------------------------------------------------------
// CSS generation
// -----------------------------------------------------------------------------

/** Emit the CSS block for a single (theme, appearance) pair. */
export function themeToCss(theme: Theme, appearance: AppearanceMode): string {
	const resolved = resolveTheme(theme);
	const paletteDecl = resolved.palette[appearance];
	if (!paletteDecl) {
		throw new Error(`Theme ${theme.id} does not declare a ${appearance} palette`);
	}
	const palette = applyDerivations(paletteDecl, appearance);
	const blocks = [
		rolesBlock(palette),
		typographyBlock(resolved.typography),
		chromeBlock(resolved.chrome),
		layoutBlock(resolved.chrome),
		componentTokensBlock(resolved.componentTokens),
		legacyAliasBlock(palette, resolved.typography, resolved.chrome),
	].filter((b) => b.length > 0);
	const selector = `[data-theme="${theme.id}"][data-appearance="${appearance}"]`;
	return `${selector} {\n${blocks.join('\n')}\n}`;
}

/**
 * Emit every registered theme x appearance plus a `:root` fallback block
 * carrying the default theme's light-appearance tokens. `:root` ensures
 * that any element outside a `[data-theme][data-appearance]` wrapper
 * (notably `<body>` before hydration, error pages, print stylesheets)
 * still resolves every token.
 */
export function emitAllThemes(): string {
	const themes = listThemes();
	if (themes.length === 0) return '';
	const blocks: string[] = [];
	// :root fallback: pick the first theme marked as the base (no extends)
	// with a light palette. Fall back to the first theme with a light palette.
	const base = themes.find((t) => !t.extends && t.palette.light) ?? themes.find((t) => t.palette.light);
	if (base) {
		const resolved = resolveTheme(base);
		const lightPalette = resolved.palette.light;
		if (lightPalette) {
			const palette = applyDerivations(lightPalette, 'light');
			const fallback = [
				rolesBlock(palette),
				typographyBlock(resolved.typography),
				chromeBlock(resolved.chrome),
				layoutBlock(resolved.chrome),
				componentTokensBlock(resolved.componentTokens),
				legacyAliasBlock(palette, resolved.typography, resolved.chrome),
			]
				.filter((b) => b.length > 0)
				.join('\n');
			blocks.push(`:root {\n${fallback}\n}`);
		}
	}
	// Per-theme, per-appearance blocks. Sort for deterministic output.
	const sorted = [...themes].sort((a, b) => a.id.localeCompare(b.id));
	for (const theme of sorted) {
		for (const appearance of ['light', 'dark'] as const) {
			if (!theme.palette[appearance]) continue;
			if (!theme.appearances.includes(appearance)) continue;
			blocks.push(themeToCss(theme, appearance));
		}
	}
	return `${blocks.join('\n\n')}\n`;
}
