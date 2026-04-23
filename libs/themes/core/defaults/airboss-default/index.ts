/**
 * airboss-default -- shared base theme.
 *
 * Every per-app theme extends this so role-token names, typography, and
 * chrome defaults only live in one place. The default theme declares
 * `reading` as its layout; flightdeck-style themes declare `dashboard` and
 * the sectional theme inherits both via `extends`.
 */

import type { Theme } from '../../../contract';
import { registerTheme } from '../../../registry';
import { airbossDefaultChrome } from './chrome';
import { airbossDefaultDarkPalette } from './palette.dark';
import { airbossDefaultLightPalette } from './palette.light';
import { airbossDefaultTypography } from './typography';

export const airbossDefaultTheme: Theme = {
	id: 'airboss/default',
	name: 'airboss default',
	description: 'Shared base theme. Role vocabulary, typography, and chrome defaults for every airboss surface.',
	appearances: ['light', 'dark'],
	defaultAppearance: 'light',
	layouts: {
		reading: 'core/defaults/airboss-default/layouts/reading.css',
		dashboard: 'core/defaults/airboss-default/layouts/dashboard.css',
	},
	defaultLayout: 'reading',
	palette: {
		light: airbossDefaultLightPalette,
		dark: airbossDefaultDarkPalette,
	},
	typography: airbossDefaultTypography,
	chrome: airbossDefaultChrome,
};

registerTheme(airbossDefaultTheme);
