/**
 * Route-action tests for `/reps/[id]` -- the rep / scenario editor.
 *
 * Mirrors the card-editor route-action coverage in
 * `../memory/[id]/route-actions.test.ts`. The rep route also has an early
 * ownership 404 in `addCitation` (the BC re-validates, but the route guards
 * first to keep error responses crisp), so this suite pins down both that
 * pre-check and the citation lifecycle for scenarios.
 */

import { bauthUser } from '@ab/auth/schema';
import { contentCitation, createScenario, scenario } from '@ab/bc-study';
import {
	CITATION_SOURCE_TYPES,
	CITATION_TARGET_TYPES,
	DIFFICULTIES,
	DOMAINS,
	EXTERNAL_REF_TARGET_DELIMITER,
	PHASES_OF_FLIGHT,
} from '@ab/constants';
import { db } from '@ab/db';
import { generateAuthId, generateContentCitationId, generateScenarioId } from '@ab/utils';
import type { ActionFailure } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { actions } from './+page.server';

const TEST_USER_ID = generateAuthId();
const TEST_EMAIL = `rep-route-actions-test-${TEST_USER_ID}@airboss.test`;
const CREATED_SCENARIO_IDS: string[] = [];

beforeAll(async () => {
	const now = new Date();
	await db.insert(bauthUser).values({
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Rep Route Actions Test',
		firstName: 'Rep',
		lastName: 'Routes',
		emailVerified: true,
		role: 'learner',
		createdAt: now,
		updatedAt: now,
	});
});

afterAll(async () => {
	if (CREATED_SCENARIO_IDS.length > 0) {
		await db.delete(contentCitation).where(eq(contentCitation.createdBy, TEST_USER_ID));
		await db.delete(scenario).where(eq(scenario.userId, TEST_USER_ID));
	}
	await db.delete(bauthUser).where(eq(bauthUser.id, TEST_USER_ID));
});

async function seedScenario(): Promise<string> {
	const row = await createScenario({
		userId: TEST_USER_ID,
		title: `Test scenario ${generateScenarioId()}`,
		situation: 'A pilot must decide between two procedures.',
		options: [
			{ id: 'a', text: 'Option A', isCorrect: true, outcome: 'Correct outcome', whyNot: '' },
			{ id: 'b', text: 'Option B', isCorrect: false, outcome: 'Wrong outcome', whyNot: 'Wrong because reasons' },
		],
		teachingPoint: 'Pre-brief decisions matter.',
		domain: DOMAINS.EMERGENCY_PROCEDURES,
		difficulty: DIFFICULTIES.INTERMEDIATE,
		phaseOfFlight: PHASES_OF_FLIGHT.TAKEOFF,
	});
	CREATED_SCENARIO_IDS.push(row.id);
	return row.id;
}

interface FakeEventInput {
	scenarioId: string;
	formData: FormData;
}

function makeEvent({ scenarioId, formData }: FakeEventInput) {
	const user = {
		id: TEST_USER_ID,
		email: TEST_EMAIL,
		name: 'Rep Route Actions Test',
		firstName: 'Rep',
		lastName: 'Routes',
		emailVerified: true,
		role: 'learner' as const,
		image: null,
		banned: null,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	return {
		params: { id: scenarioId },
		request: { formData: async () => formData } as unknown as Request,
		locals: { user, session: null, requestId: 'test-req', appearance: 'system' as const },
		url: new URL('http://localhost/reps/test'),
		route: { id: '/(app)/reps/[id]' },
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

describe('reps/[id] addCitation action', () => {
	it('creates an external_ref citation owned by the caller on a rep', async () => {
		const scenarioId = await seedScenario();
		const targetId = `https://example.com/rep${EXTERNAL_REF_TARGET_DELIMITER}Rep title`;
		const formData = new FormData();
		formData.set('targetType', CITATION_TARGET_TYPES.EXTERNAL_REF);
		formData.set('targetId', targetId);

		const result = await actions.addCitation(makeEvent({ scenarioId, formData }) as never);
		expect(result).toMatchObject({ success: true, intent: 'addCitation' });

		const rows = await db.select().from(contentCitation).where(eq(contentCitation.sourceId, scenarioId));
		expect(rows).toHaveLength(1);
		expect(rows[0]?.sourceType).toBe(CITATION_SOURCE_TYPES.REP);
		expect(rows[0]?.createdBy).toBe(TEST_USER_ID);
	});

	it('rejects an unknown targetType with 400', async () => {
		const scenarioId = await seedScenario();
		const formData = new FormData();
		formData.set('targetType', 'not-a-real-type');
		formData.set('targetId', 'whatever');

		const result = await actions.addCitation(makeEvent({ scenarioId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
		expect(result.data.intent).toBe('addCitation');
	});
});

describe('reps/[id] removeCitation action', () => {
	it('returns 400 when citationId is missing', async () => {
		const scenarioId = await seedScenario();
		const formData = new FormData();

		const result = await actions.removeCitation(makeEvent({ scenarioId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		expect(result.status).toBe(400);
	});

	it('returns 404 for an unknown citation id', async () => {
		const scenarioId = await seedScenario();
		const formData = new FormData();
		formData.set('citationId', generateContentCitationId());

		const result = await actions.removeCitation(makeEvent({ scenarioId, formData }) as never);
		expect(isFailure(result)).toBe(true);
		if (!isFailure<{ intent: string }>(result)) throw new Error('expected failure');
		// Pre-fix: this was 500; post-fix: a typed 404 distinguishes
		// missing/unowned citations from genuine server errors.
		expect(result.status).toBe(404);
	});

	it('deletes a citation owned by the caller', async () => {
		const scenarioId = await seedScenario();
		const targetId = `https://example.com/rep-del${EXTERNAL_REF_TARGET_DELIMITER}Title`;
		const addForm = new FormData();
		addForm.set('targetType', CITATION_TARGET_TYPES.EXTERNAL_REF);
		addForm.set('targetId', targetId);
		await actions.addCitation(makeEvent({ scenarioId, formData: addForm }) as never);

		const [row] = await db.select().from(contentCitation).where(eq(contentCitation.sourceId, scenarioId));
		if (!row) throw new Error('seed citation missing');

		const removeForm = new FormData();
		removeForm.set('citationId', row.id);
		const removeResult = await actions.removeCitation(makeEvent({ scenarioId, formData: removeForm }) as never);
		expect(removeResult).toMatchObject({ success: true, intent: 'removeCitation' });

		const after = await db.select().from(contentCitation).where(eq(contentCitation.id, row.id));
		expect(after).toHaveLength(0);
	});
});
