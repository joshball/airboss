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
	DOMAIN_VALUES,
	REVIEW_RATING_VALUES,
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
