import { requireAuth } from '@ab/auth';
import {
	getCard,
	getCards,
	getCardsCount,
	getRemovedCards,
	getRemovedCardsCount,
	restoreCardByCard,
} from '@ab/bc-study';
import {
	BROWSE_PAGE_SIZE,
	BROWSE_STATUS_FILTER_VALUES,
	BROWSE_STATUS_REMOVED,
	type BrowseStatusFilter,
	CARD_STATUSES,
	CARD_TYPE_VALUES,
	type CardType,
	CONTENT_SOURCE_VALUES,
	type ContentSource,
	DOMAIN_VALUES,
	type Domain,
	QUERY_PARAMS,
} from '@ab/constants';
import { createLogger, narrow } from '@ab/utils';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('study:memory-browse');

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { url } = event;

	const domain = narrow<Domain>(url.searchParams.get(QUERY_PARAMS.DOMAIN), DOMAIN_VALUES);
	const cardType = narrow<CardType>(url.searchParams.get(QUERY_PARAMS.CARD_TYPE), CARD_TYPE_VALUES);
	const sourceType = narrow<ContentSource>(url.searchParams.get(QUERY_PARAMS.SOURCE), CONTENT_SOURCE_VALUES);
	const status =
		narrow<BrowseStatusFilter>(url.searchParams.get(QUERY_PARAMS.STATUS), BROWSE_STATUS_FILTER_VALUES) ??
		CARD_STATUSES.ACTIVE;
	const search = url.searchParams.get(QUERY_PARAMS.SEARCH)?.trim() ?? '';

	const pageRaw = Number.parseInt(url.searchParams.get(QUERY_PARAMS.PAGE) ?? '1', 10);
	const pageNum = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

	// Branch on whether the caller wants the virtual "removed" view or the
	// ordinary card.status filter. The two data sources are different tables
	// (card vs card + card_snooze join) so they don't compose into the same
	// query. Keeping the read paths physically separate means either query
	// stays simple and indexable.
	let rows: Array<{
		id: string;
		front: string;
		back: string;
		domain: string;
		cardType: string;
		status: string;
		sourceType: string;
		scheduleState: string;
		stabilityDays: number;
		dueAt: Date;
		lastReviewedAt: Date | null;
		removed?: { snoozeId: string; removedAt: Date; comment: string | null };
	}>;
	let total: number;
	let hasMore: boolean;

	if (status === BROWSE_STATUS_REMOVED) {
		const filters = { domain, cardType, sourceType, search: search || undefined };
		const [removed, removedCount] = await Promise.all([
			getRemovedCards(user.id, {
				...filters,
				limit: BROWSE_PAGE_SIZE + 1,
				offset: (pageNum - 1) * BROWSE_PAGE_SIZE,
			}),
			getRemovedCardsCount(user.id, filters),
		]);
		hasMore = removed.length > BROWSE_PAGE_SIZE;
		const visible = hasMore ? removed.slice(0, BROWSE_PAGE_SIZE) : removed;
		rows = visible.map((r) => ({
			id: r.card.id,
			front: r.card.front,
			back: r.card.back,
			domain: r.card.domain,
			cardType: r.card.cardType,
			status: r.card.status,
			sourceType: r.card.sourceType,
			scheduleState: r.state.state,
			stabilityDays: r.state.stability,
			dueAt: r.state.dueAt,
			lastReviewedAt: r.state.lastReviewedAt,
			removed: { snoozeId: r.snoozeId, removedAt: r.removedAt, comment: r.comment },
		}));
		total = removedCount;
	} else {
		const filters = {
			domain,
			cardType,
			sourceType,
			status,
			search: search || undefined,
		};
		const [cards, totalCount] = await Promise.all([
			getCards(user.id, {
				...filters,
				limit: BROWSE_PAGE_SIZE + 1,
				offset: (pageNum - 1) * BROWSE_PAGE_SIZE,
			}),
			getCardsCount(user.id, filters),
		]);
		hasMore = cards.length > BROWSE_PAGE_SIZE;
		const visible = hasMore ? cards.slice(0, BROWSE_PAGE_SIZE) : cards;
		rows = visible.map(({ card, state }) => ({
			id: card.id,
			front: card.front,
			back: card.back,
			domain: card.domain,
			cardType: card.cardType,
			status: card.status,
			sourceType: card.sourceType,
			scheduleState: state.state,
			stabilityDays: state.stability,
			dueAt: state.dueAt,
			lastReviewedAt: state.lastReviewedAt,
		}));
		total = totalCount;
	}

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

export const actions: Actions = {
	restore: async (event) => {
		const user = requireAuth(event);
		const { request, locals } = event;
		const form = await request.formData();
		const cardId = String(form.get('cardId') ?? '');
		if (!cardId) return fail(400, { error: 'cardId is required' });
		try {
			await restoreCardByCard(cardId, user.id);
			return { success: true as const, intent: 'restore' as const, cardId };
		} catch (err) {
			log.error(
				'restoreCard threw',
				{ requestId: locals.requestId, userId: user.id, metadata: { cardId } },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { error: 'Could not restore card' });
		}
	},
} satisfies Actions;
