/**
 * Knowledge BC tests -- cert progress + domain x cert matrix aggregators.
 *
 * Seeds a small graph with nodes across certs (PPL/IR/CPL/CFI) and domains,
 * attaches cards + rep attempts to a subset, then verifies:
 *  - `getCertProgress` only counts core + supporting (never elective) and
 *    rolls mastered / inProgress correctly with the dual-gate rule.
 *  - `getDomainCertMatrix` returns 14 rows x 4 cells (all DOMAIN_VALUES by
 *    CERT_VALUES), counting electives in the map, with `percent = null` for
 *    empty cells and `percent = mastered/total` otherwise.
 *
 * Runs against the local dev Postgres -- same convention as the rest of the
 * BC integration suites -- because the SQL aggregation is the real thing
 * under test.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	CARD_TYPES,
	CERT_VALUES,
	CERTS,
	CONTENT_SOURCES,
	DIFFICULTIES,
	DOMAIN_VALUES,
	DOMAINS,
	RELEVANCE_PRIORITIES,
	STABILITY_MASTERED_DAYS,
} from '@ab/constants';
import { db } from '@ab/db';
import { createId, generateAuthId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCard } from './cards';
import { getCertProgress, getDomainCertMatrix } from './knowledge';
import { createScenario } from './scenarios';
import { card, cardState, knowledgeNode, scenario, session, sessionItemResult, studyPlan } from './schema';
import { seedRepAttempt } from './test-support';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `cert-test-${TEST_USER_ID}@airboss.test`;

// Slug prefix keeps nodes isolated from graph already seeded into the dev DB.
const PREFIX = `test-cert-${createId('x').slice(0, 6)}`;
const NODE_PPL_CORE_MASTERED = `${PREFIX}-ppl-core-mastered`;
const NODE_PPL_CORE_IN_PROGRESS = `${PREFIX}-ppl-core-in-progress`;
const NODE_PPL_CORE_UNTOUCHED = `${PREFIX}-ppl-core-untouched`;
const NODE_PPL_ELECTIVE = `${PREFIX}-ppl-elective`;
const NODE_MULTI_CERT_MASTERED = `${PREFIX}-multi-cert-mastered`;
const NODE_IR_SUPPORTING_MASTERED = `${PREFIX}-ir-supporting-mastered`;
const ALL_NODE_IDS = [
	NODE_PPL_CORE_MASTERED,
	NODE_PPL_CORE_IN_PROGRESS,
	NODE_PPL_CORE_UNTOUCHED,
	NODE_PPL_ELECTIVE,
	NODE_MULTI_CERT_MASTERED,
	NODE_IR_SUPPORTING_MASTERED,
];

interface NodeSpec {
	id: string;
	domain: string;
	relevance: { cert: string; bloom: string; priority: string }[];
}

const NODE_SPECS: NodeSpec[] = [
	{
		id: NODE_PPL_CORE_MASTERED,
		domain: DOMAINS.AIRSPACE,
		relevance: [{ cert: CERTS.PPL, bloom: 'apply', priority: RELEVANCE_PRIORITIES.CORE }],
	},
	{
		id: NODE_PPL_CORE_IN_PROGRESS,
		domain: DOMAINS.AIRSPACE,
		relevance: [{ cert: CERTS.PPL, bloom: 'apply', priority: RELEVANCE_PRIORITIES.CORE }],
	},
	{
		id: NODE_PPL_CORE_UNTOUCHED,
		domain: DOMAINS.WEATHER,
		relevance: [{ cert: CERTS.PPL, bloom: 'apply', priority: RELEVANCE_PRIORITIES.CORE }],
	},
	{
		id: NODE_PPL_ELECTIVE,
		domain: DOMAINS.AERODYNAMICS,
		relevance: [{ cert: CERTS.PPL, bloom: 'understand', priority: RELEVANCE_PRIORITIES.ELECTIVE }],
	},
	{
		id: NODE_MULTI_CERT_MASTERED,
		domain: DOMAINS.REGULATIONS,
		relevance: [
			{ cert: CERTS.PPL, bloom: 'apply', priority: RELEVANCE_PRIORITIES.CORE },
			{ cert: CERTS.CFI, bloom: 'evaluate', priority: RELEVANCE_PRIORITIES.CORE },
		],
	},
	{
		id: NODE_IR_SUPPORTING_MASTERED,
		domain: DOMAINS.IFR_PROCEDURES,
		relevance: [{ cert: CERTS.IR, bloom: 'apply', priority: RELEVANCE_PRIORITIES.SUPPORTING }],
	},
];

async function seedCardsForNode(nodeId: string, domain: string, count: number, masteredCount: number): Promise<void> {
	for (let i = 0; i < count; i++) {
		const c = await createCard({
			userId: TEST_USER_ID,
			front: `Front ${nodeId}-${i}`,
			back: `Back ${nodeId}-${i}`,
			domain,
			cardType: CARD_TYPES.BASIC,
			nodeId,
		});
		const stability = i < masteredCount ? STABILITY_MASTERED_DAYS + 10 : 1;
		await db.update(cardState).set({ stability }).where(eq(cardState.cardId, c.id));
	}
}

async function seedRepsForNode(
	nodeId: string,
	domain: string,
	attemptCount: number,
	correctCount: number,
): Promise<void> {
	const sc = await createScenario({
		userId: TEST_USER_ID,
		title: `Test scenario ${nodeId}`,
		situation: 'Situation',
		options: [
			{ id: 'a', text: 'A', isCorrect: true, outcome: 'ok', whyNot: '' },
			{ id: 'b', text: 'B', isCorrect: false, outcome: 'bad', whyNot: 'wrong' },
		],
		teachingPoint: 'tp',
		domain,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		sourceType: CONTENT_SOURCES.PERSONAL,
		nodeId,
	});
	const base = Date.now();
	for (let i = 0; i < attemptCount; i++) {
		await seedRepAttempt({
			userId: TEST_USER_ID,
			scenarioId: sc.id,
			isCorrect: i < correctCount,
			chosenOption: i < correctCount ? 'a' : 'b',
			completedAt: new Date(base + i),
		});
	}
}

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Cert Test',
		firstName: 'Cert',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	for (const spec of NODE_SPECS) {
		await db.insert(knowledgeNode).values({
			id: spec.id,
			title: `Test ${spec.id}`,
			domain: spec.domain,
			crossDomains: [],
			knowledgeTypes: ['factual'],
			technicalDepth: null,
			stability: null,
			relevance: spec.relevance,
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
	}

	// Mastery seed plan:
	//   NODE_PPL_CORE_MASTERED          -> 5 cards, 5 mastered (cards-only, pass)
	//   NODE_PPL_CORE_IN_PROGRESS       -> 2 cards, 0 mastered (< CARD_MIN, touched, fails gate)
	//   NODE_PPL_CORE_UNTOUCHED         -> nothing
	//   NODE_PPL_ELECTIVE               -> 5 cards mastered (to prove electives
	//                                       don't show in cert progress even
	//                                       when fully mastered)
	//   NODE_MULTI_CERT_MASTERED        -> 5 cards mastered (counts for BOTH PPL + CFI core)
	//   NODE_IR_SUPPORTING_MASTERED     -> 5 cards mastered (counts for IR supporting)
	await seedCardsForNode(NODE_PPL_CORE_MASTERED, DOMAINS.AIRSPACE, 5, 5);
	await seedCardsForNode(NODE_PPL_CORE_IN_PROGRESS, DOMAINS.AIRSPACE, 2, 0);
	await seedCardsForNode(NODE_PPL_ELECTIVE, DOMAINS.AERODYNAMICS, 5, 5);
	await seedCardsForNode(NODE_MULTI_CERT_MASTERED, DOMAINS.REGULATIONS, 5, 5);
	await seedCardsForNode(NODE_IR_SUPPORTING_MASTERED, DOMAINS.IFR_PROCEDURES, 5, 5);

	// A handful of rep attempts scattered so the rep gate path is exercised
	// too (on NODE_PPL_CORE_MASTERED: still passes both gates since both have
	// clean data).
	await seedRepsForNode(NODE_PPL_CORE_MASTERED, DOMAINS.AIRSPACE, 4, 4);
});

afterAll(async () => {
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, TEST_USER_ID));
	await db.delete(session).where(eq(session.userId, TEST_USER_ID));
	await db.delete(studyPlan).where(eq(studyPlan.userId, TEST_USER_ID));
	await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	await db.delete(cardState).where(eq(cardState.userId, TEST_USER_ID));
	await db.delete(card).where(eq(card.userId, TEST_USER_ID));
	for (const id of ALL_NODE_IDS) {
		await db.delete(knowledgeNode).where(eq(knowledgeNode.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

describe('getCertProgress', () => {
	it('returns exactly four rows in CERT_VALUES order', async () => {
		const result = await getCertProgress(TEST_USER_ID);
		expect(result).toHaveLength(CERT_VALUES.length);
		expect(result.map((r) => r.cert)).toEqual([...CERT_VALUES]);
	});

	it('counts core + supporting per cert, never elective', async () => {
		const result = await getCertProgress(TEST_USER_ID);
		const byCert = new Map(result.map((r) => [r.cert, r]));
		// PPL nodes (test-seeded): 3 core + 1 multi-cert core + 1 elective.
		// Elective is excluded, so total = 4 (for just our test nodes).
		// Other dev-DB nodes may also carry PPL core/supporting relevance, so
		// assert `total >= 4` rather than an exact equality.
		const ppl = byCert.get(CERTS.PPL);
		expect(ppl).toBeDefined();
		if (!ppl) return;
		expect(ppl.total).toBeGreaterThanOrEqual(4);

		// Mastered count for our seeded PPL core nodes = 2 (NODE_PPL_CORE_MASTERED + NODE_MULTI_CERT_MASTERED).
		// We can't assert equality against baseline DB nodes, but mastered must
		// be at least 2 (our contributions).
		expect(ppl.mastered).toBeGreaterThanOrEqual(2);

		// NODE_PPL_CORE_IN_PROGRESS is touched but unmastered, so PPL inProgress >= 1.
		expect(ppl.inProgress).toBeGreaterThanOrEqual(1);

		// Percent formula: mastered / total.
		expect(ppl.percent).toBeCloseTo(ppl.mastered / ppl.total, 4);
	});

	it('multi-cert node contributes once to each cert it lists', async () => {
		// NODE_MULTI_CERT_MASTERED is relevant to BOTH PPL core and CFI core,
		// and it's mastered. So both PPL.mastered and CFI.mastered include it.
		const result = await getCertProgress(TEST_USER_ID);
		const cfi = result.find((r) => r.cert === CERTS.CFI);
		const ppl = result.find((r) => r.cert === CERTS.PPL);
		expect(cfi).toBeDefined();
		expect(ppl).toBeDefined();
		if (!cfi || !ppl) return;
		// Both certs must show at least one mastered node attributable to the
		// multi-cert row; we only assert the lower bound because other graph
		// content may exist in the dev DB.
		expect(cfi.mastered).toBeGreaterThanOrEqual(1);
		expect(ppl.mastered).toBeGreaterThanOrEqual(2);
	});

	it('supporting priority counts toward progress the same as core', async () => {
		// NODE_IR_SUPPORTING_MASTERED is IR + supporting + mastered.
		const result = await getCertProgress(TEST_USER_ID);
		const ir = result.find((r) => r.cert === CERTS.IR);
		expect(ir).toBeDefined();
		if (!ir) return;
		expect(ir.total).toBeGreaterThanOrEqual(1);
		expect(ir.mastered).toBeGreaterThanOrEqual(1);
	});

	it('zero-total cert row returns percent 0 (not NaN)', async () => {
		const result = await getCertProgress(TEST_USER_ID);
		for (const row of result) {
			expect(Number.isFinite(row.percent)).toBe(true);
			expect(row.percent).toBeGreaterThanOrEqual(0);
			expect(row.percent).toBeLessThanOrEqual(1);
		}
	});
});

describe('getDomainCertMatrix', () => {
	it('returns 14 rows x 4 cells in DOMAIN_VALUES x CERT_VALUES order', async () => {
		const result = await getDomainCertMatrix(TEST_USER_ID);
		expect(result).toHaveLength(DOMAIN_VALUES.length);
		expect(result.map((r) => r.domain)).toEqual([...DOMAIN_VALUES]);
		for (const row of result) {
			expect(row.cells).toHaveLength(CERT_VALUES.length);
			expect(row.cells.map((c) => c.cert)).toEqual([...CERT_VALUES]);
		}
	});

	it('empty cells return percent null, not 0', async () => {
		const result = await getDomainCertMatrix(TEST_USER_ID);
		// emergency-procedures cert intersection with CFI probably has no
		// seeded nodes in this test; assert the shape contract in general.
		for (const row of result) {
			for (const cell of row.cells) {
				if (cell.total === 0) {
					expect(cell.percent).toBeNull();
				} else {
					expect(cell.percent).not.toBeNull();
					if (cell.percent !== null) {
						expect(cell.percent).toBeCloseTo(cell.mastered / cell.total, 4);
					}
				}
			}
		}
	});

	it('counts electives in the matrix (unlike getCertProgress)', async () => {
		// NODE_PPL_ELECTIVE sits in domain=aerodynamics + PPL elective.
		// getDomainCertMatrix treats all relevance priorities as contributing,
		// so the (aerodynamics, PPL) cell includes it -- total must be >= 1
		// and mastered >= 1 (we seeded 5 mastered cards).
		const result = await getDomainCertMatrix(TEST_USER_ID);
		const aero = result.find((r) => r.domain === DOMAINS.AERODYNAMICS);
		expect(aero).toBeDefined();
		if (!aero) return;
		const aeroPpl = aero.cells.find((c) => c.cert === CERTS.PPL);
		expect(aeroPpl).toBeDefined();
		if (!aeroPpl) return;
		expect(aeroPpl.total).toBeGreaterThanOrEqual(1);
		expect(aeroPpl.mastered).toBeGreaterThanOrEqual(1);
	});

	it('multi-cert node contributes to each cert cell in its primary domain', async () => {
		// NODE_MULTI_CERT_MASTERED: domain=regulations, PPL core + CFI core,
		// fully mastered. Both (regulations, PPL) and (regulations, CFI) cells
		// must reflect it.
		const result = await getDomainCertMatrix(TEST_USER_ID);
		const regs = result.find((r) => r.domain === DOMAINS.REGULATIONS);
		expect(regs).toBeDefined();
		if (!regs) return;
		const regsPpl = regs.cells.find((c) => c.cert === CERTS.PPL);
		const regsCfi = regs.cells.find((c) => c.cert === CERTS.CFI);
		expect(regsPpl).toBeDefined();
		expect(regsCfi).toBeDefined();
		if (!regsPpl || !regsCfi) return;
		expect(regsPpl.mastered).toBeGreaterThanOrEqual(1);
		expect(regsCfi.mastered).toBeGreaterThanOrEqual(1);
	});
});
