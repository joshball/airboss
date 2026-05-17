/**
 * Shared href resolver for the handbook reader routes.
 *
 * Every handbook route (`+layout`, `[chapter]`, `[chapter]/[section]`) builds
 * prev/next nav + a rail TOC from the same flat section tree, and each used to
 * carry its own inline `hrefFor` resolver. Front-matter rows broke that: they
 * are depth-0 (`parentId === null`) peers of the chapters with code `0.N` and
 * `level='front-matter'`, so the old "parentId === null -> chapter URL"
 * resolvers sent them to `/handbook/<slug>/<ed>/0` -- a chapter that doesn't
 * exist. Centralising the resolver here keeps the front-matter case correct
 * across the rail, the prev/next walk, and every section list.
 *
 * The resolver dispatches on `level`:
 *
 *  - `front-matter` -> the dedicated front-matter leaf route, keyed by the
 *    full row code (`0.2`).
 *  - depth-0 (`parentId === null`) otherwise -> handbook chapter URL.
 *  - two-segment `chapter.section` code -> handbook section URL.
 *  - anything deeper (3+ segments) -> `null` (no dedicated reader).
 */

import { REFERENCE_SECTION_LEVELS, ROUTES } from '@ab/constants';

/**
 * Minimal row shape the resolver needs. Both `ReferenceSectionRow` (the nav
 * walk) and `ReadingOrderEntry` (the TOC) satisfy it. `level` is typed as the
 * raw DB string -- the per-corpus level vocabulary is not DB-enforced, so the
 * column is `string`; the resolver compares against the enum constant.
 */
export interface HandbookHrefRow {
	readonly parentId: string | null;
	readonly code: string;
	readonly level: string;
}

/**
 * Resolve a handbook section row to its flightbag reader URL, or `null` when
 * the row has no dedicated reader page (deeper-than-section subsections).
 */
export function handbookHrefFor(slug: string, shortEdition: string, row: HandbookHrefRow): string | null {
	if (row.level === REFERENCE_SECTION_LEVELS.FRONT_MATTER) {
		return ROUTES.FLIGHTBAG_HANDBOOK_FRONT_MATTER(slug, shortEdition, row.code);
	}
	if (row.parentId === null) {
		return ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(slug, shortEdition, row.code);
	}
	const parts = row.code.split('.');
	if (parts.length !== 2) return null;
	const [chapter, section] = parts;
	if (!chapter || !section) return null;
	return ROUTES.FLIGHTBAG_HANDBOOK_SECTION(slug, shortEdition, chapter, section);
}
