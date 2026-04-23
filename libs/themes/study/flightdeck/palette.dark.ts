/**
 * study/flightdeck palette -- dark.
 *
 * TUI/dashboard theme, dark appearance. Deeper page + panel than
 * airboss/default-dark so the flightdeck reads as a denser,
 * higher-contrast instrument panel. Action / signal hues match
 * airboss/default-dark so shared components stay visually consistent
 * across surfaces.
 */
import type { Palette } from '../../contract';

export const palette: Palette = {
	ink: {
		body: '#e2e8f0',
		muted: '#94a3b8',
		subtle: '#64748b',
		faint: '#475569',
		strong: '#f1f5f9',
		inverse: '#020617',
	},
	surface: {
		page: '#020617',
		panel: '#0b1120',
		raised: '#111827',
		sunken: '#020617',
		muted: '#0b1120',
		overlay: '#111827',
	},
	edge: {
		default: '#1e293b',
		strong: '#334155',
		subtle: '#0f172a',
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
				ink: '#020617',
				disabled: 'rgba(96, 165, 250, 0.4)',
			},
			hazard: {
				base: '#f87171',
				hover: '#fca5a5',
				active: '#fecaca',
				wash: 'rgba(248, 113, 113, 0.18)',
				edge: 'rgba(248, 113, 113, 0.4)',
				ink: '#020617',
				disabled: 'rgba(248, 113, 113, 0.4)',
			},
			caution: {
				base: '#fbbf24',
				hover: '#fcd34d',
				active: '#fde68a',
				wash: 'rgba(251, 191, 36, 0.18)',
				edge: 'rgba(251, 191, 36, 0.4)',
				ink: '#020617',
				disabled: 'rgba(251, 191, 36, 0.4)',
			},
			neutral: {
				base: '#94a3b8',
				hover: '#cbd5e1',
				active: '#e2e8f0',
				wash: 'rgba(148, 163, 184, 0.18)',
				edge: 'rgba(148, 163, 184, 0.4)',
				ink: '#020617',
				disabled: 'rgba(148, 163, 184, 0.4)',
			},
			link: {
				base: '#60a5fa',
				hover: '#93c5fd',
				active: '#bfdbfe',
				wash: 'rgba(96, 165, 250, 0.18)',
				edge: 'rgba(96, 165, 250, 0.4)',
				ink: '#020617',
				disabled: 'rgba(96, 165, 250, 0.4)',
			},
		},
		signal: {
			success: { solid: '#4ade80', wash: '#0a2017', edge: '#166534', ink: '#020617' },
			warning: { solid: '#fbbf24', wash: '#201806', edge: '#854d0e', ink: '#020617' },
			danger: { solid: '#f87171', wash: '#200d0d', edge: '#7f1d1d', ink: '#020617' },
			info: { solid: '#38bdf8', wash: '#061a2a', edge: '#075985', ink: '#020617' },
		},
		focus: {
			ring: '#60a5fa',
			ringStrong: '#93c5fd',
			ringShadow: '0 0 0 3px rgba(96, 165, 250, 0.5)',
		},
		overlay: {
			scrim: 'rgba(0, 0, 0, 0.8)',
			tooltipBg: '#e2e8f0',
			tooltipInk: '#020617',
		},
		selection: {
			bg: 'rgba(96, 165, 250, 0.3)',
			ink: '#e2e8f0',
		},
		disabled: {
			surface: '#111827',
			ink: '#475569',
			edge: '#1e293b',
		},
		link: {
			default: '#60a5fa',
			hover: '#93c5fd',
			visited: '#c4b5fd',
		},
	},
};
