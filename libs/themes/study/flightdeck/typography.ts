/**
 * study/flightdeck typography — references `airboss-compact`.
 *
 * Flightdeck is a dashboard density theme: every family collapses to a
 * mono stack, sizes are compressed, leading is tighter. The
 * `airboss-compact` pack encodes all of that; this module just
 * re-exports it so the theme wiring stays uniform.
 */

import type { TypographyPack } from '../../contract';
import { AIRBOSS_COMPACT_PACK } from '../../core/typography-packs';

export const typography: TypographyPack = AIRBOSS_COMPACT_PACK;
