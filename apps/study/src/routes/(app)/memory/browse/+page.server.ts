import { requireAuth } from '@ab/auth';
import { card, getCard, getCards } from '@ab/bc-study';
import {
	BROWSE_PAGE_SIZE,
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	type CardStatus,
	type CardType,
	CONTENT_SOURCE_VALUES,
	type ContentSource,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
} from '@ab/constants';
import { db, escapeLikePattern } from '@ab/db';
import { and, eq, ilike, inArray, or, type SQL, sql } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

function narrowDomain(value: string | null): Domain | undefined {
	if (!value) return undefined;
	return (DOMAIN_VALUES as readonly string[]).includes(value) ? (value as Domain) : undefined;
}

function narrowCardType(value: string | null): CardType | undefined {
	if (!value) return undefined;
	return (CARD_TYPE_VALUES as readonly string[]).includes(value) ? (value as CardType) : undefined;
}

function narrowSourceType(value: string | null): ContentSource | undefined {
	if (!value) return undefined;
	return (CONTENT_SOURCE_VALUES as readonly string[]).includes(value) ? (value as ContentSource) : undefined;
}

function narrowStatus(value: string | null): CardStatus | undefined {
	if (!value) return undefined;
	return (CARD_STATUS_VALUES as readonly string[]).includes(value) ? (value as CardStatus) : undefined;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrowDomain(url.searchParams.get(QUERY_PARAMS.DOMAIN));
	const cardType = narrowCardType(url.searchParams.get(QUERY_PARAMS.CARD_TYPE));
	const sourceType = narrowSourceType(url.searchParams.get(QUERY_PARAMS.SOURCE));
	const status = narrowStatus(url.searchParams.get(QUERY_PARAMS.STATUS)) ?? CARD_STATUSES.ACTIVE;
	const search = url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	// Fetch one extra row to know whether another page exists.
	const cards = await getCards(user.id, {
		domain,
		cardType,
		sourceType,
		status,
		search: search || undefined,
		limit: BROWSE_PAGE_SIZE + 1,
		offset: (pageNum - 1) * BROWSE_PAGE_SIZE,
	});

	const hasMore = cards.length > BROWSE_PAGE_SIZE;
	const visible = hasMore ? cards.slice(0, BROWSE_PAGE_SIZE) : cards;

	// Total count for pagination "Page X of Y" / "Showing N-M of T". Mirrors
	// the filter shape of `getCards` above so the count matches what's listed.
	// Implemented inline with Drizzle rather than extending the study BC -- the
	// BC deliberately stays narrow; the app may need a count in exactly this
	// shape once (per browse page), so a BC-level helper isn't justified yet.
	const countClauses: SQL[] = [eq(card.userId, user.id), inArray(card.status, [status])];
	if (domain) countClauses.push(eq(card.domain, domain));
	if (cardType) countClauses.push(eq(card.cardType, cardType));
	if (sourceType) countClauses.push(eq(card.sourceType, sourceType));
	if (search && search.trim().length > 0) {
		const pattern = `%${escapeLikePattern(search.trim())}%`;
		const cond = or(ilike(card.front, pattern), ilike(card.back, pattern));
		if (cond) countClauses.push(cond);
	}
	const [{ total }] = await db
		.select({ total: sql<number>`count(*)::int` })
		.from(card)
		.where(and(...countClauses));
	const totalPages = Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));

	// Read `?created=<id>` -- set when the user lands here straight from a
	// successful create. The banner + row highlight read this.
	// See DESIGN_PRINCIPLES.md #7.
	const createdId = url.searchParams.get(QUERY_PARAMS.CREATED) ?? null;
	let createdCard: { id: string; front: string } | null = null;
	if (createdId) {
		const found = await getCard(createdId, user.id);
		if (found) createdCard = { id: found.card.id, front: found.card.front };
	}

	return {
		cards: visible,
		filters: { domain, cardType, sourceType, status, search },
		page: pageNum,
		hasMore,
		pageSize: BROWSE_PAGE_SIZE,
		total,
		totalPages,
		createdCard,
	};
};
