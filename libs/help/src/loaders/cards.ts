// @browser-globals: server-only -- never imported by client .svelte
/**
 * Cards loader (DB-backed, user-scoped). Walks `study.card` filtered by the
 * current user. Matches needle against `front` + `back` (the two authored
 * surfaces a card has). Returns `mine.card` rows for the My Stuff column.
 *
 * Empty when the host has no `userId` (unauthenticated). Cards are private
 * by definition; never surface another user's deck.
 *
 * Server-only -- imports `@ab/db/connection`.
 */

import { card } from '@ab/bc-study';
import { CARD_STATUSES, ROUTES } from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, desc, eq, ilike, ne, or } from 'drizzle-orm';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, SearchResult } from '../schema/result-types';
import { bucketByMatch, buildIlikePattern, type LoaderDb, truncateOneLine } from './_shared';

const LOADER_LIMIT = 30;

export async function loadCards(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: LoaderDb = defaultDb,
): Promise<readonly SearchResult[]> {
	if (!host.userId) return [];
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = buildIlikePattern(needle);
	const rows = await db
		.select({
			id: card.id,
			front: card.front,
			back: card.back,
			domain: card.domain,
		})
		.from(card)
		.where(
			and(
				eq(card.userId, host.userId),
				ne(card.status, CARD_STATUSES.ARCHIVED),
				or(ilike(card.front, pattern), ilike(card.back, pattern)),
			),
		)
		.orderBy(desc(card.updatedAt))
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.id,
			type: 'mine.card',
			title: truncateOneLine(r.front, 80),
			subtitle: `Card - ${r.domain}`,
			snippet: truncateOneLine(r.back, 140),
			href: ROUTES.MEMORY_CARD(r.id),
			rankBucket: bucketByMatch(needle, r.front, r.back),
			source: 'index',
		};
		out.push(result);
	}
	return out;
}
