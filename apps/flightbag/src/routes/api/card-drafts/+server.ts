/**
 * `POST /api/card-drafts`
 *
 * Create a new card draft (wp-flightbag-rich-reader Phase 3). Body:
 *
 *     {
 *       "sectionId": "refsec_<ULID>",   // optional
 *       "anchor": { "text", "start", "end", "prefix", "suffix" }, // optional, requires sectionId
 *       "front": "string",              // optional prefill
 *       "back":  "string"               // optional prefill (typically the source citation footnote)
 *     }
 *
 * Returns the created draft row + the (optional) annotation row.
 */

import { requireAuth } from '@ab/auth';
import { createCardDraft } from '@ab/bc-study/server';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const draftInputSchema = z.object({
	sectionId: z.string().min(1).optional(),
	anchor: z
		.object({
			text: z.string().min(1),
			start: z.number().int().nonnegative(),
			end: z.number().int().nonnegative(),
			prefix: z.string().default(''),
			suffix: z.string().default(''),
		})
		.optional(),
	front: z.string().max(2000).optional(),
	back: z.string().max(8000).optional(),
});

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}
	const parsed = draftInputSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.message }, { status: 400 });
	const { sectionId, anchor, front, back } = parsed.data;
	if (anchor !== undefined && sectionId === undefined) {
		return json({ error: 'anchor requires sectionId.' }, { status: 400 });
	}

	const result = await createCardDraft(
		user.id,
		{
			referenceSectionId: sectionId,
			front: front ?? '',
			back: back ?? '',
		},
		anchor,
	);
	return json(result, { status: 201 });
};
