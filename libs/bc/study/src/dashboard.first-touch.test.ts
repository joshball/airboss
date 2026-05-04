/**
 * Integration tests for `getFirstTouchDate` (study-home WP).
 *
 * Builds a fresh knowledge node, attaches mock card / card_state /
 * session_item_result rows in different combinations, and asserts the
 * helper picks the earliest evidence date across the union. The
 * `flight_maneuver` table doesn't exist yet (lands in WP 2); the helper
 * tolerates its absence today and the test confirms the no-evidence
 * branch.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CARD_STATES,
	CARD_STATUSES,
	CARD_TYPES,
	CONTENT_SOURCES,
	DEPTH_PREFERENCES,
	DOMAINS,
	MIN_SESSION_LENGTH,
	PLAN_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_MODES,
	SESSION_REASON_CODES,
	SESSION_SLICES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import {
	createId,
	generateAuthId,
	generateCardId,
	generateSessionId,
	generateSessionItemResultId,
	generateStudyPlanId,
} from '@ab/utils';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getFirstTouchDate } from './dashboard';
import { card, cardState, knowledgeNode, session, sessionItemResult, studyPlan } from './schema';

interface Fixture {
	userId: string;
	nodeId: string;
	planId: string;
	cleanup: () => Promise<void>;
}

async function fixture(label: string): Promise<Fixture> {
	const userId = generateAuthId();
	const nodeId = `first-touch-${label}-${createId('x').slice(0, 8)}`;
	const planId = generateStudyPlanId();
	const now = new Date();

	await db.insert(bauthUser).values({
		id: userId,
		email: `first-touch-${label}-${userId}@airboss.test`,
		name: `${label} Test`,
		firstName: label,
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(knowledgeNode).values({
		id: nodeId,
		title: `Test node ${label}`,
		domain: DOMAINS.AIRSPACE,
		crossDomains: [],
		knowledgeTypes: ['factual'],
		technicalDepth: null,
		stability: null,
		minimumCert: null,
		studyPriority: null,
		modalities: [],
		estimatedTimeMinutes: null,
		reviewTimeMinutes: null,
		references: [],
		assessable: true,
		assessmentMethods: [],
		masteryCriteria: null,
		contentMd: '',
		createdAt: now,
		updatedAt: now,
	});

	await db.insert(studyPlan).values({
		id: planId,
		userId,
		title: `plan ${planId}`,
		status: PLAN_STATUSES.ACTIVE,
		certGoals: [],
		focusDomains: [],
		skipDomains: [],
		skipNodes: [],
		depthPreference: DEPTH_PREFERENCES.WORKING,
		sessionLength: MIN_SESSION_LENGTH,
		defaultMode: SESSION_MODES.MIXED,
		createdAt: now,
		updatedAt: now,
	});

	return {
		userId,
		nodeId,
		planId,
		cleanup: async () => {
			await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, userId));
			await db.delete(session).where(eq(session.userId, userId));
			await db.delete(studyPlan).where(eq(studyPlan.userId, userId));
			await db.delete(cardState).where(eq(cardState.userId, userId));
			await db.delete(card).where(eq(card.userId, userId));
			await db.delete(knowledgeNode).where(eq(knowledgeNode.id, nodeId));
			await db.delete(bauthUser).where(eq(bauthUser.id, userId));
		},
	};
}

async function seedCardOnNode(userId: string, nodeId: string): Promise<string> {
	const id = generateCardId();
	const now = new Date();
	await db.insert(card).values({
		id,
		userId,
		front: 'q',
		back: 'a',
		domain: DOMAINS.AIRSPACE,
		tags: [],
		cardType: CARD_TYPES.BASIC,
		sourceType: CONTENT_SOURCES.PERSONAL,
		sourceRef: null,
		nodeId,
		isEditable: true,
		status: CARD_STATUSES.ACTIVE,
		createdAt: now,
		updatedAt: now,
	});
	await db.insert(cardState).values({
		cardId: id,
		userId,
		stability: 0,
		difficulty: 5,
		state: CARD_STATES.NEW,
		dueAt: now,
		lastReviewId: null,
		lastReviewedAt: null,
		reviewCount: 0,
		lapseCount: 0,
	});
	return id;
}

async function setCardLastReviewedAt(cardId: string, at: Date): Promise<void> {
	await db.update(cardState).set({ lastReviewedAt: at, reviewCount: 1 }).where(eq(cardState.cardId, cardId));
}

async function seedRepSlot(userId: string, planId: string, nodeId: string, presentedAt: Date): Promise<void> {
	const sessionId = generateSessionId();
	await db.insert(session).values({
		id: sessionId,
		userId,
		planId,
		mode: SESSION_MODES.MIXED,
		focusOverride: null,
		certOverride: null,
		sessionLength: MIN_SESSION_LENGTH,
		items: [],
		seed: `test-seed-${sessionId}`,
		startedAt: presentedAt,
		completedAt: null,
		seedOrigin: null,
	});
	await db.insert(sessionItemResult).values({
		id: generateSessionItemResultId(),
		sessionId,
		userId,
		slotIndex: 0,
		itemKind: SESSION_ITEM_KINDS.NODE_START,
		slice: SESSION_SLICES.CONTINUE,
		reasonCode: SESSION_REASON_CODES.CONTINUE_RECENT_DOMAIN,
		nodeId,
		presentedAt,
		completedAt: null,
	});
}

describe('getFirstTouchDate', () => {
	it('returns null when no evidence is attached to the node', async () => {
		const f = await fixture('empty');
		try {
			const got = await getFirstTouchDate(f.userId, f.nodeId);
			expect(got).toBeNull();
		} finally {
			await f.cleanup();
		}
	});

	it('returns the card_state.last_reviewed_at when only cards exist', async () => {
		const f = await fixture('cards-only');
		try {
			const cardId = await seedCardOnNode(f.userId, f.nodeId);
			const reviewedAt = new Date('2026-04-01T12:00:00Z');
			await setCardLastReviewedAt(cardId, reviewedAt);

			const got = await getFirstTouchDate(f.userId, f.nodeId);
			expect(got?.toISOString()).toBe(reviewedAt.toISOString());
		} finally {
			await f.cleanup();
		}
	});

	it('returns the rep slot presented_at when only reps exist', async () => {
		const f = await fixture('reps-only');
		try {
			const presentedAt = new Date('2026-04-15T08:00:00Z');
			await seedRepSlot(f.userId, f.planId, f.nodeId, presentedAt);
			const got = await getFirstTouchDate(f.userId, f.nodeId);
			expect(got?.toISOString()).toBe(presentedAt.toISOString());
		} finally {
			await f.cleanup();
		}
	});

	it('returns the earliest of card and rep when both exist', async () => {
		const f = await fixture('mixed');
		try {
			const cardId = await seedCardOnNode(f.userId, f.nodeId);
			const cardAt = new Date('2026-04-10T00:00:00Z');
			const repAt = new Date('2026-04-05T00:00:00Z'); // earlier
			await setCardLastReviewedAt(cardId, cardAt);
			await seedRepSlot(f.userId, f.planId, f.nodeId, repAt);

			const got = await getFirstTouchDate(f.userId, f.nodeId);
			expect(got?.toISOString()).toBe(repAt.toISOString());
		} finally {
			await f.cleanup();
		}
	});

	it('ignores cards on other nodes', async () => {
		const f = await fixture('other-node');
		try {
			const otherNodeId = `first-touch-other-${createId('x').slice(0, 8)}`;
			const now = new Date();
			await db.insert(knowledgeNode).values({
				id: otherNodeId,
				title: 'Other',
				domain: DOMAINS.AIRSPACE,
				crossDomains: [],
				knowledgeTypes: ['factual'],
				technicalDepth: null,
				stability: null,
				minimumCert: null,
				studyPriority: null,
				modalities: [],
				estimatedTimeMinutes: null,
				reviewTimeMinutes: null,
				references: [],
				assessable: true,
				assessmentMethods: [],
				masteryCriteria: null,
				contentMd: '',
				createdAt: now,
				updatedAt: now,
			});
			const cardId = await seedCardOnNode(f.userId, otherNodeId);
			await setCardLastReviewedAt(cardId, new Date('2026-03-01T00:00:00Z'));

			const got = await getFirstTouchDate(f.userId, f.nodeId);
			expect(got).toBeNull();

			await db.delete(knowledgeNode).where(eq(knowledgeNode.id, otherNodeId));
		} finally {
			await f.cleanup();
		}
	});
});
