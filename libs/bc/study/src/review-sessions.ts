/**
 * Memory-review session BC (review-sessions-url layer a "Resume").
 *
 * A memory-review session freezes the due-card list at start and walks through
 * it by `current_index`. Close the tab, reopen the URL, resume where you left
 * off. See `docs/work-packages/review-sessions-url/spec.md`.
 *
 * Distinct from the engine-scheduler sessions in `sessions.ts`: engine sessions
 * mix cards + reps + node starts across slices; review sessions are a pure
 * memory-card traversal driven by the due queue + an optional domain filter.
 */

import {
	type CardStatus,
	type CardType,
	type Domain,
	REVIEW_SESSION_ABANDON_MS,
	REVIEW_SESSION_STATUSES,
	type ReviewSessionStatus,
} from '@ab/constants';
import { db as defaultDb } from '@ab/db';
import { generateReviewSessionId } from '@ab/utils';
import { and, count, desc, eq, inArray, isNotNull, lt, max } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDueCards } from './cards';
import { computeDeckHash } from './deck-spec';
import { getSavedDeckOverlays } from './saved-decks';
import {
	card,
	cardState,
	type MemoryReviewSessionRow,
	memoryReviewSession,
	type ReviewSessionDeckSpec,
	review,
} from './schema';

// Layer (b) "Redo" moved the deck-spec hash + canonical-JSON helpers into
// `./deck-spec`. Re-export so existing call sites that imported
// `computeDeckHash` from this module (or via `@ab/bc-study`) keep working.
export { computeDeckHash } from './deck-spec';

type Db = PgDatabase<PgQueryResultHKT, Record<string, never>>;

// ---------- Errors ----------

export class ReviewSessionNotFoundError extends Error {
	constructor(
		public readonly sessionId: string,
		public readonly userId: string,
	) {
		super(`Review session ${sessionId} not found for user ${userId}`);
		this.name = 'ReviewSessionNotFoundError';
	}
}

/** Jump target was outside `[0, cardIdList.length - 1]`. */
export class ReviewSessionJumpOutOfRangeError extends Error {
	constructor(
		public readonly sessionId: string,
		public readonly index: number,
		public readonly totalCards: number,
	) {
		super(`Jump index ${index} out of range for session ${sessionId} (total ${totalCards})`);
		this.name = 'ReviewSessionJumpOutOfRangeError';
	}
}

/** Jumping is only allowed while the session is `active`. */
export class ReviewSessionNotActiveError extends Error {
	constructor(
		public readonly sessionId: string,
		public readonly status: ReviewSessionStatus,
	) {
		super(`Review session ${sessionId} is ${status}; cannot jump`);
		this.name = 'ReviewSessionNotActiveError';
	}
}

// ---------- Public types ----------

export interface StartReviewSessionInput {
	userId: string;
	deckSpec: ReviewSessionDeckSpec;
}

/**
 * Current card snapshot for the review chrome. Mirrors the shape that the old
 * `/memory/review` page assembled per card, narrowed to the fields the chrome
 * actually consumes.
 */
export interface ReviewSessionCard {
	id: string;
	front: string;
	back: string;
	domain: Domain;
	cardType: CardType;
	tags: readonly string[];
	status: CardStatus;
	/** FSRS scheduler state at load time, for per-card info surfaces. */
	state: string;
	stability: number;
	difficulty: number;
	dueAt: Date;
	/**
	 * Counters needed to feed `fsrsPreviewAll` server-side so the rating
	 * chicklets can show the next interval per rating. Mirrors `cardState`.
	 */
	reviewCount: number;
	lapseCount: number;
	lastReview: Date | null;
	/** Whether the review chrome should prompt for pre-reveal confidence. */
	promptConfidence: boolean;
}

export interface ReviewSessionState {
	session: MemoryReviewSessionRow;
	/** The current card, or null when the session is completed. */
	currentCard: ReviewSessionCard | null;
	/** 1-based counter for display ("Card 3 of 12"). 0 when completed. */
	position: number;
	totalCards: number;
	isComplete: boolean;
}

// ---------- Helpers ----------

interface LoadCardOptions {
	promptConfidence: boolean;
}

async function loadCardsForSession(
	cardIds: readonly string[],
	userId: string,
	db: Db,
	options: LoadCardOptions,
): Promise<Map<string, ReviewSessionCard>> {
	if (cardIds.length === 0) return new Map();
	const rows = await db
		.select({ card, state: cardState })
		.from(card)
		.innerJoin(cardState, and(eq(cardState.cardId, card.id), eq(cardState.userId, card.userId)))
		.where(and(eq(card.userId, userId), inArray(card.id, [...cardIds])));
	const map = new Map<string, ReviewSessionCard>();
	for (const row of rows) {
		map.set(row.card.id, {
			id: row.card.id,
			front: row.card.front,
			back: row.card.back,
			domain: row.card.domain as Domain,
			cardType: row.card.cardType as CardType,
			tags: row.card.tags ?? [],
			status: row.card.status as CardStatus,
			state: row.state.state,
			stability: row.state.stability,
			difficulty: row.state.difficulty,
			dueAt: row.state.dueAt,
			reviewCount: row.state.reviewCount,
			lapseCount: row.state.lapseCount,
			lastReview: row.state.lastReviewedAt ?? null,
			promptConfidence: options.promptConfidence,
		});
	}
	return map;
}

// ---------- Public API ----------

/**
 * Create a fresh review session. Freezes the due-card list at call time so
 * follow-up reviews in other tabs don't reshape the queue mid-run. Returns
 * the persisted row; the caller redirects the learner to
 * `/memory/review/<id>`.
 */
export async function startReviewSession(
	input: StartReviewSessionInput,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MemoryReviewSessionRow> {
	const domainFilter = input.deckSpec.domain;
	const due = await getDueCards(
		input.userId,
		{ domain: domainFilter === null ? undefined : (domainFilter as Domain) },
		db,
		now,
	);
	const cardIds = due.map((r) => r.card.id);
	const deckHash = computeDeckHash(input.deckSpec);

	const [row] = await db
		.insert(memoryReviewSession)
		.values({
			id: generateReviewSessionId(),
			userId: input.userId,
			deckHash,
			deckSpec: input.deckSpec,
			cardIdList: cardIds,
			currentIndex: 0,
			status: REVIEW_SESSION_STATUSES.ACTIVE,
			startedAt: now,
			lastActivityAt: now,
			completedAt: null,
		})
		.returning();
	return row;
}

/**
 * Load a session and resolve its current card. Raises
 * `ReviewSessionNotFoundError` when the id is unknown or owned by another
 * user. Callers treat that as a 404.
 */
export async function resumeReviewSession(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<ReviewSessionState> {
	const [row] = await db
		.select()
		.from(memoryReviewSession)
		.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
		.limit(1);
	if (!row) throw new ReviewSessionNotFoundError(sessionId, userId);

	const totalCards = row.cardIdList.length;
	const isComplete = row.status === REVIEW_SESSION_STATUSES.COMPLETED || row.currentIndex >= totalCards;

	let currentCard: ReviewSessionCard | null = null;
	if (!isComplete && totalCards > 0) {
		const currentId = row.cardIdList[row.currentIndex];
		if (currentId) {
			const cardsById = await loadCardsForSession([currentId], userId, db, { promptConfidence: true });
			currentCard = cardsById.get(currentId) ?? null;
		}
	}

	return {
		session: row,
		currentCard,
		position: isComplete ? 0 : row.currentIndex + 1,
		totalCards,
		isComplete,
	};
}

/**
 * Move the session forward one step. Marks `completed` when the new index
 * reaches the end of the frozen card list. Idempotent against replays: if
 * the session is already completed, returns the row unchanged.
 */
export async function advanceReviewSession(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MemoryReviewSessionRow> {
	return await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(memoryReviewSession)
			.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
			.for('update')
			.limit(1);
		if (!row) throw new ReviewSessionNotFoundError(sessionId, userId);
		if (row.status === REVIEW_SESSION_STATUSES.COMPLETED) return row;

		const total = row.cardIdList.length;
		const nextIndex = row.currentIndex + 1;
		const reachedEnd = nextIndex >= total;

		const [updated] = await tx
			.update(memoryReviewSession)
			.set({
				currentIndex: nextIndex,
				lastActivityAt: now,
				status: reachedEnd ? REVIEW_SESSION_STATUSES.COMPLETED : REVIEW_SESSION_STATUSES.ACTIVE,
				completedAt: reachedEnd ? now : null,
			})
			.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
			.returning();
		return updated;
	});
}

/**
 * Jump the session's `current_index` to a specific position in the frozen
 * card list. A navigation aid -- skipped cards remain pending (no
 * `session_item_result` is written), the learner can return to them later.
 *
 * Only valid while the session is `ACTIVE`. Out-of-range indices raise
 * {@link ReviewSessionJumpOutOfRangeError}; jumping a completed/abandoned
 * session raises {@link ReviewSessionNotActiveError}.
 */
export async function jumpToIndex(
	input: { sessionId: string; userId: string; index: number },
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MemoryReviewSessionRow> {
	return await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(memoryReviewSession)
			.where(and(eq(memoryReviewSession.id, input.sessionId), eq(memoryReviewSession.userId, input.userId)))
			.for('update')
			.limit(1);
		if (!row) throw new ReviewSessionNotFoundError(input.sessionId, input.userId);
		if (row.status !== REVIEW_SESSION_STATUSES.ACTIVE) {
			throw new ReviewSessionNotActiveError(input.sessionId, row.status as ReviewSessionStatus);
		}

		const total = row.cardIdList.length;
		if (!Number.isInteger(input.index) || input.index < 0 || input.index >= total) {
			throw new ReviewSessionJumpOutOfRangeError(input.sessionId, input.index, total);
		}

		// Already there: skip the write so `last_activity_at` only moves on
		// an actual navigation. Cheap to skip; matters for the abandon-stale
		// bookkeeping.
		if (row.currentIndex === input.index) return row;

		const [updated] = await tx
			.update(memoryReviewSession)
			.set({
				currentIndex: input.index,
				lastActivityAt: now,
			})
			.where(and(eq(memoryReviewSession.id, input.sessionId), eq(memoryReviewSession.userId, input.userId)))
			.returning();
		return updated;
	});
}

/**
 * Card ids that already received at least one review row stamped with this
 * session's id. Drives the per-position status indicator (rated vs pending)
 * on the jump-to-card dropdown so the learner can see where they have been
 * without leaking front/back content.
 */
export async function getReviewedCardIdsInSession(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
): Promise<readonly string[]> {
	const rows = await db
		.selectDistinct({ cardId: review.cardId })
		.from(review)
		.where(and(eq(review.userId, userId), eq(review.reviewSessionId, sessionId)));
	return rows.map((r) => r.cardId);
}

/**
 * Drop the card at the current index from the session's frozen list. The
 * `current_index` stays put because the next card slid into its slot. Used
 * by the snooze flow when the learner pushes a card out of the queue: the
 * deck shrinks rather than the cursor advancing past empty space.
 *
 * Marks the session COMPLETED when the shrink leaves no remaining cards.
 */
export async function shrinkSessionAtIndex(
	sessionId: string,
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MemoryReviewSessionRow> {
	return await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(memoryReviewSession)
			.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
			.for('update')
			.limit(1);
		if (!row) throw new ReviewSessionNotFoundError(sessionId, userId);
		if (row.status === REVIEW_SESSION_STATUSES.COMPLETED) return row;

		const idx = row.currentIndex;
		if (idx >= row.cardIdList.length) return row;

		const nextList = [...row.cardIdList.slice(0, idx), ...row.cardIdList.slice(idx + 1)];
		const reachedEnd = idx >= nextList.length;

		const [updated] = await tx
			.update(memoryReviewSession)
			.set({
				cardIdList: nextList,
				lastActivityAt: now,
				status: reachedEnd ? REVIEW_SESSION_STATUSES.COMPLETED : REVIEW_SESSION_STATUSES.ACTIVE,
				completedAt: reachedEnd ? now : null,
			})
			.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
			.returning();
		return updated;
	});
}

/**
 * Replace the card at the current index with a different card id. The
 * `current_index` stays put so the learner sees the replacement immediately.
 * Used by the snooze REMOVE flow paired with `getReplacementCard`.
 */
export async function replaceSessionAtIndex(
	sessionId: string,
	userId: string,
	replacementCardId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<MemoryReviewSessionRow> {
	return await db.transaction(async (tx) => {
		const [row] = await tx
			.select()
			.from(memoryReviewSession)
			.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
			.for('update')
			.limit(1);
		if (!row) throw new ReviewSessionNotFoundError(sessionId, userId);
		if (row.status === REVIEW_SESSION_STATUSES.COMPLETED) return row;

		const idx = row.currentIndex;
		if (idx >= row.cardIdList.length) return row;

		const nextList = [...row.cardIdList];
		nextList[idx] = replacementCardId;

		const [updated] = await tx
			.update(memoryReviewSession)
			.set({
				cardIdList: nextList,
				lastActivityAt: now,
			})
			.where(and(eq(memoryReviewSession.id, sessionId), eq(memoryReviewSession.userId, userId)))
			.returning();
		return updated;
	});
}

/**
 * Lazy cleanup: mark any ACTIVE session whose last activity is older than
 * {@link REVIEW_SESSION_ABANDON_MS} as ABANDONED. Per the spec this runs on
 * every visit to the sessions surfaces (cheap); no background job.
 */
export async function abandonStaleSessions(
	userId: string,
	db: Db = defaultDb,
	now: Date = new Date(),
): Promise<number> {
	const cutoff = new Date(now.getTime() - REVIEW_SESSION_ABANDON_MS);
	const rows = await db
		.update(memoryReviewSession)
		.set({ status: REVIEW_SESSION_STATUSES.ABANDONED })
		.where(
			and(
				eq(memoryReviewSession.userId, userId),
				eq(memoryReviewSession.status, REVIEW_SESSION_STATUSES.ACTIVE),
				lt(memoryReviewSession.lastActivityAt, cutoff),
			),
		)
		.returning({ id: memoryReviewSession.id });
	return rows.length;
}

/**
 * Most-recent resumable session (active or abandoned) for this user. Used by
 * the `/memory` dashboard's "Resume your last run" tile.
 */
export async function getLatestResumableSession(
	userId: string,
	db: Db = defaultDb,
): Promise<MemoryReviewSessionRow | null> {
	const resumableStatuses: ReviewSessionStatus[] = [REVIEW_SESSION_STATUSES.ACTIVE, REVIEW_SESSION_STATUSES.ABANDONED];
	const [row] = await db
		.select()
		.from(memoryReviewSession)
		.where(and(eq(memoryReviewSession.userId, userId), inArray(memoryReviewSession.status, resumableStatuses)))
		.orderBy(desc(memoryReviewSession.lastActivityAt))
		.limit(1);
	return row ?? null;
}

/**
 * Find the most-recent in-progress (active or abandoned) session for this
 * user and deck hash. Drives the Layer (b) Redo resolver's "Resume your
 * in-progress run?" prompt: if the visit to `?deck=<...>` matches a hash the
 * user already has a partial run on, the resolver offers Resume vs Start
 * fresh rather than silently creating a new session.
 *
 * Returns the row or null. Completed sessions never match -- finishing a run
 * is the explicit signal that "this deck is done for now."
 */
export async function findResumableSessionByDeckHash(
	userId: string,
	deckHash: string,
	db: Db = defaultDb,
): Promise<MemoryReviewSessionRow | null> {
	const resumableStatuses: ReviewSessionStatus[] = [REVIEW_SESSION_STATUSES.ACTIVE, REVIEW_SESSION_STATUSES.ABANDONED];
	const [row] = await db
		.select()
		.from(memoryReviewSession)
		.where(
			and(
				eq(memoryReviewSession.userId, userId),
				eq(memoryReviewSession.deckHash, deckHash),
				inArray(memoryReviewSession.status, resumableStatuses),
			),
		)
		.orderBy(desc(memoryReviewSession.lastActivityAt))
		.limit(1);
	return row ?? null;
}

/**
 * Saved-deck summary for the `/memory` dashboard "Saved decks" section. One
 * entry per distinct `deck_hash` the user has run, with the most recently
 * stored canonical spec, the timestamp of the last run, and a count of total
 * runs (active + completed + abandoned). When an in-progress session exists
 * for the deck, its id + position are included so the entry can render a
 * "Resume in progress (N of M)" affordance instead of just a Re-run link.
 */
export interface SavedDeckSummary {
	deckHash: string;
	deckSpec: ReviewSessionDeckSpec;
	lastVisitedAt: Date;
	sessionCount: number;
	/**
	 * Learner-supplied display name overriding the auto-derived summary, or
	 * `null` when the learner hasn't renamed the deck. The dashboard falls
	 * back to `summarizeDeckSpec(deckSpec)` when this is null.
	 */
	label: string | null;
	resumable: {
		sessionId: string;
		status: ReviewSessionStatus;
		currentIndex: number;
		totalCards: number;
	} | null;
}

/**
 * Aggregate the user's saved decks. Saved decks are implicit: any
 * `memory_review_session` row contributes its `deck_hash` to the list, so
 * running a session with non-default filters automatically saves the deck.
 *
 * Joins the `study.saved_deck` overlay so per-deck rename / dismiss applies:
 * decks with `dismissed_at` set are filtered out, and a non-null `label`
 * replaces the auto-derived summary on the dashboard row.
 */
export async function listSavedDecks(userId: string, db: Db = defaultDb): Promise<SavedDeckSummary[]> {
	const aggregateRows = await db
		.select({
			deckHash: memoryReviewSession.deckHash,
			lastVisitedAt: max(memoryReviewSession.lastActivityAt),
			sessionCount: count(memoryReviewSession.id),
		})
		.from(memoryReviewSession)
		.where(eq(memoryReviewSession.userId, userId))
		.groupBy(memoryReviewSession.deckHash);

	if (aggregateRows.length === 0) return [];

	const deckHashes = aggregateRows.map((r) => r.deckHash);

	// Fetch all candidate rows for these hashes in one query, then pick the
	// representative (latest deck_spec) + the resumable row (latest active /
	// abandoned) per hash in memory. One round-trip beats N per-hash queries.
	const sessionRows = await db
		.select()
		.from(memoryReviewSession)
		.where(and(eq(memoryReviewSession.userId, userId), inArray(memoryReviewSession.deckHash, deckHashes)))
		.orderBy(desc(memoryReviewSession.lastActivityAt));

	const latestSpecByHash = new Map<string, ReviewSessionDeckSpec>();
	const resumableByHash = new Map<string, MemoryReviewSessionRow>();
	for (const row of sessionRows) {
		if (!latestSpecByHash.has(row.deckHash)) {
			latestSpecByHash.set(row.deckHash, row.deckSpec);
		}
		const isResumable =
			row.status === REVIEW_SESSION_STATUSES.ACTIVE || row.status === REVIEW_SESSION_STATUSES.ABANDONED;
		if (isResumable && !resumableByHash.has(row.deckHash)) {
			resumableByHash.set(row.deckHash, row);
		}
	}

	// Per-(user, hash) overlay: label override + dismissal. Fetched once
	// after the aggregate so a user with no overlay rows pays nothing
	// beyond the existing two queries.
	const overlays = await getSavedDeckOverlays(userId, db);

	const summaries: SavedDeckSummary[] = [];
	for (const agg of aggregateRows) {
		const overlay = overlays.get(agg.deckHash);
		// Dismissed decks are hidden from the dashboard list. Re-running the
		// same filter (or a Rename) clears `dismissed_at` and the entry
		// returns -- see `renameSavedDeck` / `?deck=<...>` resolver.
		if (overlay?.dismissedAt) continue;

		const resumableRow = resumableByHash.get(agg.deckHash);
		// `max()` over a non-empty group never returns null but TS sees it as
		// nullable; default to epoch as a defensive guard.
		const lastVisitedAt = agg.lastVisitedAt ?? new Date(0);
		summaries.push({
			deckHash: agg.deckHash,
			deckSpec: latestSpecByHash.get(agg.deckHash) ?? ({} as ReviewSessionDeckSpec),
			lastVisitedAt,
			sessionCount: Number(agg.sessionCount),
			label: overlay?.label ?? null,
			resumable: resumableRow
				? {
						sessionId: resumableRow.id,
						status: resumableRow.status as ReviewSessionStatus,
						currentIndex: resumableRow.currentIndex,
						totalCards: resumableRow.cardIdList.length,
					}
				: null,
		});
	}

	summaries.sort((a, b) => b.lastVisitedAt.getTime() - a.lastVisitedAt.getTime());
	return summaries;
}

/**
 * List memory-review sessions that included a card. Drives the Sessions row
 * of the card cross-references panel on `/memory/<id>`.
 */
export interface CardSessionRef {
	id: string;
	startedAt: Date;
	status: ReviewSessionStatus;
}

export async function getSessionsForCard(
	cardId: string,
	userId: string,
	limit: number,
	db: Db = defaultDb,
): Promise<CardSessionRef[]> {
	// Join review -> memory_review_session via the `review.review_session_id`
	// pointer stamped by `submitReview` when a session is in play. Distinct
	// over session id because a learner may review the same card multiple
	// times inside one run (undo + resubmit). Ordered newest-first so the
	// panel surfaces recent runs at the top.
	const rows = await db
		.selectDistinctOn([memoryReviewSession.id], {
			id: memoryReviewSession.id,
			startedAt: memoryReviewSession.startedAt,
			status: memoryReviewSession.status,
		})
		.from(review)
		.innerJoin(memoryReviewSession, eq(memoryReviewSession.id, review.reviewSessionId))
		.where(and(eq(review.cardId, cardId), eq(review.userId, userId), isNotNull(review.reviewSessionId)));

	return rows
		.map((r) => ({ id: r.id, startedAt: r.startedAt, status: r.status as ReviewSessionStatus }))
		.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
		.slice(0, Math.max(1, limit));
}
