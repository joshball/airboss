import type { Theme } from '../../../contract';
import { registerTheme } from '../../../registry';
import { chrome } from './chrome';
import { palette as paletteDark } from './palette.dark';
import { palette as paletteLight } from './palette.light';
import { typography } from './typography';

export const airbossDefault: Theme = {
	id: 'airboss/default',
	name: 'airboss default',
	description: 'Base theme shared across all airboss apps. Reading-column layout, rounded chrome.',
	appearances: ['light', 'dark'],
	defaultAppearance: 'light',
	layouts: {
		reading: './layouts/reading.css',
		dashboard: './layouts/dashboard.css',
	},
	defaultLayout: 'reading',
	palette: {
		light: paletteLight,
		dark: paletteDark,
	},
	typography,
	chrome,
};

registerTheme(airbossDefault);
