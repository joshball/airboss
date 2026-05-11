/**
 * `POST /api/notes` -- create a note (wp-flightbag-rich-reader Phase 5).
 *
 * Two body shapes:
 *
 *   1. With an anchor (rich-reader path):
 *      { sectionId, anchor: {...}, bodyMd, title?, quotedExcerpt?, tags?,
 *        referenceId?, knowledgeNodeId?, courseId?, goalId?,
 *        followUpMd? }
 *      -- inserts a note + a `note_anchor` annotation in one transaction.
 *
 *   2. Without an anchor (freestanding note):
 *      { bodyMd, ... }
 *      -- inserts a note row only.
 *
 * Returns { note, annotation? } as JSON.
 */

import { requireAuth } from '@ab/auth';
import { createNote, createNoteInputSchema, createNoteWithAnchor } from '@ab/bc-study/server';
import { ANNOTATION_ANCHOR_TEXT_MAX_LENGTH } from '@ab/constants';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const requestSchema = z.object({
	sectionId: z.string().min(1).optional(),
	anchor: z
		.object({
			text: z.string().min(1).max(ANNOTATION_ANCHOR_TEXT_MAX_LENGTH),
			start: z.number().int().nonnegative(),
			end: z.number().int().nonnegative(),
			prefix: z.string().default(''),
			suffix: z.string().default(''),
		})
		.optional(),
	bodyMd: z.string().min(1),
	title: z.string().optional(),
	quotedExcerpt: z.string().optional(),
	tags: z.array(z.string()).optional(),
	referenceId: z.union([z.string().min(1), z.null()]).optional(),
	knowledgeNodeId: z.union([z.string().min(1), z.null()]).optional(),
	courseId: z.union([z.string().min(1), z.null()]).optional(),
	goalId: z.union([z.string().min(1), z.null()]).optional(),
	syllabusNodeId: z.union([z.string().min(1), z.null()]).optional(),
	followUpMd: z.string().optional(),
});

export const POST: RequestHandler = async (event) => {
	const user = requireAuth(event);

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}
	const parsed = requestSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.message }, { status: 400 });

	const { sectionId, anchor, ...rest } = parsed.data;
	if (anchor !== undefined && sectionId === undefined) {
		return json({ error: 'anchor requires sectionId.' }, { status: 400 });
	}

	const noteInput = createNoteInputSchema.parse(rest);

	if (anchor !== undefined && sectionId !== undefined) {
		const result = await createNoteWithAnchor(user.id, sectionId, anchor, noteInput);
		return json(result, { status: 201 });
	}
	const note = await createNote(user.id, noteInput);
	return json({ note, annotation: null }, { status: 201 });
};
