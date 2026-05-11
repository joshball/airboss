/**
 * `/notes/new` -- standalone note creator (wp-notes-primitive Phase 1).
 *
 * The form action calls `createNote` and redirects to `/notes/[id]`. The
 * loader populates the context-picker dropdowns with the user's owned
 * goals + active courses + the references registry. Section / knowledge /
 * syllabus axes default to empty -- those scopes are populated by the
 * surface-launched composer (Phase 2 wires "+ Note from goal", etc.) so
 * the standalone creator stays light.
 *
 * Phase 2 extension: `?goalId=`, `?courseId=`, `?knowledgeNodeId=`,
 * `?referenceId=`, `?referenceSectionId=`, `?syllabusNodeId=` query
 * params seed the form. Invalid ids are silently dropped (user-scoped
 * axes -- goal / course -- are validated against the signed-in user;
 * unscoped axes pass through and the BC zod schema rejects malformed
 * values at submit time).
 */

import { requireAuth } from '@ab/auth';
import {
	createNote,
	createNoteInputSchema,
	GoalNotFoundError,
	GoalNotOwnedError,
	getCourseById,
	getOwnedGoal,
	listCoursesForReader,
	listGoals,
	listReferences,
} from '@ab/bc-study/server';
import { COURSE_STATUSES, GOAL_STATUSES, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import type { NoteContextOptions } from '@ab/ui/components/notes/note-context-types';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export interface NewNoteSeed {
	referenceId: string | null;
	referenceSectionId: string | null;
	knowledgeNodeId: string | null;
	courseId: string | null;
	goalId: string | null;
	syllabusNodeId: string | null;
}

export interface NewNotePageData {
	contextOptions: NoteContextOptions;
	seed: NewNoteSeed;
}

function readOptionalId(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);

	const [goals, courses, references] = await Promise.all([
		listGoals(user.id, { status: GOAL_STATUSES.ACTIVE }),
		listCoursesForReader(db, { statusIn: [COURSE_STATUSES.ACTIVE] }),
		listReferences({}),
	]);

	const contextOptions: NoteContextOptions = {
		goals: goals.map((g) => ({ id: g.id, label: g.title })),
		courses: courses.map((c) => ({ id: c.id, label: c.title })),
		references: references.map((r) => ({ id: r.id, label: r.title })),
		// Section / knowledge node / syllabus axes are not pre-populated for the
		// standalone creator. Phase 2 surface-launched composers seed those via
		// pre-fill query params, and the dependent reader-WP wires a richer
		// section picker. The picker renders "No <kind> yet" when the axis is
		// absent, so the form remains usable.
	};

	const url = event.url;
	const seed: NewNoteSeed = {
		referenceId: readOptionalId(url.searchParams.get(QUERY_PARAMS.NOTE_REFERENCE_ID)),
		referenceSectionId: readOptionalId(url.searchParams.get(QUERY_PARAMS.NOTE_REFERENCE_SECTION_ID)),
		knowledgeNodeId: readOptionalId(url.searchParams.get(QUERY_PARAMS.NOTE_KNOWLEDGE_NODE_ID)),
		courseId: readOptionalId(url.searchParams.get(QUERY_PARAMS.NOTE_COURSE_ID)),
		goalId: readOptionalId(url.searchParams.get(QUERY_PARAMS.NOTE_GOAL_ID)),
		syllabusNodeId: readOptionalId(url.searchParams.get(QUERY_PARAMS.NOTE_SYLLABUS_NODE_ID)),
	};

	// Best-effort validation of the pre-fill axes that are user-scoped: if the
	// caller hands us a goalId or courseId that the signed-in user doesn't own
	// or that doesn't exist, drop it silently rather than confusing the
	// composer with a stale value. Reference / section / knowledge / syllabus
	// scopes are not user-owned, so we leave them as-is and let `createNote`
	// validate at submit time.
	if (seed.goalId !== null) {
		try {
			await getOwnedGoal(seed.goalId, user.id);
		} catch (err) {
			if (err instanceof GoalNotFoundError || err instanceof GoalNotOwnedError) {
				seed.goalId = null;
			} else {
				throw err;
			}
		}
	}
	if (seed.courseId !== null) {
		const course = await getCourseById(seed.courseId);
		if (course === null || course.status !== COURSE_STATUSES.ACTIVE) {
			seed.courseId = null;
		}
	}

	return {
		contextOptions,
		seed,
	} satisfies NewNotePageData;
};

function readString(form: FormData, key: string): string {
	const raw = form.get(key);
	if (raw === null) return '';
	return String(raw);
}

function readNullableId(form: FormData, key: string): string | null {
	const raw = form.get(key);
	if (raw === null) return null;
	const value = String(raw).trim();
	return value === '' ? null : value;
}

function readTags(form: FormData): string[] {
	const all = form.getAll('tags[]');
	const out: string[] = [];
	for (const v of all) {
		const s = String(v).trim();
		if (s.length > 0) out.push(s);
	}
	return out;
}

export const actions: Actions = {
	default: async (event) => {
		const user = requireAuth(event);
		const form = await event.request.formData();

		const input = {
			bodyMd: readString(form, 'bodyMd'),
			title: readString(form, 'title'),
			quotedExcerpt: readString(form, 'quotedExcerpt'),
			referenceId: readNullableId(form, 'referenceId'),
			referenceSectionId: readNullableId(form, 'referenceSectionId'),
			knowledgeNodeId: readNullableId(form, 'knowledgeNodeId'),
			courseId: readNullableId(form, 'courseId'),
			goalId: readNullableId(form, 'goalId'),
			syllabusNodeId: readNullableId(form, 'syllabusNodeId'),
			tags: readTags(form),
			followUpMd: readString(form, 'followUpMd'),
		};

		const parsed = createNoteInputSchema.safeParse(input);
		if (!parsed.success) {
			const fieldErrors: Record<string, string> = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path.join('.') || '_';
				if (!fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			return fail(400, { values: input, fieldErrors });
		}

		const created = await createNote(user.id, parsed.data);
		throw redirect(303, ROUTES.NOTE_DETAIL(created.id));
	},
} satisfies Actions;
