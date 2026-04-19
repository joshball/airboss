/**
 * Zod schemas for study BC inputs.
 *
 * Shared between the BC functions (defense-in-depth at the service boundary)
 * and the route form actions (user-facing validation messages).
 */

import {
	CARD_TYPE_VALUES,
	CONFIDENCE_LEVEL_VALUES,
	CONTENT_SOURCE_VALUES,
	DIFFICULTY_VALUES,
	DOMAIN_VALUES,
	PHASE_OF_FLIGHT_VALUES,
	REVIEW_RATING_VALUES,
	SCENARIO_OPTIONS_MAX,
	SCENARIO_OPTIONS_MIN,
} from '@ab/constants';
import { z } from 'zod';

const cardEnum = {
	domain: z.enum(DOMAIN_VALUES as [string, ...string[]]),
	cardType: z.enum(CARD_TYPE_VALUES as [string, ...string[]]),
	sourceType: z.enum(CONTENT_SOURCE_VALUES as [string, ...string[]]),
};

export const cardTextSchema = z.string().trim().min(1).max(10_000);

export const cardTagsSchema = z.array(z.string().trim().min(1).max(100)).max(20).default([]);

export const newCardSchema = z.object({
	front: cardTextSchema,
	back: cardTextSchema,
	domain: cardEnum.domain,
	cardType: cardEnum.cardType,
	tags: cardTagsSchema.optional(),
	sourceType: cardEnum.sourceType.optional(),
	sourceRef: z.string().trim().min(1).max(500).nullish(),
	isEditable: z.boolean().optional(),
});

export const updateCardSchema = z.object({
	front: cardTextSchema.optional(),
	back: cardTextSchema.optional(),
	domain: cardEnum.domain.optional(),
	cardType: cardEnum.cardType.optional(),
	tags: cardTagsSchema.optional(),
});

export const reviewRatingSchema = z
	.number()
	.int()
	.refine((v) => (REVIEW_RATING_VALUES as readonly number[]).includes(v), {
		message: 'rating must be 1..4',
	});

export const confidenceSchema = z
	.number()
	.int()
	.refine((v) => (CONFIDENCE_LEVEL_VALUES as readonly number[]).includes(v), { message: 'confidence must be 1..5' });

export const submitReviewSchema = z.object({
	rating: reviewRatingSchema,
	confidence: confidenceSchema.nullish(),
	answerMs: z.number().int().min(0).nullish(),
});

// -------- Decision Reps (scenarios) --------

const scenarioEnum = {
	domain: z.enum(DOMAIN_VALUES as [string, ...string[]]),
	difficulty: z.enum(DIFFICULTY_VALUES as [string, ...string[]]),
	phaseOfFlight: z.enum(PHASE_OF_FLIGHT_VALUES as [string, ...string[]]),
	sourceType: z.enum(CONTENT_SOURCE_VALUES as [string, ...string[]]),
};

export const scenarioOptionSchema = z.object({
	id: z.string().trim().min(1).max(50),
	text: z.string().trim().min(1).max(2000),
	isCorrect: z.boolean(),
	outcome: z.string().trim().min(1).max(2000),
	// whyNot is required on every option per spec. Enforced as min(1) for
	// incorrect options; for the correct option we still accept a whyNot so
	// authors can leave notes, but it's allowed to be empty. The options-shape
	// refine below is where the spec rule lives.
	whyNot: z.string().trim().max(2000).default(''),
});

/**
 * Validate the authored options array. Spec rules:
 *
 * - 2 to 5 options
 * - every option id is unique
 * - exactly one option marked correct
 * - every incorrect option has a non-empty `whyNot`
 */
export const scenarioOptionsSchema = z
	.array(scenarioOptionSchema)
	.min(SCENARIO_OPTIONS_MIN, `at least ${SCENARIO_OPTIONS_MIN} options are required`)
	.max(SCENARIO_OPTIONS_MAX, `at most ${SCENARIO_OPTIONS_MAX} options are allowed`)
	.superRefine((opts, ctx) => {
		const ids = new Set<string>();
		for (let i = 0; i < opts.length; i++) {
			const o = opts[i];
			if (ids.has(o.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [i, 'id'],
					message: `duplicate option id: ${o.id}`,
				});
			}
			ids.add(o.id);
			if (!o.isCorrect && o.whyNot.length === 0) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [i, 'whyNot'],
					message: 'incorrect options must include a "why not" explanation',
				});
			}
		}
		const correctCount = opts.filter((o) => o.isCorrect).length;
		if (correctCount !== 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [],
				message: 'exactly one option must be marked correct',
			});
		}
	});

export const regReferencesSchema = z.array(z.string().trim().min(1).max(200)).max(10).default([]);

export const newScenarioSchema = z.object({
	title: z.string().trim().min(1).max(200),
	situation: z.string().trim().min(1).max(10_000),
	options: scenarioOptionsSchema,
	teachingPoint: z.string().trim().min(1).max(5_000),
	domain: scenarioEnum.domain,
	difficulty: scenarioEnum.difficulty,
	phaseOfFlight: scenarioEnum.phaseOfFlight.nullish(),
	sourceType: scenarioEnum.sourceType.optional(),
	sourceRef: z.string().trim().min(1).max(500).nullish(),
	regReferences: regReferencesSchema.optional(),
	isEditable: z.boolean().optional(),
});

export const submitAttemptSchema = z.object({
	scenarioId: z.string().trim().min(1),
	chosenOption: z.string().trim().min(1).max(50),
	confidence: confidenceSchema.nullish(),
	answerMs: z.number().int().min(0).nullish(),
});
