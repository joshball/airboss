/**
 * sim/glass palette -- dark.
 *
 * Dark-only glass-cockpit aesthetic. Deep black panels, high-contrast
 * tick marks, indicator-yellow pointers (aviation convention), bright
 * critical reds. The base palette provides the non-instrument surfaces
 * (chrome around the instruments). Instrument-specific values live in
 * `sim.ts`.
 *
 * Values match the canonical `--ab-sim-*` palette shipped in wave 4
 * (commit d8111b7) so the codemod migration is pixel-identical.
 */

import type { Palette } from '../../contract';

export const palette: Palette = {
	ink: {
		body: '#f5f5f5',
		muted: '#bbb',
		subtle: '#888',
		faint: '#555',
		strong: '#ffffff',
		inverse: '#0a0a0a',
	},
	surface: {
		page: '#0a0a0a',
		panel: '#1a1a1a',
		raised: '#2a2a2a',
		sunken: '#0a0a0a',
		muted: '#1a1a1a',
		overlay: '#1a1a1a',
	},
	edge: {
		default: '#333',
		strong: '#555',
		subtle: '#222',
	},
	action: {
		default: '#2563eb',
		hazard: '#e0443e',
		caution: '#ffa62b',
		neutral: '#888',
		link: '#9bbfff',
	},
	signal: {
		success: '#2fb856',
		warning: '#ffa62b',
		danger: '#e0443e',
		info: '#3b7bb5',
	},
	focus: '#ffe270',
	accent: {
		code: '#9bffb0',
		reference: '#9bbfff',
		definition: '#ffe270',
	},
	overrides: {
		action: {
			default: {
				base: '#2563eb',
				hover: '#1d4ed8',
				active: '#1e3a8a',
				wash: '#0c2a4a',
				edge: '#1f4a7a',
				ink: '#9bbfff',
				disabled: 'rgba(37, 99, 235, 0.4)',
			},
			hazard: {
				base: '#e0443e',
				hover: '#c23530',
				active: '#852524',
				wash: '#4a1210',
				edge: '#852524',
				ink: '#ffd1cf',
				disabled: 'rgba(224, 68, 62, 0.4)',
			},
			caution: {
				base: '#ffa62b',
				hover: '#e69220',
				active: '#b57014',
				wash: '#5a4000',
				edge: '#8b6a00',
				ink: '#ffe270',
				disabled: 'rgba(255, 166, 43, 0.4)',
			},
			neutral: {
				base: '#888',
				hover: '#aaa',
				active: '#ccc',
				wash: '#222',
				edge: '#333',
				ink: '#f5f5f5',
				disabled: 'rgba(136, 136, 136, 0.4)',
			},
			link: {
				base: '#9bbfff',
				hover: '#b5d0ff',
				active: '#1d4ed8',
				wash: '#0c2a4a',
				edge: '#1f4a7a',
				ink: '#eaf4ff',
				disabled: 'rgba(155, 191, 255, 0.4)',
			},
		},
		signal: {
			success: { solid: '#2fb856', wash: '#063b1c', edge: '#0c5a2c', ink: '#9bffb0' },
			warning: { solid: '#ffa62b', wash: '#5a4000', edge: '#8b6a00', ink: '#ffe270' },
			danger: { solid: '#e0443e', wash: '#4a1210', edge: '#852524', ink: '#ffd1cf' },
			info: { solid: '#3b7bb5', wash: '#0c2a4a', edge: '#1f4a7a', ink: '#eaf4ff' },
		},
		focus: {
			ring: '#ffe270',
			ringStrong: '#ffffff',
			ringShadow: '0 0 0 3px rgba(255, 226, 112, 0.6)',
		},
		overlay: {
			scrim: 'rgba(0, 0, 0, 0.75)',
			tooltipBg: '#2a2a2a',
			tooltipInk: '#f5f5f5',
		},
		selection: {
			bg: '#1f4a7a',
			ink: '#eaf4ff',
		},
		disabled: {
			surface: '#1a1a1a',
			ink: '#555',
			edge: '#333',
		},
		link: {
			default: '#9bbfff',
			hover: '#b5d0ff',
			visited: '#7ca5e6',
		},
	},
};
