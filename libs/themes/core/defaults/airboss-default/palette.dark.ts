/**
 * Airboss default palette -- dark.
 *
 * Authored in OKLCH (CSS Color 4). Values converted from the original
 * hex set via `scripts/themes/hex-to-oklch.ts`; drift < 0.005 per
 * channel. See WP #8 for migration context.
 *
 * Design notes:
 *   - Surfaces progress from `surface.page` (deepest) -> `panel` ->
 *     `raised` so chrome can layer without ambiguity.
 *   - Ink is near-white for body / strong, slate for muted / subtle.
 *   - Action bases are LIGHTER than their light-mode counterparts so
 *     they read as "luminous controls on a dark field." Their `ink`
 *     override is near-black so every fill clears AA.
 *   - Washes in dark are translucent tints that preview as deep surfaces;
 *     body ink on any wash clears 4.5:1 because the wash stays near the
 *     page floor when composited.
 *   - Overrides stay explicit so the emit pipeline uses these exact
 *     values; the derivation contract covers most pairs but some (e.g.
 *     signal washes tinted away from pure hue) still warrant pins.
 */
import type { Palette } from '../../../contract';

export const palette: Palette = {
	ink: {
		body: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
		muted: 'oklch(0.869 0.02 252.9)', // from #cbd5e1
		subtle: 'oklch(0.711 0.035 256.8)', // from #94a3b8
		faint: 'oklch(0.554 0.041 257.4)', // from #64748b
		strong: 'oklch(0.984 0.003 247.9)', // from #f8fafc
		inverse: 'oklch(0.208 0.04 265.8)', // from #0f172a
	},
	surface: {
		page: 'oklch(0.18 0.032 266.6)', // from #0b1120
		panel: 'oklch(0.21 0.032 264.7)', // from #111827
		raised: 'oklch(0.278 0.03 256.8)', // from #1f2937
		sunken: 'oklch(0.208 0.04 265.8)', // from #0f172a
		muted: 'oklch(0.208 0.04 265.8)', // from #0f172a
		overlay: 'oklch(0.278 0.03 256.8)', // from #1f2937
	},
	edge: {
		default: 'oklch(0.372 0.039 257.3)', // from #334155
		strong: 'oklch(0.446 0.037 257.3)', // from #475569
		subtle: 'oklch(0.278 0.03 256.8)', // from #1f2937
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
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
				disabled: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
			},
			hazard: {
				base: 'oklch(0.711 0.166 22.2)', // from #f87171
				hover: 'oklch(0.808 0.103 19.6)', // from #fca5a5
				active: 'oklch(0.885 0.059 18.3)', // from #fecaca
				wash: 'oklch(0.711 0.166 22.2 / 0.18)', // from rgba(248, 113, 113, 0.18)
				edge: 'oklch(0.711 0.166 22.2 / 0.4)', // from rgba(248, 113, 113, 0.4)
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
				disabled: 'oklch(0.711 0.166 22.2 / 0.4)', // from rgba(248, 113, 113, 0.4)
			},
			caution: {
				base: 'oklch(0.837 0.164 84.4)', // from #fbbf24
				hover: 'oklch(0.879 0.153 91.6)', // from #fcd34d
				active: 'oklch(0.924 0.115 95.7)', // from #fde68a
				wash: 'oklch(0.837 0.164 84.4 / 0.18)', // from rgba(251, 191, 36, 0.18)
				edge: 'oklch(0.837 0.164 84.4 / 0.4)', // from rgba(251, 191, 36, 0.4)
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
				disabled: 'oklch(0.837 0.164 84.4 / 0.4)', // from rgba(251, 191, 36, 0.4)
			},
			neutral: {
				base: 'oklch(0.711 0.035 256.8)', // from #94a3b8
				hover: 'oklch(0.869 0.02 252.9)', // from #cbd5e1
				active: 'oklch(0.929 0.013 255.5)', // from #e2e8f0
				wash: 'oklch(0.711 0.035 256.8 / 0.18)', // from rgba(148, 163, 184, 0.18)
				edge: 'oklch(0.711 0.035 256.8 / 0.4)', // from rgba(148, 163, 184, 0.4)
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
				disabled: 'oklch(0.711 0.035 256.8 / 0.4)', // from rgba(148, 163, 184, 0.4)
			},
			link: {
				base: 'oklch(0.714 0.143 254.6)', // from #60a5fa
				hover: 'oklch(0.809 0.096 251.8)', // from #93c5fd
				active: 'oklch(0.882 0.057 254.1)', // from #bfdbfe
				wash: 'oklch(0.714 0.143 254.6 / 0.18)', // from rgba(96, 165, 250, 0.18)
				edge: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
				disabled: 'oklch(0.714 0.143 254.6 / 0.4)', // from rgba(96, 165, 250, 0.4)
			},
		},
		signal: {
			success: {
				solid: 'oklch(0.8 0.182 151.7)', // from #4ade80
				wash: 'oklch(0.259 0.043 158.7)', // from #0f2a1c
				edge: 'oklch(0.448 0.108 151.3)', // from #166534
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
			},
			warning: {
				solid: 'oklch(0.837 0.164 84.4)', // from #fbbf24
				wash: 'oklch(0.247 0.038 81.6)', // from #2a1f0a
				edge: 'oklch(0.476 0.103 61.9)', // from #854d0e
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
			},
			danger: {
				solid: 'oklch(0.711 0.166 22.2)', // from #f87171
				wash: 'oklch(0.218 0.04 20.8)', // from #2a1212
				edge: 'oklch(0.396 0.133 25.7)', // from #7f1d1d
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
			},
			info: {
				solid: 'oklch(0.754 0.139 232.7)', // from #38bdf8
				wash: 'oklch(0.251 0.042 234.6)', // from #0a2533
				edge: 'oklch(0.443 0.1 240.8)', // from #075985
				ink: 'oklch(0.18 0.032 266.6)', // from #0b1120
			},
		},
		focus: {
			ring: 'oklch(0.714 0.143 254.6)', // from #60a5fa
			ringStrong: 'oklch(0.809 0.096 251.8)', // from #93c5fd
			ringShadow: '0 0 0 3px oklch(0.714 0.143 254.6 / 0.5)', // from 0 0 0 3px rgba(96, 165, 250, 0.5)
		},
		overlay: {
			scrim: 'oklch(0 0 0 / 0.7)', // from rgba(0, 0, 0, 0.7)
			tooltipBg: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
			tooltipInk: 'oklch(0.208 0.04 265.8)', // from #0f172a
		},
		selection: {
			bg: 'oklch(0.714 0.143 254.6 / 0.3)', // from rgba(96, 165, 250, 0.3)
			ink: 'oklch(0.968 0.007 247.9)', // from #f1f5f9
		},
		disabled: {
			surface: 'oklch(0.278 0.03 256.8)', // from #1f2937
			ink: 'oklch(0.554 0.041 257.4)', // from #64748b
			edge: 'oklch(0.372 0.039 257.3)', // from #334155
		},
		link: {
			default: 'oklch(0.714 0.143 254.6)', // from #60a5fa
			hover: 'oklch(0.809 0.096 251.8)', // from #93c5fd
			visited: 'oklch(0.811 0.101 293.6)', // from #c4b5fd
		},
	},
};
