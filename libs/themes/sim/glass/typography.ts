/**
 * sim/glass typography -- references `airboss-compact` (mono-dense).
 *
 * Cockpit chrome wants compact, tight-leading, mono-dominant text so
 * readouts align and numeric columns don't drift. The compact pack
 * collapses every family to a mono stack where it matters.
 */

import type { TypographyPack } from '../../contract';
import { AIRBOSS_COMPACT_PACK } from '../../core/typography-packs';

export const typography: TypographyPack = AIRBOSS_COMPACT_PACK;
