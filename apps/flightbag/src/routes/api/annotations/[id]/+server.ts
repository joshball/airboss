/**
 * `PATCH /api/annotations/[id]`  -- update color (highlights only).
 * `DELETE /api/annotations/[id]` -- remove the annotation.
 *
 * Owner-scoped: a user can only mutate their own annotations.
 */

import { requireAuth } from '@ab/auth';
import { AnnotationNotFoundError, deleteAnnotation, updateHighlightColor } from '@ab/bc-study/server';
import { HIGHLIGHT_COLOR_VALUES, type HighlightColor } from '@ab/constants';
import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const HIGHLIGHT_COLOR_SET = new Set<string>(HIGHLIGHT_COLOR_VALUES);

const patchSchema = z.object({
	color: z.string().refine((v): v is HighlightColor => HIGHLIGHT_COLOR_SET.has(v), {
		message: `Color must be one of ${HIGHLIGHT_COLOR_VALUES.join(', ')}.`,
	}),
});

export const PATCH: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const id = event.params.id;
	if (!id) throw error(400, 'Missing annotation id.');

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}
	const parsed = patchSchema.safeParse(body);
	if (!parsed.success) {
		return json({ error: parsed.error.message }, { status: 400 });
	}
	try {
		const after = await updateHighlightColor(id, user.id, parsed.data.color);
		return json(after);
	} catch (err) {
		if (err instanceof AnnotationNotFoundError) {
			return json({ error: 'Annotation not found.' }, { status: 404 });
		}
		throw err;
	}
};

export const DELETE: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const id = event.params.id;
	if (!id) throw error(400, 'Missing annotation id.');
	try {
		await deleteAnnotation(id, user.id);
		return new Response(null, { status: 204 });
	} catch (err) {
		if (err instanceof AnnotationNotFoundError) {
			return json({ error: 'Annotation not found.' }, { status: 404 });
		}
		throw err;
	}
};
