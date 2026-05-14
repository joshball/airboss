/**
 * `POST /api/plan-items` -- "pin to today" endpoint.
 *
 * Inserts one row on `study.plan_item` scoped to the calling user's
 * local-calendar today. The command palette's detail-pane "Pin to today"
 * button posts here; future surfaces (a /today consumer page, in-line
 * pins from the rich reader) reuse the same endpoint.
 *
 * Idempotent: re-pinning the same (kind, target, date) returns the
 * existing row. The response carries `{ planItem }` so the palette can
 * confirm the optimistic state, even on the second click.
 *
 * Auth-gated; only the owning user can pin to their own queue.
 */

import { requireAuth } from '@ab/auth';
import { pinToToday } from '@ab/bc-study/server';
import type { PlanItemKind } from '@ab/constants';
import {
	PLAN_ITEM_HREF_MAX_LENGTH,
	PLAN_ITEM_KIND_VALUES,
	PLAN_ITEM_NOTES_MAX_LENGTH,
	PLAN_ITEM_TITLE_MAX_LENGTH,
} from '@ab/constants';
import { db } from '@ab/db/connection';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const bodySchema = z.object({
	kind: z.enum(PLAN_ITEM_KIND_VALUES as [string, ...string[]]),
	targetId: z.string().trim().min(1).max(256),
	title: z.string().trim().min(1).max(PLAN_ITEM_TITLE_MAX_LENGTH),
	href: z.string().trim().min(1).max(PLAN_ITEM_HREF_MAX_LENGTH),
	notes: z.string().trim().max(PLAN_ITEM_NOTES_MAX_LENGTH).optional(),
});

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let raw: unknown;
	try {
		raw = await event.request.json();
	} catch {
		throw error(400, 'invalid JSON body');
	}
	const parsed = bodySchema.safeParse(raw);
	if (!parsed.success) throw error(400, 'invalid body shape');

	const row = await pinToToday(
		{
			userId: user.id,
			kind: parsed.data.kind as PlanItemKind,
			targetId: parsed.data.targetId,
			title: parsed.data.title,
			href: parsed.data.href,
			notes: parsed.data.notes,
		},
		db,
	);
	return json({ planItem: row });
};
