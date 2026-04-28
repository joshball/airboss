/**
 * Public (unauthenticated) card reads for the shareable `/cards/<id>` surface.
 *
 * Per `docs/work-packages/card-page-and-cross-references/spec.md`:
 *   - Active cards only -- suspended and archived 404 on the public surface.
 *   - No scheduler internals leak (no stability, difficulty, due-at).
 *   - `source_ref` is not exposed; only the high-level `source_type` label is.
 *
 * Citations are part of bc-study (folded in from the former bc-citations
 * package); the route layer composes the citation read with `getPublicCard`.
 * We expose `PublicCardCitation` as the stable wire shape and a
 * `composePublicCardCitations` helper that takes the resolved citations and
 * projects the public-safe subset (no createdBy, no scheduling internals,
 * no internal hrefs).
 */

import {
	CARD_STATUSES,
	type CardType,
	CITATION_TARGET_TYPES,
	type CitationTargetType,
	type ContentSource,
	type Domain,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db/connection';
import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { card } from './schema';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface PublicCardCitation {
	id: string;
	label: string;
	/** Optional secondary text (e.g. "Regulation"). */
	detail: string | null;
	/** External link when the citation has one (external_ref). Internal targets stay unlinked on the public page. */
	href: string | null;
}

export interface PublicCard {
	id: string;
	front: string;
	back: string;
	domain: Domain;
	cardType: CardType;
	sourceType: ContentSource;
	/** Authored citations rendered below the content. Hydrated by the route layer via the bc-study citations API. */
	citations: PublicCardCitation[];
}

/**
 * Public-safe projection of a resolved citation. Lives here (not in the
 * citations BC) because the policy of "external links only on the public
 * page" is a card-public concern, and keeping it here avoids a dep cycle
 * (citations already imports from study). Internal targets render as text;
 * external_ref carries its href through.
 */
export function composePublicCardCitations(
	resolved: ReadonlyArray<{
		citation: { id: string };
		target: { type: CitationTargetType; label: string; detail?: string; href?: string };
	}>,
): PublicCardCitation[] {
	return resolved.map((c) => ({
		id: c.citation.id,
		label: c.target.label,
		detail: c.target.detail ?? null,
		href: c.target.type === CITATION_TARGET_TYPES.EXTERNAL_REF && c.target.href ? c.target.href : null,
	}));
}

/**
 * Fetch a card by id for the public page. Returns null when the id is
 * unknown OR when the card is suspended/archived; the caller maps either to
 * a 404. `userId` is intentionally not a parameter -- the public view does
 * not know who "owns" a shared card and the author's ownership is not part
 * of the identity projection exposed here.
 *
 * The returned `citations` array is empty -- the route layer hydrates it
 * via the bc-study citations API (`getCitationsOf`, `resolveCitationTargets`).
 * Keeping the hydration in the route layer mirrors how scenario / rep / node
 * pages compose their citation reads.
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
		citations: [],
	};
}
