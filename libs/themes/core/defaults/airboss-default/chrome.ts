/**
 * Chrome -- spacing, radii, shadows, motion, and layout values for the
 * airboss default (reading-column / rounded / soft-shadow) theme.
 *
 * Values are ported verbatim from the legacy web token set.
 */

import type { Chrome } from '../../../contract';

export const chrome: Chrome = {
	space: {
		'2xs': '0.25rem',
		xs: '0.375rem',
		sm: '0.5rem',
		md: '0.75rem',
		lg: '1rem',
		xl: '1.5rem',
		'2xl': '2rem',
	},
	radius: {
		sharp: '0',
		xs: '3px',
		sm: '6px',
		md: '8px',
		lg: '10px',
		pill: '999px',
	},
	shadow: {
		none: 'none',
		sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
		md: '0 2px 6px rgba(15, 23, 42, 0.06)',
		lg: '0 6px 16px rgba(15, 23, 42, 0.08)',
	},
	motion: {
		fast: '120ms ease-out',
		normal: '200ms ease-out',
		slow: '800ms ease-out',
	},
	layout: {
		containerMax: '48rem',
		containerPadding: '1.5rem',
		gridGap: '1rem',
		panelPadding: '1.25rem',
		panelGap: '0.75rem',
		panelHeaderSize: '1.125rem',
		panelHeaderWeight: '600',
		panelHeaderTransform: 'none',
		panelHeaderTracking: '0',
		panelHeaderFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	},
};
