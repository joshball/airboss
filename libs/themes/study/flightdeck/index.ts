/**
 * study/flightdeck -- study's dashboard/TUI surface.
 *
 * Replaces the pre-foundation `tui` theme. Extends airboss/default for role
 * names and derivation behaviour, then overrides palette/typography/chrome
 * for the dense, flat, monospace look. Package #6 adds real dark mode.
 */

import type { Theme } from '../../contract';
import { registerTheme } from '../../registry';
import { airbossDefaultTheme } from '../../core/defaults/airboss-default';
import { flightdeckChrome } from './chrome';
import { flightdeckDarkPalette } from './palette.dark';
import { flightdeckLightPalette } from './palette.light';
import { flightdeckTypography } from './typography';

export const flightdeckTheme: Theme = {
	id: 'study/flightdeck',
	name: 'flightdeck',
	description: 'Dashboard surface for study -- full-bleed grid, monospace, flat chrome.',
	extends: airbossDefaultTheme.id,
	appearances: ['light', 'dark'],
	defaultAppearance: 'light',
	layouts: {
		dashboard: 'study/flightdeck/layouts/dashboard.css',
	},
	defaultLayout: 'dashboard',
	palette: {
		light: flightdeckLightPalette,
		dark: flightdeckDarkPalette,
	},
	typography: flightdeckTypography,
	chrome: flightdeckChrome,
};

registerTheme(flightdeckTheme);
