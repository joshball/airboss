/**
 * airboss/default avionics tokens -- light + dark.
 *
 * Surface-agnostic instrument color roles consumed by the avionics PFD
 * (and later MFD). Every theme that ships inherits these via the
 * `extends: 'airboss/default'` chain unless it overrides explicitly.
 *
 * Color choices:
 *   - dark.sky / dark.ground match standard glass-cockpit horizon
 *     (steel blue / warm brown). Tuned to read against `--surface-panel`
 *     near `#0b1120` without bleeding.
 *   - light.sky / light.ground are lifted versions of the same hues so
 *     the attitude indicator reads "sky over ground" in light mode
 *     without trying to look like daylight (which would defeat the
 *     instrument metaphor).
 *   - pointer is indicator-yellow, deepened in light mode for contrast
 *     against a light backplate.
 *   - arc colors follow ASI convention: white (Vs0..Vfe), green
 *     (Vs1..Vno), yellow (Vno..Vne), red (Vne line). Same hex in light
 *     and dark; AA contrast holds against both `--surface-panel`
 *     extremes because the arcs are saturated mid-luminance.
 *
 * See `docs/products/avionics/work-packages/avionics-app-scaffold/design.md`
 * (PFD rendering: light and dark) for the role->token mapping the PFD
 * components consume.
 */

import type { AvionicsThemeBlock } from '../../../contract';

export const avionics: AvionicsThemeBlock = {
	dark: {
		sky: '#3b7bb5', // steel blue, sampled from sim/glass horizon
		ground: '#7a4e25', // warm brown, sampled from sim/glass horizon
		pointer: '#ffe270', // indicator yellow -- aviation convention
		arc: {
			white: '#eaeaea', // Vs0..Vfe (flap operating range)
			green: '#2fb856', // Vs1..Vno (normal operating)
			yellow: '#e9c53c', // Vno..Vne (caution)
			red: '#e0443e', // Vne (never exceed)
		},
	},
	light: {
		sky: '#9bb4c8', // lighter steel-blue, reads against light-mode panels
		ground: '#a08365', // lighter warm brown, balances against light surface
		pointer: '#c69a00', // deeper yellow for AA contrast on light backplate
		arc: {
			white: '#3a3a3a', // dark grey stands in for "white arc" against a light backplate
			green: '#1a8a47', // deeper green for AA contrast in light mode
			yellow: '#a87c00', // deeper yellow for AA contrast in light mode
			red: '#b22e29', // deeper red for AA contrast in light mode
		},
	},
};
