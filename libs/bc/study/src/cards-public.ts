/**
 * Public (unauthenticated) card reads for the shareable `/cards/<id>` surface.
 *
 * Per `docs/work-packages/card-page-and-cross-references/spec.md`:
 *   - Active cards only -- suspended and archived 404 on the public surface.
 *   - No scheduler internals leak (no stability, difficulty, due-at).
 *   - `source_ref` is not exposed; only the high-level `source_type` label is.
 *
 * Citations are wired as an empty array today. `content-citations` is a
 * separate work package (Bundle C); when that lands it hydrates this list.
 */

import { CARD_STATUSES, type CardType, type ContentSource, type Domain } from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface PublicCardCitation {
	id: string;
	label: string;
	href: string | null;
}

export interface PublicCard {
	id: string;
	front: string;
	back: string;
	domain: Domain;
	cardType: CardType;
	sourceType: ContentSource;
	/** Authored citations rendered below the content. Empty until `content-citations` lands. */
	citations: PublicCardCitation[];
}

/**
 * Fetch a card by id for the public page. Returns null when the id is
 * unknown OR when the card is suspended/archived; the caller maps either to
 * a 404. `userId` is intentionally not a parameter -- the public view does
 * not know who "owns" a shared card and the author's ownership is not part
 * of the identity projection exposed here.
 */
export async function getPublicCard(cardId: string, db: Db = defaultDb): Promise<PublicCard | null> {
	const [row] = await db
		.select({
			id: card.id,
			front: card.front,
			back: card.back,
			domain: card.domain,
			cardType: card.cardType,
			sourceType: card.sourceType,
			status: card.status,
		})
		.from(card)
		.where(and(eq(card.id, cardId), eq(card.status, CARD_STATUSES.ACTIVE)))
		.limit(1);
	if (!row) return null;

	return {
		id: row.id,
		front: row.front,
		back: row.back,
		domain: row.domain as Domain,
		cardType: row.cardType as CardType,
		sourceType: row.sourceType as ContentSource,
		// `content-citations` (Bundle C) populates this list. Shipping the
		// empty array now so the public-card shape is stable and the panel
		// component can render against one contract.
		citations: [],
	};
}
