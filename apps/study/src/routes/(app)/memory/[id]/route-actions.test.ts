/**
 * Route-action tests for `/memory/[id]` -- the card editor.
 *
 * Covers the form-action layer for `?/addCitation` and `?/removeCitation` that
 * the BC tests in `libs/bc/study/src/citations/` don't reach. The BC layer is exercised
 * for ownership + validation + duplicates already; this file pins down the
 * route action's form parsing, error -> ActionFailure mapping, and the
 * ownership 404 surface that distinguishes `CitationNotFoundError` from a
 * generic 500.
 *
 * Pattern: build a minimal `RequestEvent`-shaped object, invoke the action
 * directly, assert the returned ActionFailure / success payload + side
 * effects in the DB. `requireAuth` reads `event.locals.user`, so no module
 * mocking is needed -- a plain object satisfies the contract.
 */

import { bauthUser } from '@ab/auth/schema';
import { card, cardState, contentCitation } from '@ab/bc-study';
import {
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CITATION_SOURCE_TYPES,
	CITATION_TARGET_TYPES,
	CONTENT_SOURCES,
	DOMAINS,
	EXTERNAL_REF_TARGET_DELIMITER,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateCardId, generateContentCitationId } from '@ab/utils';
import type { ActionFailure } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actions } from './+page.server';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `card-route-actions-test-${TEST_USER_ID}@airboss.test`;
const CREATED_CARD_IDS: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Card Route Actions Test',
		firstName: 'Card',
		lastName: 'Routes',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	if (CREATED_CARD_IDS.length > 0) {
		await db.delete(contentCitation).where(eq(contentCitation.createdBy, TEST_USER_ID));
		await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
		await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

async function seedCard(): Promise<string> {
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
		dueAt: now,
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	CREATED_CARD_IDS.push(id);
	return id;
}

interface FakeEventInput {
	cardId: string;
	formData: FormData;
}

/**
 * Build a minimal RequestEvent-shaped object that satisfies the slice the
 * action actually reads (`params.id`, `request.formData()`, `locals.user`,
 * `locals.requestId`). Cast to `never` only at the boundary so each action's
 * own type still drives intellisense.
 */
function makeEvent({ cardId, formData }: FakeEventInput) {
	const user = {
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Card Route Actions Test',
		firstName: 'Card',
		lastName: 'Routes',
		emailVerified: true,
		role: 'learner' as const,
		image: null,
		banned: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	return {
		params: { id: cardId },
		request: { formData: async () => formData } as unknown as Request,
		locals: { user, session: null, requestId: 'test-req', appearance: 'system' as const },
		// Unused fields the action does not read; SvelteKit's RequestEvent type
		// has more, but the action body never touches them. Cast at the boundary.
		url: new URL('http://localhost/memory/test'),
		route: { id: '/(app)/memory/[id]' },
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

describe('memory/[id] addCitation action', () => {
	it('creates an external_ref citation owned by the caller', async () => {
		const cardId = await seedCard();
		const targetId = `https://example.com/foo${EXTERNAL_REF_TARGET_DELIMITER}Example title`;
		const formData = new FormData();
		formData.set('targetType', CITATION_TARGET_TYPES.EXTERNAL_REF);
		formData.set('targetId', targetId);
		formData.set('note', 'My note');

		const result = await actions.addCitation(makeEvent({ cardId, formData }) as never);
		expect(result).toMatchObject({ success: true, intent: 'addCitation' });

		const rows = await db.select().from(contentCitation).where(eq(contentCitation.sourceId, cardId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.createdBy).toBe(TEST_USER_ID);
		expect(rows[0]?.sourceType).toBe(CITATION_SOURCE_TYPES.CARD);
		expect(rows[0]?.targetType).toBe(CITATION_TARGET_TYPES.EXTERNAL_REF);
		expect(rows[0]?.citationContext).toBe('My note');
	});

	it('rejects an unknown targetType with 400', async () => {
		const cardId = await seedCard();
		const formData = new FormData();
		formData.set('targetType', 'not-a-real-type');
		formData.set('targetId', 'whatever');

		const result = await actions.addCitation(makeEvent({ cardId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
		expect(result.data.intent).toBe('addCitation');
	});

	it('rejects an external_ref with an invalid URL as 400', async () => {
		const cardId = await seedCard();
		const formData = new FormData();
		formData.set('targetType', CITATION_TARGET_TYPES.EXTERNAL_REF);
		// Non-URL: BC raises CitationTargetNotFoundError, action surfaces 400.
		formData.set('targetId', 'not a url');

		const result = await actions.addCitation(makeEvent({ cardId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
		expect(result.data.intent).toBe('addCitation');
	});
});

describe('memory/[id] removeCitation action', () => {
	it('returns 400 when citationId is missing', async () => {
		const cardId = await seedCard();
		const formData = new FormData();
		// no citationId

		const result = await actions.removeCitation(makeEvent({ cardId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
	});

	it('returns 404 for an unknown citation id', async () => {
		const cardId = await seedCard();
		const formData = new FormData();
		formData.set('citationId', generateContentCitationId());

		const result = await actions.removeCitation(makeEvent({ cardId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		// Pre-fix: this was 500 (CitationNotFoundError fell through to log+500).
		// Post-fix: we surface 404 so the learner sees "already gone".
		expect(result.status).toBe(404);
	});

	it('deletes a citation owned by the caller', async () => {
		const cardId = await seedCard();
		const targetId = `https://example.com/del${EXTERNAL_REF_TARGET_DELIMITER}Del title`;
		const addForm = new FormData();
		addForm.set('targetType', CITATION_TARGET_TYPES.EXTERNAL_REF);
		addForm.set('targetId', targetId);
		const addResult = await actions.addCitation(makeEvent({ cardId, formData: addForm }) as never);
		expect(addResult).toMatchObject({ success: true });

		const [row] = await db.select().from(contentCitation).where(eq(contentCitation.sourceId, cardId));
		expect(row).toBeDefined();
		if (!row) throw new Error('seed citation missing');

		const removeForm = new FormData();
		removeForm.set('citationId', row.id);
		const removeResult = await actions.removeCitation(makeEvent({ cardId, formData: removeForm }) as never);
		expect(removeResult).toMatchObject({ success: true, intent: 'removeCitation' });

		const after = await db.select().from(contentCitation).where(eq(contentCitation.id, row.id));
		expect(after).toHaveLength(0);
	});
});
