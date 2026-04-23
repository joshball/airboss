/**
 * airboss-default typography pack.
 *
 * Package #1 lands the bundle-per-role shape. Values mirror the legacy
 * atomic scale (`--font-size-*`, weights, line-heights, tracking) so
 * primitives rendering via `--type-*` match what the legacy
 * `--font-*` atoms produce. Package #2 curates alternative packs.
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
	scale: 1,
	bundles: {
		reading: {
			body: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.65, tracking: '0' },
			lead: { family: 'base', size: '1.125rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			caption: { family: 'base', size: '0.875rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			quote: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.65, tracking: '0' },
		},
		heading: {
			1: { family: 'base', size: '1.75rem', weight: 700, lineHeight: 1.2, tracking: '-0.01em' },
			2: { family: 'base', size: '1.375rem', weight: 700, lineHeight: 1.2, tracking: '-0.01em' },
			3: { family: 'base', size: '1.125rem', weight: 600, lineHeight: 1.2, tracking: '0' },
			4: { family: 'base', size: '1rem', weight: 600, lineHeight: 1.5, tracking: '0' },
			5: { family: 'base', size: '0.9375rem', weight: 600, lineHeight: 1.5, tracking: '0' },
			6: { family: 'base', size: '0.875rem', weight: 600, lineHeight: 1.5, tracking: '0.04em' },
		},
		ui: {
			control: { family: 'base', size: '1rem', weight: 500, lineHeight: 1.2, tracking: '0' },
			label: { family: 'base', size: '0.875rem', weight: 500, lineHeight: 1.5, tracking: '0' },
			caption: { family: 'base', size: '0.75rem', weight: 500, lineHeight: 1.5, tracking: '0.04em' },
			badge: { family: 'base', size: '0.75rem', weight: 600, lineHeight: 1.2, tracking: '0.04em' },
		},
		code: {
			inline: { family: 'mono', size: '0.9375rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			block: { family: 'mono', size: '0.875rem', weight: 400, lineHeight: 1.65, tracking: '0' },
		},
		definition: {
			term: { family: 'base', size: '0.9375rem', weight: 600, lineHeight: 1.5, tracking: '0' },
			body: { family: 'base', size: '0.9375rem', weight: 400, lineHeight: 1.65, tracking: '0' },
		},
	},
};
