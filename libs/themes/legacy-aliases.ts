/**
 * Legacy `--ab-*` → role-token alias map.
 *
 * Package #1 migrated the 12 `libs/ui/src/components` primitives off
 * the legacy names. Package #5 migrated every `apps/study/src/**` call
 * site. The alias block now ships only the names still referenced by
 * `apps/sim/src/**` and `apps/hangar/src/**` (confirmed via
 * `rg -oNI '\-\-ab-[a-z0-9-]+'`). The `--ab-sim-*` entries are TODO
 * sentinels owned by package #7 and will flip from `initial` to real
 * values once `theme.sim` is populated. The remaining surface stays
 * here until package #7 sweeps sim and a future pass sweeps hangar.
 */

/** `[legacyName, valueExpression]` in deterministic insertion order. */
export const LEGACY_ALIAS_MAP: ReadonlyArray<readonly [string, string]> = [
	// -------- color (fg / surface / border) --------
	['--ab-color-fg', 'var(--ink-body)'],
	['--ab-color-fg-muted', 'var(--ink-muted)'],
	['--ab-color-fg-subtle', 'var(--ink-subtle)'],
	['--ab-color-fg-faint', 'var(--ink-faint)'],

	['--ab-color-bg', 'var(--surface-page)'],
	['--ab-color-surface', 'var(--surface-panel)'],
	['--ab-color-surface-raised', 'var(--surface-raised)'],
	['--ab-color-surface-sunken', 'var(--surface-sunken)'],

	['--ab-color-border', 'var(--edge-default)'],
	['--ab-color-border-strong', 'var(--edge-strong)'],

	// -------- color: primary → action-default --------
	['--ab-color-primary', 'var(--action-default)'],
	['--ab-color-primary-subtle', 'var(--action-default-wash)'],
	['--ab-color-primary-subtle-border', 'var(--action-default-edge)'],
	['--ab-color-primary-fg', 'var(--action-default-ink)'],

	// -------- color: danger → action-hazard (interactive) --------
	['--ab-color-danger', 'var(--action-hazard)'],

	// -------- color: success → signal --------

	// -------- color: warning → signal-warning --------

	// -------- color: info → signal-info --------

	// -------- color: muted → action-neutral --------

	// -------- color: accent --------

	// -------- focus --------
	['--ab-color-focus-ring', 'var(--focus-ring)'],

	// -------- breakpoints (documentary; kept at legacy pixel values) --------
	['--ab-breakpoint-lg', '960px'],

	// -------- typography: families --------
	['--ab-font-family-mono', 'var(--font-family-mono)'],
	['--ab-font-family-base', 'var(--font-family-base)'],
	['--ab-font-mono', 'var(--font-family-mono)'],

	// -------- typography: sizes (role-token aliases; pack-aware) --------
	['--ab-font-size-xs', 'var(--type-ui-caption-size)'],
	['--ab-font-size-sm', 'var(--type-ui-label-size)'],
	['--ab-font-size-base', 'var(--type-reading-body-size)'],
	['--ab-font-size-lg', 'var(--type-reading-lead-size)'],
	['--ab-font-size-xl', 'var(--type-heading-2-size)'],
	['--ab-font-size-2xl', 'var(--type-heading-1-size)'],

	// -------- typography: weights (role-token aliases) --------
	['--ab-font-weight-medium', 'var(--type-ui-control-weight)'],
	['--ab-font-weight-semibold', 'var(--type-heading-3-weight)'],
	['--ab-font-weight-bold', 'var(--type-heading-1-weight)'],

	// -------- typography: line-height (role-token aliases) --------
	['--ab-line-height-tight', 'var(--type-heading-1-line-height)'],
	['--ab-line-height-normal', 'var(--type-ui-label-line-height)'],

	// -------- typography: letter-spacing (role-token aliases) --------
	['--ab-letter-spacing-tight', 'var(--type-heading-1-tracking)'],
	['--ab-letter-spacing-wide', 'var(--type-ui-caption-tracking)'],
	['--ab-letter-spacing-caps', 'var(--type-ui-badge-tracking)'],

	// -------- spacing (core + legacy half-steps) --------
	['--ab-space-2xs', 'var(--space-2xs)'],
	['--ab-space-xs', 'var(--space-xs)'],
	['--ab-space-sm', 'var(--space-sm)'],
	['--ab-space-md', 'var(--space-md)'],
	['--ab-space-lg', 'var(--space-lg)'],
	['--ab-space-xl', 'var(--space-xl)'],
	['--ab-space-2xl', 'var(--space-2xl)'],

	// -------- radius (core + legacy half-steps) --------
	['--ab-radius-xs', 'var(--radius-xs)'],
	['--ab-radius-sm', 'var(--radius-sm)'],
	['--ab-radius-md', 'var(--radius-md)'],
	['--ab-radius-lg', 'var(--radius-lg)'],
	['--ab-radius-pill', 'var(--radius-pill)'],

	// -------- shadow --------
	['--ab-shadow-sm', 'var(--shadow-sm)'],

	// -------- layout --------

	// -------- transitions --------
	['--ab-transition-fast', 'var(--motion-fast)'],

	// -------- controls (atomic; package #4 grows component tokens) --------

	// -------- sim surface --------
	// Package #7 populated `theme.sim`, which emits the canonical
	// `--sim-*` role tokens, and migrated every `apps/sim/src` consumer
	// off the `--ab-sim-*` aliases. The block is intentionally empty;
	// `rg -o '--ab-sim-' apps/ libs/` returns zero and the sim coverage
	// test in `legacy-alias-coverage.test.ts` is gone with the final
	// references. Do not re-add entries here -- migrate call sites to
	// the `--sim-*` role tokens instead.
] as const;

/** Flat list of legacy names the alias block exposes (for audit). */
export const LEGACY_ALIAS_NAMES: readonly string[] = LEGACY_ALIAS_MAP.map(([name]) => name);
