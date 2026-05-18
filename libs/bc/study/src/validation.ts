/**
 * Zod schemas for study BC inputs.
 *
 * Shared between the BC functions (defense-in-depth at the service boundary)
 * and the route form actions (user-facing validation messages).
 */

import {
	ACS_CODE_PATTERN,
	ACS_CODES_MAX_PER_CARD,
	ASSESSMENT_METHOD_VALUES,
	CARD_KIND_VALUES,
	CARD_TYPE_VALUES,
	CONFIDENCE_LEVEL_VALUES,
	CONTENT_SOURCE_VALUES,
	DIFFICULTY_VALUES,
	DOMAIN_VALUES,
	PHASE_OF_FLIGHT_VALUES,
	QUESTION_TIER_VALUES,
	REVIEW_RATING_VALUES,
	SCENARIO_OPTIONS_MAX,
	SCENARIO_OPTIONS_MIN,
	SOURCE_AUTHORITY_CITE_MAX_LENGTH,
	SOURCE_AUTHORITY_KIND_VALUES,
	SOURCE_AUTHORITY_MAX_PER_CARD,
} from '@ab/constants';
import { z } from 'zod';

const cardEnum = {
	domain: z.enum(DOMAIN_VALUES),
	cardType: z.enum(CARD_TYPE_VALUES),
	kind: z.enum(CARD_KIND_VALUES),
	sourceType: z.enum(CONTENT_SOURCE_VALUES),
	questionTier: z.enum(QUESTION_TIER_VALUES),
	sourceAuthorityKind: z.enum(SOURCE_AUTHORITY_KIND_VALUES),
};

export const cardTextSchema = z.string().trim().min(1).max(10_000);

export const cardTagsSchema = z.array(z.string().trim().min(1).max(100)).max(20).default([]);

/**
 * Per-element shape for `card.source_authority` (card-question-tier WP).
 * `kind` is a closed enum (`SOURCE_AUTHORITY_KIND_VALUES`); `cite` is a
 * trimmed, non-empty string bounded by `SOURCE_AUTHORITY_CITE_MAX_LENGTH`.
 * The DB CHECK (`card_source_authority_shape_check`) enforces the same
 * rule at the storage layer; this schema is the authoring-time mirror.
 */
export const sourceAuthorityEntrySchema = z.object({
	kind: cardEnum.sourceAuthorityKind,
	cite: z.string().trim().min(1).max(SOURCE_AUTHORITY_CITE_MAX_LENGTH),
});

export const sourceAuthoritySchema = z.array(sourceAuthorityEntrySchema).max(SOURCE_AUTHORITY_MAX_PER_CARD);

/**
 * ACS task-element codes array (card-question-tier WP). Each element is
 * a single code (`PA.I.C.K2a`, `IR.II.A.K2c`, ...) matching
 * `ACS_CODE_PATTERN`. Bounded to `ACS_CODES_MAX_PER_CARD` so authoring
 * slips can't run unboundedly.
 */
export const acsCodesSchema = z
	.array(z.string().trim().regex(ACS_CODE_PATTERN, 'ACS code must match the canonical shape (e.g. PA.I.C.K2a)'))
	.max(ACS_CODES_MAX_PER_CARD);

export const newCardSchema = z.object({
	front: cardTextSchema,
	back: cardTextSchema,
	domain: cardEnum.domain,
	cardType: cardEnum.cardType,
	kind: cardEnum.kind.optional(),
	tags: cardTagsSchema.optional(),
	sourceType: cardEnum.sourceType.optional(),
	sourceRef: z.string().trim().min(1).max(500).nullish(),
	isEditable: z.boolean().optional(),
	questionTier: cardEnum.questionTier.nullish(),
	sourceAuthority: sourceAuthoritySchema.nullish(),
	acsCodes: acsCodesSchema.nullish(),
});

/**
 * Input shape accepted by `createCard` and the memory/new form action.
 * Inferred from the zod schema so validation and types stay in sync.
 * Exported from the BC (not per-route) so every caller reads the same
 * contract.
 */
export type NewCardInput = z.infer<typeof newCardSchema>;

export const updateCardSchema = z.object({
	front: cardTextSchema.optional(),
	back: cardTextSchema.optional(),
	domain: cardEnum.domain.optional(),
	cardType: cardEnum.cardType.optional(),
	kind: cardEnum.kind.optional(),
	tags: cardTagsSchema.optional(),
	questionTier: cardEnum.questionTier.nullish(),
	sourceAuthority: sourceAuthoritySchema.nullish(),
	acsCodes: acsCodesSchema.nullish(),
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
	domain: z.enum(DOMAIN_VALUES),
	difficulty: z.enum(DIFFICULTY_VALUES),
	phaseOfFlight: z.enum(PHASE_OF_FLIGHT_VALUES),
	sourceType: z.enum(CONTENT_SOURCE_VALUES),
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

/**
 * `scenario.assessment_methods` BC validator (evidence-kind-data-layer WP).
 * Schema-level CHECK on a jsonb array would be awkward; the BC enforces the
 * three rules below and the column default fills the unset case at insert.
 *
 * - Non-empty (default applies when the field is omitted; an explicit empty
 *   array is rejected here).
 * - Every entry is in `ASSESSMENT_METHOD_VALUES`.
 * - No duplicates within the array.
 */
export const assessmentMethodsSchema = z
	.array(z.enum(ASSESSMENT_METHOD_VALUES))
	.min(1, 'assessmentMethods must be a non-empty array')
	.superRefine((values, ctx) => {
		const seen = new Set<string>();
		for (let i = 0; i < values.length; i++) {
			if (seen.has(values[i])) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: [i],
					message: `duplicate assessment method: ${values[i]}`,
				});
			}
			seen.add(values[i]);
		}
	});

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
	assessmentMethods: assessmentMethodsSchema.optional(),
});

/**
 * Input shape accepted by `createScenario` and the reps/new form action.
 * Inferred from the zod schema so validation and types stay in sync.
 * Exported from the BC so routes and future API surfaces share the
 * contract.
 */
export type NewScenarioInput = z.infer<typeof newScenarioSchema>;

// -------- Teaching exercises (evidence-kind-data-layer WP) --------

export const newTeachingExerciseSchema = z.object({
	title: z.string().trim().min(1).max(200),
	prompt: z.string().trim().min(1).max(10_000),
	domain: z.enum(DOMAIN_VALUES),
	nodeId: z.string().trim().min(1).max(150).nullish(),
	isEditable: z.boolean().optional(),
});

export type NewTeachingExerciseInput = z.infer<typeof newTeachingExerciseSchema>;

export const updateTeachingExerciseSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	prompt: z.string().trim().min(1).max(10_000).optional(),
	domain: z.enum(DOMAIN_VALUES).optional(),
	nodeId: z.string().trim().min(1).max(150).nullish(),
});

export type UpdateTeachingExerciseInput = z.infer<typeof updateTeachingExerciseSchema>;

export const submitAttemptSchema = z.object({
	scenarioId: z.string().trim().min(1),
	/**
	 * Id of the option the learner picked. Renamed from `chosenOption` after
	 * the scenario_options-relational migration: now an FK to
	 * `scenario_option.id`, not free text.
	 */
	// `createScenario` builds composite option PKs as `${scenarioId}__${o.id}`
	// (e.g. ~30-char scenario id + `__` + up to 50-char authored option id =
	// ~82 chars). Cap at 150 so any composite shape `createScenario` can
	// produce is also submittable -- the previous 50-char cap rejected
	// legitimate composite ids.
	chosenOptionId: z.string().trim().min(1).max(150),
	confidence: confidenceSchema.nullish(),
	answerMs: z.number().int().min(0).nullish(),
});
