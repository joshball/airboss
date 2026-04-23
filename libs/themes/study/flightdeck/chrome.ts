/**
 * study/flightdeck chrome -- sharp corners, flat shadows, tighter space.
 * Values ported verbatim from the legacy `tui` theme.
 */

import type { Chrome } from '../../contract';

const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

export const chrome: Chrome = {
	space: {
		'2xs': '0.125rem',
		xs: '0.25rem',
		sm: '0.375rem',
		md: '0.5rem',
		lg: '0.75rem',
		xl: '1rem',
		'2xl': '1.5rem',
	},
	radius: {
		sharp: '0',
		xs: '2px',
		sm: '2px',
		md: '2px',
		lg: '2px',
		pill: '999px',
	},
	shadow: {
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
		panelHeaderWeight: '600',
		panelHeaderTransform: 'uppercase',
		panelHeaderTracking: '0.08em',
		panelHeaderFamily: MONO,
	},
};
