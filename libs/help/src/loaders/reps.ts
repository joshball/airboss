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
 * Rating label routes through `REVIEW_RATING_LABELS` so the palette renders
 * the project's chosen names (`Wrong / Hard / Right / Easy`), not FSRS's.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { card, review } from '@ab/bc-study';
import { REVIEW_RATING_LABELS, type ReviewRating, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bucketByMatch, buildIlikePattern, type LoaderDb, truncateOneLine } from './_shared';

const LOADER_LIMIT = 20;

export async function loadReps(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	if (!host.userId) return [];
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
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
			title: truncateOneLine(r.front, 80),
			subtitle: `Rep - ${ratingLabel(r.rating)} - ${formatDate(r.reviewedAt)}`,
			href: ROUTES.MEMORY_CARD(r.cardId),
			rankBucket: bucketByMatch(needle, r.front),
			source: 'index',
		};
		out.push(result);
	}
	return out;
}

function ratingLabel(rating: number): string {
	const label = REVIEW_RATING_LABELS[rating as ReviewRating];
	return label ?? `Rating ${rating}`;
}

function formatDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}
