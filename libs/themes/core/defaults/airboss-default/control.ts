/**
 * airboss-default control tokens.
 *
 * Package #1 lands the slot shape. Values resolve to existing role
 * tokens via `var(--...)` so theme palette swaps propagate
 * automatically. Package #4 may refine slots per-primitive; the shape
 * is what unblocks Wave 2 parallelism.
 */

import type { ControlTokens } from '../../../contract';

export const control: ControlTokens = {
	button: {
		default: {
			bg: 'var(--surface-panel)',
			ink: 'var(--ink-body)',
			border: 'var(--edge-default)',
			hoverBg: 'var(--surface-muted)',
			hoverInk: 'var(--ink-strong)',
			activeBg: 'var(--surface-sunken)',
			disabledBg: 'var(--disabled-surface)',
			disabledInk: 'var(--disabled-ink)',
			ring: 'var(--focus-ring)',
		},
		primary: {
			bg: 'var(--action-default)',
			ink: 'var(--action-default-ink)',
			border: 'var(--action-default)',
			hoverBg: 'var(--action-default-hover)',
			hoverInk: 'var(--action-default-ink)',
			activeBg: 'var(--action-default-active)',
			disabledBg: 'var(--action-default-disabled)',
			disabledInk: 'var(--action-default-ink)',
			ring: 'var(--focus-ring)',
		},
		hazard: {
			bg: 'var(--action-hazard)',
			ink: 'var(--action-hazard-ink)',
			border: 'var(--action-hazard)',
			hoverBg: 'var(--action-hazard-hover)',
			hoverInk: 'var(--action-hazard-ink)',
			activeBg: 'var(--action-hazard-active)',
			disabledBg: 'var(--action-hazard-disabled)',
			disabledInk: 'var(--action-hazard-ink)',
			ring: 'var(--focus-ring)',
		},
		neutral: {
			bg: 'var(--action-neutral-wash)',
			ink: 'var(--action-neutral-ink)',
			border: 'var(--action-neutral-edge)',
			hoverBg: 'var(--action-neutral-hover)',
			hoverInk: 'var(--action-neutral-ink)',
			activeBg: 'var(--action-neutral-active)',
			disabledBg: 'var(--disabled-surface)',
			disabledInk: 'var(--disabled-ink)',
			ring: 'var(--focus-ring)',
		},
		ghost: {
			bg: 'transparent',
			ink: 'var(--ink-body)',
			border: 'transparent',
			hoverBg: 'var(--surface-muted)',
			hoverInk: 'var(--ink-strong)',
			activeBg: 'var(--surface-sunken)',
			disabledBg: 'transparent',
			disabledInk: 'var(--disabled-ink)',
			ring: 'var(--focus-ring)',
		},
	},
	input: {
		default: {
			bg: 'var(--surface-panel)',
			ink: 'var(--ink-body)',
			border: 'var(--edge-default)',
			hoverBg: 'var(--surface-panel)',
			hoverInk: 'var(--ink-body)',
			activeBg: 'var(--surface-panel)',
			disabledBg: 'var(--disabled-surface)',
			disabledInk: 'var(--disabled-ink)',
			ring: 'var(--focus-ring)',
		},
		error: {
			bg: 'var(--surface-panel)',
			ink: 'var(--ink-body)',
			border: 'var(--action-hazard-edge)',
			hoverBg: 'var(--surface-panel)',
			hoverInk: 'var(--ink-body)',
			activeBg: 'var(--surface-panel)',
			disabledBg: 'var(--disabled-surface)',
			disabledInk: 'var(--disabled-ink)',
			ring: 'var(--action-hazard)',
		},
	},
};
