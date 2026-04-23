/**
 * airboss-default -- chrome (scales + layout).
 *
 * Spacing / radius / shadow / motion / layout all match the pre-foundation
 * `web` theme values. The flightdeck theme overrides radii to sharp,
 * shadows to none, and layout to full-bleed in its own `chrome.ts`.
 */

import type { Chrome } from '../../../contract';

export const airbossDefaultChrome: Chrome = {
	space: {
		'2xs': '0.25rem',
		xs: '0.375rem',
		sm: '0.5rem',
		md: '0.75rem',
		lg: '1rem',
		xl: '1.5rem',
		'2xl': '2rem',
	},
	radii: {
		sharp: '0',
		xs: '3px',
		sm: '6px',
		md: '8px',
		lg: '12px',
		pill: '999px',
	},
	shadows: {
		none: 'none',
		sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
		md: '0 2px 6px rgba(15, 23, 42, 0.06)',
		lg: '0 6px 16px rgba(15, 23, 42, 0.08)',
	},
	motion: {
		fast: '120ms ease-out',
		normal: '200ms ease-out',
	},
	zIndex: {
		base: 0,
		dropdown: 10,
		sticky: 20,
		overlay: 30,
		modal: 40,
		toast: 50,
		tooltip: 60,
	},
	breakpoints: {
		sm: '480px',
		md: '640px',
		lg: '960px',
		xl: '1280px',
	},
	layout: {
		containerMax: '48rem',
		containerPadding: '1.5rem',
		gridGap: '1rem',
		panelPadding: '1.25rem',
		panelGap: '0.75rem',
		panelHeaderSize: '1.125rem',
		panelHeaderWeight: 600,
		panelHeaderTransform: 'none',
		panelHeaderTracking: '0',
		panelHeaderFamily: `system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
	},
};
