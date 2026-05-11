// @browser-globals: server-only -- never imported by client .svelte
/**
 * Handbook-sections loader (DB-backed). Walks `study.reference_section` joined
 * to `study.reference` where `reference.kind = 'handbook'` and matches the
 * needle against the section's `code` + `title` + `content_md` (the body
 * substrate). Returns one `faa.handbook.chapter` row per match, carrying the
 * parent handbook's `documentSlug` as `parentDocCode` so the FAA Resources
 * column can cluster the chapter under its handbook root.
 *
 * Runs server-side only: imports `@ab/db/connection`. The palette UI feeds
 * the loader's output through `searchGrouped()`'s `injected` argument from
 * the `/api/palette/search` endpoint (or any other server caller).
 *
 * Limit: 30 rows. The palette renders the top N per column; loaders cap at
 * a tight ceiling so the union across loaders fits comfortably under
 * Vitest budgets and dev-mode debounce windows.
 */

import { reference, referenceSection } from '@ab/bc-study';
import { REFERENCE_KINDS, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq, ilike, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 30;

/** Convert needle-match tier into a palette `RankBucket`. */
function bucketFor(needle: string, code: string, title: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (code.toLowerCase() === n) return 1;
	if (code.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase() === n) return 1;
	if (title.toLowerCase().startsWith(n)) return 2;
	if (title.toLowerCase().includes(n)) return 3;
	return 5;
}

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Match a handbook-section row from a free-text needle. Empty needle returns
 * `[]` -- handbook sections are too numerous to enumerate without a filter.
 * The caller is `searchGrouped()` which has already short-circuited the
 * fully-empty-query case.
 */
export async function loadHandbookSections(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: Db = defaultDb,
): Promise<readonly SearchResult[]> {
	void host;
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = `%${escapePattern(needle)}%`;
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
		.where(
			and(
				eq(reference.kind, REFERENCE_KINDS.HANDBOOK),
				or(
					ilike(referenceSection.code, pattern),
					ilike(referenceSection.title, pattern),
					ilike(referenceSection.contentMd, pattern),
				),
			),
		)
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
			rankBucket: bucketFor(needle, r.code, r.title),
			parentDocCode: r.documentSlug,
		};
		out.push(result);
	}
	void sql; // imported for potential FTS upgrade; silence unused-import lint.
	return out;
}

/**
 * Trim a one-line snippet around the first occurrence of `needle` in body,
 * or the head of the body when no match. Pure -- no markdown rendering. The
 * palette is plain text, not rich.
 */
function bodySnippet(body: string, needle: string): string {
	if (body.length === 0) return '';
	const idx = needle.length > 0 ? body.toLowerCase().indexOf(needle.toLowerCase()) : -1;
	const start = idx < 0 ? 0 : Math.max(0, idx - 30);
	const end = Math.min(body.length, start + 140);
	const slice = body.slice(start, end).replace(/\s+/g, ' ').trim();
	return start === 0 ? slice : `…${slice}`;
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
