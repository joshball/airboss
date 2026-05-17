/**
 * Zod schemas for the credential / syllabus / goal pipeline.
 *
 * Two audiences:
 *
 * 1. The credential + syllabus seeds (`scripts/db/seed-credentials.ts`,
 *    `scripts/db/seed-syllabi.ts`) parse YAML manifests against these
 *    schemas before touching the DB. Bad authoring is a load-time error
 *    with a path the author can act on, not a silent crash.
 * 2. The goals BC validates CRUD inputs from route action handlers (when
 *    the goal composer pages land in a follow-on WP).
 *
 * Schemas live in the BC, not `@ab/types`, so the dependency on `zod`
 * stays out of the type-only barrel. The shape mirrors the spec and the
 * Drizzle schema definitions in `schema.ts`. Citation entries inside
 * credential `regulatory_basis` and syllabus_node `citations` reuse the
 * `structuredCitationSchema` from `manifest-validation.ts` so there is
 * one citation primitive across the BC.
 *
 * See `docs/work-packages/cert-syllabus-and-goal-composer/spec.md` and
 * `docs/decisions/016-cert-syllabus-goal-model/decision.md`.
 */

import {
	ACS_TRIAD_VALUES,
	type ACSTriad,
	BLOOM_LEVEL_VALUES,
	type BloomLevel,
	CREDENTIAL_CATEGORY_VALUES,
	CREDENTIAL_CLASS_VALUES,
	CREDENTIAL_KIND_VALUES,
	CREDENTIAL_PREREQ_KIND_VALUES,
	CREDENTIAL_STATUS_VALUES,
	type CredentialCategory,
	type CredentialClass,
	type CredentialKind,
	type CredentialPrereqKind,
	type CredentialStatus,
	DOMAIN_VALUES,
	type Domain,
	GOAL_NODE_NOTES_MAX_LENGTH,
	GOAL_NOTES_MAX_LENGTH,
	GOAL_STATUS_VALUES,
	GOAL_SYLLABUS_WEIGHT_MAX,
	GOAL_SYLLABUS_WEIGHT_MIN,
	GOAL_TITLE_MAX_LENGTH,
	type GoalStatus,
	SYLLABUS_KIND_VALUES,
	SYLLABUS_NODE_LEVEL_VALUES,
	SYLLABUS_PRIMACY_VALUES,
	SYLLABUS_STATUS_VALUES,
	type SyllabusKind,
	type SyllabusNodeLevel,
	type SyllabusPrimacy,
	type SyllabusStatus,
} from '@ab/constants';
import { z } from 'zod';
import { structuredCitationSchema } from './manifest-validation';

/** Slug shape mirrored from the DB CHECK on `credential.slug` and `syllabus.slug`. */
const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/** Authoring shape for one row in `course/credentials/<slug>.yaml`. */
export const credentialYamlSchema = z.object({
	slug: z.string().regex(SLUG_REGEX),
	kind: z.enum(CREDENTIAL_KIND_VALUES as unknown as readonly [CredentialKind, ...CredentialKind[]]),
	title: z.string().min(1),
	category: z.enum(CREDENTIAL_CATEGORY_VALUES as unknown as readonly [CredentialCategory, ...CredentialCategory[]]),
	class: z
		.enum(CREDENTIAL_CLASS_VALUES as unknown as readonly [CredentialClass, ...CredentialClass[]])
		.nullable()
		.optional(),
	regulatory_basis: z.array(structuredCitationSchema).default([]),
	status: z.enum(CREDENTIAL_STATUS_VALUES as unknown as readonly [CredentialStatus, ...CredentialStatus[]]).optional(),
	/**
	 * Inline prereqs. Each entry references another credential by slug.
	 * Cycle detection is the seed's job; the schema only validates shape.
	 */
	prereqs: z
		.array(
			z.object({
				prereq_slug: z.string().regex(SLUG_REGEX),
				kind: z.enum(
					CREDENTIAL_PREREQ_KIND_VALUES as unknown as readonly [CredentialPrereqKind, ...CredentialPrereqKind[]],
				),
				notes: z.string().default(''),
			}),
		)
		.default([]),
	/**
	 * Inline syllabi. Each entry references a syllabus by slug; the seed
	 * resolves to the syllabus row id at upsert time.
	 */
	syllabi: z
		.array(
			z.object({
				syllabus_slug: z.string().regex(SLUG_REGEX),
				primacy: z.enum(SYLLABUS_PRIMACY_VALUES as unknown as readonly [SyllabusPrimacy, ...SyllabusPrimacy[]]),
			}),
		)
		.default([]),
});
export type CredentialYaml = z.infer<typeof credentialYamlSchema>;

/** Top-level `course/syllabi/<slug>/manifest.yaml` shape. */
export const syllabusManifestSchema = z.object({
	slug: z.string().regex(SLUG_REGEX),
	kind: z.enum(SYLLABUS_KIND_VALUES as unknown as readonly [SyllabusKind, ...SyllabusKind[]]),
	title: z.string().min(1),
	edition: z.string().min(1).max(64),
	source_url: z.string().url().optional(),
	status: z.enum(SYLLABUS_STATUS_VALUES as unknown as readonly [SyllabusStatus, ...SyllabusStatus[]]).optional(),
	/** Optional reference slug pointing at the FAA publication backing this syllabus. */
	reference: z.string().min(1).optional(),
	/** Credential slugs this syllabus belongs to. */
	credentials: z
		.array(
			z.object({
				credential_slug: z.string().regex(SLUG_REGEX),
				primacy: z.enum(SYLLABUS_PRIMACY_VALUES as unknown as readonly [SyllabusPrimacy, ...SyllabusPrimacy[]]),
			}),
		)
		.default([]),
});
export type SyllabusManifest = z.infer<typeof syllabusManifestSchema>;

/**
 * One leaf-or-internal node in `course/syllabi/<slug>/areas/*.yaml`.
 * Recursive: `children` carries nested nodes for tree shapes. The seed
 * derives `is_leaf` from the absence of children at upsert time, but the
 * schema enforces the level-vs-children consistency where authoring should
 * align (an area must have children; an element must not).
 */
type SyllabusNodeYamlBase = {
	level: SyllabusNodeLevel;
	code: string;
	title: string;
	description?: string;
	triad?: ACSTriad;
	required_bloom?: BloomLevel;
	airboss_ref?: string;
	citations: z.infer<typeof structuredCitationSchema>[];
	knowledge_nodes: { node_slug: string; weight?: number; notes?: string }[];
	children: SyllabusNodeYamlBase[];
};

export const syllabusNodeYamlSchema: z.ZodType<SyllabusNodeYamlBase, z.ZodTypeDef, unknown> = z.lazy(() =>
	z.object({
		level: z.enum(SYLLABUS_NODE_LEVEL_VALUES as unknown as readonly [SyllabusNodeLevel, ...SyllabusNodeLevel[]]),
		code: z.string().min(1),
		title: z.string().min(1),
		description: z.string().optional(),
		triad: z.enum(ACS_TRIAD_VALUES as unknown as readonly [ACSTriad, ...ACSTriad[]]).optional(),
		required_bloom: z.enum(BLOOM_LEVEL_VALUES as unknown as readonly [BloomLevel, ...BloomLevel[]]).optional(),
		airboss_ref: z
			.string()
			.regex(/^airboss-ref:.+$/, { message: 'airboss_ref must start with `airboss-ref:`' })
			.optional(),
		citations: z.array(structuredCitationSchema).default([]),
		knowledge_nodes: z
			.array(
				z.object({
					node_slug: z.string().min(1),
					weight: z.number().min(0).max(1).default(1.0),
					notes: z.string().default(''),
				}),
			)
			.default([]),
		children: z.array(syllabusNodeYamlSchema).default([]),
	}),
);

/**
 * Per-area authoring file: `course/syllabi/<slug>/areas/<area-code>-<title>.yaml`.
 * The top of the file is a single `syllabusNodeYamlSchema` of `level=area`.
 */
export const syllabusAreaYamlSchema = syllabusNodeYamlSchema;

/**
 * Goal-CRUD input from a route action. The user_id is set server-side.
 * Targeting fields (`focusDomains`, `skipDomains`, `skipNodes`) flow through
 * separate setter helpers (`setGoalFocusDomains`, `setGoalSkipDomains`,
 * `setGoalSkipNodes`) -- not this schema -- because the route layer
 * patches them as a separate operation post-create.
 */
export const createGoalInputSchema = z.object({
	title: z.string().min(1).max(GOAL_TITLE_MAX_LENGTH),
	notesMd: z.string().max(GOAL_NOTES_MAX_LENGTH).optional(),
	isPrimary: z.boolean().optional(),
	targetDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'targetDate must be a calendar date in YYYY-MM-DD form')
		.nullable()
		.optional(),
});
export type CreateGoalInput = z.infer<typeof createGoalInputSchema>;

export const updateGoalInputSchema = z.object({
	title: z.string().min(1).max(GOAL_TITLE_MAX_LENGTH).optional(),
	notesMd: z.string().max(GOAL_NOTES_MAX_LENGTH).optional(),
	status: z.enum(GOAL_STATUS_VALUES as unknown as readonly [GoalStatus, ...GoalStatus[]]).optional(),
	targetDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'targetDate must be a calendar date in YYYY-MM-DD form')
		.nullable()
		.optional(),
});
export type UpdateGoalInput = z.infer<typeof updateGoalInputSchema>;

export const addGoalSyllabusInputSchema = z.object({
	syllabusId: z.string().min(1),
	weight: z.number().min(GOAL_SYLLABUS_WEIGHT_MIN).max(GOAL_SYLLABUS_WEIGHT_MAX).default(1.0),
});
export type AddGoalSyllabusInput = z.infer<typeof addGoalSyllabusInputSchema>;

export const addGoalNodeInputSchema = z.object({
	knowledgeNodeId: z.string().min(1),
	weight: z.number().min(GOAL_SYLLABUS_WEIGHT_MIN).max(GOAL_SYLLABUS_WEIGHT_MAX).default(1.0),
	notes: z.string().max(GOAL_NODE_NOTES_MAX_LENGTH).default(''),
});
export type AddGoalNodeInput = z.infer<typeof addGoalNodeInputSchema>;

/**
 * Input for `addGoalCourse`. The `goal_course.weight` column reuses the
 * syllabus weight range (`goal_course_weight_check` mirrors
 * `GOAL_SYLLABUS_WEIGHT_MIN/MAX`); a `.min/.max` here rejects out-of-range
 * input at the BC boundary rather than letting the DB CHECK 500 the request.
 */
export const addGoalCourseInputSchema = z.object({
	courseId: z.string().min(1),
	weight: z.number().min(GOAL_SYLLABUS_WEIGHT_MIN).max(GOAL_SYLLABUS_WEIGHT_MAX).default(1.0),
});
export type AddGoalCourseInput = z.infer<typeof addGoalCourseInputSchema>;

/**
 * Targeting-list schemas wired into `setGoalFocusDomains`,
 * `setGoalSkipDomains`, and `setGoalSkipNodes`. The arrays are validated
 * against `DOMAIN_VALUES` so a caller that bypasses the route layer
 * (e.g. a script) can't slip an unknown domain slug into `goal.focus_domains`.
 */
export const goalDomainListSchema = z.array(z.enum(DOMAIN_VALUES as unknown as readonly [Domain, ...Domain[]]));
export type GoalDomainList = z.infer<typeof goalDomainListSchema>;

export const goalNodeIdListSchema = z.array(z.string().min(1));
export type GoalNodeIdList = z.infer<typeof goalNodeIdListSchema>;

/**
 * Input for `applyCertGoalsToPrimaryGoal`. Validates the shape of every
 * argument: non-empty `userId`, an array of non-empty cert slug strings,
 * and the optional targeting overrides against `DOMAIN_VALUES` plus the
 * goal-title length cap. The cert slugs themselves are NOT enum-checked
 * here because the BC already resolves each slug against `credential.slug`
 * and reports unknown slugs through the `skippedCerts` result -- making
 * "unknown slug" a first-class outcome, not an error. The schema's role
 * is to block oversized/wrong-shape payloads so a script bypassing the
 * route layer can't blow up `credentialBySlug` lookups with non-string
 * input.
 */
export const applyCertGoalsInputSchema = z.object({
	userId: z.string().min(1),
	certs: z.array(z.string().min(1)),
	options: z
		.object({
			goalTitle: z.string().min(1).max(GOAL_TITLE_MAX_LENGTH).optional(),
			focusDomains: z.array(z.enum(DOMAIN_VALUES as unknown as readonly [Domain, ...Domain[]])).optional(),
			skipDomains: z.array(z.enum(DOMAIN_VALUES as unknown as readonly [Domain, ...Domain[]])).optional(),
		})
		.default({}),
});
export type ApplyCertGoalsInput = z.infer<typeof applyCertGoalsInputSchema>;
