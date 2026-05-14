/**
 * Plan-items BC integration tests. Hits the dev Postgres directly,
 * mirroring the snooze + annotations suites. Each test creates an
 * isolated user + supporting reference/section/card rows and tears them
 * down on cleanup.
 */

import { bauthUser } from '@ab/auth/schema';
import { CARD_KINDS, CARD_TYPES, DOMAINS, PLAN_ITEM_KINDS } from '@ab/constants';
import { db } from '@ab/db/connection';
import { generateAuthId, generateCardId, generateReferenceId, generateReferenceSectionId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	getPlanItemsForDate,
	getTodayPlanItems,
	markPlanItemComplete,
	PlanItemNotFoundError,
	pinPlanItem,
	reopenPlanItem,
	unpinPlanItem,
} from './plan-items';
import { card, cardState, planItem, reference, referenceSection } from './schema';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `plan-items-test-${TEST_USER_ID}@airboss.test`;
const TEST_REFERENCE_ID = generateReferenceId();
const TEST_SECTION_ID = generateReferenceSectionId();
const TEST_CARD_ID = generateCardId();

// Use a fixed "today" string so tests are deterministic regardless of when
// they run. The BC accepts an explicit `pinnedForDate`; `pinToToday` uses
// the wall clock and is verified separately.
const TODAY = '2026-05-14';
const YESTERDAY = '2026-05-13';

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Plan Items Test',
		firstName: 'PlanItems',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
	// `document_slug` must match `[a-z0-9][a-z0-9-]{1,30}[a-z0-9]`. The full
	// 26-char ULID suffix would exceed 33 chars; truncate so the slug stays
	// within the regex cap.
	await db.insert(reference).values({
		id: TEST_REFERENCE_ID,
		kind: 'handbook',
		documentSlug: `plan-${TEST_USER_ID.slice(0, 20)}`,
		edition: 'test-1',
		editionDate: '2026-01-01',
		title: 'Plan Items Test Handbook',
		publisher: 'airboss-test',
	});
	await db.insert(referenceSection).values({
		id: TEST_SECTION_ID,
		referenceId: TEST_REFERENCE_ID,
		airbossRef: `airboss-ref:test/plan-items/${TEST_SECTION_ID}`,
		level: 'section',
		code: 'PI.1',
		title: 'Plan Items Test Section',
		sourceLocator: 'Plan Items Test §PI.1',
		contentHash: `sha256:test-plan-items-${TEST_SECTION_ID}`,
		ordinal: 1,
		depth: 0,
		contentMd: 'Plan items test body.',
	});
	await db.insert(card).values({
		id: TEST_CARD_ID,
		userId: TEST_USER_ID,
		front: 'plan items test card',
		back: 'pinned',
		domain: DOMAINS.AIRSPACE,
		cardType: CARD_TYPES.BASIC,
		kind: CARD_KINDS.RECALL,
	});
});

afterAll(async () => {
	// plan_item rows cascade from bauthUser; deleting the user via the FK
	// would also drop them, but we delete explicitly so the test row count
	// stays observable mid-suite if a later case relies on isolation.
	await db.delete(planItem).where(eq(planItem.userId, TEST_USER_ID));
	await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
	await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	await db.delete(referenceSection).where(eq(referenceSection.id, TEST_SECTION_ID));
	await db.delete(reference).where(eq(reference.id, TEST_REFERENCE_ID));
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

async function clearPins(): Promise<void> {
	await db.delete(planItem).where(eq(planItem.userId, TEST_USER_ID));
}

describe('pinPlanItem', () => {
	it('pins a knowledge node and stores the snapshot fields', async () => {
		await clearPins();
		const row = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'airspace-vfr-weather-minimums',
			title: 'VFR weather minimums',
			href: '/study/knowledge/airspace-vfr-weather-minimums',
			pinnedForDate: TODAY,
		});
		expect(row.kind).toBe(PLAN_ITEM_KINDS.KNOWLEDGE_NODE);
		expect(row.knowledgeNodeId).toBe('airspace-vfr-weather-minimums');
		expect(row.referenceSectionId).toBeNull();
		expect(row.cardId).toBeNull();
		expect(row.glossaryTerm).toBeNull();
		expect(row.title).toBe('VFR weather minimums');
		expect(row.href).toBe('/study/knowledge/airspace-vfr-weather-minimums');
		expect(row.notes).toBe('');
		expect(row.completedAt).toBeNull();
		expect(row.pinnedForDate).toBe(TODAY);
	});

	it('pins a reference section with a typed FK column populated', async () => {
		await clearPins();
		const row = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.REFERENCE_SECTION,
			targetId: TEST_SECTION_ID,
			title: 'Plan Items Test Section',
			href: `/handbook/test/${TEST_SECTION_ID}`,
			pinnedForDate: TODAY,
		});
		expect(row.referenceSectionId).toBe(TEST_SECTION_ID);
		expect(row.knowledgeNodeId).toBeNull();
	});

	it('pins a card', async () => {
		await clearPins();
		const row = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.CARD,
			targetId: TEST_CARD_ID,
			title: 'plan items test card',
			href: `/memory/cards/${TEST_CARD_ID}`,
			pinnedForDate: TODAY,
		});
		expect(row.cardId).toBe(TEST_CARD_ID);
	});

	it('pins a glossary term', async () => {
		await clearPins();
		const row = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.GLOSSARY,
			targetId: 'magnetic-variation',
			title: 'magnetic variation',
			href: '/study/glossary/magnetic-variation',
			pinnedForDate: TODAY,
		});
		expect(row.glossaryTerm).toBe('magnetic-variation');
	});

	it('is idempotent for the same (user, kind, target, date)', async () => {
		await clearPins();
		const first = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'airspace-vfr-weather-minimums',
			title: 'VFR weather minimums',
			href: '/study/knowledge/airspace-vfr-weather-minimums',
			pinnedForDate: TODAY,
		});
		const second = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'airspace-vfr-weather-minimums',
			title: 'VFR weather minimums (rename)',
			href: '/study/knowledge/airspace-vfr-weather-minimums',
			pinnedForDate: TODAY,
		});
		expect(second.id).toBe(first.id);
		// Existing snapshot title preserved -- the idempotent return is the
		// original row, not an update.
		expect(second.title).toBe('VFR weather minimums');
		const rows = await db.select().from(planItem).where(eq(planItem.userId, TEST_USER_ID));
		expect(rows).toHaveLength(1);
	});

	it('allows the same target on a different date', async () => {
		await clearPins();
		await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'airspace-vfr-weather-minimums',
			title: 'VFR weather minimums',
			href: '/study/knowledge/airspace-vfr-weather-minimums',
			pinnedForDate: YESTERDAY,
		});
		await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'airspace-vfr-weather-minimums',
			title: 'VFR weather minimums',
			href: '/study/knowledge/airspace-vfr-weather-minimums',
			pinnedForDate: TODAY,
		});
		const rows = await db.select().from(planItem).where(eq(planItem.userId, TEST_USER_ID));
		expect(rows).toHaveLength(2);
	});

	it('rejects an empty target id at the validation layer', async () => {
		await clearPins();
		await expect(
			pinPlanItem({
				userId: TEST_USER_ID,
				kind: PLAN_ITEM_KINDS.GLOSSARY,
				targetId: '   ',
				title: 'magnetic variation',
				href: '/study/glossary/magnetic-variation',
				pinnedForDate: TODAY,
			}),
		).rejects.toThrow();
	});
});

describe('getPlanItemsForDate / getTodayPlanItems', () => {
	it('returns only the requested date, oldest-pin first', async () => {
		await clearPins();
		await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'pinned-yesterday',
			title: 'Yesterday',
			href: '/y',
			pinnedForDate: YESTERDAY,
		});
		const a = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'a',
			title: 'A',
			href: '/a',
			pinnedForDate: TODAY,
		});
		// Tiny pause so the second pinnedAt is strictly greater.
		await new Promise((r) => setTimeout(r, 10));
		const b = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'b',
			title: 'B',
			href: '/b',
			pinnedForDate: TODAY,
		});
		const rows = await getPlanItemsForDate(TEST_USER_ID, TODAY);
		expect(rows.map((r) => r.id)).toEqual([a.id, b.id]);
	});

	it('getTodayPlanItems excludes completed rows', async () => {
		await clearPins();
		const a = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'a',
			title: 'A',
			href: '/a',
			pinnedForDate: TODAY,
		});
		await markPlanItemComplete(a.id, TEST_USER_ID);
		const rows = await getTodayPlanItems(TEST_USER_ID, db, new Date(`${TODAY}T12:00:00-06:00`));
		expect(rows.find((r) => r.id === a.id)).toBeUndefined();
	});
});

describe('markPlanItemComplete / reopenPlanItem', () => {
	it('marks an open row complete and preserves completedAt on re-call', async () => {
		await clearPins();
		const a = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'a',
			title: 'A',
			href: '/a',
			pinnedForDate: TODAY,
		});
		const first = await markPlanItemComplete(a.id, TEST_USER_ID);
		expect(first.completedAt).not.toBeNull();
		const second = await markPlanItemComplete(a.id, TEST_USER_ID);
		expect(second.completedAt?.getTime()).toBe(first.completedAt?.getTime());
	});

	it('reopen clears completedAt', async () => {
		await clearPins();
		const a = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'a',
			title: 'A',
			href: '/a',
			pinnedForDate: TODAY,
		});
		await markPlanItemComplete(a.id, TEST_USER_ID);
		const reopened = await reopenPlanItem(a.id, TEST_USER_ID);
		expect(reopened.completedAt).toBeNull();
	});

	it('throws PlanItemNotFoundError when the row does not belong to the user', async () => {
		await clearPins();
		await expect(markPlanItemComplete('pitm_nope', TEST_USER_ID)).rejects.toBeInstanceOf(PlanItemNotFoundError);
	});
});

describe('unpinPlanItem', () => {
	it('removes the row', async () => {
		await clearPins();
		const a = await pinPlanItem({
			userId: TEST_USER_ID,
			kind: PLAN_ITEM_KINDS.KNOWLEDGE_NODE,
			targetId: 'a',
			title: 'A',
			href: '/a',
			pinnedForDate: TODAY,
		});
		await unpinPlanItem(a.id, TEST_USER_ID);
		const rows = await db.select().from(planItem).where(eq(planItem.id, a.id));
		expect(rows).toHaveLength(0);
	});

	it('throws for a missing or non-owned row', async () => {
		await expect(unpinPlanItem('pitm_nope', TEST_USER_ID)).rejects.toBeInstanceOf(PlanItemNotFoundError);
	});
});
