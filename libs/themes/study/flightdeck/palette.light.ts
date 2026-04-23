/**
 * study/flightdeck palette -- light.
 *
 * TUI/dashboard theme. Values ported from the legacy `tui` theme:
 * darker / state-shifted action + signal hexes, same surface / ink.
 */

import type { Palette } from '../../contract';

export const palette: Palette = {
	ink: {
		body: '#0f172a',
		muted: '#475569',
		subtle: '#64748b',
		faint: '#94a3b8',
		strong: '#334155',
		inverse: '#ffffff',
	},
	surface: {
		page: '#f1f5f9',
		panel: '#ffffff',
		raised: '#ffffff',
		sunken: '#f8fafc',
		muted: '#f8fafc',
		overlay: '#ffffff',
	},
	edge: {
		default: '#e2e8f0',
		strong: '#cbd5e1',
		subtle: '#f1f5f9',
	},
	action: {
		default: '#2563eb',
		hazard: '#b91c1c',
		caution: '#b45309',
		neutral: '#64748b',
		link: '#2563eb',
	},
	signal: {
		success: '#15803d',
		warning: '#b45309',
		danger: '#b91c1c',
		info: '#0369a1',
	},
	focus: '#2563eb',
	accent: {
		code: '#4f46e5',
		reference: '#4f46e5',
		definition: '#4f46e5',
	},
	overrides: {
		action: {
			default: {
				base: '#2563eb',
				hover: '#1d4ed8',
				active: '#1e40af',
				wash: '#eff6ff',
				edge: '#bfdbfe',
				ink: '#ffffff',
				disabled: 'rgba(37, 99, 235, 0.4)',
			},
			hazard: {
				base: '#b91c1c',
				hover: '#991b1b',
				active: '#7f1d1d',
				wash: '#fef2f2',
				edge: '#fecaca',
				ink: '#ffffff',
				disabled: 'rgba(185, 28, 28, 0.4)',
			},
			caution: {
				base: '#b45309',
				hover: '#92400e',
				active: '#78350f',
				wash: '#fffbeb',
				edge: '#fde68a',
				ink: '#ffffff',
				disabled: 'rgba(180, 83, 9, 0.4)',
			},
			neutral: {
				base: '#64748b',
				hover: '#475569',
				active: '#334155',
				wash: '#f1f5f9',
				edge: '#e2e8f0',
				ink: '#ffffff',
				disabled: 'rgba(100, 116, 139, 0.4)',
			},
			link: {
				base: '#2563eb',
				hover: '#1d4ed8',
				active: '#1e40af',
				wash: '#eff6ff',
				edge: '#bfdbfe',
				ink: '#ffffff',
				disabled: 'rgba(37, 99, 235, 0.4)',
			},
		},
		signal: {
			success: { solid: '#15803d', wash: '#f0fdf4', edge: '#bbf7d0', ink: '#ffffff' },
			warning: { solid: '#b45309', wash: '#fffbeb', edge: '#fde68a', ink: '#ffffff' },
			danger: { solid: '#b91c1c', wash: '#fef2f2', edge: '#fecaca', ink: '#ffffff' },
			info: { solid: '#0369a1', wash: '#f0f9ff', edge: '#bae6fd', ink: '#ffffff' },
		},
		focus: {
			ring: '#2563eb',
			ringStrong: '#2563eb',
			ringShadow: '0 0 0 3px #2563eb',
		},
		overlay: {
			scrim: 'rgba(0, 0, 0, 0.5)',
			tooltipBg: '#0f172a',
			tooltipInk: '#ffffff',
		},
		selection: {
			bg: '#bfdbfe',
			ink: '#0f172a',
		},
		disabled: {
			surface: '#f1f5f9',
			ink: '#94a3b8',
			edge: '#e2e8f0',
		},
		link: {
			default: '#2563eb',
			hover: '#1d4ed8',
			visited: '#1e40af',
		},
	},
};
