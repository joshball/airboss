/**
 * study/flightdeck chrome -- sharp corners, flat shadows, denser than the
 * reading theme without collapsing into tiny "zoom me to 133%" UI.
 */

import type { Chrome } from '../../contract';

const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

export const chrome: Chrome = {
	space: {
		'2xs': '0.1875rem',
		xs: '0.3125rem',
		sm: '0.5rem',
		md: '0.75rem',
		lg: '1rem',
		xl: '1.25rem',
		'2xl': '1.75rem',
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
		containerPadding: '0.875rem',
		gridGap: '0.875rem',
		panelPadding: '0.75rem',
		panelGap: '0.5rem',
		panelHeaderSize: '0.9375rem',
		panelHeaderWeight: '600',
		panelHeaderTransform: 'uppercase',
		panelHeaderTracking: '0.08em',
		panelHeaderFamily: MONO,
	},
};
