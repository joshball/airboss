/**
 * Curated typography packs.
 *
 * A typography pack bundles font stacks (`families`) + per-family size
 * multipliers (`adjustments`) + the full role-bundle surface. Packs are
 * theme-agnostic; a theme picks a pack by reference and may override
 * individual bundles.
 *
 * Today we ship two packs:
 *   - `airbossStandard`  — sans-driven, reasonable reading column. Used
 *     by `airboss/default` + `study/sectional`.
 *   - `airbossCompact`   — mono-driven, compressed leading, flat
 *     tracking. Used by `study/flightdeck` (dashboard density).
 *
 * A third `airbossDisplaySerif` pack is reserved for a future theme;
 * we don't ship it until a consuming theme exists (YAGNI).
 */

import type { TypographyPack } from '../contract';

// ---------------------------------------------------------------------
// Font stacks
// ---------------------------------------------------------------------

const STACK_SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const STACK_SERIF = "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif";
const STACK_MONO = "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

// ---------------------------------------------------------------------
// airboss-standard — the default sans pack
// ---------------------------------------------------------------------

export const AIRBOSS_STANDARD_PACK: TypographyPack = {
	packId: 'airboss-standard',
	families: {
		sans: STACK_SANS,
		serif: STACK_SERIF,
		mono: STACK_MONO,
		base: STACK_SANS,
	},
	adjustments: {
		sans: 1,
		serif: 0.95,
		mono: 1.05,
		base: 1,
	},
	bundles: {
		reading: {
			body: { family: 'base', size: '1rem', weight: 400, lineHeight: 1.65, tracking: '0' },
			lead: { family: 'base', size: '1.125rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			caption: { family: 'base', size: '0.875rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			quote: { family: 'serif', size: '1rem', weight: 400, lineHeight: 1.65, tracking: '0' },
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
			badge: { family: 'base', size: '0.75rem', weight: 600, lineHeight: 1.2, tracking: '0.08em' },
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

// ---------------------------------------------------------------------
// airboss-compact — mono, dashboard density
// ---------------------------------------------------------------------

export const AIRBOSS_COMPACT_PACK: TypographyPack = {
	packId: 'airboss-compact',
	families: {
		sans: STACK_MONO,
		serif: STACK_MONO,
		mono: STACK_MONO,
		base: STACK_MONO,
	},
	adjustments: {
		// Mono faces already render ~5% wider than equivalent sans; the
		// compact pack absorbs that by trimming all families back to 1.0.
		sans: 1,
		serif: 1,
		mono: 1,
		base: 1,
	},
	bundles: {
		reading: {
			body: { family: 'base', size: '0.9375rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			lead: { family: 'base', size: '1rem', weight: 500, lineHeight: 1.4, tracking: '0' },
			caption: { family: 'base', size: '0.8125rem', weight: 400, lineHeight: 1.4, tracking: '0' },
			quote: { family: 'base', size: '0.9375rem', weight: 400, lineHeight: 1.5, tracking: '0' },
		},
		heading: {
			1: { family: 'base', size: '1.5rem', weight: 700, lineHeight: 1.2, tracking: '0' },
			2: { family: 'base', size: '1.25rem', weight: 700, lineHeight: 1.2, tracking: '0' },
			3: { family: 'base', size: '1.0625rem', weight: 600, lineHeight: 1.2, tracking: '0' },
			4: { family: 'base', size: '0.9375rem', weight: 600, lineHeight: 1.4, tracking: '0' },
			5: { family: 'base', size: '0.875rem', weight: 600, lineHeight: 1.4, tracking: '0' },
			6: { family: 'base', size: '0.8125rem', weight: 600, lineHeight: 1.4, tracking: '0.04em' },
		},
		ui: {
			control: { family: 'base', size: '0.9375rem', weight: 500, lineHeight: 1.2, tracking: '0' },
			label: { family: 'base', size: '0.8125rem', weight: 500, lineHeight: 1.4, tracking: '0' },
			caption: { family: 'base', size: '0.6875rem', weight: 500, lineHeight: 1.4, tracking: '0.04em' },
			badge: { family: 'base', size: '0.6875rem', weight: 600, lineHeight: 1.2, tracking: '0.08em' },
		},
		code: {
			inline: { family: 'mono', size: '0.9375rem', weight: 400, lineHeight: 1.5, tracking: '0' },
			block: { family: 'mono', size: '0.875rem', weight: 400, lineHeight: 1.5, tracking: '0' },
		},
		definition: {
			term: { family: 'base', size: '0.875rem', weight: 600, lineHeight: 1.4, tracking: '0' },
			body: { family: 'base', size: '0.875rem', weight: 400, lineHeight: 1.5, tracking: '0' },
		},
	},
};

/** Named catalogue. Callers pick a pack by id; themes reference the
 * pack object directly so the type system catches invalid bundles. */
export const TYPOGRAPHY_PACKS = {
	[AIRBOSS_STANDARD_PACK.packId]: AIRBOSS_STANDARD_PACK,
	[AIRBOSS_COMPACT_PACK.packId]: AIRBOSS_COMPACT_PACK,
} as const;
