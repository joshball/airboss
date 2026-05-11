/**
 * `/notes/saved-searches` -- write-only sub-route owning save / remove form
 * actions for the `study.notes.saved_searches` user-pref. Posting `?/save`
 * with `name` + `url` upserts the entry; posting `?/remove` with `name`
 * drops it. Both redirect back to the calling URL (typically `/notes`)
 * via the `Referer` header so the user lands on the same view they came
 * from.
 *
 * The route doesn't render anything -- a load function would be cute but
 * unnecessary, and the sidebar lives on `/notes`. Hitting GET goes back
 * to `/notes`.
 */

import { requireAuth } from '@ab/auth';
import { NotesSavedSearchLimitError, removeNotesSearch, saveNotesSearch } from '@ab/bc-study/server';
import { ROUTES } from '@ab/constants';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	throw redirect(303, ROUTES.NOTES);
};

function backTo(event: Parameters<Actions[string]>[0]): string {
	const referer = event.request.headers.get('referer');
	if (referer === null) return ROUTES.NOTES;
	try {
		const url = new URL(referer);
		// Same-origin guard: never bounce off-site.
		if (url.origin !== event.url.origin) return ROUTES.NOTES;
		return `${url.pathname}${url.search}`;
	} catch {
		return ROUTES.NOTES;
	}
}

export const actions: Actions = {
	save: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		const url = String(form.get('url') ?? '').trim();
		if (name.length === 0 || url.length === 0) {
			return fail(400, { intent: 'save', error: 'Name and URL are required.' });
		}
		try {
			await saveNotesSearch(user.id, name, url);
		} catch (err) {
			if (err instanceof NotesSavedSearchLimitError) {
				return fail(400, { intent: 'save', error: err.message });
			}
			throw err;
		}
		throw redirect(303, backTo(event));
	},

	remove: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (name.length === 0) {
			return fail(400, { intent: 'remove', error: 'Name is required.' });
		}
		await removeNotesSearch(user.id, name);
		throw redirect(303, backTo(event));
	},
} satisfies Actions;
