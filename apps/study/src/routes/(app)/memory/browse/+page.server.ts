import { requireAuth } from '@ab/auth';
import { getCard, getCards, getCardsCount } from '@ab/bc-study';
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
import { narrow } from '@ab/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const cardType = narrow<CardType>(url.searchParams.get(QUERY_PARAMS.CARD_TYPE), CARD_TYPE_VALUES);
	const sourceType = narrow<ContentSource>(url.searchParams.get(QUERY_PARAMS.SOURCE), CONTENT_SOURCE_VALUES);
	const status =
		narrow<CardStatus>(url.searchParams.get(QUERY_PARAMS.STATUS), CARD_STATUS_VALUES) ?? CARD_STATUSES.ACTIVE;
	const search = url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	// Shared filter shape feeds both the list and the count so "Page X of Y"
	// can never disagree with the visible rows. Fetching one extra row gives
	// us `hasMore` for the "Next" button without a second round-trip.
	const filters = {
		domain,
		cardType,
		sourceType,
		status,
		search: search || undefined,
	};

	const [cards, total] = await Promise.all([
		getCards(user.id, {
			...filters,
			limit: BROWSE_PAGE_SIZE + 1,
			offset: (pageNum - 1) * BROWSE_PAGE_SIZE,
		}),
		getCardsCount(user.id, filters),
	]);

	const hasMore = cards.length > BROWSE_PAGE_SIZE;
	const visible = hasMore ? cards.slice(0, BROWSE_PAGE_SIZE) : cards;
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

	// Flatten `{card, state}` into a shape that keeps the card fields the row
	// template already uses and adds the per-user schedule signals the user
	// needs to locate a card they just touched (SMI item 23).
	const rows = visible.map(({ card, state }) => ({
		...card,
		scheduleState: state.state,
		stabilityDays: state.stability,
		dueAt: state.dueAt,
		lastReviewedAt: state.lastReviewedAt,
	}));

	return {
		cards: rows,
		filters: { domain, cardType, sourceType, status, search },
		page: pageNum,
		hasMore,
		pageSize: BROWSE_PAGE_SIZE,
		total,
		totalPages,
		createdCard,
	};
};
