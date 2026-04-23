import type { Theme } from '../../contract';
import '../../core/defaults/airboss-default/index';
import { registerTheme } from '../../registry';
import { chrome } from './chrome';
import { control } from './control';
import { palette as paletteDark } from './palette.dark';
import { sim } from './sim';
import { typography } from './typography';

/**
 * sim/glass -- glass cockpit instrument theme.
 *
 * Dark-only. Instruments don't do light mode: a sunlit attitude
 * indicator is both visually wrong and physically impossible to read
 * against real daylight. The resolver refuses to render this theme in
 * a light appearance.
 *
 * Extends `airboss/default` for the non-instrument role vocabulary so
 * `@ab/ui` primitives (buttons, inputs) still work inside sim chrome.
 * Instrument SVGs consume the `--sim-*` role tokens populated from the
 * `sim` slot.
 */
export const simGlass: Theme = {
	id: 'sim/glass',
	name: 'Glass Cockpit',
	description:
		'Dark-only glass-cockpit theme. Deep black instrument panels, indicator-yellow pointers, mono-dense chrome.',
	extends: 'airboss/default',
	appearances: ['dark'],
	defaultAppearance: 'dark',
	layouts: {
		cockpit: './layouts/cockpit.css',
		dashboard: '../../core/defaults/airboss-default/layouts/dashboard.css',
	},
	defaultLayout: 'cockpit',
	palette: {
		dark: paletteDark,
	},
	typography,
	chrome,
	control,
	sim,
};

registerTheme(simGlass);
