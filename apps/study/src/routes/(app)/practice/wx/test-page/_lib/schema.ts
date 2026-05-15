/**
 * Zod schemas for the `/practice/wx/test-page` POST endpoints.
 *
 * Browser-safe: `zod` + sandbox constants only. The `derive` and
 * `save-candidate` endpoints parse their request bodies through these
 * schemas so a malformed POST returns a 400 rather than throwing deep in
 * the derivation layer.
 */

import { z } from 'zod';
import {
	SANDBOX_FRONT_INTENSITIES,
	SANDBOX_HAZARD_SEVERITIES,
	SANDBOX_SLIDER_BOUNDS,
	type SandboxSliderState,
} from './types';

const bounds = SANDBOX_SLIDER_BOUNDS;

/** Slider-state schema -- every lever clamped to its declared bounds. */
export const sandboxSliderStateSchema = z.object({
	windDirDeg: z.number().int().gte(bounds.windDirDeg.min).lte(bounds.windDirDeg.max),
	windKt: z.number().int().gte(bounds.windKt.min).lte(bounds.windKt.max),
	tempC: z.number().int().gte(bounds.tempC.min).lte(bounds.tempC.max),
	dewpointSpreadC: z.number().int().gte(bounds.dewpointSpreadC.min).lte(bounds.dewpointSpreadC.max),
	seaLevelPressureMb: z.number().int().gte(bounds.seaLevelPressureMb.min).lte(bounds.seaLevelPressureMb.max),
	frontDistanceKm: z.number().int().gte(bounds.frontDistanceKm.min).lte(bounds.frontDistanceKm.max),
	frontIntensity: z.enum(SANDBOX_FRONT_INTENSITIES),
	cellDistanceNm: z.number().int().gte(bounds.cellDistanceNm.min).lte(bounds.cellDistanceNm.max),
	hazardSeverity: z.enum(SANDBOX_HAZARD_SEVERITIES),
}) satisfies z.ZodType<SandboxSliderState>;

/** Slug shape for a catalog-example candidate -- lowercase kebab-case. */
const candidateSlugSchema = z
	.string()
	.min(3)
	.max(80)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase kebab-case');

/** Request body for the `save-candidate` endpoint. */
export const saveCandidateRequestSchema = z.object({
	slug: candidateSlugSchema,
	product: z.enum(['metar', 'taf']),
	raw: z.string().min(1).max(500),
	synoptic: z.string().min(1).max(600),
	tokenFamilies: z.array(z.string().min(1).max(80)).max(40),
	references: z
		.array(
			z.object({
				source: z.string().min(1).max(120),
				detail: z.string().min(1).max(300),
			}),
		)
		.max(20),
	sliderState: sandboxSliderStateSchema,
});

export type SaveCandidateRequest = z.infer<typeof saveCandidateRequestSchema>;
