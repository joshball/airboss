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

import { createHash } from 'node:crypto';
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
import { and, desc, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { getDueCards } from './cards';
import {
	card,
	cardState,
	type MemoryReviewSessionRow,
	memoryReviewSession,
	type ReviewSessionDeckSpec,
	review,
} from './schema';

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

/**
 * Deterministic canonical JSON of a deck spec + SHA-1 first 8 chars. Two
 * requests with the same logical filter land on the same hash regardless of
 * property-insertion order.
 */
export function computeDeckHash(spec: ReviewSessionDeckSpec): string {
	// Sort keys so `{ domain: null }` and future multi-field specs round-trip
	// deterministically.
	const canonical = JSON.stringify(spec, Object.keys(spec).sort());
	return createHash('sha1').update(canonical).digest('hex').slice(0, 8);
}

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
