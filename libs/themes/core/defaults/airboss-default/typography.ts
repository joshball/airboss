/**
 * airboss-default -- atomic typography.
 *
 * Package #1 only emits atomic tokens (family / size / weight / line-height
 * / tracking). Package #2 layers the bundle vocabulary (reading/heading/
 * ui/code/definition) on top, resolving each bundle to five sub-properties.
 *
 * Values mirror what the old `web` theme shipped so prose, controls, and
 * headings render identically after the rename.
 */

import type { TypographyPack } from '../../../contract';

export const airbossDefaultTypography: TypographyPack = {
	families: {
		sans: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
		mono: `ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace`,
		base: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
	},
	sizes: {
		xs: '0.75rem',
		sm: '0.875rem',
		body: '0.9375rem',
		base: '1rem',
		lg: '1.125rem',
		xl: '1.375rem',
		'2xl': '1.75rem',
	},
	weights: {
		regular: 400,
		medium: 500,
		semibold: 600,
		bold: 700,
	},
	lineHeights: {
		tight: 1.2,
		normal: 1.5,
		relaxed: 1.65,
	},
	letterSpacings: {
		tight: '-0.01em',
		normal: '0',
		wide: '0.04em',
		caps: '0.08em',
	},
};
