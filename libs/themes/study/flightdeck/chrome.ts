/**
 * study/flightdeck -- sharp-corner, flat-shadow chrome.
 *
 * Overrides radii, shadows, motion, spacing, and layout from
 * airboss/default to recreate the pre-foundation `tui` treatment: 2px
 * corners on every control, no drop shadows anywhere, tighter spacing,
 * full-bleed container, uppercase panel headers. Everything else (z-index,
 * breakpoints) inherits because it doesn't need to diverge.
 */

import type { Chrome } from '../../contract';
import { airbossDefaultChrome } from '../../core/defaults/airboss-default/chrome';

const monoStack = `ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace`;

export const flightdeckChrome: Chrome = {
	...airbossDefaultChrome,
	space: {
		'2xs': '0.125rem',
		xs: '0.25rem',
		sm: '0.375rem',
		md: '0.5rem',
		lg: '0.75rem',
		xl: '1rem',
		'2xl': '1.5rem',
	},
	radii: {
		sharp: '0',
		xs: '2px',
		sm: '2px',
		md: '2px',
		lg: '2px',
		pill: '999px',
	},
	shadows: {
		none: 'none',
		sm: 'none',
		md: 'none',
		lg: 'none',
	},
	motion: {
		fast: '80ms ease-out',
		normal: '120ms ease-out',
	},
	layout: {
		containerMax: 'none',
		containerPadding: '0.75rem',
		gridGap: '0.5rem',
		panelPadding: '0.625rem',
		panelGap: '0.5rem',
		panelHeaderSize: '0.6875rem',
		panelHeaderWeight: 600,
		panelHeaderTransform: 'uppercase',
		panelHeaderTracking: '0.08em',
		panelHeaderFamily: monoStack,
	},
};
