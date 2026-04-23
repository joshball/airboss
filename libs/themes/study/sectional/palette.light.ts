/**
 * study/sectional -- light palette overrides.
 *
 * Sectional is the default study reading surface (memory, plans, knowledge,
 * glossary, etc.). It inherits every value from airboss/default today;
 * override leaves stay empty so the extends chain does the work. Package
 * #5 may tune reading-surface-specific ink/paper contrast here.
 */

import type { Palette } from '../../contract';
import { airbossDefaultLightPalette } from '../../core/defaults/airboss-default/palette.light';

export const sectionalLightPalette: Palette = airbossDefaultLightPalette;
