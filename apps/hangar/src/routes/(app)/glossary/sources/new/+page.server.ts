import { requireRole } from '@ab/auth';
import { ROLES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import { createSource, getSource } from '$lib/server/registry';
import { sourceFormDataToInitial, validateSourceForm } from '$lib/server/source-form';
import { EMPTY_SOURCE_INITIAL } from '$lib/server/source-form-types';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:sources-new');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	return { initial: EMPTY_SOURCE_INITIAL };
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const initial = sourceFormDataToInitial(form);

		const result = validateSourceForm(form);
		if (!result.ok) {
			return fail(400, {
				initial,
				fieldErrors: result.errors.fieldErrors,
				formError: result.errors.formError,
			});
		}

		const existing = await getSource(result.input.id);
		if (existing) {
			return fail(409, {
				initial,
				fieldErrors: { id: 'A source with this id already exists' },
				formError: null,
			});
		}

		try {
			await createSource({ ...result.input, locatorShape: result.locatorShape }, user.id);
		} catch (err) {
			log.error(
				'createSource failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, {
				initial,
				fieldErrors: {},
				formError: 'Save failed. Please try again.',
			});
		}

		redirect(303, ROUTES.HANGAR_GLOSSARY_SOURCES_DETAIL(result.input.id));
	},
};
