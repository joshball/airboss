/**
 * study/flightdeck typography -- mono stack everywhere.
 */

import type { TypographyPack } from '../../contract';

const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

export const typography: TypographyPack = {
	packId: 'flightdeck-mono',
	families: {
		sans: MONO,
		mono: MONO,
		base: MONO,
	},
};
