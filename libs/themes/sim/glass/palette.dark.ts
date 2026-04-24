/**
 * sim/glass palette -- dark.
 *
 * Dark-only glass-cockpit aesthetic in OKLCH. Deep black panels,
 * high-contrast tick marks, indicator-yellow pointers (aviation
 * convention), bright critical reds. Instrument-specific values live
 * in `sim.ts`. Values converted from hex per WP #8 (drift < 0.005 per
 * channel); three action pairs previously below AA were bumped one
 * rung along the same hue in the same package (see the Phase-2 commit
 * "contrast matrix measures every theme x appearance without oklch
 * skip" for the base adjustments).
 */

import type { Palette } from '../../contract';

export const palette: Palette = {
	ink: {
		body: 'oklch(0.97 0 89.9)', // from #f5f5f5
		muted: 'oklch(0.792 0 89.9)', // from #bbb
		subtle: 'oklch(0.627 0 89.9)', // from #888
		faint: 'oklch(0.45 0 89.9)', // from #555
		strong: 'oklch(1 0 89.9)', // from #ffffff
		inverse: 'oklch(0.145 0 0)', // from #0a0a0a
	},
	surface: {
		page: 'oklch(0.145 0 0)', // from #0a0a0a
		panel: 'oklch(0.218 0 0)', // from #1a1a1a
		raised: 'oklch(0.285 0 89.9)', // from #2a2a2a
		sunken: 'oklch(0.145 0 0)', // from #0a0a0a
		muted: 'oklch(0.218 0 0)', // from #1a1a1a
		overlay: 'oklch(0.218 0 0)', // from #1a1a1a
	},
	edge: {
		default: 'oklch(0.321 0 89.9)', // from #333
		strong: 'oklch(0.45 0 89.9)', // from #555
		subtle: 'oklch(0.252 0 0)', // from #222
	},
	action: {
		default: 'oklch(0.546 0.215 262.9)', // from #2563eb
		hazard: 'oklch(0.505 0.19 27.5)', // from #b91c1c (Phase 2: was #e0443e for AA)
		caution: 'oklch(0.796 0.162 68.5)', // from #ffa62b
		neutral: 'oklch(0.45 0 89.9)', // from #555   (Phase 2: was #888 for AA)
		link: 'oklch(0.802 0.099 261.6)', // from #9bbfff
	},
	signal: {
		success: 'oklch(0.689 0.18 148.3)', // from #2fb856
		warning: 'oklch(0.796 0.162 68.5)', // from #ffa62b
		danger: 'oklch(0.611 0.194 26.8)', // from #e0443e
		info: 'oklch(0.568 0.112 248.4)', // from #3b7bb5
	},
	focus: 'oklch(0.915 0.137 95.3)', // from #ffe270
	accent: {
		code: 'oklch(0.919 0.143 149.6)', // from #9bffb0
		reference: 'oklch(0.802 0.099 261.6)', // from #9bbfff
		definition: 'oklch(0.915 0.137 95.3)', // from #ffe270
	},
	overrides: {
		action: {
			default: {
				base: 'oklch(0.546 0.215 262.9)', // from #2563eb
				hover: 'oklch(0.488 0.217 264.4)', // from #1d4ed8
				active: 'oklch(0.379 0.138 265.5)', // from #1e3a8a
				wash: 'oklch(0.282 0.069 252.8)', // from #0c2a4a
				edge: 'oklch(0.404 0.094 253.3)', // from #1f4a7a
				ink: 'oklch(0.963 0.018 250.6)', // from #eaf4ff
				disabled: 'oklch(0.546 0.215 262.9 / 0.4)', // from rgba(37, 99, 235, 0.4)
			},
			hazard: {
				base: 'oklch(0.505 0.19 27.5)', // from #b91c1c (Phase 2 AA fix)
				hover: 'oklch(0.416 0.131 25.4)', // from #852524
				active: 'oklch(0.341 0.106 24.8)', // from #641a1a
				wash: 'oklch(0.278 0.085 26.3)', // from #4a1210
				edge: 'oklch(0.416 0.131 25.4)', // from #852524
				ink: 'oklch(0.9 0.052 21.1)', // from #ffd1cf
				disabled: 'oklch(0.505 0.19 27.5 / 0.4)', // from rgba(185, 28, 28, 0.4)
			},
			caution: {
				base: 'oklch(0.796 0.162 68.5)', // from #ffa62b
				hover: 'oklch(0.73 0.153 67.2)', // from #e69220
				active: 'oklch(0.606 0.129 66.2)', // from #b57014
				wash: 'oklch(0.39 0.08 82.4)', // from #5a4000
				edge: 'oklch(0.542 0.111 87)', // from #8b6a00
				ink: 'oklch(0.915 0.137 95.3)', // from #ffe270
				disabled: 'oklch(0.796 0.162 68.5 / 0.4)', // from rgba(255, 166, 43, 0.4)
			},
			neutral: {
				base: 'oklch(0.45 0 89.9)', // from #555 (Phase 2 AA fix)
				hover: 'oklch(0.569 0 89.9)', // from #777
				active: 'oklch(0.683 0 89.9)', // from #999
				wash: 'oklch(0.252 0 0)', // from #222
				edge: 'oklch(0.321 0 89.9)', // from #333
				ink: 'oklch(0.97 0 89.9)', // from #f5f5f5
				disabled: 'oklch(0.45 0 89.9 / 0.4)', // from rgba(85, 85, 85, 0.4)
			},
			link: {
				base: 'oklch(0.802 0.099 261.6)', // from #9bbfff
				hover: 'oklch(0.854 0.072 261.4)', // from #b5d0ff
				active: 'oklch(0.488 0.217 264.4)', // from #1d4ed8
				wash: 'oklch(0.282 0.069 252.8)', // from #0c2a4a
				edge: 'oklch(0.404 0.094 253.3)', // from #1f4a7a
				ink: 'oklch(0.963 0.018 250.6)', // from #eaf4ff
				disabled: 'oklch(0.802 0.099 261.6 / 0.4)', // from rgba(155, 191, 255, 0.4)
			},
		},
		signal: {
			success: {
				solid: 'oklch(0.689 0.18 148.3)', // from #2fb856
				wash: 'oklch(0.311 0.076 152.1)', // from #063b1c
				edge: 'oklch(0.412 0.104 151.4)', // from #0c5a2c
				ink: 'oklch(0.919 0.143 149.6)', // from #9bffb0
			},
			warning: {
				solid: 'oklch(0.796 0.162 68.5)', // from #ffa62b
				wash: 'oklch(0.39 0.08 82.4)', // from #5a4000
				edge: 'oklch(0.542 0.111 87)', // from #8b6a00
				ink: 'oklch(0.915 0.137 95.3)', // from #ffe270
			},
			danger: {
				solid: 'oklch(0.611 0.194 26.8)', // from #e0443e
				wash: 'oklch(0.278 0.085 26.3)', // from #4a1210
				edge: 'oklch(0.416 0.131 25.4)', // from #852524
				ink: 'oklch(0.9 0.052 21.1)', // from #ffd1cf
			},
			info: {
				solid: 'oklch(0.568 0.112 248.4)', // from #3b7bb5
				wash: 'oklch(0.282 0.069 252.8)', // from #0c2a4a
				edge: 'oklch(0.404 0.094 253.3)', // from #1f4a7a
				ink: 'oklch(0.963 0.018 250.6)', // from #eaf4ff
			},
		},
		focus: {
			ring: 'oklch(0.915 0.137 95.3)', // from #ffe270
			ringStrong: 'oklch(1 0 89.9)', // from #ffffff
			ringShadow: '0 0 0 3px oklch(0.915 0.137 95.3 / 0.6)', // from 0 0 0 3px rgba(255, 226, 112, 0.6)
		},
		overlay: {
			scrim: 'oklch(0 0 0 / 0.75)', // from rgba(0, 0, 0, 0.75)
			tooltipBg: 'oklch(0.285 0 89.9)', // from #2a2a2a
			tooltipInk: 'oklch(0.97 0 89.9)', // from #f5f5f5
		},
		selection: {
			bg: 'oklch(0.404 0.094 253.3)', // from #1f4a7a
			ink: 'oklch(0.963 0.018 250.6)', // from #eaf4ff
		},
		disabled: {
			surface: 'oklch(0.218 0 0)', // from #1a1a1a
			ink: 'oklch(0.45 0 89.9)', // from #555
			edge: 'oklch(0.321 0 89.9)', // from #333
		},
		link: {
			default: 'oklch(0.802 0.099 261.6)', // from #9bbfff
			hover: 'oklch(0.854 0.072 261.4)', // from #b5d0ff
			visited: 'oklch(0.718 0.106 259.4)', // from #7ca5e6
		},
	},
};
