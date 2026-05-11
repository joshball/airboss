// @browser-globals: server-only -- never imported by client .svelte
/**
 * Reps loader (DB-backed, user-scoped). Walks `study.review` joined to
 * `study.card` for the current user, matching needle against the card's
 * `front` + `back`. Returns `mine.rep` rows for the My Stuff column,
 * surfacing the most recent review touching each matching card.
 *
 * Why join through `card`: reviews themselves carry no searchable text; the
 * meaningful surface is "a rep on a card whose front/back mentions X."
 * Dedupe to one row per card -- a flood of repetitions of the same card
 * would push every other column off the screen.
 *
 * Empty when host has no `userId`.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { card, review } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 20;

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function bucketFor(needle: string, front: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (front.toLowerCase() === n) return 1;
	if (front.toLowerCase().startsWith(n)) return 2;
	if (front.toLowerCase().includes(n)) return 3;
	return 4;
}

function titleFromFront(front: string): string {
	const oneLine = front.replace(/\s+/g, ' ').trim();
	return oneLine.length <= 80 ? oneLine : `${oneLine.slice(0, 77)}…`;
}

export async function loadReps(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: Db = defaultDb,
): Promise<readonly SearchResult[]> {
	if (!host.userId) return [];
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = `%${escapePattern(needle)}%`;
	// One row per card -- DISTINCT ON the card id, ordered by most-recent
	// review so the returned reviewId is the freshest one. This matches the
	// "recent reps on cards matching X" mental model the palette presents
	// in My Stuff.
	const rows = await db
		.selectDistinctOn([review.cardId], {
			reviewId: review.id,
			cardId: card.id,
			front: card.front,
			rating: review.rating,
			reviewedAt: review.reviewedAt,
		})
		.from(review)
		.innerJoin(card, eq(card.id, review.cardId))
		.where(and(eq(review.userId, host.userId), or(ilike(card.front, pattern), ilike(card.back, pattern))))
		.orderBy(review.cardId, desc(review.reviewedAt))
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.reviewId,
			type: 'mine.rep',
			title: titleFromFront(r.front),
			subtitle: `Rep - ${formatRating(r.rating)} - ${formatDate(r.reviewedAt)}`,
			href: ROUTES.MEMORY_CARD(r.cardId),
			rankBucket: bucketFor(needle, r.front),
			source: 'index',
		};
		out.push(result);
	}
	void sql; // imported for potential aggregate upgrade; silence unused-import lint.
	return out;
}

function formatRating(rating: number): string {
	switch (rating) {
		case 1:
			return 'Again';
		case 2:
			return 'Hard';
		case 3:
			return 'Good';
		case 4:
			return 'Easy';
		default:
			return `Rating ${rating}`;
	}
}

function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}
