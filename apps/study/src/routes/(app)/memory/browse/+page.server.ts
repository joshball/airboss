import { requireAuth } from '@ab/auth';
import { getCard, getCards } from '@ab/bc-study';
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
} from '@ab/constants';
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

	const domain = narrowDomain(url.searchParams.get('domain'));
	const cardType = narrowCardType(url.searchParams.get('type'));
	const sourceType = narrowSourceType(url.searchParams.get('source'));
	const status = narrowStatus(url.searchParams.get('status')) ?? CARD_STATUSES.ACTIVE;
	const search = url.searchParams.get('q')?.trim() ?? '';

	const pageRaw = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
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

	// Read `?created=<id>` -- set when the user lands here straight from a
	// successful create. The banner + row highlight read this.
	// See DESIGN_PRINCIPLES.md #7.
	const createdId = url.searchParams.get('created') ?? null;
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
		createdCard,
	};
};
