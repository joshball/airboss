// @browser-globals: server-only -- never imported by client .svelte
/**
 * Shared helpers for the DB-backed palette loaders. Every loader was carrying
 * verbatim copies of these utilities; consolidating them here means the
 * project can change ilike escaping, snippet width, or bucket scoring in one
 * place instead of eight.
 *
 * Server-only -- some helpers are pure but the file is tagged because every
 * loader that imports it also reaches `@ab/db/connection` transitively.
 */

import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { RankBucket } from '../schema/result-types';

export type LoaderDb = PgDatabase<PgQueryResultHKT, Record<string, never>>;

/**
 * Escape an ilike pattern. The Postgres ilike operator treats `%` and `_` as
 * wildcards and `\` as the escape char; needles from user input have to be
 * neutered before they're sandwiched in `%...%`.
 */
export function escapeIlikePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Build the canonical `%escaped%` pattern from a raw needle. */
export function buildIlikePattern(needle: string): string {
	return `%${escapeIlikePattern(needle)}%`;
}

/**
 * Score a row from its primary fields using the palette's 4-tier match ladder.
 * Tier 1 = exact match on any field, tier 2 = prefix, tier 3 = substring,
 * otherwise tier 5 (body-only / fallback). Tier 4 is reserved for "no needle"
 * paths.
 *
 * Pass the most-discriminating field first (typically `code` or `id`) so an
 * exact-code match always outranks an exact-title match on a different row.
 */
export function bucketByMatch(needle: string, ...fields: readonly string[]): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	let prefixSeen = false;
	let substringSeen = false;
	for (const field of fields) {
		if (!field) continue;
		const f = field.toLowerCase();
		if (f === n) return 1;
		if (!prefixSeen && f.startsWith(n)) prefixSeen = true;
		else if (!substringSeen && f.includes(n)) substringSeen = true;
	}
	if (prefixSeen) return 2;
	if (substringSeen) return 3;
	return 5;
}

/**
 * Trim a windowed snippet around the first occurrence of `needle` in `body`,
 * or the head of the body when no match. Returns plain text -- the palette
 * never renders markdown here. Default width matches the palette's single-line
 * footer + 30-char lead-in for context.
 */
export function bodySnippet(body: string, needle: string, width = 140, lead = 30): string {
	if (body.length === 0) return '';
	const idx = needle.length > 0 ? body.toLowerCase().indexOf(needle.toLowerCase()) : -1;
	const start = idx < 0 ? 0 : Math.max(0, idx - lead);
	const end = Math.min(body.length, start + width);
	const slice = body.slice(start, end).replace(/\s+/g, ' ').trim();
	return start === 0 ? slice : `…${slice}`;
}

/**
 * Collapse a free-form string to a one-line truncated form, suitable for a
 * palette row's title or snippet. Adds a single trailing ellipsis when
 * truncated.
 */
export function truncateOneLine(text: string, max: number): string {
	const oneLine = text.replace(/\s+/g, ' ').trim();
	if (oneLine.length <= max) return oneLine;
	return `${oneLine.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Skip-body cutoff. ilike against `content_md` is the slowest field on
 * `reference_section`; for short needles (<3 chars) the match is almost
 * meaningless (`a` matches every body) and the cost is full-table scan. The
 * three section loaders gate body matching on this threshold so a fast typist
 * doesn't pin the database.
 */
export const MIN_BODY_NEEDLE_LENGTH = 3;
