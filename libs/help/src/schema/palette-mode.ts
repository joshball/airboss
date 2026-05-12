/**
 * Palette mode contract. Three modes share one input, ranker, and registry;
 * `PALETTE_MODE_ELIGIBLE` selects which result types each mode renders.
 *
 * `Cmd+K` -- search, every type.
 * `Cmd+P` -- quickopen, "things you can jump to" (Phase 5).
 * `Cmd+Shift+P` -- command, actions only (Phase 4).
 *
 * Source: `docs/work-packages/command-palette/spec.md` ("Mode contract").
 */

import type { SearchResultType } from './result-types';

export type PaletteMode = 'search' | 'quickopen' | 'command';

export const PALETTE_MODES: readonly PaletteMode[] = ['search', 'quickopen', 'command'];

/** Every type known to the palette -- equivalent to `ALL_TYPES` in the spec. */
const ALL_TYPES: ReadonlySet<SearchResultType> = new Set([
	'faa.handbook',
	'faa.handbook.chapter',
	'faa.cfr.part',
	'faa.cfr.sect',
	'faa.aim',
	'faa.ac',
	'faa.acs',
	'airboss.course',
	'airboss.knode',
	'airboss.glossary',
	'airboss.lesson',
	'airboss.help',
	'mine.card',
	'mine.rep',
	'mine.plan',
	'mine.note',
	'web.tool',
	'cmd.action',
	'cmd.goto',
]);

export const PALETTE_MODE_ELIGIBLE: Record<PaletteMode, ReadonlySet<SearchResultType>> = {
	search: ALL_TYPES,
	quickopen: new Set(['faa.handbook', 'faa.cfr.part', 'airboss.course', 'airboss.knode', 'mine.plan', 'cmd.goto']),
	command: new Set(['cmd.action', 'cmd.goto']),
};
