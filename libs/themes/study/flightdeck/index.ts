import type { Theme } from '../../contract';
import { registerTheme } from '../../registry';
import '../../core/defaults/airboss-default/index';
import { control } from '../../core/defaults/airboss-default/control';
import { chrome } from './chrome';
import { palette as paletteDark } from './palette.dark';
import { palette as paletteLight } from './palette.light';
import { typography } from './typography';

export const studyFlightdeck: Theme = {
	id: 'study/flightdeck',
	name: 'Flightdeck',
	description: 'Dense dashboard theme. Mono, 2px radii, flat shadows, full-bleed grid.',
	extends: 'airboss/default',
	appearances: ['light', 'dark'],
	defaultAppearance: 'light',
	layouts: { dashboard: './layouts/dashboard.css' },
	defaultLayout: 'dashboard',
	palette: {
		light: paletteLight,
		dark: paletteDark,
	},
	typography,
	chrome,
	control,
};

registerTheme(studyFlightdeck);
