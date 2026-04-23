import type { Theme } from '../../contract';
import { registerTheme } from '../../registry';
import '../../core/defaults/airboss-default/index';
import { chrome } from './chrome';
import { palette as paletteDark } from './palette.dark';
import { palette as paletteLight } from './palette.light';
import { typography } from './typography';

export const studySectional: Theme = {
	id: 'study/sectional',
	name: 'Sectional',
	description: 'Reading-column theme for study routes. Rounded, generous, mixed sans.',
	extends: 'airboss/default',
	appearances: ['light', 'dark'],
	defaultAppearance: 'light',
	layouts: { reading: './layouts/reading.css' },
	defaultLayout: 'reading',
	palette: {
		light: paletteLight,
		dark: paletteDark,
	},
	typography,
	chrome,
};

registerTheme(studySectional);
