/**
 * Legacy `--ab-*` → role-token alias map.
 *
 * Package #1 migrates the 12 primitives in `libs/ui/src/components`
 * off the legacy names, but `apps/study/src/**` still ships thousands
 * of references to the old tokens. Until package #5 sweeps the app,
 * this alias block re-emits every legacy token name as a
 * `var(--role-token)` reference so unmigrated call sites keep
 * rendering pixel-identical.
 *
 * Scope: every `--ab-*` name currently used in `apps/study/src` or
 * `libs/ui/src` (confirmed via `rg -oNI '\-\-ab-[a-z0-9-]+'`). Items
 * that have no direct role-token equivalent (legacy half-steps like
 * `--ab-space-sm-alt`, `--ab-radius-hair`) fall back to the closest
 * canonical rung so the layout stays stable.
 */

/** `[legacyName, valueExpression]` in deterministic insertion order. */
export const LEGACY_ALIAS_MAP: ReadonlyArray<readonly [string, string]> = [
	// -------- color (fg / surface / border) --------
	['--ab-color-fg', 'var(--ink-body)'],
	['--ab-color-fg-muted', 'var(--ink-muted)'],
	['--ab-color-fg-subtle', 'var(--ink-subtle)'],
	['--ab-color-fg-faint', 'var(--ink-faint)'],
	['--ab-color-fg-strong', 'var(--ink-strong)'],
	['--ab-color-fg-inverse', 'var(--ink-inverse)'],
	['--ab-color-fg-on-primary', 'var(--action-default-ink)'],

	['--ab-color-bg', 'var(--surface-page)'],
	['--ab-color-surface', 'var(--surface-panel)'],
	['--ab-color-surface-raised', 'var(--surface-raised)'],
	['--ab-color-surface-sunken', 'var(--surface-sunken)'],
	['--ab-color-surface-muted', 'var(--surface-muted)'],

	['--ab-color-border', 'var(--edge-default)'],
	['--ab-color-border-strong', 'var(--edge-strong)'],
	['--ab-color-border-subtle', 'var(--edge-subtle)'],

	// -------- color: primary → action-default --------
	['--ab-color-primary', 'var(--action-default)'],
	['--ab-color-primary-hover', 'var(--action-default-hover)'],
	['--ab-color-primary-active', 'var(--action-default-active)'],
	['--ab-color-primary-subtle', 'var(--action-default-wash)'],
	['--ab-color-primary-subtle-border', 'var(--action-default-edge)'],
	['--ab-color-primary-fg', 'var(--action-default-ink)'],

	// -------- color: danger → action-hazard (interactive) --------
	['--ab-color-danger', 'var(--action-hazard)'],
	['--ab-color-danger-hover', 'var(--action-hazard-hover)'],
	['--ab-color-danger-active', 'var(--action-hazard-active)'],
	['--ab-color-danger-subtle', 'var(--action-hazard-wash)'],
	['--ab-color-danger-subtle-border', 'var(--action-hazard-edge)'],
	['--ab-color-danger-fg', 'var(--action-hazard-ink)'],

	// -------- color: success → signal --------
	['--ab-color-success', 'var(--signal-success)'],
	['--ab-color-success-hover', 'var(--signal-success)'],
	['--ab-color-success-active', 'var(--signal-success)'],
	['--ab-color-success-subtle', 'var(--signal-success-wash)'],
	['--ab-color-success-subtle-border', 'var(--signal-success-edge)'],
	['--ab-color-success-fg', 'var(--signal-success-ink)'],

	// -------- color: warning → signal-warning --------
	['--ab-color-warning', 'var(--signal-warning)'],
	['--ab-color-warning-hover', 'var(--signal-warning)'],
	['--ab-color-warning-active', 'var(--signal-warning)'],
	['--ab-color-warning-subtle', 'var(--signal-warning-wash)'],
	['--ab-color-warning-subtle-border', 'var(--signal-warning-edge)'],
	['--ab-color-warning-fg', 'var(--signal-warning-ink)'],

	// -------- color: info → signal-info --------
	['--ab-color-info', 'var(--signal-info)'],
	['--ab-color-info-hover', 'var(--signal-info)'],
	['--ab-color-info-active', 'var(--signal-info)'],
	['--ab-color-info-subtle', 'var(--signal-info-wash)'],
	['--ab-color-info-subtle-border', 'var(--signal-info-edge)'],
	['--ab-color-info-fg', 'var(--signal-info-ink)'],

	// -------- color: muted → action-neutral --------
	['--ab-color-muted', 'var(--action-neutral)'],
	['--ab-color-muted-hover', 'var(--action-neutral-hover)'],
	['--ab-color-muted-subtle', 'var(--action-neutral-wash)'],
	['--ab-color-muted-subtle-border', 'var(--action-neutral-edge)'],
	['--ab-color-muted-fg', 'var(--action-neutral-ink)'],

	// -------- color: accent --------
	['--ab-color-accent', 'var(--accent-code)'],
	['--ab-color-accent-hover', 'var(--accent-code)'],
	['--ab-color-accent-subtle', 'var(--action-default-wash)'],
	['--ab-color-accent-subtle-border', 'var(--action-default-edge)'],
	['--ab-color-accent-fg', 'var(--accent-code)'],

	// -------- focus --------
	['--ab-color-focus-ring', 'var(--focus-ring)'],
	['--ab-color-focus-ring-strong', 'var(--focus-ring-strong)'],
	['--ab-focus-ring', 'var(--focus-ring)'],
	['--ab-focus-ring-offset', '2px'],
	['--ab-focus-ring-width', '2px'],
	['--ab-shadow-focus-ring', 'var(--focus-ring-shadow)'],
	['--ab-shadow-success-glow', '0 0 0 3px var(--signal-success)'],

	// -------- breakpoints (documentary; kept at legacy pixel values) --------
	['--ab-breakpoint-sm', '480px'],
	['--ab-breakpoint-md', '640px'],
	['--ab-breakpoint-lg', '960px'],
	['--ab-breakpoint-xl', '1280px'],

	// -------- typography: families --------
	['--ab-font-family-sans', 'var(--font-family-sans)'],
	['--ab-font-family-mono', 'var(--font-family-mono)'],
	['--ab-font-family-base', 'var(--font-family-base)'],
	['--ab-font-mono', 'var(--font-family-mono)'],
	['--ab-font-sans', 'var(--font-family-sans)'],

	// -------- typography: sizes (atomic; bundles in #2) --------
	['--ab-font-size-xs', '0.75rem'],
	['--ab-font-size-sm', '0.875rem'],
	['--ab-font-size-body', '0.9375rem'],
	['--ab-font-size-base', '1rem'],
	['--ab-font-size-lg', '1.125rem'],
	['--ab-font-size-xl', '1.375rem'],
	['--ab-font-size-2xl', '1.75rem'],

	// -------- typography: weights --------
	['--ab-font-weight-regular', '400'],
	['--ab-font-weight-medium', '500'],
	['--ab-font-weight-semibold', '600'],
	['--ab-font-weight-bold', '700'],

	// -------- typography: line-height --------
	['--ab-line-height-tight', '1.2'],
	['--ab-line-height-normal', '1.5'],
	['--ab-line-height-relaxed', '1.65'],

	// -------- typography: letter-spacing --------
	['--ab-letter-spacing-tight', '-0.01em'],
	['--ab-letter-spacing-normal', '0'],
	['--ab-letter-spacing-wide', '0.04em'],
	['--ab-letter-spacing-caps', '0.08em'],

	// -------- spacing (core + legacy half-steps) --------
	['--ab-space-hair', '0.0625rem'],
	['--ab-space-micro', '0.1875rem'],
	['--ab-space-3xs', '0.125rem'],
	['--ab-space-2xs', 'var(--space-2xs)'],
	['--ab-space-xs', 'var(--space-xs)'],
	['--ab-space-xs-alt', '0.3125rem'],
	['--ab-space-tiny', '0.35rem'],
	['--ab-space-sm', 'var(--space-sm)'],
	['--ab-space-sm-alt', '0.625rem'],
	['--ab-space-md', 'var(--space-md)'],
	['--ab-space-md-alt', '0.875rem'],
	['--ab-space-lg', 'var(--space-lg)'],
	['--ab-space-lg-alt', '1.125rem'],
	['--ab-space-xl', 'var(--space-xl)'],
	['--ab-space-xl-alt', '1.25rem'],
	['--ab-space-xl-hi', '1.75rem'],
	['--ab-space-2xl', 'var(--space-2xl)'],
	['--ab-space-2xl-alt', '2.5rem'],
	['--ab-space-3xl', '3rem'],

	// -------- radius (core + legacy half-steps) --------
	['--ab-radius-sharp', 'var(--radius-sharp)'],
	['--ab-radius-hair', '2px'],
	['--ab-radius-xs', 'var(--radius-xs)'],
	['--ab-radius-tight', '4px'],
	['--ab-radius-sm', 'var(--radius-sm)'],
	['--ab-radius-md', 'var(--radius-md)'],
	['--ab-radius-lg', 'var(--radius-lg)'],
	['--ab-radius-xl', '12px'],
	['--ab-radius-2xl', '16px'],
	['--ab-radius-pill', 'var(--radius-pill)'],

	// -------- shadow --------
	['--ab-shadow-none', 'var(--shadow-none)'],
	['--ab-shadow-sm', 'var(--shadow-sm)'],
	['--ab-shadow-md', 'var(--shadow-md)'],
	['--ab-shadow-lg', 'var(--shadow-lg)'],

	// -------- layout --------
	['--ab-layout-container-max', 'var(--layout-container-max)'],
	['--ab-layout-container-padding', 'var(--layout-container-padding)'],
	['--ab-layout-grid-gap', 'var(--layout-grid-gap)'],
	['--ab-layout-panel-padding', 'var(--layout-panel-padding)'],
	['--ab-layout-panel-gap', 'var(--layout-panel-gap)'],
	['--ab-layout-panel-header-size', 'var(--layout-panel-header-size)'],
	['--ab-layout-panel-header-weight', 'var(--layout-panel-header-weight)'],
	['--ab-layout-panel-header-transform', 'var(--layout-panel-header-transform)'],
	['--ab-layout-panel-header-tracking', 'var(--layout-panel-header-tracking)'],
	['--ab-layout-panel-header-family', 'var(--layout-panel-header-family)'],

	// -------- transitions --------
	['--ab-transition-fast', 'var(--motion-fast)'],
	['--ab-transition-normal', 'var(--motion-normal)'],

	// -------- controls (atomic; package #4 grows component tokens) --------
	['--ab-control-radius', 'var(--radius-md)'],
	['--ab-control-padding-x-sm', '0.5rem'],
	['--ab-control-padding-y-sm', '0.375rem'],
	['--ab-control-padding-x-md', '0.75rem'],
	['--ab-control-padding-y-md', '0.5rem'],
	['--ab-control-padding-x-lg', '1rem'],
	['--ab-control-padding-y-lg', '0.625rem'],
	['--ab-control-font-size-sm', '0.875rem'],
	['--ab-control-font-size-md', '1rem'],
	['--ab-control-font-size-lg', '1.125rem'],
] as const;

/** Flat list of legacy names the alias block exposes (for audit). */
export const LEGACY_ALIAS_NAMES: readonly string[] = LEGACY_ALIAS_MAP.map(([name]) => name);
