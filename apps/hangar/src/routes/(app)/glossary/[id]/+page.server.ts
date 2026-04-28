import { requireRole } from '@ab/auth';
import {
	formDataToInitial,
	getReference,
	NotFoundError,
	type ReferenceFormInitial,
	RevConflictError,
	softDeleteReference,
	updateReference,
	validateReferenceForm,
} from '@ab/bc-hangar';
import { ROLES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:glossary-detail');

function rowToInitial(row: {
	id: string;
	displayName: string;
	aliases: readonly string[];
	paraphrase: string;
	tags: Record<string, unknown>;
	sources: readonly Record<string, unknown>[];
	related: readonly string[];
	author: string | null;
	reviewedAt: string | null;
}): ReferenceFormInitial {
	const tags = row.tags as {
		sourceType?: string;
		aviationTopic?: readonly string[];
		flightRules?: string;
		knowledgeKind?: string;
		phaseOfFlight?: readonly string[];
		certApplicability?: readonly string[];
		keywords?: readonly string[];
	};
	return {
		id: row.id,
		displayName: row.displayName,
		paraphrase: row.paraphrase,
		aliasesText: row.aliases.join(', '),
		keywordsText: (tags.keywords ?? []).join(', '),
		sourceType: tags.sourceType ?? '',
		aviationTopic: tags.aviationTopic ?? [],
		flightRules: tags.flightRules ?? '',
		knowledgeKind: tags.knowledgeKind ?? '',
		phaseOfFlight: tags.phaseOfFlight ?? [],
		certApplicability: tags.certApplicability ?? [],
		relatedText: row.related.join(', '),
		citationsJson: JSON.stringify(row.sources, null, 2),
		author: row.author ?? '',
		reviewedAt: row.reviewedAt ?? '',
	};
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const row = await getReference(event.params.id);
	if (!row) throw error(404, `reference '${event.params.id}' not found`);
	return {
		reference: {
			id: row.id,
			rev: row.rev,
			displayName: row.displayName,
			dirty: row.dirty,
			deletedAt: row.deletedAt?.toISOString() ?? null,
			updatedAt: row.updatedAt.toISOString(),
			updatedBy: row.updatedBy,
		},
		initial: rowToInitial(row),
	};
};

export const actions: Actions = {
	save: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const initial = formDataToInitial(form);
		const revRaw = form.get('rev');
		const rev = typeof revRaw === 'string' ? Number.parseInt(revRaw, 10) : Number.NaN;
		if (!Number.isFinite(rev) || rev < 1) {
			return fail(400, {
				initial,
				fieldErrors: {},
				formError: 'missing or invalid rev',
				conflict: null,
			});
		}

		// Force the URL id -- the input is readonly client-side but verify.
		form.set('id', event.params.id);
		const result = validateReferenceForm(form);
		if (!result.ok) {
			return fail(400, {
				initial: { ...initial, id: event.params.id },
				fieldErrors: result.errors.fieldErrors,
				formError: result.errors.formError,
				conflict: null,
			});
		}

		try {
			await updateReference({ ...result.input, rev }, user.id);
		} catch (err) {
			if (err instanceof RevConflictError) {
				return fail(409, {
					initial: { ...initial, id: event.params.id },
					fieldErrors: {},
					formError: `Another user saved this reference (now at rev ${err.currentRev}). Reload to see their changes.`,
					conflict: { currentRev: err.currentRev },
				});
			}
			if (err instanceof NotFoundError) {
				return fail(404, {
					initial: { ...initial, id: event.params.id },
					fieldErrors: {},
					formError: err.message,
					conflict: null,
				});
			}
			log.error(
				'updateReference failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, {
				initial: { ...initial, id: event.params.id },
				fieldErrors: {},
				formError: 'Save failed. Please try again.',
				conflict: null,
			});
		}

		redirect(303, ROUTES.HANGAR_GLOSSARY_DETAIL(event.params.id));
	},

	delete: async (event) => {
		const user = requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
		const form = await event.request.formData();
		const revRaw = form.get('rev');
		const rev = typeof revRaw === 'string' ? Number.parseInt(revRaw, 10) : Number.NaN;
		if (!Number.isFinite(rev) || rev < 1) {
			return fail(400, { formError: 'missing or invalid rev' });
		}

		try {
			await softDeleteReference({ id: event.params.id, rev }, user.id);
		} catch (err) {
			if (err instanceof RevConflictError) {
				return fail(409, {
					formError: `Another user saved this reference (now at rev ${err.currentRev}). Reload before deleting.`,
				});
			}
			if (err instanceof NotFoundError) {
				return fail(404, { formError: err.message });
			}
			log.error(
				'softDeleteReference failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { formError: 'Delete failed. Please try again.' });
		}

		redirect(303, ROUTES.HANGAR_GLOSSARY);
	},
};
