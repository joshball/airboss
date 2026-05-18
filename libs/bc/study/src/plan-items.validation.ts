/**
 * Zod schemas for plan-item CRUD inputs. Used by the BC layer
 * (defense in depth) and by the `POST /api/plan-items` route handler.
 *
 * Per-kind invariants (which target id column must be set) are enforced
 * in the BC layer's `pinPlanItem` because each `kind` requires a different
 * subset of the optional target fields; the Zod schema accepts every
 * shape and the BC narrows it.
 */

import {
	PLAN_ITEM_HREF_MAX_LENGTH,
	PLAN_ITEM_KIND_VALUES,
	PLAN_ITEM_NOTES_MAX_LENGTH,
	PLAN_ITEM_TITLE_MAX_LENGTH,
} from '@ab/constants';
import { z } from 'zod';

/**
 * `YYYY-MM-DD` calendar-day string. Matches the storage shape on
 * `study.plan_item.pinned_for_date`. Strict format to keep DB writes
 * consistent across the route + BC + future seed paths.
 */
export const planItemDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'pinned_for_date must be YYYY-MM-DD');

/**
 * Input for `pinPlanItem`. The route surface POSTs this same shape.
 * The target id is a single field; the BC routes it into the right
 * FK column based on `kind`.
 */
export const pinPlanItemSchema = z.object({
	kind: z.enum(PLAN_ITEM_KIND_VALUES),
	targetId: z.string().trim().min(1).max(256),
	title: z.string().trim().min(1).max(PLAN_ITEM_TITLE_MAX_LENGTH),
	href: z.string().trim().min(1).max(PLAN_ITEM_HREF_MAX_LENGTH),
	notes: z.string().trim().max(PLAN_ITEM_NOTES_MAX_LENGTH).optional(),
	/**
	 * Optional explicit pin date. Defaults to the caller-supplied "today"
	 * when omitted (`pinToToday` fills it from `userStartOfDay`).
	 */
	pinnedForDate: planItemDateSchema.optional(),
});

export type PinPlanItemInput = z.infer<typeof pinPlanItemSchema>;
