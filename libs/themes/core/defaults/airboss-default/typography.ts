/**
 * airboss-default typography pack — references `airboss-standard`.
 *
 * Pack authoring lives in `libs/themes/core/typography-packs.ts`. This
 * module exists so `airboss/default` can keep its per-theme
 * `typography` slot; swapping packs is a one-line change here.
 */

import type { TypographyPack } from '../../../contract';
import { AIRBOSS_STANDARD_PACK } from '../../typography-packs';

export const typography: TypographyPack = AIRBOSS_STANDARD_PACK;
