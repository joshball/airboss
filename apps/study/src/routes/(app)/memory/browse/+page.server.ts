import { getCards } from '@ab/bc-study';
import {
	CARD_STATUS_VALUES,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	type CardStatus,
	type CardType,
	CONTENT_SOURCE_VALUES,
	type ContentSource,
	DOMAIN_VALUES,
	type Domain,
	ROUTES,
} from '@ab/constants';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 25;

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

export const load: PageServerLoad = async ({ url, locals }) => {
	const user = locals.user;
	if (!user) redirect(302, ROUTES.LOGIN);

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
		limit: PAGE_SIZE + 1,
		offset: (pageNum - 1) * PAGE_SIZE,
	});

	const hasMore = cards.length > PAGE_SIZE;
	const visible = hasMore ? cards.slice(0, PAGE_SIZE) : cards;

	return {
		cards: visible,
		filters: { domain, cardType, sourceType, status, search },
		page: pageNum,
		hasMore,
		pageSize: PAGE_SIZE,
	};
};
