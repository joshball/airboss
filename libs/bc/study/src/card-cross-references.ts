/**
 * Cross-references for a single card on the owner detail page `/memory/<id>`.
 *
 * Four rows: sessions, reps, plans, scenarios. Sessions populate today via
 * the `review.review_session_id` pointer. The other three are data sources
 * that don't exist yet; each returns an empty list with `comingSoon=true` so
 * the panel renders the full IA with honest empty states (per spec).
 */

import { db as defaultDb } from '@ab/db';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { type CardSessionRef, getSessionsForCard } from './review-sessions';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

export interface CardCrossRefsReps {
	items: ReadonlyArray<{ id: string; citedAt: Date }>;
	/** `true` when the data source for this row does not exist yet. */
	comingSoon: boolean;
}

export interface CardCrossRefsPlans {
	items: ReadonlyArray<{ id: string; name: string }>;
	comingSoon: boolean;
}

export interface CardCrossRefsScenarios {
	items: ReadonlyArray<{ id: string; name: string }>;
	comingSoon: boolean;
}

export interface CardCrossReferences {
	sessions: ReadonlyArray<CardSessionRef>;
	reps: CardCrossRefsReps;
	plans: CardCrossRefsPlans;
	scenarios: CardCrossRefsScenarios;
}

/** Default cap on how many session rows the panel surfaces. */
export const CROSS_REF_SESSION_LIMIT = 10;

/**
 * Aggregate all four cross-reference rows for a card. Returns empty-but-
 * structured data for every row whose source is not yet wired; the panel
 * component branches on `.comingSoon` to render the honest message.
 */
export async function getCardCrossReferences(
	cardId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<CardCrossReferences> {
	const sessions = await getSessionsForCard(cardId, userId, CROSS_REF_SESSION_LIMIT, db);

	return {
		sessions,
		// Reps-to-card enrollment does not exist yet. When a scenario grows a
		// "cites this card" attachment (candidate: content-citations work
		// package) this row hydrates; until then the panel shows the honest
		// coming-soon state.
		reps: { items: [], comingSoon: true },
		// Plan-to-card enrollment is not tracked. Plans today are cert/domain/
		// node-scoped; per-card inclusion is a future work package.
		plans: { items: [], comingSoon: true },
		// Scenarios citing this card wait on `content-citations`.
		scenarios: { items: [], comingSoon: true },
	};
}
