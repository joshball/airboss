/**
 * study/flightdeck palette -- dark.
 *
 * TUI/dashboard theme, dark appearance in OKLCH. Deeper page + panel
 * than airboss/default-dark so the flightdeck reads as a denser,
 * higher-contrast instrument panel. Action / signal hues match
 * airboss/default-dark so shared components stay visually consistent
 * across surfaces. Values converted from hex per WP #8; drift < 0.005
 * per channel.
 */
import type { Palette } from '../../contract';

export const palette: Palette = {
	ink: {
		body: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
		muted: 'oklch(0.711 0.035 256.8)', // from #94a3b8
		subtle: 'oklch(0.554 0.041 257.4)', // from #64748b
		faint: 'oklch(0.446 0.037 257.3)', // from #475569
		strong: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
		inverse: 'oklch(0.129 0.041 264.7)', // from #020617
	},
	surface: {
		page: 'oklch(0.129 0.041 264.7)', // from #020617
		panel: 'oklch(0.18 0.032 266.6)', // from #0b1120
		raised: 'oklch(0.21 0.032 264.7)', // from #111827
		sunken: 'oklch(0.129 0.041 264.7)', // from #020617
		muted: 'oklch(0.18 0.032 266.6)', // from #0b1120
		overlay: 'oklch(0.21 0.032 264.7)', // from #111827
	},
	edge: {
		default: 'oklch(0.279 0.037 260)', // from #1e293b
		strong: 'oklch(0.372 0.039 257.3)', // from #334155
		subtle: 'oklch(0.208 0.04 265.8)', // from #0f172a
	},
	action: {
		default: 'oklch(0.714 0.143 254.6)', // from #60a5fa
		hazard: 'oklch(0.711 0.166 22.2)', // from #f87171
		caution: 'oklch(0.837 0.164 84.4)', // from #fbbf24
		neutral: 'oklch(0.711 0.035 256.8)', // from #94a3b8
		link: 'oklch(0.714 0.143 254.6)', // from #60a5fa
	},
	signal: {
		success: 'oklch(0.8 0.182 151.7)', // from #4ade80
		warning: 'oklch(0.837 0.164 84.4)', // from #fbbf24
		danger: 'oklch(0.711 0.166 22.2)', // from #f87171
		info: 'oklch(0.754 0.139 232.7)', // from #38bdf8
	},
	focus: 'oklch(0.714 0.143 254.6)', // from #60a5fa
	accent: {
		code: 'oklch(0.785 0.104 274.7)', // from #a5b4fc
		reference: 'oklch(0.785 0.104 274.7)', // from #a5b4fc
		definition: 'oklch(0.785 0.104 274.7)', // from #a5b4fc
	},
	overrides: {
		action: {
			default: {
				base: 'oklch(0.714 0.143 254.6)', // from #60a5fa
				hover: 'oklch(0.809 0.096 251.8)', // from #93c5fd
				active: 'oklch(0.882 0.057 254.1)', // from #bfdbfe
				wash: 'oklch(0.714 0.143 254.6 / 0.18)', // from rgba(96, 165, 250, 0.18)
				edge: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
				disabled: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
			},
			hazard: {
				base: 'oklch(0.711 0.166 22.2)', // from #f87171
				hover: 'oklch(0.808 0.103 19.6)', // from #fca5a5
				active: 'oklch(0.885 0.059 18.3)', // from #fecaca
				wash: 'oklch(0.711 0.166 22.2 / 0.18)', // from rgba(248, 113, 113, 0.18)
				edge: 'oklch(0.711 0.166 22.2 / 0.4)', // from rgba(248, 113, 113, 0.4)
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
				disabled: 'oklch(0.711 0.166 22.2 / 0.4)', // from rgba(248, 113, 113, 0.4)
			},
			caution: {
				base: 'oklch(0.837 0.164 84.4)', // from #fbbf24
				hover: 'oklch(0.879 0.153 91.6)', // from #fcd34d
				active: 'oklch(0.924 0.115 95.7)', // from #fde68a
				wash: 'oklch(0.837 0.164 84.4 / 0.18)', // from rgba(251, 191, 36, 0.18)
				edge: 'oklch(0.837 0.164 84.4 / 0.4)', // from rgba(251, 191, 36, 0.4)
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
				disabled: 'oklch(0.837 0.164 84.4 / 0.4)', // from rgba(251, 191, 36, 0.4)
			},
			neutral: {
				base: 'oklch(0.711 0.035 256.8)', // from #94a3b8
				hover: 'oklch(0.869 0.02 252.9)', // from #cbd5e1
				active: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
				wash: 'oklch(0.711 0.035 256.8 / 0.18)', // from rgba(148, 163, 184, 0.18)
				edge: 'oklch(0.711 0.035 256.8 / 0.4)', // from rgba(148, 163, 184, 0.4)
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
				disabled: 'oklch(0.711 0.035 256.8 / 0.4)', // from rgba(148, 163, 184, 0.4)
			},
			link: {
				base: 'oklch(0.714 0.143 254.6)', // from #60a5fa
				hover: 'oklch(0.809 0.096 251.8)', // from #93c5fd
				active: 'oklch(0.882 0.057 254.1)', // from #bfdbfe
				wash: 'oklch(0.714 0.143 254.6 / 0.18)', // from rgba(96, 165, 250, 0.18)
				edge: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
				disabled: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
			},
		},
		signal: {
			success: {
				solid: 'oklch(0.8 0.182 151.7)', // from #4ade80
				wash: 'oklch(0.222 0.033 164.5)', // from #0a2017
				edge: 'oklch(0.448 0.108 151.3)', // from #166534
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
			},
			warning: {
				solid: 'oklch(0.837 0.164 84.4)', // from #fbbf24
				wash: 'oklch(0.214 0.033 86)', // from #201806
				edge: 'oklch(0.476 0.103 61.9)', // from #854d0e
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
			},
			danger: {
				solid: 'oklch(0.711 0.166 22.2)', // from #f87171
				wash: 'oklch(0.188 0.033 20.6)', // from #200d0d
				edge: 'oklch(0.396 0.133 25.7)', // from #7f1d1d
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
			},
			info: {
				solid: 'oklch(0.754 0.139 232.7)', // from #38bdf8
				wash: 'oklch(0.211 0.041 245.1)', // from #061a2a
				edge: 'oklch(0.443 0.1 240.8)', // from #075985
				ink: 'oklch(0.129 0.041 264.7)', // from #020617
			},
		},
		focus: {
			ring: 'oklch(0.714 0.143 254.6)', // from #60a5fa
			ringStrong: 'oklch(0.809 0.096 251.8)', // from #93c5fd
			ringShadow: '0 0 0 3px oklch(0.714 0.143 254.6 / 0.5)', // from 0 0 0 3px rgba(96, 165, 250, 0.5)
		},
		overlay: {
			scrim: 'oklch(0 0 0 / 0.8)', // from rgba(0, 0, 0, 0.8)
			tooltipBg: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
			tooltipInk: 'oklch(0.129 0.041 264.7)', // from #020617
		},
		selection: {
			bg: 'oklch(0.714 0.143 254.6 / 0.3)', // from rgba(96, 165, 250, 0.3)
			ink: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
		},
		disabled: {
			surface: 'oklch(0.21 0.032 264.7)', // from #111827
			ink: 'oklch(0.446 0.037 257.3)', // from #475569
			edge: 'oklch(0.279 0.037 260)', // from #1e293b
		},
		link: {
			default: 'oklch(0.714 0.143 254.6)', // from #60a5fa
			hover: 'oklch(0.809 0.096 251.8)', // from #93c5fd
			visited: 'oklch(0.811 0.101 293.6)', // from #c4b5fd
		},
	},
};
