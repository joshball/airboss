/**
 * Verify that the theme emit pipeline ships the control / dialog /
 * table / badge-height tokens that primitives consume. Fails fast if a
 * refactor drops an expected variable.
 */

import { themeToCss } from '@ab/themes';
import { describe, expect, it } from 'vitest';
import { getTheme } from '../../themes/registry';

const REQUIRED_TOKENS = [
	// Button variants
	'--button-default-bg',
	'--button-primary-bg',
	'--button-hazard-bg',
	'--button-neutral-bg',
	'--button-ghost-bg',
	'--button-primary-ink',
	'--button-primary-hover-bg',
	'--button-primary-active-bg',
	'--button-primary-disabled-bg',
	'--button-primary-ring',
	// Input variants
	'--input-default-bg',
	'--input-error-border',
	'--input-error-ring',
	// Per-size heights
	'--button-height-sm',
	'--button-height-md',
	'--button-height-lg',
	'--input-height-sm',
	'--input-height-lg',
	'--badge-height-sm',
	'--badge-height-md',
	'--badge-height-lg',
	// Dialog component tokens
	'--dialog-bg',
	'--dialog-edge',
	'--dialog-radius',
	'--dialog-shadow',
	'--dialog-scrim',
	// Table component tokens
	'--table-header-bg',
	'--table-header-ink',
	'--table-row-edge',
	'--table-row-bg-hover',
	'--table-row-bg-selected',
	// Underline offset scale
	'--underline-offset-2xs',
];

describe('component tokens emission', () => {
	it('airboss/default (light) emits every required component token', () => {
		const theme = getTheme('airboss/default');
		const css = themeToCss(theme, 'light');
		const missing = REQUIRED_TOKENS.filter((t) => !css.includes(`${t}:`));
		expect(missing, `missing tokens: ${missing.join(', ')}`).toEqual([]);
	});

	it('airboss/default (dark) emits every required component token', () => {
		const theme = getTheme('airboss/default');
		const css = themeToCss(theme, 'dark');
		const missing = REQUIRED_TOKENS.filter((t) => !css.includes(`${t}:`));
		expect(missing, `missing tokens: ${missing.join(', ')}`).toEqual([]);
	});
});
