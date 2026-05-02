/**
 * `/library/regulations/[kind]/[group]/[section]` -- regulations leaf reader.
 *
 * Resolves the matching `study.reference` row for `kind/group`, then loads
 * the section row by code. Reuses the shared handbook-section resolver --
 * regulations live in the same `reference_section` table once their content
 * is ingested.
 *
 * Loader is a thin adapter: parse the `[kind]/[group]/[section]` slugs, call
 * the `getRegulationsView` BC aggregator, return its payload. The form
 * actions resolve the same (kind, group, section) tuple to a section id via
 * `resolveRegulationsSectionId` -- the lighter helper from the BC aggregator
 * that skips the rest of the detail-view payload.
 */

import { requireAuth } from '@ab/auth';
import { parseRegulationGroup, parseRegulationKind, parseRegulationSection } from '@ab/aviation';
import {
	getRegulationsView,
	HandbookValidationError,
	handbookReadStatusSchema,
	markAsReread,
	RegulationsViewNotFoundError,
	resolveRegulationsSectionId,
	setComprehended,
	setNotes,
	setReadStatus,
} from '@ab/bc-study';
import { HANDBOOK_NOTES_MAX_LENGTH } from '@ab/constants';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const kind = parseRegulationKind(event.params.kind);
	if (!kind) {
		throw error(404, `Unknown regulations kind: ${event.params.kind}`);
	}
	const group = parseRegulationGroup(kind, event.params.group);
	if (!group) {
		throw error(404, `Invalid group slug: ${event.params.group}`);
	}
	const parsedSection = parseRegulationSection(event.params.section);
	if (!parsedSection) {
		throw error(404, `Invalid section slug: ${event.params.section}`);
	}

	try {
		const view = await getRegulationsView({
			view: 'detail',
			kind,
			group,
			section: parsedSection,
			userId: user.id,
		});
		return {
			kind: view.kind,
			group: view.group,
			reference: view.reference,
			section: view.section,
			chapter: view.chapter,
			figures: view.figures,
			siblings: view.siblings,
			readState: view.readState,
			citingNodes: view.citingNodes,
			errata: view.errata,
		};
	} catch (err) {
		if (err instanceof RegulationsViewNotFoundError) throw error(404, err.message);
		throw err;
	}
};

export const actions: Actions = {
	'set-status': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params);
		const formData = await event.request.formData();
		const parsed = handbookReadStatusSchema.safeParse(String(formData.get('status') ?? ''));
		if (!parsed.success) return fail(400, { fieldError: 'Invalid status' });
		await setReadStatus(user.id, sectionId, parsed.data);
		return { ok: true };
	},
	'set-comprehended': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params);
		const formData = await event.request.formData();
		const comprehended = String(formData.get('comprehended') ?? '') === 'true';
		try {
			await setComprehended(user.id, sectionId, comprehended);
		} catch (err) {
			if (err instanceof HandbookValidationError) return fail(409, { fieldError: err.message });
			throw err;
		}
		return { ok: true };
	},
	'mark-reread': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params);
		try {
			await markAsReread(user.id, sectionId);
		} catch (err) {
			if (err instanceof HandbookValidationError) return fail(409, { fieldError: err.message });
			throw err;
		}
		return { ok: true };
	},
	'set-notes': async (event) => {
		const user = requireAuth(event);
		const sectionId = await resolveSectionId(event.params);
		const formData = await event.request.formData();
		const notesMd = String(formData.get('notesMd') ?? '');
		if (notesMd.length > HANDBOOK_NOTES_MAX_LENGTH) {
			return fail(400, { fieldError: `Notes exceed ${HANDBOOK_NOTES_MAX_LENGTH} characters.` });
		}
		await setNotes(user.id, sectionId, notesMd);
		return { ok: true };
	},
};

async function resolveSectionId(params: { kind: string; group: string; section: string }): Promise<string> {
	const kind = parseRegulationKind(params.kind);
	if (!kind) throw error(404, `Unknown regulations kind: ${params.kind}`);
	const group = parseRegulationGroup(kind, params.group);
	if (!group) throw error(404, `Invalid group slug: ${params.group}`);
	const parsedSection = parseRegulationSection(params.section);
	if (!parsedSection) throw error(404, `Invalid section slug: ${params.section}`);
	try {
		return await resolveRegulationsSectionId({ kind, group, section: parsedSection });
	} catch (err) {
		if (err instanceof RegulationsViewNotFoundError) throw error(404, err.message);
		throw err;
	}
}
