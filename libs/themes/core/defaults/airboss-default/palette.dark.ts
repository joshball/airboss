/**
 * Airboss default palette -- dark.
 *
 * Hex-native dark palette. Stays in hex so the contrast matrix keeps
 * AA enforcement live (OKLCH-aware ratio math is a separate follow-up).
 *
 * Design notes:
 *   - Surfaces progress from `surface.page` (deepest) -> `panel` ->
 *     `raised` so chrome can layer without ambiguity.
 *   - Ink is near-white for body / strong, slate for muted / subtle.
 *   - Action bases are LIGHTER than their light-mode counterparts so
 *     they read as "luminous controls on a dark field." Their `ink`
 *     override is `#0b1120` (darker than `surface.page`) to clear AA.
 *   - Washes in dark are hue-tinted deep surfaces; body ink on any
 *     wash clears 4.5:1 because the wash stays near the page floor.
 *   - Because derivation is a no-op on hex, every action / signal
 *     variant is spelled out in `overrides` -- the emit pipeline uses
 *     these values verbatim.
 */
import type { Palette } from '../../../contract';

export const palette: Palette = {
	ink: {
		body: '#f1f5f9',
		muted: '#cbd5e1',
		subtle: '#94a3b8',
		faint: '#64748b',
		strong: '#f8fafc',
		inverse: '#0f172a',
	},
	surface: {
		page: '#0b1120',
		panel: '#111827',
		raised: '#1f2937',
		sunken: '#0f172a',
		muted: '#0f172a',
		overlay: '#1f2937',
	},
	edge: {
		default: '#334155',
		strong: '#475569',
		subtle: '#1f2937',
	},
	action: {
		default: '#60a5fa',
		hazard: '#f87171',
		caution: '#fbbf24',
		neutral: '#94a3b8',
		link: '#60a5fa',
	},
	signal: {
		success: '#4ade80',
		warning: '#fbbf24',
		danger: '#f87171',
		info: '#38bdf8',
	},
	focus: '#60a5fa',
	accent: {
		code: '#a5b4fc',
		reference: '#a5b4fc',
		definition: '#a5b4fc',
	},
	overrides: {
		action: {
			default: {
				base: '#60a5fa',
				hover: '#93c5fd',
				active: '#bfdbfe',
				wash: 'rgba(96, 165, 250, 0.18)',
				edge: 'rgba(96, 165, 250, 0.4)',
				ink: '#0b1120',
				disabled: 'rgba(96, 165, 250, 0.4)',
			},
			hazard: {
				base: '#f87171',
				hover: '#fca5a5',
				active: '#fecaca',
				wash: 'rgba(248, 113, 113, 0.18)',
				edge: 'rgba(248, 113, 113, 0.4)',
				ink: '#0b1120',
				disabled: 'rgba(248, 113, 113, 0.4)',
			},
			caution: {
				base: '#fbbf24',
				hover: '#fcd34d',
				active: '#fde68a',
				wash: 'rgba(251, 191, 36, 0.18)',
				edge: 'rgba(251, 191, 36, 0.4)',
				ink: '#0b1120',
				disabled: 'rgba(251, 191, 36, 0.4)',
			},
			neutral: {
				base: '#94a3b8',
				hover: '#cbd5e1',
				active: '#e2e8f0',
				wash: 'rgba(148, 163, 184, 0.18)',
				edge: 'rgba(148, 163, 184, 0.4)',
				ink: '#0b1120',
				disabled: 'rgba(148, 163, 184, 0.4)',
			},
			link: {
				base: '#60a5fa',
				hover: '#93c5fd',
				active: '#bfdbfe',
				wash: 'rgba(96, 165, 250, 0.18)',
				edge: 'rgba(96, 165, 250, 0.4)',
				ink: '#0b1120',
				disabled: 'rgba(96, 165, 250, 0.4)',
			},
		},
		signal: {
			success: { solid: '#4ade80', wash: '#0f2a1c', edge: '#166534', ink: '#0b1120' },
			warning: { solid: '#fbbf24', wash: '#2a1f0a', edge: '#854d0e', ink: '#0b1120' },
			danger: { solid: '#f87171', wash: '#2a1212', edge: '#7f1d1d', ink: '#0b1120' },
			info: { solid: '#38bdf8', wash: '#0a2533', edge: '#075985', ink: '#0b1120' },
		},
		focus: {
			ring: '#60a5fa',
			ringStrong: '#93c5fd',
			ringShadow: '0 0 0 3px rgba(96, 165, 250, 0.5)',
		},
		overlay: {
			scrim: 'rgba(0, 0, 0, 0.7)',
			tooltipBg: '#f1f5f9',
			tooltipInk: '#0f172a',
		},
		selection: {
			bg: 'rgba(96, 165, 250, 0.3)',
			ink: '#f1f5f9',
		},
		disabled: {
			surface: '#1f2937',
			ink: '#64748b',
			edge: '#334155',
		},
		link: {
			default: '#60a5fa',
			hover: '#93c5fd',
			visited: '#c4b5fd',
		},
	},
};
