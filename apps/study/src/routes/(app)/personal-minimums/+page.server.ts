/**
 * `/personal-minimums` -- reader + editor surface for the personal-minimums
 * typed primitive (personal-minimums-as-typed-contract WP).
 *
 * The loader reads the active record + the latest 5 revisions. The `save`
 * action validates the form against `personalMinimumsInputSchema` and
 * writes a new revision via the BC; `deactivate` retracts the active
 * record. A concurrent-edit race surfaces as a 409.
 *
 * Form-based v1: the entire form opens, the entire form saves. Per
 * design.md the page-level form is deliberate -- personal minimums are an
 * infrequent, considered decision, not a quick-edit modal.
 *
 * Phase D wires the "implications" subpanel into this loader.
 */

import { requireAuth } from '@ab/auth';
import {
	createPersonalMinimumsRevision,
	deactivatePersonalMinimums,
	getActivePersonalMinimums,
	getPersonalMinimumsHistory,
	type PersonalMinimums,
	PersonalMinimumsConflictError,
} from '@ab/bc-study/server';
import { QUERY_PARAMS } from '@ab/constants';
import { personalMinimumsInputSchema } from '@ab/types';
import { renderMarkdown } from '@ab/utils';
import { fail, redirect } from '@sveltejs/kit';
import { computeImplications, type ImplicationsResult } from './_lib/implications.server';
import type { Actions, PageServerLoad } from './$types';

/** Number of recent revisions shown inline on the main page. */
const HISTORY_PREVIEW_LIMIT = 5;

export interface PersonalMinimumsPageData {
	active: PersonalMinimums | null;
	/** Active record's notes rendered to sanitized HTML, or null. */
	activeNotesHtml: string | null;
	history: PersonalMinimums[];
	/**
	 * Whether the edit form is the surface. True when `?edit=1` is set, or
	 * (implicitly) when there is no active record -- the empty state IS the
	 * form. Edit / Cancel toggle the query param; the loader echoes it so
	 * the read / edit flip needs no client-side action round-trip.
	 */
	editing: boolean;
	/**
	 * Implications of the active minimums against the wx-engine scenarios.
	 * `null` when there is no active record -- the subpanel renders a
	 * "set your minimums" placeholder rather than running comparisons
	 * against values the pilot has not agreed to.
	 */
	implications: ImplicationsResult | null;
}

export const load: PageServerLoad = async (event): Promise<PersonalMinimumsPageData> => {
	const user = requireAuth(event);
	const [active, history] = await Promise.all([
		getActivePersonalMinimums(user.id),
		getPersonalMinimumsHistory(user.id),
	]);
	const editing = active === null || event.url.searchParams.get(QUERY_PARAMS.EDIT) === '1';
	const implications = active === null ? null : await computeImplications(active);
	return {
		active,
		activeNotesHtml: active?.notes ? renderMarkdown(active.notes) : null,
		history: history.slice(0, HISTORY_PREVIEW_LIMIT),
		editing,
		implications,
	};
};

/** Read a required numeric form field; NaN when absent or unparseable. */
function readNumber(form: FormData, key: string): number {
	const raw = form.get(key);
	if (raw === null) return Number.NaN;
	return Number(String(raw).trim());
}

export const actions: Actions = {
	save: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();
		const notesRaw = form.get('notes');
		const notes = notesRaw === null ? null : String(notesRaw);

		const input = {
			ceilingFt: readNumber(form, 'ceilingFt'),
			visibilitySm: readNumber(form, 'visibilitySm'),
			windTotalKt: readNumber(form, 'windTotalKt'),
			crosswindTotalKt: readNumber(form, 'crosswindTotalKt'),
			nightRequiredRecencyLandings: readNumber(form, 'nightRequiredRecencyLandings'),
			imcRequiredRecencyApproaches: readNumber(form, 'imcRequiredRecencyApproaches'),
			paxMax: readNumber(form, 'paxMax'),
			terrainBufferAgl: readNumber(form, 'terrainBufferAgl'),
			notes: notes !== null && notes.trim().length === 0 ? null : notes,
		};

		const parsed = personalMinimumsInputSchema.safeParse(input);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.') || '_';
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			return fail(400, { values: input, fieldErrors });
		}

		try {
			await createPersonalMinimumsRevision(user.id, parsed.data);
		} catch (err) {
			if (err instanceof PersonalMinimumsConflictError) {
				return fail(409, { values: input, conflict: true });
			}
			throw err;
		}
		throw redirect(303, `${event.url.pathname}?saved=1`);
	},

	deactivate: async (event) => {
		const user = requireAuth(event);
		await deactivatePersonalMinimums(user.id);
		throw redirect(303, `${event.url.pathname}?deactivated=1`);
	},
} satisfies Actions;
