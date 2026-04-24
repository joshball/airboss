/**
 * study/flightdeck palette -- light.
 *
 * TUI/dashboard theme in OKLCH. Darker / state-shifted action + signal
 * hues than airboss/default; same surface / ink rungs. Values
 * converted from hex via `scripts/themes/hex-to-oklch.ts` for WP #8;
 * drift < 0.005 per channel.
 */

import type { Palette } from '../../contract';

export const palette: Palette = {
	ink: {
		body: 'oklch(0.208 0.04 265.8)', // from #0f172a
		muted: 'oklch(0.446 0.037 257.3)', // from #475569
		subtle: 'oklch(0.554 0.041 257.4)', // from #64748b
		faint: 'oklch(0.711 0.035 256.8)', // from #94a3b8
		strong: 'oklch(0.372 0.039 257.3)', // from #334155
		inverse: 'oklch(1 0 89.9)', // from #ffffff
	},
	surface: {
		page: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
		panel: 'oklch(1 0 89.9)', // from #ffffff
		raised: 'oklch(1 0 89.9)', // from #ffffff
		sunken: 'oklch(0.984 0.003 247.9)', // from #f8fafc
		muted: 'oklch(0.984 0.003 247.9)', // from #f8fafc
		overlay: 'oklch(1 0 89.9)', // from #ffffff
	},
	edge: {
		default: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
		strong: 'oklch(0.869 0.02 252.9)', // from #cbd5e1
		subtle: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
	},
	action: {
		default: 'oklch(0.546 0.215 262.9)', // from #2563eb
		hazard: 'oklch(0.505 0.19 27.5)', // from #b91c1c
		caution: 'oklch(0.555 0.146 49)', // from #b45309
		neutral: 'oklch(0.554 0.041 257.4)', // from #64748b
		link: 'oklch(0.546 0.215 262.9)', // from #2563eb
	},
	signal: {
		success: 'oklch(0.527 0.137 150.1)', // from #15803d
		warning: 'oklch(0.555 0.146 49)', // from #b45309
		danger: 'oklch(0.505 0.19 27.5)', // from #b91c1c
		info: 'oklch(0.5 0.119 242.7)', // from #0369a1
	},
	focus: 'oklch(0.546 0.215 262.9)', // from #2563eb
	accent: {
		code: 'oklch(0.511 0.23 277)', // from #4f46e5
		reference: 'oklch(0.511 0.23 277)', // from #4f46e5
		definition: 'oklch(0.511 0.23 277)', // from #4f46e5
	},
	overrides: {
		action: {
			default: {
				base: 'oklch(0.546 0.215 262.9)', // from #2563eb
				hover: 'oklch(0.488 0.217 264.4)', // from #1d4ed8
				active: 'oklch(0.424 0.181 265.6)', // from #1e40af
				wash: 'oklch(0.97 0.014 254.6)', // from #eff6ff
				edge: 'oklch(0.882 0.057 254.1)', // from #bfdbfe
				ink: 'oklch(1 0 89.9)', // from #ffffff
				disabled: 'oklch(0.546 0.215 262.9 / 0.4)', // from rgba(37, 99, 235, 0.4)
			},
			hazard: {
				base: 'oklch(0.505 0.19 27.5)', // from #b91c1c
				hover: 'oklch(0.444 0.161 26.9)', // from #991b1b
				active: 'oklch(0.396 0.133 25.7)', // from #7f1d1d
				wash: 'oklch(0.971 0.013 17.4)', // from #fef2f2
				edge: 'oklch(0.885 0.059 18.3)', // from #fecaca
				ink: 'oklch(1 0 89.9)', // from #ffffff
				disabled: 'oklch(0.505 0.19 27.5 / 0.4)', // from rgba(185, 28, 28, 0.4)
			},
			caution: {
				base: 'oklch(0.555 0.146 49)', // from #b45309
				hover: 'oklch(0.473 0.125 46.2)', // from #92400e
				active: 'oklch(0.414 0.105 45.9)', // from #78350f
				wash: 'oklch(0.987 0.021 95.3)', // from #fffbeb
				edge: 'oklch(0.924 0.115 95.7)', // from #fde68a
				ink: 'oklch(1 0 89.9)', // from #ffffff
				disabled: 'oklch(0.555 0.146 49 / 0.4)', // from rgba(180, 83, 9, 0.4)
			},
			neutral: {
				base: 'oklch(0.554 0.041 257.4)', // from #64748b
				hover: 'oklch(0.446 0.037 257.3)', // from #475569
				active: 'oklch(0.372 0.039 257.3)', // from #334155
				wash: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
				edge: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
				ink: 'oklch(1 0 89.9)', // from #ffffff
				disabled: 'oklch(0.554 0.041 257.4 / 0.4)', // from rgba(100, 116, 139, 0.4)
			},
			link: {
				base: 'oklch(0.546 0.215 262.9)', // from #2563eb
				hover: 'oklch(0.488 0.217 264.4)', // from #1d4ed8
				active: 'oklch(0.424 0.181 265.6)', // from #1e40af
				wash: 'oklch(0.97 0.014 254.6)', // from #eff6ff
				edge: 'oklch(0.882 0.057 254.1)', // from #bfdbfe
				ink: 'oklch(1 0 89.9)', // from #ffffff
				disabled: 'oklch(0.546 0.215 262.9 / 0.4)', // from rgba(37, 99, 235, 0.4)
			},
		},
		signal: {
			success: {
				solid: 'oklch(0.527 0.137 150.1)', // from #15803d
				wash: 'oklch(0.982 0.018 155.8)', // from #f0fdf4
				edge: 'oklch(0.925 0.081 156)', // from #bbf7d0
				ink: 'oklch(1 0 89.9)', // from #ffffff
			},
			warning: {
				solid: 'oklch(0.555 0.146 49)', // from #b45309
				wash: 'oklch(0.987 0.021 95.3)', // from #fffbeb
				edge: 'oklch(0.924 0.115 95.7)', // from #fde68a
				ink: 'oklch(1 0 89.9)', // from #ffffff
			},
			danger: {
				solid: 'oklch(0.505 0.19 27.5)', // from #b91c1c
				wash: 'oklch(0.971 0.013 17.4)', // from #fef2f2
				edge: 'oklch(0.885 0.059 18.3)', // from #fecaca
				ink: 'oklch(1 0 89.9)', // from #ffffff
			},
			info: {
				solid: 'oklch(0.5 0.119 242.7)', // from #0369a1
				wash: 'oklch(0.977 0.012 236.6)', // from #f0f9ff
				edge: 'oklch(0.901 0.055 230.9)', // from #bae6fd
				ink: 'oklch(1 0 89.9)', // from #ffffff
			},
		},
		focus: {
			ring: 'oklch(0.546 0.215 262.9)', // from #2563eb
			ringStrong: 'oklch(0.546 0.215 262.9)', // from #2563eb
			ringShadow: '0 0 0 3px oklch(0.546 0.215 262.9)', // from 0 0 0 3px #2563eb
		},
		overlay: {
			scrim: 'oklch(0 0 0 / 0.5)', // from rgba(0, 0, 0, 0.5)
			tooltipBg: 'oklch(0.208 0.04 265.8)', // from #0f172a
			tooltipInk: 'oklch(1 0 89.9)', // from #ffffff
		},
		selection: {
			bg: 'oklch(0.882 0.057 254.1)', // from #bfdbfe
			ink: 'oklch(0.208 0.04 265.8)', // from #0f172a
		},
		disabled: {
			surface: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
			ink: 'oklch(0.711 0.035 256.8)', // from #94a3b8
			edge: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
		},
		link: {
			default: 'oklch(0.546 0.215 262.9)', // from #2563eb
			hover: 'oklch(0.488 0.217 264.4)', // from #1d4ed8
			visited: 'oklch(0.424 0.181 265.6)', // from #1e40af
		},
	},
};
