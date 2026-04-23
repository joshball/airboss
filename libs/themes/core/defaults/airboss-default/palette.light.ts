/**
 * airboss-default -- light palette.
 *
 * Values are OKLCH conversions of the hex palette that shipped in the
 * pre-foundation `libs/themes/tokens.css`. Every swatch maps to the
 * equivalent perceptual lightness so rendered pages stay pixel-identical
 * after the migration; only the names changed.
 *
 * OKLCH gives us predictable `adjustBrightness` and `alpha` derivations in
 * `derive.ts`; the hex originals ran through YIQ / HSL math and drifted
 * across hue families. See `docs/platform/theme-system/02-ARCHITECTURE.md`
 * for the rationale.
 */

import type { Palette } from '../../../contract';

export const airbossDefaultLightPalette: Palette = {
	ink: {
		// Previously #0f172a / #334155 / #475569 / #64748b / #94a3b8 / #ffffff
		body: 'oklch(0.208 0.040 265.8)',
		strong: 'oklch(0.372 0.039 257.3)',
		muted: 'oklch(0.446 0.037 257.3)',
		subtle: 'oklch(0.554 0.041 257.4)',
		faint: 'oklch(0.711 0.035 256.8)',
		inverse: 'oklch(1.000 0.000 89.9)',
	},
	surface: {
		// #f8fafc / #ffffff / #ffffff / #f1f5f9 / #f8fafc
		page: 'oklch(0.984 0.003 247.9)',
		panel: 'oklch(1.000 0.000 89.9)',
		raised: 'oklch(1.000 0.000 89.9)',
		sunken: 'oklch(0.968 0.007 247.9)',
		muted: 'oklch(0.984 0.003 247.9)',
		// Overlay == panel (white) today; package #6 gives it a distinct dark value.
		overlay: 'oklch(1.000 0.000 89.9)',
	},
	edge: {
		// #e2e8f0 / #cbd5e1 / #f1f5f9
		default: 'oklch(0.929 0.013 255.5)',
		strong: 'oklch(0.869 0.020 252.9)',
		subtle: 'oklch(0.968 0.007 247.9)',
	},
	action: {
		// default (primary blue) #2563eb
		default: 'oklch(0.546 0.215 262.9)',
		// hazard (red) #dc2626
		hazard: 'oklch(0.577 0.215 27.3)',
		// caution (amber) #d97706 -- used by warning actions (e.g. confirm caution)
		caution: 'oklch(0.666 0.157 58.3)',
		// neutral (slate) #64748b
		neutral: 'oklch(0.554 0.041 257.4)',
		// link -- matches default today; package #5 may distinguish underlined links.
		link: 'oklch(0.546 0.215 262.9)',
	},
	signal: {
		// success #16a34a / warning #d97706 / danger #dc2626 / info #0284c7
		success: 'oklch(0.627 0.170 149.2)',
		warning: 'oklch(0.666 0.157 58.3)',
		danger: 'oklch(0.577 0.215 27.3)',
		info: 'oklch(0.588 0.139 242.0)',
	},
	focus: 'oklch(0.546 0.215 262.9)',
	accent: {
		// Indigo #4f46e5 for code chips / reference / definition highlights.
		code: 'oklch(0.511 0.230 277.0)',
		reference: 'oklch(0.511 0.230 277.0)',
		definition: 'oklch(0.511 0.230 277.0)',
	},
	// Explicit ink overrides -- our brand blues/reds/greens sit around OKLCH
	// L=0.55-0.65, which the derive-math threshold (>0.5 -> black ink) flips
	// to dark text. Human perception and the pre-foundation theme both used
	// white ink on solid brand fills; keep that parity here. Package #5 can
	// revisit as part of the contrast pass.
	overrides: {
		action: {
			default: { ink: 'oklch(1.000 0.000 89.9)' },
			hazard: { ink: 'oklch(1.000 0.000 89.9)' },
			caution: { ink: 'oklch(1.000 0.000 89.9)' },
			neutral: { ink: 'oklch(1.000 0.000 89.9)' },
			link: { ink: 'oklch(1.000 0.000 89.9)' },
		},
		signal: {
			success: { ink: 'oklch(1.000 0.000 89.9)' },
			warning: { ink: 'oklch(1.000 0.000 89.9)' },
			danger: { ink: 'oklch(1.000 0.000 89.9)' },
			info: { ink: 'oklch(1.000 0.000 89.9)' },
		},
	},
};
