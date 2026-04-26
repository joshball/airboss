/**
 * Route-action tests for `/memory/review` -- the deck-spec resolver.
 *
 * Covers `?/resume` and `?/fresh` form actions. Both decode a base64url deck
 * spec, normalize it against the current domain enum, recompute the deck hash,
 * and either (resume) redirect to an existing in-progress run or (fresh)
 * always create a new session. The redirect target is `/memory/review/<id>`.
 *
 * Pattern mirrors `apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts`:
 * minimal RequestEvent shape + real DB. The actions throw SvelteKit `Redirect`
 * sentinels on success; tests catch them via `isRedirect` and assert on the
 * `location` header value.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	card,
	cardState,
	computeDeckHash,
	encodeDeckSpec,
	memoryReviewSession,
	type ReviewSessionDeckSpec,
} from '@ab/bc-study';
import {
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONTENT_SOURCES,
	DOMAINS,
	QUERY_PARAMS,
	REVIEW_SESSION_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateCardId, generateReviewSessionId } from '@ab/utils';
import { type ActionFailure, isRedirect, type Redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actions } from './+page.server';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `memory-review-actions-test-${TEST_USER_ID}@airboss.test`;
const CREATED_CARD_IDS: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Memory Review Actions Test',
		firstName: 'Memory',
		lastName: 'Review',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(memoryReviewSession).where(eq(memoryReviewSession.userId, TEST_USER_ID));
	if (CREATED_CARD_IDS.length > 0) {
		await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
		await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

/**
 * Seed one due card so `startReviewSession`'s `getDueCards` query returns a
 * non-empty list. The action still creates a session row even if zero cards
 * are due, but a non-empty list mirrors real flows.
 */
async function seedDueCard(): Promise<string> {
	const id = generateCardId();
	const now = new Date();
	await db.insert(card).values({
		id,
		userId: TEST_USER_ID,
		front: `front ${id}`,
		back: `back ${id}`,
		domain: DOMAINS.REGULATIONS,
		tags: [],
		cardType: CARD_TYPES.BASIC,
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId: null,
		isEditable: true,
		status: CARD_STATUSES.ACTIVE,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(cardState).values({
		cardId: id,
		userId: TEST_USER_ID,
		stability: 0,
		difficulty: 5,
		state: CARD_STATES.NEW,
		// dueAt in the past so getDueCards picks it up.
		dueAt: new Date(now.getTime() - 60_000),
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	CREATED_CARD_IDS.push(id);
	return id;
}

interface SeedSessionRowOptions {
	deckHash: string;
	deckSpec: ReviewSessionDeckSpec;
	status: 'active' | 'completed' | 'abandoned';
	cardIds?: readonly string[];
	currentIndex?: number;
}

async function seedSessionRow(opts: SeedSessionRowOptions): Promise<string> {
	const id = generateReviewSessionId();
	const now = new Date();
	await db.insert(memoryReviewSession).values({
		id,
		userId: TEST_USER_ID,
		deckHash: opts.deckHash,
		deckSpec: opts.deckSpec,
		cardIdList: opts.cardIds ? [...opts.cardIds] : [],
		currentIndex: opts.currentIndex ?? 0,
		status: opts.status,
		startedAt: now,
		lastActivityAt: now,
		completedAt: opts.status === REVIEW_SESSION_STATUSES.COMPLETED ? now : null,
	});
	return id;
}

interface FakeEventInput {
	formData: FormData;
}

function makeEvent({ formData }: FakeEventInput) {
	const user = {
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Memory Review Actions Test',
		firstName: 'Memory',
		lastName: 'Review',
		emailVerified: true,
		role: 'learner' as const,
		image: null,
		banned: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	return {
		params: {},
		request: { formData: async () => formData } as unknown as Request,
		locals: { user, session: null, requestId: 'test-req', appearance: 'system' as const },
		url: new URL('http://localhost/memory/review'),
		route: { id: '/(app)/memory/review' },
		cookies: {} as never,
		fetch: globalThis.fetch,
		getClientAddress: () => '127.0.0.1',
		platform: undefined,
		setHeaders: () => {},
		isDataRequest: false,
		isSubRequest: false,
	};
}

function isFailure<T>(result: unknown): result is ActionFailure<T> {
	return (
		typeof result === 'object' &&
		result !== null &&
		'status' in result &&
		typeof (result as { status: unknown }).status === 'number'
	);
}

/**
 * Run a SvelteKit action that always redirects on success, capturing the
 * `Redirect` sentinel via the runtime helper. Re-throws anything that isn't a
 * Redirect so genuine errors surface in the test report. Accepts
 * `MaybePromise<unknown>` so SvelteKit's `Action` return type
 * (`MaybePromise<void | Record>`) is trivially assignable without a per-call
 * cast.
 */
async function expectRedirect(run: () => unknown | Promise<unknown>): Promise<Redirect> {
	try {
		await Promise.resolve(run());
	} catch (err) {
		if (isRedirect(err)) return err;
		throw err;
	}
	throw new Error('expected redirect, got resolved value');
}

describe('memory/review resume action', () => {
	it('redirects to the existing in-progress session for the deck hash', async () => {
		const spec: ReviewSessionDeckSpec = { domain: DOMAINS.REGULATIONS };
		const hash = computeDeckHash(spec);
		const sessionId = await seedSessionRow({
			deckHash: hash,
			deckSpec: spec,
			status: REVIEW_SESSION_STATUSES.ACTIVE,
			cardIds: [generateCardId()],
		});

		const formData = new FormData();
		formData.set(QUERY_PARAMS.DECK, encodeDeckSpec(spec));

		const redirectErr = await expectRedirect(() => actions.resume(makeEvent({ formData }) as never));
		expect(redirectErr.status).toBe(303);
		expect(redirectErr.location).toBe(`/memory/review/${encodeURIComponent(sessionId)}`);
	});

	it('falls through to creating a new session when no resumable run exists', async () => {
		await seedDueCard();
		// Use a deck spec that has no prior session for this user.
		const spec: ReviewSessionDeckSpec = { domain: DOMAINS.WEATHER };
		const hash = computeDeckHash(spec);

		const formData = new FormData();
		formData.set(QUERY_PARAMS.DECK, encodeDeckSpec(spec));

		const redirectErr = await expectRedirect(() => actions.resume(makeEvent({ formData }) as never));
		expect(redirectErr.status).toBe(303);
		expect(redirectErr.location).toMatch(/^\/memory\/review\/[^/]+$/);

		// A fresh session for this hash now exists in the DB.
		const rows = await db.select().from(memoryReviewSession).where(eq(memoryReviewSession.userId, TEST_USER_ID));
		const matching = rows.filter((r) => r.deckHash === hash);
		expect(matching.length).toBeGreaterThan(0);
	});

	it('returns 400 when the deck param is missing', async () => {
		const formData = new FormData();
		const result = await actions.resume(makeEvent({ formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ error: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
	});

	it('returns 400 for a malformed deck param', async () => {
		const formData = new FormData();
		formData.set(QUERY_PARAMS.DECK, 'not-valid-base64-or-json');

		const result = await actions.resume(makeEvent({ formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ error: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
	});
});

describe('memory/review fresh action', () => {
	it('always creates a new session even when a resumable one would match', async () => {
		await seedDueCard();
		const spec: ReviewSessionDeckSpec = { domain: DOMAINS.AERODYNAMICS };
		const hash = computeDeckHash(spec);
		// Pre-existing resumable run on this deck.
		const existingId = await seedSessionRow({
			deckHash: hash,
			deckSpec: spec,
			status: REVIEW_SESSION_STATUSES.ACTIVE,
			cardIds: [generateCardId()],
		});

		const formData = new FormData();
		formData.set(QUERY_PARAMS.DECK, encodeDeckSpec(spec));

		const redirectErr = await expectRedirect(() => actions.fresh(makeEvent({ formData }) as never));
		expect(redirectErr.status).toBe(303);
		expect(redirectErr.location).toMatch(/^\/memory\/review\/[^/]+$/);

		// The redirect target is NOT the pre-existing session id -- a brand
		// new row was minted.
		const target = redirectErr.location.replace('/memory/review/', '');
		expect(target).not.toBe(encodeURIComponent(existingId));

		// Two distinct sessions for this hash now exist.
		const rows = await db.select().from(memoryReviewSession).where(eq(memoryReviewSession.userId, TEST_USER_ID));
		const matching = rows.filter((r) => r.deckHash === hash);
		expect(matching.length).toBe(2);
	});

	it('returns 400 when the deck param is missing', async () => {
		const formData = new FormData();
		const result = await actions.fresh(makeEvent({ formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ error: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
	});

	it('returns 400 for a malformed deck param', async () => {
		const formData = new FormData();
		formData.set(QUERY_PARAMS.DECK, '!!!not-base64!!!');

		const result = await actions.fresh(makeEvent({ formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ error: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
	});
});
