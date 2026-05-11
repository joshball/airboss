/**
 * `POST /api/annotations`
 *
 * Create a new annotation. Body shape (JSON):
 *
 *     {
 *       "kind": "highlight",
 *       "sectionId": "refsec_<ULID>",
 *       "color": "yellow",            // required when kind === 'highlight'
 *       "anchor": { "text", "start", "end", "prefix", "suffix" }
 *     }
 *
 * Note-anchors and card-draft-anchors travel with their owning row through
 * `createNoteWithAnchor` / `createCardDraft` -- only highlights are
 * created via this endpoint.
 *
 * Returns the created annotation row as JSON.
 *
 * Authentication: cross-subdomain `bauth_session_token` cookie. Anonymous
 * callers get a 401 redirect to the study sign-in flow.
 */

import { requireAuth } from '@ab/auth';
import { createHighlight } from '@ab/bc-study/server';
import { ANNOTATION_KINDS, HIGHLIGHT_COLOR_VALUES, type HighlightColor } from '@ab/constants';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const HIGHLIGHT_COLOR_SET = new Set<string>(HIGHLIGHT_COLOR_VALUES);

const highlightInputSchema = z.object({
	kind: z.literal(ANNOTATION_KINDS.HIGHLIGHT),
	sectionId: z.string().min(1),
	color: z.string().refine((v): v is HighlightColor => HIGHLIGHT_COLOR_SET.has(v), {
		message: `Color must be one of ${HIGHLIGHT_COLOR_VALUES.join(', ')}.`,
	}),
	anchor: z.object({
		text: z.string().min(1),
		start: z.number().int().nonnegative(),
		end: z.number().int().nonnegative(),
		prefix: z.string().default(''),
		suffix: z.string().default(''),
	}),
});

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}

	const parsed = highlightInputSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.message }, { status: 400 });
	}
	const { sectionId, color, anchor } = parsed.data;
	const row = await createHighlight(user.id, sectionId, anchor, color);
	return json(row, { status: 201 });
};
