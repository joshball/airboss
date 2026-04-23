/**
 * study/sectional -- study's reading surface.
 *
 * Replaces the pre-foundation `web` theme. Inherits everything from
 * airboss/default; only the id / name / description change so pages that
 * opt into "reading mode" get a distinct data-theme attribute. Package #6
 * will add real dark swatches; package #5 may tune ink contrast.
 */

import type { Theme } from '../../contract';
import { registerTheme } from '../../registry';
import { airbossDefaultTheme } from '../../core/defaults/airboss-default';
import { sectionalDarkPalette } from './palette.dark';
import { sectionalLightPalette } from './palette.light';

export const sectionalTheme: Theme = {
	id: 'study/sectional',
	name: 'sectional',
	description: 'Reading surface for study -- centered column, prose-friendly typography.',
	extends: airbossDefaultTheme.id,
	appearances: ['light', 'dark'],
	defaultAppearance: 'light',
	layouts: {
		reading: 'study/sectional/layouts/reading.css',
	},
	defaultLayout: 'reading',
	palette: {
		light: sectionalLightPalette,
		dark: sectionalDarkPalette,
	},
};

registerTheme(sectionalTheme);
