/**
 * Zod schemas for hangar form actions.
 *
 * Mirrors the contracts in `libs/aviation/src/schema/{reference,source,tags}`
 * but written as Zod so form-action `safeParse` can surface per-field errors.
 * Every mutating route under `/glossary` + `/glossary/sources` pushes its
 * raw FormData through these before calling `registry.ts`.
 */

import {
	AVIATION_TOPIC_VALUES,
	CERT_APPLICABILITY_VALUES,
	FLIGHT_RULES_VALUES,
	KNOWLEDGE_KIND_VALUES,
	PHASE_REQUIRING_SOURCE_TYPES,
	REFERENCE_KEYWORD_MAX_COUNT,
	REFERENCE_KEYWORD_MAX_LENGTH,
	REFERENCE_PHASE_OF_FLIGHT_MAX,
	REFERENCE_PHASE_OF_FLIGHT_VALUES,
	SOURCE_TYPE_VALUES,
} from '@ab/constants';
import { z } from 'zod';

/** slug-shaped ref id: lowercase + digits + `-`; must start alpha. */
export const referenceIdSchema = z
	.string()
	.trim()
	.min(2, 'ID must be at least 2 characters')
	.max(128, 'ID must be at most 128 characters')
	.regex(/^[a-z][a-z0-9-]*$/, 'ID must be lowercase letters, digits, and dashes (starting with a letter)');

export const displayNameSchema = z.string().trim().min(1, 'Display name is required').max(200);

export const paraphraseSchema = z
	.string()
	.trim()
	.min(1, 'Paraphrase is required')
	.max(8000, 'Paraphrase is capped at 8000 characters');

export const aliasesSchema = z.array(z.string().trim().min(1).max(120)).max(16, 'No more than 16 aliases').default([]);

export const keywordsSchema = z
	.array(
		z
			.string()
			.trim()
			.min(1)
			.max(REFERENCE_KEYWORD_MAX_LENGTH, `Keywords capped at ${REFERENCE_KEYWORD_MAX_LENGTH} chars`),
	)
	.max(REFERENCE_KEYWORD_MAX_COUNT, `No more than ${REFERENCE_KEYWORD_MAX_COUNT} keywords`)
	.default([]);

export const relatedSchema = z.array(referenceIdSchema).max(32, 'No more than 32 related ids').default([]);

export const tagsSchema = z
	.object({
		sourceType: z.enum(SOURCE_TYPE_VALUES as unknown as [string, ...string[]]),
		aviationTopic: z
			.array(z.enum(AVIATION_TOPIC_VALUES as unknown as [string, ...string[]]))
			.min(1, 'At least one topic is required')
			.max(4, 'No more than 4 topics'),
		flightRules: z.enum(FLIGHT_RULES_VALUES as unknown as [string, ...string[]]),
		knowledgeKind: z.enum(KNOWLEDGE_KIND_VALUES as unknown as [string, ...string[]]),
		phaseOfFlight: z
			.array(z.enum(REFERENCE_PHASE_OF_FLIGHT_VALUES as unknown as [string, ...string[]]))
			.max(REFERENCE_PHASE_OF_FLIGHT_MAX)
			.default([]),
		certApplicability: z.array(z.enum(CERT_APPLICABILITY_VALUES as unknown as [string, ...string[]])).default([]),
		keywords: keywordsSchema,
	})
	.superRefine((tags, ctx) => {
		const needsPhase =
			(PHASE_REQUIRING_SOURCE_TYPES as readonly string[]).includes(tags.sourceType) ||
			tags.knowledgeKind === 'procedure';
		if (needsPhase && tags.phaseOfFlight.length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: 'Phase of flight is required for this source type / knowledge kind',
				path: ['phaseOfFlight'],
			});
		}
	});

/**
 * Outbound HTTP(S) URL field shared by `sourceSchema.url`, `bv_index_url`, and
 * `citationSchema.url`. The regex catches the obvious "ftp://", "file://",
 * "javascript:" cases at form validation time. The async denylist
 * (RFC1918 / loopback / link-local / cloud metadata) lives in
 * `@ab/utils` `validateOutboundUrl` and runs in form actions before the
 * worker is allowed to fetch the URL. See ssrf review finding for context.
 */
export const outboundUrlSchema = z
	.string()
	.trim()
	.regex(/^https?:\/\//i, 'URL must be http(s)')
	.max(2048);

/**
 * Citation URLs require `https://` (not `http://`). Every legitimate aviation
 * source the platform cites is HTTPS today, and a future renderer that
 * de-references citation URLs (link previews, validation pings, archive
 * captures) would inherit the SSRF surface from `outboundUrlSchema` -- locking
 * scheme to https here removes one class of internal-host targets up front.
 *
 * Closes chunk-6 security MIN: reference citation URL allows any host.
 */
export const citationUrlSchema = z
	.string()
	.trim()
	.regex(/^https:\/\//i, 'Citation URL must be https')
	.max(2048);

/** Single citation. Locator stays freeform (per source-type). */
export const citationSchema = z.object({
	sourceId: z.string().trim().min(1).max(128),
	locator: z
		.record(z.union([z.string().trim().min(1).max(200), z.number().int()]))
		.refine((o) => Object.keys(o).length > 0, 'Locator must not be empty'),
	url: citationUrlSchema.optional(),
});

/**
 * Binary-visual-source schema for the operator-typed `bv_*` fields.
 * Mirrors the regex + length cap on `outboundUrlSchema` so the index URL
 * cannot bypass the http(s) check applied to the main `url` column.
 *
 * The async SSRF denylist (`validateOutboundUrl`) runs in the form action
 * after this sync parse succeeds; it must run there because Zod refines
 * cannot await without `parseAsync` and the route layer is the right place
 * to surface DNS-driven failures as form errors.
 */
export const binaryVisualLocatorSchema = z.object({
	region: z.string().trim().min(1, 'Region is required for binary-visual sources').max(120),
	index_url: outboundUrlSchema,
	cadence_days: z.number().int().positive().optional(),
});

export type BinaryVisualLocatorParsed = z.infer<typeof binaryVisualLocatorSchema>;

export const referenceSchema = z.object({
	id: referenceIdSchema,
	displayName: displayNameSchema,
	paraphrase: paraphraseSchema,
	aliases: aliasesSchema,
	tags: tagsSchema,
	sources: z.array(citationSchema).default([]),
	related: relatedSchema,
	author: z.string().trim().max(200).optional(),
	reviewedAt: z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
		.optional(),
});

export type ReferenceInputParsed = z.infer<typeof referenceSchema>;

// -------- sources --------

export const sourceIdSchema = z
	.string()
	.trim()
	.min(2)
	.max(64)
	.regex(/^[a-z][a-z0-9-]*$/, 'ID must be lowercase letters, digits, and dashes (starting with a letter)');

export const sourceFormatSchema = z.enum(['xml', 'pdf', 'html', 'txt', 'json', 'csv', 'geotiff-zip']);

export const sourceSchema = z.object({
	id: sourceIdSchema,
	type: z.enum(SOURCE_TYPE_VALUES as unknown as [string, ...string[]]),
	title: z.string().trim().min(1).max(200),
	version: z.string().trim().min(1).max(120),
	url: outboundUrlSchema,
	path: z.string().trim().min(1).max(512),
	format: sourceFormatSchema,
	checksum: z.string().trim().min(1).max(128),
	downloadedAt: z.string().trim().min(1).max(64),
	sizeBytes: z.number().int().nonnegative().optional(),
});

export type SourceInputParsed = z.infer<typeof sourceSchema>;
