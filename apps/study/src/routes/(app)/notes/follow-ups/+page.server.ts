/**
 * `/notes/follow-ups` -- write-only sub-route owning the "Mark all in
 * this month done" bulk action for the follow-ups inbox grouping. Posts
 * to `?/mark-month-done` with `month=YYYY-MM`; we re-fetch the user's
 * open follow-ups, filter to the chosen month, and call
 * `markFollowUpDone` per row inside one transaction.
 *
 * GET redirects to `/notes?view=follow-ups` so the user lands back on
 * the inbox.
 */

import { requireAuth } from '@ab/auth';
import { listOpenFollowUps, markFollowUpDone, NoFollowUpError, NoteNotFoundError } from '@ab/bc-study/server';
import { NOTES_VIEWS, ROUTES } from '@ab/constants';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const MONTH_RE = /^\d{4}-\d{2}$/;

export const load: PageServerLoad = async () => {
	throw redirect(303, ROUTES.NOTES_FILTER(NOTES_VIEWS.FOLLOW_UPS));
};

function monthKey(d: Date): string {
	return `${d.getUTCFullYear().toString().padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const actions: Actions = {
	'mark-month-done': async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const month = String(form.get('month') ?? '').trim();
		if (!MONTH_RE.test(month)) {
			return fail(400, { intent: 'mark-month-done', error: 'Month must be YYYY-MM.' });
		}
		const open = await listOpenFollowUps(user.id);
		const targets = open.filter((n) => monthKey(n.createdAt) === month);
		// Per-row mark-done: keeps the audit trail individuated. The set is
		// bounded by `NOTES_LIST_HARD_CAP` (100) so the loop is fast.
		for (const row of targets) {
			try {
				await markFollowUpDone(row.id, user.id);
			} catch (err) {
				if (err instanceof NoteNotFoundError || err instanceof NoFollowUpError) continue;
				throw err;
			}
		}
		throw redirect(303, ROUTES.NOTES_FILTER(NOTES_VIEWS.FOLLOW_UPS));
	},
} satisfies Actions;
