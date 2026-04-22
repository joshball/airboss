/**
 * Zod schemas for study-plan CRUD inputs. Used by the BC layer (defense in
 * depth) and by route form actions (user-facing error messages).
 */

import {
	CERT_VALUES,
	DEPTH_PREFERENCE_VALUES,
	DOMAIN_VALUES,
	MAX_SESSION_LENGTH,
	MIN_SESSION_LENGTH,
	PLAN_STATUS_VALUES,
	SESSION_MODE_VALUES,
} from '@ab/constants';
import { z } from 'zod';

const planEnum = {
	cert: z.enum(CERT_VALUES as [string, ...string[]]),
	domain: z.enum(DOMAIN_VALUES as [string, ...string[]]),
	status: z.enum(PLAN_STATUS_VALUES as [string, ...string[]]),
	mode: z.enum(SESSION_MODE_VALUES as [string, ...string[]]),
	depth: z.enum(DEPTH_PREFERENCE_VALUES as [string, ...string[]]),
};

export const planTitleSchema = z.string().trim().min(1).max(200);

export const createPlanSchema = z
	.object({
		title: planTitleSchema.optional(),
		// Empty certGoals is a first-class plan state (ADR 012): cert-agnostic
		// plans produce sessions full of reps without any cert filter. Upper bound
		// stays at 4 so authors can't list every cert.
		certGoals: z.array(planEnum.cert).max(4).default([]),
		focusDomains: z.array(planEnum.domain).max(5).default([]),
		skipDomains: z.array(planEnum.domain).max(14).default([]),
		skipNodes: z.array(z.string().trim().min(1).max(100)).max(200).default([]),
		depthPreference: planEnum.depth.optional(),
		sessionLength: z.number().int().min(MIN_SESSION_LENGTH).max(MAX_SESSION_LENGTH).optional(),
		defaultMode: planEnum.mode.optional(),
	})
	.superRefine((data, ctx) => {
		// focus + skip are disjoint (a domain cannot be emphasized and skipped at once).
		const focus = new Set(data.focusDomains ?? []);
		for (const s of data.skipDomains ?? []) {
			if (focus.has(s)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['skipDomains'],
					message: `"${s}" is in focus_domains; focus and skip must be disjoint`,
				});
			}
		}
	});

/** Partial update -- every field optional. */
export const updatePlanSchema = z
	.object({
		title: planTitleSchema.optional(),
		certGoals: z.array(planEnum.cert).max(4).optional(),
		focusDomains: z.array(planEnum.domain).max(5).optional(),
		skipDomains: z.array(planEnum.domain).max(14).optional(),
		skipNodes: z.array(z.string().trim().min(1).max(100)).max(200).optional(),
		depthPreference: planEnum.depth.optional(),
		sessionLength: z.number().int().min(MIN_SESSION_LENGTH).max(MAX_SESSION_LENGTH).optional(),
		defaultMode: planEnum.mode.optional(),
		status: planEnum.status.optional(),
	})
	.superRefine((data, ctx) => {
		if (data.focusDomains && data.skipDomains) {
			const focus = new Set(data.focusDomains);
			for (const s of data.skipDomains) {
				if (focus.has(s)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ['skipDomains'],
						message: `"${s}" is in focus_domains; focus and skip must be disjoint`,
					});
				}
			}
		}
	});
