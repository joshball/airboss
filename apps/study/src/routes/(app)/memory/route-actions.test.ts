/**
 * Route-action tests for `/memory` -- the dashboard's saved-decks rename +
 * delete affordances.
 *
 * Mirrors the pattern in `apps/study/src/routes/(app)/memory/[id]/route-actions.test.ts`:
 * build a minimal RequestEvent-shaped object, invoke the action directly, and
 * assert the side effects in the DB. The BC-layer rules (label normalization,
 * length cap, dismissal idempotency) are pinned in `libs/bc/study/src/saved-decks.test.ts`;
 * this file exercises the form-parsing + redirect + ActionFailure-mapping
 * surface that lives in the route handler.
 */

import { bauthUser } from '@ab/auth/schema';
import { savedDeck } from '@ab/bc-study';
import { SAVED_DECK_LABEL_MAX_LENGTH } from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId } from '@ab/utils';
import type { ActionFailure } from '@sveltejs/kit';
import { isHttpError, isRedirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actions } from './+page.server';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `memory-dash-route-actions-test-${TEST_USER_ID}@airboss.test`;

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Memory Dashboard Routes',
		firstName: 'Memory',
		lastName: 'Routes',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	await db.delete(savedDeck).where(eq(savedDeck.userId, TEST_USER_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

interface FakeEventInput {
	formData: FormData;
}

function makeEvent({ formData }: FakeEventInput) {
	const user = {
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Memory Dashboard Routes',
		firstName: 'Memory',
		lastName: 'Routes',
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
		url: new URL('http://localhost/memory'),
		route: { id: '/(app)/memory' },
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
		typeof (result as { status: unknown }).status === 'number' &&
		!isHttpError(result) &&
		!isRedirect(result)
	);
}

/**
 * Both saved-deck actions end in `redirect(303, ...)` on the success path,
 * which throws a `Redirect` sentinel. Wrap the call so the test can assert
 * on the captured redirect; re-throw anything that isn't a Redirect so
 * genuine errors surface in the report. Accepts `MaybePromise<unknown>` so
 * SvelteKit's `Action` return type (`MaybePromise<void | Record>`) is
 * trivially assignable without a per-call cast.
 */
async function callAction(run: () => unknown | Promise<unknown>): Promise<unknown> {
	try {
		return await Promise.resolve(run());
	} catch (err) {
		if (isRedirect(err)) return err;
		throw err;
	}
}

describe('memory renameDeck action', () => {
	it('persists a new label and redirects on success', async () => {
		const formData = new FormData();
		formData.set('deckHash', 'rt000001');
		formData.set('label', 'Daily airspace');

		const result = await callAction(() => actions.renameDeck(makeEvent({ formData }) as never));
		expect(isRedirect(result)).toBe(true);

		const stored = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, TEST_USER_ID), eq(savedDeck.deckHash, 'rt000001')));
		expect(stored).toHaveLength(1);
		expect(stored[0]?.label).toBe('Daily airspace');
	});

	it('returns 400 when deckHash is missing', async () => {
		const formData = new FormData();
		formData.set('label', 'Anything');

		const result = await callAction(() => actions.renameDeck(makeEvent({ formData }) as never));
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
		expect(result.data.intent).toBe('renameDeck');
	});

	it('returns 400 with a label-specific error when the label exceeds the limit', async () => {
		const formData = new FormData();
		formData.set('deckHash', 'rt000002');
		formData.set('label', 'x'.repeat(SAVED_DECK_LABEL_MAX_LENGTH + 1));

		const result = await callAction(() => actions.renameDeck(makeEvent({ formData }) as never));
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string; deckHash: string; fieldErrors: { label?: string } }>(result))
			throw new Error('expected failure');
		expect(result.status).toBe(400);
		expect(result.data.fieldErrors.label).toBeTruthy();
		expect(result.data.deckHash).toBe('rt000002');
	});
});

describe('memory deleteDeck action', () => {
	it('marks the saved-deck row dismissed and redirects on success', async () => {
		const formData = new FormData();
		formData.set('deckHash', 'rt000003');

		const result = await callAction(() => actions.deleteDeck(makeEvent({ formData }) as never));
		expect(isRedirect(result)).toBe(true);

		const stored = await db
			.select()
			.from(savedDeck)
			.where(and(eq(savedDeck.userId, TEST_USER_ID), eq(savedDeck.deckHash, 'rt000003')));
		expect(stored).toHaveLength(1);
		expect(stored[0]?.dismissedAt).toBeInstanceOf(Date);
	});

	it('returns 400 when deckHash is missing', async () => {
		const formData = new FormData();

		const result = await callAction(() => actions.deleteDeck(makeEvent({ formData }) as never));
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
		expect(result.data.intent).toBe('deleteDeck');
	});
});
