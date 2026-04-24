/**
 * sim/glass chrome -- sharp corners, flat shadows, cockpit density.
 *
 * Instrument chrome is the opposite of a reading column: tight
 * spacing, minimal radii, zero drop shadow. Mono-family panel headers
 * since the flightdeck pack drives the rest.
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
		md: '3px',
		lg: '4px',
		pill: '999px',
	},
	shadow: {
		none: 'none',
		sm: 'none',
		md: 'none',
		lg: '0 0 0 1px rgba(255, 226, 112, 0.15)',
	},
	motion: {
		fast: '80ms ease-out',
		normal: '120ms ease-out',
		slow: '600ms linear',
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
