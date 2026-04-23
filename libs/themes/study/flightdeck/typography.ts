/**
 * study/flightdeck -- monospace-forward typography.
 *
 * Everything scales down one tier versus airboss-default so panel headers,
 * labels, and metadata pack onto a dense grid. Families flip to mono for
 * the whole theme; prose rarely appears on flightdeck surfaces, and when
 * it does the mono treatment reads as intentional TUI styling.
 *
 * Values match the pre-foundation `tui` theme 1:1 so dashboard measurements
 * don't shift.
 */

import type { TypographyPack } from '../../contract';

const monoStack = `ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace`;

export const flightdeckTypography: TypographyPack = {
	families: {
		// Both "sans" and "base" fall back to mono on flightdeck so panels
		// that read `--font-family-sans` don't accidentally render a sans
		// paragraph inside a dashboard grid.
		sans: monoStack,
		mono: monoStack,
		base: monoStack,
	},
	sizes: {
		xs: '0.6875rem',
		sm: '0.75rem',
		body: '0.75rem',
		base: '0.8125rem',
		lg: '0.9375rem',
		xl: '1.0625rem',
		'2xl': '1.25rem',
	},
	weights: {
		regular: 400,
		medium: 500,
		semibold: 600,
		bold: 700,
	},
	lineHeights: {
		tight: 1.15,
		normal: 1.4,
		relaxed: 1.55,
	},
	letterSpacings: {
		tight: '0',
		normal: '0',
		wide: '0.04em',
		caps: '0.08em',
	},
};
