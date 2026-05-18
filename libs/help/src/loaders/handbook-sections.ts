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
import { REFERENCE_KINDS } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { type SourceId, urlForReference } from '@ab/sources';
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
			airbossRef: referenceSection.airbossRef,
			documentSlug: reference.documentSlug,
			referenceTitle: reference.title,
		})
		.from(referenceSection)
		.innerJoin(reference, eq(reference.id, referenceSection.referenceId))
		.where(and(eq(reference.kind, REFERENCE_KINDS.HANDBOOK), or(...fieldMatches)))
		.orderBy(reference.documentSlug, referenceSection.code)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.sectionId,
			type: 'faa.handbook.chapter',
			title: `${r.code} - ${r.title}`,
			subtitle: `${r.documentSlug.toUpperCase()} - ${r.referenceTitle}`,
			snippet: bodySnippet(r.contentMd, needle),
			// Flightbag-direct handbook reader URL from the section's
			// canonical `airboss-ref:` URI -- the chapter / section depth and
			// edition normalisation are handled by `urlForReference()`.
			href: urlForReference(r.airbossRef as SourceId),
			rankBucket: bucketByMatch(needle, r.code, r.title),
			clusterKey: r.documentSlug,
		};
		out.push(result);
	}
	return out;
}
