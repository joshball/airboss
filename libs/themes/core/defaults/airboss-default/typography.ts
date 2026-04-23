/**
 * Typography pack -- atomic families only. Bundle-per-role surface
 * (reading/heading/ui/code/definition) lands in package #2.
 */

import type { TypographyPack } from '../../../contract';

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

export const typography: TypographyPack = {
	packId: 'airboss-default-sans',
	families: {
		sans: SANS,
		mono: MONO,
		base: SANS,
	},
};
