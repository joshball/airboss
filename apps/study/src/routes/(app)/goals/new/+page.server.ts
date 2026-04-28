import { requireAuth } from '@ab/auth';
import { createGoal } from '@ab/bc-study';
import { ROUTES } from '@ab/constants';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireAuth(event);
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const title = String(form.get('title') ?? '').trim();
		const notesMd = String(form.get('notesMd') ?? '');
		const targetDateRaw = String(form.get('targetDate') ?? '').trim();
		const isPrimary = form.get('isPrimary') === 'on';

		if (title === '') {
			return fail(400, { error: 'Title is required.', values: { title, notesMd, targetDateRaw, isPrimary } });
		}
		if (title.length > 200) {
			return fail(400, {
				error: 'Title must be 200 characters or fewer.',
				values: { title, notesMd, targetDateRaw, isPrimary },
			});
		}
		if (targetDateRaw !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(targetDateRaw)) {
			return fail(400, {
				error: 'Target date must be YYYY-MM-DD or empty.',
				values: { title, notesMd, targetDateRaw, isPrimary },
			});
		}

		const goal = await createGoal({
			userId: user.id,
			title,
			notesMd,
			isPrimary,
			targetDate: targetDateRaw === '' ? null : targetDateRaw,
		});

		throw redirect(303, ROUTES.GOAL(goal.id));
	},
};
