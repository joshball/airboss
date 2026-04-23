/**
 * study/flightdeck -- light palette overrides.
 *
 * Flightdeck is the dashboard / TUI surface. Today's values darken the
 * signal and action colors (the old `tui` theme used `-700` shades
 * instead of `-600`), keeping danger/warning/success from "glowing" on a
 * dense grid. Everything else inherits from airboss/default.
 */

import type { Palette } from '../../contract';
import { airbossDefaultLightPalette } from '../../core/defaults/airboss-default/palette.light';

export const flightdeckLightPalette: Palette = {
	...airbossDefaultLightPalette,
	// Background is slightly darker than sectional's #f8fafc so the grid
	// "sits down" visually -- #f1f5f9 in the old `tui` theme.
	surface: {
		...airbossDefaultLightPalette.surface,
		page: 'oklch(0.968 0.007 247.9)',
		sunken: 'oklch(0.984 0.003 247.9)',
		muted: 'oklch(0.984 0.003 247.9)',
	},
	// Signals step one lightness rung down (closer to the old -700 hex set).
	signal: {
		success: 'oklch(0.527 0.137 150.1)',
		warning: 'oklch(0.555 0.146 49.0)',
		danger: 'oklch(0.505 0.190 27.5)',
		info: 'oklch(0.500 0.119 242.7)',
	},
	// Hazard action matches the darker danger signal.
	action: {
		...airbossDefaultLightPalette.action,
		hazard: 'oklch(0.505 0.190 27.5)',
		caution: 'oklch(0.555 0.146 49.0)',
	},
};
