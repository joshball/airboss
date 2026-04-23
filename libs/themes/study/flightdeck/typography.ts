/**
 * study/flightdeck typography -- mono stack everywhere.
 *
 * Package #1 inherits airboss-default's bundle shape and remaps every
 * family key to the mono stack. Package #2 may ship a dedicated
 * flightdeck pack; until then this preserves the legacy atomic
 * behavior under the new typed surface.
 */

import type { TypographyPack } from '../../contract';
import { typography as defaultTypography } from '../../core/defaults/airboss-default/typography';

const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

export const typography: TypographyPack = {
	packId: 'flightdeck-mono',
	families: {
		sans: MONO,
		mono: MONO,
		base: MONO,
	},
	scale: defaultTypography.scale,
	bundles: defaultTypography.bundles,
};
