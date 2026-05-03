/**
 * Validator + BC unit tests for the evidence-kind-data-layer WP.
 *
 * Covers:
 *   - newCardSchema/updateCardSchema accept the `kind` field, default to
 *     `recall` on omission, reject values outside CARD_KIND_VALUES.
 *   - newScenarioSchema accepts `assessmentMethods`, defaults via the
 *     scenario column when omitted, rejects empty / duplicate / unknown.
 *   - assessmentMethodsSchema directly (the validator the BC throws through).
 *   - newTeachingExerciseSchema accepts the happy path and rejects empty.
 *
 * Pure tests -- no DB. Integration coverage (createCard / createScenario /
 * createTeachingExercise reading round-tripped rows back, mastery partition
 * queries) lives in mastery.test.ts (Phase 5).
 */

import { ASSESSMENT_METHODS, CARD_KINDS, DOMAINS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import {
	assessmentMethodsSchema,
	newCardSchema,
	newScenarioSchema,
	newTeachingExerciseSchema,
	updateCardSchema,
} from './validation';

describe('newCardSchema -- card kind', () => {
	const base = {
		front: 'What is the meaning of an Airworthiness Directive?',
		back: 'A binding regulatory action issued by the FAA.',
		domain: DOMAINS.AIRSPACE,
		cardType: 'regulation',
	};

	it('accepts kind=recall', () => {
		const parsed = newCardSchema.parse({ ...base, kind: CARD_KINDS.RECALL });
		expect(parsed.kind).toBe(CARD_KINDS.RECALL);
	});

	it('accepts kind=calculation', () => {
		const parsed = newCardSchema.parse({ ...base, kind: CARD_KINDS.CALCULATION });
		expect(parsed.kind).toBe(CARD_KINDS.CALCULATION);
	});

	it('leaves kind undefined when omitted (BC defaults to recall)', () => {
		const parsed = newCardSchema.parse({ ...base });
		expect(parsed.kind).toBeUndefined();
	});

	it('rejects an unknown kind', () => {
		expect(() => newCardSchema.parse({ ...base, kind: 'scenario' })).toThrow();
	});
});

describe('updateCardSchema -- card kind', () => {
	it('accepts a partial patch that only flips kind', () => {
		const parsed = updateCardSchema.parse({ kind: CARD_KINDS.CALCULATION });
		expect(parsed.kind).toBe(CARD_KINDS.CALCULATION);
		expect(parsed.front).toBeUndefined();
	});

	it('rejects an unknown kind', () => {
		expect(() => updateCardSchema.parse({ kind: 'demonstration' })).toThrow();
	});
});

describe('assessmentMethodsSchema', () => {
	it('accepts a single-method array', () => {
		const parsed = assessmentMethodsSchema.parse([ASSESSMENT_METHODS.SCENARIO]);
		expect(parsed).toEqual([ASSESSMENT_METHODS.SCENARIO]);
	});

	it('accepts a hybrid array with multiple methods', () => {
		const parsed = assessmentMethodsSchema.parse([ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.DEMONSTRATION]);
		expect(parsed).toEqual([ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.DEMONSTRATION]);
	});

	it('rejects an empty array', () => {
		expect(() => assessmentMethodsSchema.parse([])).toThrow();
	});

	it('rejects duplicates', () => {
		expect(() => assessmentMethodsSchema.parse([ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.SCENARIO])).toThrow();
	});

	it('rejects an unknown method', () => {
		expect(() => assessmentMethodsSchema.parse([ASSESSMENT_METHODS.SCENARIO, 'bogus'])).toThrow();
	});
});

describe('newScenarioSchema -- assessment methods', () => {
	const base = {
		title: 'Crosswind landing',
		situation: 'You are cleared to land on Runway 36 with winds 270/18G25.',
		options: [
			{ id: 'a', text: 'Land on 36', isCorrect: true, outcome: 'ok', whyNot: '' },
			{ id: 'b', text: 'Divert', isCorrect: false, outcome: 'unnecessary', whyNot: 'Within crosswind limit' },
		],
		teachingPoint: 'Compute the crosswind component before accepting.',
		domain: DOMAINS.AERODYNAMICS,
		difficulty: 'intermediate',
	};

	it('accepts the happy path with assessmentMethods omitted (BC defaults to ["scenario"])', () => {
		const parsed = newScenarioSchema.parse(base);
		expect(parsed.assessmentMethods).toBeUndefined();
	});

	it('accepts a hybrid assessmentMethods array', () => {
		const parsed = newScenarioSchema.parse({
			...base,
			assessmentMethods: [ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.DEMONSTRATION],
		});
		expect(parsed.assessmentMethods).toEqual([ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.DEMONSTRATION]);
	});

	it('rejects an empty assessmentMethods array', () => {
		expect(() => newScenarioSchema.parse({ ...base, assessmentMethods: [] })).toThrow();
	});

	it('rejects duplicates in assessmentMethods', () => {
		expect(() =>
			newScenarioSchema.parse({
				...base,
				assessmentMethods: [ASSESSMENT_METHODS.SCENARIO, ASSESSMENT_METHODS.SCENARIO],
			}),
		).toThrow();
	});
});

describe('newTeachingExerciseSchema', () => {
	const base = {
		title: 'Explain the difference between IAS and TAS',
		prompt: 'In your own words, walk a CFI student through the conversion ladder from IAS to GS.',
		domain: DOMAINS.AERODYNAMICS,
	};

	it('accepts the happy path', () => {
		const parsed = newTeachingExerciseSchema.parse(base);
		expect(parsed.title).toBe(base.title);
		expect(parsed.prompt).toBe(base.prompt);
	});

	it('rejects an empty prompt', () => {
		expect(() => newTeachingExerciseSchema.parse({ ...base, prompt: '   ' })).toThrow();
	});

	it('rejects an empty title', () => {
		expect(() => newTeachingExerciseSchema.parse({ ...base, title: '' })).toThrow();
	});

	it('accepts a nodeId link', () => {
		const parsed = newTeachingExerciseSchema.parse({ ...base, nodeId: 'performance-true-airspeed' });
		expect(parsed.nodeId).toBe('performance-true-airspeed');
	});
});
