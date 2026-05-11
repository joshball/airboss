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
import { and, eq, ilike, ne, or } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { ParsedQuery } from '../schema/help-registry';
import type { PaletteHost, RankBucket, SearchResult } from '../schema/result-types';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

const LOADER_LIMIT = 30;

function bucketFor(needle: string, front: string, back: string): RankBucket {
	if (needle.length === 0) return 4;
	const n = needle.toLowerCase();
	if (front.toLowerCase() === n) return 1;
	if (front.toLowerCase().startsWith(n)) return 2;
	if (front.toLowerCase().includes(n)) return 3;
	if (back.toLowerCase().includes(n)) return 4;
	return 5;
}

function escapePattern(s: string): string {
	return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function titleFromFront(front: string): string {
	const oneLine = front.replace(/\s+/g, ' ').trim();
	return oneLine.length <= 80 ? oneLine : `${oneLine.slice(0, 77)}…`;
}

function snippetFromBack(back: string): string {
	const oneLine = back.replace(/\s+/g, ' ').trim();
	return oneLine.length <= 140 ? oneLine : `${oneLine.slice(0, 137)}…`;
}

export async function loadCards(
	parsed: ParsedQuery,
	host: PaletteHost,
	db: Db = defaultDb,
): Promise<readonly SearchResult[]> {
	if (!host.userId) return [];
	const needle = parsed.freeText.trim();
	if (needle.length === 0) return [];

	const pattern = `%${escapePattern(needle)}%`;
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
		.orderBy(card.updatedAt)
		.limit(LOADER_LIMIT);

	const out: SearchResult[] = [];
	for (const r of rows) {
		const result: SearchResult = {
			id: r.id,
			type: 'mine.card',
			title: titleFromFront(r.front),
			subtitle: `Card - ${r.domain}`,
			snippet: snippetFromBack(r.back),
			href: ROUTES.MEMORY_CARD(r.id),
			rankBucket: bucketFor(needle, r.front, r.back),
			source: 'index',
		};
		out.push(result);
	}
	return out;
}
