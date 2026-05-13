/**
 * Vertical type-nav buckets (Phase 3.5 / R8).
 *
 * The previous five-column layout grouped results by `ResultColumn`
 * (Library / Airboss Content / App Help / My Stuff / External Tools).
 * Phase 3.5 collapses that into a single result column and turns the
 * groups into a left-side vertical type-nav with finer-grained buckets:
 * Handbooks, CFRs, AIM, AC, ACS, Knowledge nodes, Courses, Glossary,
 * Mine, Tools, App Help.
 *
 * Source of truth: `design/mockups/search/mockup-02-new-layout.md`
 * ("Type bucket order").
 *
 * The `COLUMN_BY_TYPE` and `COLUMN_ORDER` mappings in
 * `result-types.ts` stay in place -- they remain the back-compat layer
 * for the legacy `clusters` field and any non-3.5 consumer. The type-nav
 * uses this finer mapping.
 */

import type { SearchResultType } from './result-types';

/** Vertical type-nav bucket id. */
export type TypeBucket =
	| 'handbooks'
	| 'cfrs'
	| 'aim'
	| 'ac'
	| 'acs'
	| 'knowledge'
	| 'courses'
	| 'glossary'
	| 'mine'
	| 'tools'
	| 'app-help';

/** User-facing bucket label. */
export const TYPE_BUCKET_LABELS: Record<TypeBucket, string> = {
	handbooks: 'Handbooks',
	cfrs: 'CFRs',
	aim: 'AIM',
	ac: 'AC',
	acs: 'ACS / PTS',
	knowledge: 'Knowledge',
	courses: 'Courses',
	glossary: 'Glossary',
	mine: 'Mine',
	tools: 'Tools',
	'app-help': 'App Help',
};

/**
 * Ordered list of buckets for the vertical nav. Matches the mockup's
 * "Type bucket order" -- usefulness for a working pilot.
 */
export const TYPE_BUCKET_ORDER: readonly TypeBucket[] = [
	'handbooks',
	'cfrs',
	'aim',
	'ac',
	'acs',
	'knowledge',
	'courses',
	'glossary',
	'mine',
	'tools',
	'app-help',
];

/**
 * Mapping from result type -> bucket. Exhaustive (TS compile-error if a
 * new `SearchResultType` is added without assigning it a bucket).
 */
export const BUCKET_BY_TYPE: Record<SearchResultType, TypeBucket> = {
	'faa.handbook': 'handbooks',
	'faa.handbook.chapter': 'handbooks',
	'faa.cfr.part': 'cfrs',
	'faa.cfr.sect': 'cfrs',
	'faa.aim': 'aim',
	'faa.ac': 'ac',
	'faa.acs': 'acs',
	'airboss.course': 'courses',
	'airboss.knode': 'knowledge',
	'airboss.glossary': 'glossary',
	'airboss.lesson': 'courses',
	'airboss.help': 'app-help',
	'mine.card': 'mine',
	'mine.rep': 'mine',
	'mine.plan': 'mine',
	'mine.note': 'mine',
	'web.tool': 'tools',
	// Commands sit alongside Mine in Phase 4; until then they don't show up.
	'cmd.action': 'mine',
	'cmd.goto': 'mine',
};

/**
 * Buckets hidden by default when they have zero hits AND any other
 * bucket has at least one hit. App Help is the canonical case: it
 * surfaces only when the user filters to it explicitly or when no other
 * bucket has results.
 */
export const HIDDEN_BY_DEFAULT_WHEN_EMPTY: ReadonlySet<TypeBucket> = new Set(['app-help']);

/**
 * Whether to render a "type chip" badge on the row. Off for `tools`,
 * `commands`, and other non-published rows where the title already
 * carries enough disambiguation; on for everything in Library (handbooks,
 * CFRs, AIM, AC, ACS).
 */
export const SHOWS_DOC_CODE_ROW: ReadonlySet<TypeBucket> = new Set(['handbooks', 'cfrs', 'aim', 'ac', 'acs']);
