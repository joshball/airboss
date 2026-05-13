/**
 * Per-type palette accent family.
 *
 * Maps every `SearchResultType` to one of the five palette accent families
 * (amber / violet / cyan / green / rose) plus the no-accent `cmd` slot. The
 * mapping is locked by the design.md "Color tokens" table and the result
 * taxonomy in spec.md.
 *
 * Consumers: `CommandPalette.svelte`, `PaletteDetailPane.svelte`,
 * `PaletteRow.svelte` (and via it `PaletteTopHits`, `PaletteScopedView`,
 * `PalettePassageView`), and the three Phase 3 variant prototypes. They
 * read `accentFor(result.type)` and apply the `--palette-accent-<family>-*`
 * tokens defined in `palette-tokens.css`.
 */

import type { SearchResultType } from '../schema/result-types';

export type PaletteAccent = 'amber' | 'violet' | 'cyan' | 'green' | 'rose' | 'cmd';

const ACCENT_BY_TYPE: Record<SearchResultType, PaletteAccent> = {
	'faa.handbook': 'amber',
	'faa.handbook.chapter': 'amber',
	'faa.cfr.part': 'amber',
	'faa.cfr.sect': 'amber',
	'faa.aim': 'amber',
	'faa.ac': 'amber',
	'faa.acs': 'amber',
	'airboss.knode': 'violet',
	'airboss.glossary': 'violet',
	'airboss.course': 'cyan',
	'airboss.lesson': 'cyan',
	'airboss.help': 'cyan',
	'mine.card': 'green',
	'mine.rep': 'green',
	'mine.plan': 'green',
	'mine.note': 'green',
	'web.tool': 'rose',
	'cmd.action': 'cmd',
	'cmd.goto': 'cmd',
};

/** Accent family for a given result type. */
export function accentFor(type: SearchResultType): PaletteAccent {
	return ACCENT_BY_TYPE[type];
}
