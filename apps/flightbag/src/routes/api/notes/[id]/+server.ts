/**
 * `PATCH /api/notes/[id]` -- update a note
 * (wp-flightbag-rich-reader Phase 5).
 *
 * Owner-scoped: a user can only mutate their own notes.
 */

import { requireAuth } from '@ab/auth';
import { NoteNotFoundError, updateNote, updateNoteInputSchema } from '@ab/bc-study/server';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async (event) => {
	const user = requireAuth(event);
	const id = event.params.id;
	if (!id) throw error(400, 'Missing note id.');

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Body must be JSON.' }, { status: 400 });
	}
	const parsed = updateNoteInputSchema.safeParse(body);
	if (!parsed.success) return json({ error: parsed.error.message }, { status: 400 });

	try {
		const after = await updateNote(id, user.id, parsed.data);
		return json(after);
	} catch (err) {
		if (err instanceof NoteNotFoundError) return json({ error: 'Note not found.' }, { status: 404 });
		throw err;
	}
};
