// @browser-globals: server-only -- never imported by client .svelte
/**
 * Handbook-sections loader (DB-backed). Walks `study.reference_section` joined
 * to `study.reference` where `reference.kind = 'handbook'` and matches the
 * needle against the section's `code` + `title` + `content_md` (the body
 * substrate). Returns one `faa.handbook.chapter` row per match, carrying the
 * parent handbook's `documentSlug` as `clusterKey` so the FAA Resources
 * column can cluster the chapter under its handbook root.
 *
 * Runs server-side only: imports `@ab/db/connection`. The palette UI feeds
 * the loader's output through `searchGrouped()`'s `injected` argument from
 * the `/api/palette/search` endpoint (or any other server caller).
 *
 * Limit: 30 rows. The palette renders the top N per column; loaders cap at
 * a tight ceiling so the union across loaders fits comfortably under
 * Vitest budgets and dev-mode debounce windows.
 *
 * Body matching is gated on `MIN_BODY_NEEDLE_LENGTH` -- ilike against
 * `content_md` on a 1- or 2-character needle is the worst case for the
 * planner. Code/title matches still fire on every needle length.
 */

import { reference, referenceSection } from '@ab/bc-study';
import { REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bodySnippet, bucketByMatch, buildIlikePattern, type LoaderDb, MIN_BODY_NEEDLE_LENGTH } from './_shared';

const LOADER_LIMIT = 30;

/**
 * Match a handbook-section row from a free-text needle. Empty needle returns
 * `[]` -- handbook sections are too numerous to enumerate without a filter.
 * The caller is `searchGrouped()` which has already short-circuited the
 * fully-empty-query case.
 */
export async function loadHandbookSections(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
	const fieldMatches: SQL[] = [ilike(referenceSection.code, pattern), ilike(referenceSection.title, pattern)];
	if (needle.length >= MIN_BODY_NEEDLE_LENGTH) {
		fieldMatches.push(ilike(referenceSection.contentMd, pattern));
	}

	const rows = await db
		.select({
			sectionId: referenceSection.id,
			code: referenceSection.code,
			title: referenceSection.title,
			contentMd: referenceSection.contentMd,
			documentSlug: reference.documentSlug,
			edition: reference.edition,
			referenceTitle: reference.title,
		})
		.from(referenceSection)
		.innerJoin(reference, eq(reference.id, referenceSection.referenceId))
		.where(and(eq(reference.kind, REFERENCE_KINDS.HANDBOOK), or(...fieldMatches)))
		.orderBy(reference.documentSlug, referenceSection.code)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const { chapter, section } = splitCode(r.code);
		const href =
			section.length === 0
				? ROUTES.LIBRARY_HANDBOOK_CHAPTER(r.documentSlug, chapter)
				: ROUTES.LIBRARY_HANDBOOK_SECTION(r.documentSlug, chapter, section);
		const result: SearchResult = {
			id: r.sectionId,
			type: 'faa.handbook.chapter',
			title: `${r.code} - ${r.title}`,
			subtitle: `${r.documentSlug.toUpperCase()} - ${r.referenceTitle}`,
			snippet: bodySnippet(r.contentMd, needle),
			href,
			rankBucket: bucketByMatch(needle, r.code, r.title),
			clusterKey: r.documentSlug,
		};
		out.push(result);
	}
	return out;
}

/**
 * Split a handbook section `code` (`"12"` or `"12.3"`) into chapter + section
 * fragments for the in-app reader href. Whole-doc handbooks carry `"1"` or
 * `"publication"` as `code`; the route degrades to the chapter-only path
 * when no dot-separator is present.
 */
function splitCode(code: string): { chapter: string; section: string } {
	const dot = code.indexOf('.');
	if (dot < 0) return { chapter: code, section: '' };
	return { chapter: code.slice(0, dot), section: code.slice(dot + 1) };
}
