import { requireRole } from '@ab/auth';
import {
	createReference,
	EMPTY_REFERENCE_INITIAL,
	formDataToInitial,
	getReference,
	validateReferenceForm,
} from '@ab/bc-hangar';
import { ROLES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:glossary-new');

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	return {
		initial: EMPTY_REFERENCE_INITIAL,
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const initial = formDataToInitial(form);

		const result = validateReferenceForm(form);
		if (!result.ok) {
			return fail(400, {
				initial,
				fieldErrors: result.errors.fieldErrors,
				formError: result.errors.formError,
			});
		}

		// Reject duplicate ids before the DB complains -- nicer error copy.
		const existing = await getReference(result.input.id);
		if (existing) {
			return fail(409, {
				initial,
				fieldErrors: { id: 'A reference with this id already exists' },
				formError: null,
			});
		}

		try {
			await createReference(result.input, user.id);
		} catch (err) {
			log.error(
				'createReference failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, {
				initial,
				fieldErrors: {},
				formError: 'Save failed. Please try again.',
			});
		}

		redirect(303, ROUTES.HANGAR_GLOSSARY_DETAIL(result.input.id));
	},
};
