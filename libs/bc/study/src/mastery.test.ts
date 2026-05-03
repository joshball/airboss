/**
 * Evidence-kind gating BC tests.
 *
 * Pure-helper suites cover the per-leaf aggregation logic without a DB. The
 * integration suite seeds knowledge nodes, syllabus leaves, and a handful of
 * card / scenario / rep evidence rows, then exercises `getNodeEvidenceState`
 * + `isLeafMastered` end-to-end against the real DB so the SQL path is
 * verified alongside the threshold math.
 *
 * Every integration `it` block is self-contained: it mints its own user,
 * syllabus, area parent, leaves, and knowledge nodes via `withFixture`, seeds
 * whatever evidence the assertion needs, and tears the fixture down on exit.
 * No state survives across tests.
 */

import { bauthUser } from '@ab/auth/schema';
import {
	ACS_TRIAD,
	ASSESSMENT_METHODS,
	type AssessmentMethod,
	CARD_KINDS,
	CARD_TYPES,
	type CardKind,
	CERT_APPLICABILITIES,
	CONTENT_SOURCES,
	DIFFICULTIES,
	DOMAINS,
	NODE_MASTERY_GATES,
	SCENARIO_STATUSES,
	SESSION_ITEM_KINDS,
	SESSION_REASON_CODES,
	SESSION_SLICES,
	STABILITY_MASTERED_DAYS,
	SYLLABUS_KINDS,
	SYLLABUS_NODE_LEVELS,
	SYLLABUS_STATUSES,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { createId, generateAuthId, generateSessionItemResultId, generateTeachingExerciseId } from '@ab/utils';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createCard } from './cards';
import {
	aggregateLeafKindStates,
	credentialSlugToCertApplicability,
	getLeafMasteryStateMap,
	getNodeEvidenceState,
	isLeafMastered,
	type NodeEvidenceState,
} from './mastery';
import { createScenario } from './scenarios';
import {
	card,
	cardState,
	knowledgeNode,
	scenario,
	session,
	sessionItemResult,
	studyPlan,
	syllabus,
	syllabusNode,
	syllabusNodeLink,
	teachingExercise,
} from './schema';
import { seedRepAttempt, seedRepTestPlan } from './test-support';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function makeState(nodeId: string, partial: Partial<Omit<NodeEvidenceState, 'nodeId'>>): NodeEvidenceState {
	return {
		nodeId,
		recall: NODE_MASTERY_GATES.NOT_APPLICABLE,
		calculation: NODE_MASTERY_GATES.NOT_APPLICABLE,
		scenario: NODE_MASTERY_GATES.NOT_APPLICABLE,
		demonstration: NODE_MASTERY_GATES.NOT_APPLICABLE,
		teaching: NODE_MASTERY_GATES.NOT_APPLICABLE,
		...partial,
	};
}

describe('aggregateLeafKindStates -- any-of x all-of resolution', () => {
	it('skill leaf with scenario evidence on one node is mastered (alternative satisfied)', () => {
		const result = aggregateLeafKindStates(
			[makeState('n1', { scenario: NODE_MASTERY_GATES.PASS })],
			[[ASSESSMENT_METHODS.DEMONSTRATION], [ASSESSMENT_METHODS.SCENARIO]],
		);
		expect(result.mastered).toBe(true);
		expect(result.missingKinds).toEqual([]);
		expect(result.byEvidenceKind[ASSESSMENT_METHODS.SCENARIO]).toBe(NODE_MASTERY_GATES.PASS);
	});

	it('skill leaf with no scenario or demonstration -> not mastered, missingKinds is the cheapest unmet alt', () => {
		const result = aggregateLeafKindStates(
			[makeState('n1', { recall: NODE_MASTERY_GATES.PASS })],
			[[ASSESSMENT_METHODS.DEMONSTRATION], [ASSESSMENT_METHODS.SCENARIO]],
		);
		expect(result.mastered).toBe(false);
		// Both groups are size-1; missingKinds names one of them as the
		// minimum-cost path to mastery. Both required kinds are reflected in
		// the requiredKinds set.
		expect(result.missingKinds.length).toBe(1);
		expect([ASSESSMENT_METHODS.DEMONSTRATION, ASSESSMENT_METHODS.SCENARIO]).toContain(result.missingKinds[0]);
		expect(new Set(result.requiredKinds)).toEqual(
			new Set([ASSESSMENT_METHODS.DEMONSTRATION, ASSESSMENT_METHODS.SCENARIO]),
		);
	});

	it('any-one-passes across linked nodes for a single kind', () => {
		const result = aggregateLeafKindStates(
			[
				makeState('n1', { scenario: NODE_MASTERY_GATES.FAIL }),
				makeState('n2', { scenario: NODE_MASTERY_GATES.PASS }),
				makeState('n3', { scenario: NODE_MASTERY_GATES.NOT_APPLICABLE }),
			],
			[[ASSESSMENT_METHODS.SCENARIO]],
		);
		expect(result.mastered).toBe(true);
		expect(result.byEvidenceKind[ASSESSMENT_METHODS.SCENARIO]).toBe(NODE_MASTERY_GATES.PASS);
	});

	it('CFI K with both recall and scenario required (instructor mapping) needs both', () => {
		const onlyRecall = aggregateLeafKindStates(
			[makeState('n1', { recall: NODE_MASTERY_GATES.PASS })],
			[[ASSESSMENT_METHODS.RECALL, ASSESSMENT_METHODS.SCENARIO]],
		);
		expect(onlyRecall.mastered).toBe(false);
		expect(onlyRecall.missingKinds).toEqual([ASSESSMENT_METHODS.SCENARIO]);

		const both = aggregateLeafKindStates(
			[makeState('n1', { recall: NODE_MASTERY_GATES.PASS, scenario: NODE_MASTERY_GATES.PASS })],
			[[ASSESSMENT_METHODS.RECALL, ASSESSMENT_METHODS.SCENARIO]],
		);
		expect(both.mastered).toBe(true);
		expect(both.missingKinds).toEqual([]);
	});

	it('teaching requirement stacks onto every alternative', () => {
		// Skill leaf with requires_teaching=true. The recommended mapping
		// produces `[[demonstration, teaching], [scenario, teaching]]`.
		const groups = [
			[ASSESSMENT_METHODS.DEMONSTRATION, ASSESSMENT_METHODS.TEACHING],
			[ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.TEACHING],
		];
		const noTeaching = aggregateLeafKindStates([makeState('n1', { scenario: NODE_MASTERY_GATES.PASS })], groups);
		expect(noTeaching.mastered).toBe(false);
		expect(noTeaching.missingKinds).toEqual([ASSESSMENT_METHODS.TEACHING]);
	});

	it('triad=null leaf with no required kinds is mastered when any evidence touched the node', () => {
		const result = aggregateLeafKindStates([makeState('n1', { recall: NODE_MASTERY_GATES.FAIL })], []);
		expect(result.mastered).toBe(true);
		expect(result.requiredKinds).toEqual([]);
	});

	it('precedence pass > fail > insufficient_data > not_applicable on aggregation', () => {
		const result = aggregateLeafKindStates(
			[
				makeState('n1', { scenario: NODE_MASTERY_GATES.INSUFFICIENT_DATA }),
				makeState('n2', { scenario: NODE_MASTERY_GATES.FAIL }),
				makeState('n3', { scenario: NODE_MASTERY_GATES.NOT_APPLICABLE }),
			],
			[[ASSESSMENT_METHODS.SCENARIO]],
		);
		// No node passes scenario, but `fail` outranks `insufficient_data` and
		// `not_applicable`, so the aggregated state is `fail` and the leaf is
		// not mastered.
		expect(result.byEvidenceKind[ASSESSMENT_METHODS.SCENARIO]).toBe(NODE_MASTERY_GATES.FAIL);
		expect(result.mastered).toBe(false);
	});
});

describe('credentialSlugToCertApplicability', () => {
	it('returns the applicability when the slug matches', () => {
		expect(credentialSlugToCertApplicability('cfi')).toBe(CERT_APPLICABILITIES.CFI);
		expect(credentialSlugToCertApplicability('atp')).toBe(CERT_APPLICABILITIES.ATP);
		expect(credentialSlugToCertApplicability('private')).toBe(CERT_APPLICABILITIES.PRIVATE);
	});

	it('falls back to the default for unknown slugs', () => {
		expect(credentialSlugToCertApplicability('single-engine-land')).toBe(CERT_APPLICABILITIES.ALL);
		expect(credentialSlugToCertApplicability(null)).toBe(CERT_APPLICABILITIES.ALL);
		expect(credentialSlugToCertApplicability(undefined)).toBe(CERT_APPLICABILITIES.ALL);
	});
});

// ---------------------------------------------------------------------------
// Integration: exercises the SQL path end-to-end. Each `it` builds its own
// fixture (user + nodes + leaves + links) and tears it down on exit, so the
// suite is order-independent.
// ---------------------------------------------------------------------------

interface MasteryFixture {
	userId: string;
	syllabusId: string;
	areaId: string;
	nodeKId: string;
	nodeSId: string;
	nodeEmptyId: string;
	leafKId: string;
	leafSId: string;
	leafSTeachingId: string;
}

async function buildFixture(): Promise<MasteryFixture> {
	const userId = generateAuthId();
	const email = `mastery-fresh-${userId}@airboss.test`;
	const tag = createId('x').slice(0, 6);
	const nodeKId = `test-mastery-k-${tag}`;
	const nodeSId = `test-mastery-s-${tag}`;
	const nodeEmptyId = `test-mastery-empty-${tag}`;
	const syllabusId = `test-mastery-syl-${tag}`;
	const areaId = `test-mastery-area-${tag}`;
	const leafKId = `test-mastery-leaf-k-${tag}`;
	const leafSId = `test-mastery-leaf-s-${tag}`;
	const leafSTeachingId = `test-mastery-leaf-s-tch-${tag}`;

	const now = new Date();
	await db.insert(bauthUser).values({
		id: userId,
		email,
		name: 'Mastery Test',
		firstName: 'Mastery',
		lastName: 'Test',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});

	for (const id of [nodeKId, nodeSId, nodeEmptyId]) {
		await db.insert(knowledgeNode).values({
			id,
			title: `Mastery Test Node ${id}`,
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
	}

	const slugSuffix = createId('x').slice(2, 8).toLowerCase();
	await db.insert(syllabus).values({
		id: syllabusId,
		slug: `mastery-test-${slugSuffix}`,
		kind: SYLLABUS_KINDS.ACS,
		title: 'Mastery test syllabus',
		edition: `mastery-test-${slugSuffix}`,
		status: SYLLABUS_STATUSES.ACTIVE,
		createdAt: now,
		updatedAt: now,
	});

	// Element-level leaves cannot have NULL parent_id per the
	// parent_level_consistency CHECK ("level NOT IN ('area','chapter') AND
	// parent_id IS NOT NULL"). Seed an area parent and chain the elements
	// under it.
	await db.insert(syllabusNode).values({
		id: areaId,
		syllabusId,
		parentId: null,
		level: SYLLABUS_NODE_LEVELS.AREA,
		ordinal: 0,
		code: 'I',
		title: 'Mastery test area',
		description: '',
		triad: null,
		requiredBloom: null,
		isLeaf: false,
		airbossRef: null,
		citations: [],
		classes: null,
		contentHash: null,
		seedOrigin: 'mastery-test',
		requiresTeaching: false,
		createdAt: now,
		updatedAt: now,
	});

	const insertElementLeaf = (id: string, code: string, triad: string, requiresTeaching: boolean) =>
		db.insert(syllabusNode).values({
			id,
			syllabusId,
			parentId: areaId,
			level: SYLLABUS_NODE_LEVELS.ELEMENT,
			ordinal: 0,
			code,
			title: `Mastery test ${code}`,
			description: '',
			triad,
			requiredBloom: 'understand',
			isLeaf: true,
			airbossRef: null,
			citations: [],
			classes: null,
			contentHash: null,
			seedOrigin: 'mastery-test',
			requiresTeaching,
			createdAt: now,
			updatedAt: now,
		});

	await insertElementLeaf(leafKId, 'I.A.K1', ACS_TRIAD.KNOWLEDGE, false);
	await insertElementLeaf(leafSId, 'I.A.S1', ACS_TRIAD.SKILL, false);
	await insertElementLeaf(leafSTeachingId, 'I.A.S2', ACS_TRIAD.SKILL, true);

	await db.insert(syllabusNodeLink).values([
		{ id: createId('snl'), syllabusNodeId: leafKId, knowledgeNodeId: nodeKId, weight: 1 },
		{ id: createId('snl'), syllabusNodeId: leafSId, knowledgeNodeId: nodeSId, weight: 1 },
		{ id: createId('snl'), syllabusNodeId: leafSTeachingId, knowledgeNodeId: nodeSId, weight: 1 },
	]);

	return { userId, syllabusId, areaId, nodeKId, nodeSId, nodeEmptyId, leafKId, leafSId, leafSTeachingId };
}

async function teardownFixture(fx: MasteryFixture): Promise<void> {
	await db.delete(sessionItemResult).where(eq(sessionItemResult.userId, fx.userId));
	await db.delete(session).where(eq(session.userId, fx.userId));
	await db.delete(studyPlan).where(eq(studyPlan.userId, fx.userId));
	await db.delete(scenario).where(eq(scenario.userId, fx.userId));
	await db.delete(teachingExercise).where(eq(teachingExercise.userId, fx.userId));
	await db.delete(cardState).where(eq(cardState.userId, fx.userId));
	await db.delete(card).where(eq(card.userId, fx.userId));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.knowledgeNodeId, fx.nodeKId));
	await db.delete(syllabusNodeLink).where(eq(syllabusNodeLink.knowledgeNodeId, fx.nodeSId));
	await db.delete(syllabusNode).where(eq(syllabusNode.syllabusId, fx.syllabusId));
	await db.delete(syllabus).where(eq(syllabus.id, fx.syllabusId));
	for (const id of [fx.nodeKId, fx.nodeSId, fx.nodeEmptyId]) {
		await db.delete(knowledgeNode).where(eq(knowledgeNode.id, id));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, fx.userId));
}

async function withFixture<T>(fn: (fx: MasteryFixture) => Promise<T>): Promise<T> {
	const fx = await buildFixture();
	try {
		return await fn(fx);
	} finally {
		await teardownFixture(fx);
	}
}

async function seedAttachedCards(
	userId: string,
	nodeId: string,
	total: number,
	masteredCount: number,
	kind: CardKind = CARD_KINDS.RECALL,
): Promise<void> {
	for (let i = 0; i < total; i++) {
		const c = await createCard({
			userId,
			front: `Front ${nodeId}-${kind}-${i}`,
			back: `Back ${nodeId}-${kind}-${i}`,
			domain: DOMAINS.AIRSPACE,
			cardType: CARD_TYPES.BASIC,
			kind,
			nodeId,
		});
		const stability = i < masteredCount ? STABILITY_MASTERED_DAYS + 10 : 1;
		await db.update(cardState).set({ stability }).where(eq(cardState.cardId, c.id));
	}
}

async function seedAttachedReps(
	userId: string,
	nodeId: string,
	attempts: number,
	correct: number,
	assessmentMethods: readonly AssessmentMethod[] = [ASSESSMENT_METHODS.SCENARIO],
): Promise<void> {
	const sc = await createScenario({
		userId,
		title: `Mastery scenario ${nodeId} ${assessmentMethods.join('+')}`,
		situation: 'Situation',
		options: [
			{ id: 'a', text: 'A', isCorrect: true, outcome: 'ok', whyNot: '' },
			{ id: 'b', text: 'B', isCorrect: false, outcome: 'bad', whyNot: 'wrong' },
		],
		teachingPoint: 'tp',
		domain: DOMAINS.AIRSPACE,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		sourceType: CONTENT_SOURCES.PERSONAL,
		nodeId,
		assessmentMethods,
	});
	const now = Date.now();
	for (let i = 0; i < attempts; i++) {
		await seedRepAttempt({
			userId,
			scenarioId: sc.id,
			isCorrect: i < correct,
			completedAt: new Date(now + i),
		});
	}
}

/**
 * Seed teaching-exercise reps: one teaching_exercise row attached to the
 * node, plus N completed session_item_result rows pointing at it. Used by
 * the teaching-gate partition tests in Phase 5 of evidence-kind-data-layer.
 */
async function seedAttachedTeachingExerciseReps(
	userId: string,
	nodeId: string,
	attempts: number,
	correct: number,
): Promise<void> {
	const exerciseId = generateTeachingExerciseId();
	const now = new Date();
	await db.insert(teachingExercise).values({
		id: exerciseId,
		userId,
		title: `Mastery teaching exercise ${nodeId}`,
		prompt: 'Explain this concept to a student.',
		domain: DOMAINS.AIRSPACE,
		nodeId,
		isEditable: true,
		status: SCENARIO_STATUSES.ACTIVE,
		seedOrigin: 'mastery-test',
		createdAt: now,
	});
	// Reuse the user's active study plan if one exists (seedRepAttempt may
	// have already minted one); otherwise seedRepTestPlan creates the
	// minimal row. The one-active-plan partial UNIQUE index would reject a
	// second active plan otherwise.
	const planId = await seedRepTestPlan(userId);
	const sessionId = createId('ses');
	await db.insert(session).values({
		id: sessionId,
		userId,
		planId,
		mode: 'mixed',
		focusOverride: null,
		certOverride: null,
		sessionLength: attempts,
		items: [],
		seed: 'mastery-test',
		startedAt: now,
		completedAt: now,
		seedOrigin: 'mastery-test',
	});
	for (let i = 0; i < attempts; i++) {
		await db.insert(sessionItemResult).values({
			id: generateSessionItemResultId(),
			sessionId,
			userId,
			slotIndex: i,
			itemKind: SESSION_ITEM_KINDS.TEACHING_EXERCISE,
			slice: SESSION_SLICES.STRENGTHEN,
			reasonCode: SESSION_REASON_CODES.STRENGTHEN_MASTERY_DROP,
			cardId: null,
			scenarioId: null,
			nodeId: null,
			teachingExerciseId: exerciseId,
			reviewId: null,
			skipKind: null,
			reasonDetail: null,
			chosenOptionId: null,
			isCorrect: i < correct,
			confidence: null,
			answerMs: null,
			presentedAt: new Date(now.getTime() + i),
			completedAt: new Date(now.getTime() + i),
			seedOrigin: 'mastery-test',
		});
	}
}

describe('getNodeEvidenceState -- integration', () => {
	it('node with cards-only evidence reports recall=pass and other kinds not_applicable', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4);

			const state = await getNodeEvidenceState(fx.userId, fx.nodeKId);
			expect(state.recall).toBe(NODE_MASTERY_GATES.PASS);
			expect(state.scenario).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.demonstration).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.calculation).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.teaching).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
		});
	});

	it('node with rep-only evidence reports scenario=pass and recall not_applicable', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4);

			const state = await getNodeEvidenceState(fx.userId, fx.nodeSId);
			expect(state.recall).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.scenario).toBe(NODE_MASTERY_GATES.PASS);
		});
	});

	it('untouched node reports every kind not_applicable', async () => {
		await withFixture(async (fx) => {
			const state = await getNodeEvidenceState(fx.userId, fx.nodeEmptyId);
			expect(state.recall).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.scenario).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.calculation).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.demonstration).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
			expect(state.teaching).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
		});
	});
});

describe('isLeafMastered -- integration', () => {
	it('K leaf masters when its linked node has recall evidence', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4);
			const result = await isLeafMastered(fx.userId, fx.leafKId);
			expect(result.mastered).toBe(true);
			expect(result.byEvidenceKind[ASSESSMENT_METHODS.RECALL]).toBe(NODE_MASTERY_GATES.PASS);
			expect(result.missingKinds).toEqual([]);
		});
	});

	it('S leaf masters via scenario evidence on its linked node', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4);
			const result = await isLeafMastered(fx.userId, fx.leafSId);
			expect(result.mastered).toBe(true);
			expect(result.byEvidenceKind[ASSESSMENT_METHODS.SCENARIO]).toBe(NODE_MASTERY_GATES.PASS);
		});
	});

	it('S leaf with requires_teaching=true is NOT mastered until teaching evidence arrives', async () => {
		await withFixture(async (fx) => {
			// Seed scenario evidence on the S node so the demo/scenario
			// alternatives can each pass on the non-teaching axis. Required
			// kinds become [[demo, teaching], [scn, teaching]] -- every
			// alternative requires teaching. The teaching gate is structurally
			// not_applicable in this WP (no teaching item kind ships yet), so
			// the leaf must be missing teaching.
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4);
			const result = await isLeafMastered(fx.userId, fx.leafSTeachingId);
			expect(result.mastered).toBe(false);
			expect(result.missingKinds).toContain(ASSESSMENT_METHODS.TEACHING);
		});
	});

	it('CFI applicability tightens the K gate to require recall + scenario together', async () => {
		await withFixture(async (fx) => {
			// Recall-only cards on the K node. Default applicability masters
			// the leaf; CFI applicability demands [[recall, scenario]] and the
			// scenario gate is not_applicable on a cards-only node.
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4);
			const cfi = await isLeafMastered(fx.userId, fx.leafKId, CERT_APPLICABILITIES.CFI);
			expect(cfi.mastered).toBe(false);
			expect(cfi.missingKinds).toContain(ASSESSMENT_METHODS.SCENARIO);
		});
	});

	it('batched getLeafMasteryStateMap returns one entry per leaf', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4);
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4);

			const map = await getLeafMasteryStateMap(fx.userId, [fx.leafKId, fx.leafSId, fx.leafSTeachingId]);
			expect(map.size).toBe(3);
			expect(map.get(fx.leafKId)?.mastered).toBe(true);
			expect(map.get(fx.leafSId)?.mastered).toBe(true);
			expect(map.get(fx.leafSTeachingId)?.mastered).toBe(false);
		});
	});
});

// ---------------------------------------------------------------------------
// Phase 5 of evidence-kind-data-layer: real per-kind partition queries
// (recall vs calculation, scenario vs demonstration, teaching) replace the
// not_applicable shims. Tests below exercise each partition end-to-end.
// ---------------------------------------------------------------------------

describe('per-kind partitions -- card.kind', () => {
	it('recall-only cards on a node report recall=pass and calculation=not_applicable', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4, CARD_KINDS.RECALL);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeKId);
			expect(state.recall).toBe(NODE_MASTERY_GATES.PASS);
			expect(state.calculation).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
		});
	});

	it('calculation-only cards on a node report calculation=pass and recall=not_applicable', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4, CARD_KINDS.CALCULATION);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeKId);
			expect(state.calculation).toBe(NODE_MASTERY_GATES.PASS);
			expect(state.recall).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
		});
	});

	it('mixed kinds on the same node: both gates pass independently', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4, CARD_KINDS.RECALL);
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4, CARD_KINDS.CALCULATION);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeKId);
			expect(state.recall).toBe(NODE_MASTERY_GATES.PASS);
			expect(state.calculation).toBe(NODE_MASTERY_GATES.PASS);
		});
	});

	it('K leaf with calc-only cards reads as not-mastered (recommended K=recall mapping)', async () => {
		await withFixture(async (fx) => {
			await seedAttachedCards(fx.userId, fx.nodeKId, 4, 4, CARD_KINDS.CALCULATION);
			const result = await isLeafMastered(fx.userId, fx.leafKId);
			expect(result.mastered).toBe(false);
			expect(result.missingKinds).toContain(ASSESSMENT_METHODS.RECALL);
		});
	});
});

describe('per-kind partitions -- scenario.assessment_methods', () => {
	it('demonstration-only scenario reports demonstration=pass and scenario=not_applicable', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4, [ASSESSMENT_METHODS.DEMONSTRATION]);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeSId);
			expect(state.demonstration).toBe(NODE_MASTERY_GATES.PASS);
			expect(state.scenario).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
		});
	});

	it('hybrid scenario tagged [scenario, demonstration] satisfies both gates', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4, [
				ASSESSMENT_METHODS.SCENARIO,
				ASSESSMENT_METHODS.DEMONSTRATION,
			]);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeSId);
			expect(state.scenario).toBe(NODE_MASTERY_GATES.PASS);
			expect(state.demonstration).toBe(NODE_MASTERY_GATES.PASS);
		});
	});

	it('S leaf masters via demonstration-only reps (skill mapping accepts either)', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4, [ASSESSMENT_METHODS.DEMONSTRATION]);
			const result = await isLeafMastered(fx.userId, fx.leafSId);
			expect(result.mastered).toBe(true);
			expect(result.byEvidenceKind[ASSESSMENT_METHODS.DEMONSTRATION]).toBe(NODE_MASTERY_GATES.PASS);
		});
	});
});

describe('per-kind partitions -- teaching gate', () => {
	it('teaching-exercise reps on a node drive teaching=pass', async () => {
		await withFixture(async (fx) => {
			await seedAttachedTeachingExerciseReps(fx.userId, fx.nodeSId, 4, 4);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeSId);
			expect(state.teaching).toBe(NODE_MASTERY_GATES.PASS);
		});
	});

	it('S leaf with requires_teaching=true: cards + reps + teaching exercises -> mastered', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4);
			await seedAttachedTeachingExerciseReps(fx.userId, fx.nodeSId, 4, 4);
			const result = await isLeafMastered(fx.userId, fx.leafSTeachingId);
			expect(result.mastered).toBe(true);
			expect(result.byEvidenceKind[ASSESSMENT_METHODS.TEACHING]).toBe(NODE_MASTERY_GATES.PASS);
			expect(result.missingKinds).toEqual([]);
		});
	});

	it('node with zero teaching exercises authored reports teaching=not_applicable', async () => {
		await withFixture(async (fx) => {
			await seedAttachedReps(fx.userId, fx.nodeSId, 4, 4);
			const state = await getNodeEvidenceState(fx.userId, fx.nodeSId);
			expect(state.teaching).toBe(NODE_MASTERY_GATES.NOT_APPLICABLE);
		});
	});
});
