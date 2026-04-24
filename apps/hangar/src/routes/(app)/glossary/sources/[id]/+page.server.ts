import { requireRole } from '@ab/auth';
import { ROLES, ROUTES } from '@ab/constants';
import { createLogger } from '@ab/utils';
import { error, fail, redirect } from '@sveltejs/kit';
import { getSource, NotFoundError, RevConflictError, softDeleteSource, updateSource } from '$lib/server/registry';
import { sourceFormDataToInitial, validateSourceForm } from '$lib/server/source-form';
import type { SourceFormInitial } from '$lib/server/source-form-types';
import type { Actions, PageServerLoad } from './$types';

const log = createLogger('hangar:sources-detail');

function rowToInitial(row: {
	id: string;
	type: string;
	title: string;
	version: string;
	url: string;
	path: string;
	format: string;
	checksum: string;
	downloadedAt: string;
	sizeBytes: number | null;
	locatorShape: Record<string, unknown> | null;
}): SourceFormInitial {
	return {
		id: row.id,
		type: row.type,
		title: row.title,
		version: row.version,
		url: row.url,
		path: row.path,
		format: row.format,
		checksum: row.checksum,
		downloadedAt: row.downloadedAt,
		sizeBytes: row.sizeBytes == null ? '' : String(row.sizeBytes),
		locatorShapeJson: JSON.stringify(row.locatorShape ?? {}, null, 2),
	};
}

export const load: PageServerLoad = async (event) => {
	requireRole(event, ROLES.AUTHOR, ROLES.OPERATOR, ROLES.ADMIN);
	const row = await getSource(event.params.id);
	if (!row) throw error(404, `source '${event.params.id}' not found`);
	return {
		source: {
			id: row.id,
			rev: row.rev,
			title: row.title,
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
		const initial = sourceFormDataToInitial(form);
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

		form.set('id', event.params.id);
		const result = validateSourceForm(form);
		if (!result.ok) {
			return fail(400, {
				initial: { ...initial, id: event.params.id },
				fieldErrors: result.errors.fieldErrors,
				formError: result.errors.formError,
				conflict: null,
			});
		}

		try {
			await updateSource({ ...result.input, locatorShape: result.locatorShape, rev }, user.id);
		} catch (err) {
			if (err instanceof RevConflictError) {
				return fail(409, {
					initial: { ...initial, id: event.params.id },
					fieldErrors: {},
					formError: `Another user saved this source (now at rev ${err.currentRev}). Reload to see their changes.`,
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
				'updateSource failed',
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

		redirect(303, ROUTES.HANGAR_GLOSSARY_SOURCES_DETAIL(event.params.id));
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
			await softDeleteSource({ id: event.params.id, rev }, user.id);
		} catch (err) {
			if (err instanceof RevConflictError) {
				return fail(409, {
					formError: `Another user saved this source (now at rev ${err.currentRev}). Reload before deleting.`,
				});
			}
			if (err instanceof NotFoundError) {
				return fail(404, { formError: err.message });
			}
			log.error(
				'softDeleteSource failed',
				{ requestId: event.locals.requestId, userId: user.id },
				err instanceof Error ? err : undefined,
			);
			return fail(500, { formError: 'Delete failed. Please try again.' });
		}

		redirect(303, ROUTES.HANGAR_GLOSSARY_SOURCES);
	},
};
