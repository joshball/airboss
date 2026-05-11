/**
 * `/notes/[id]` -- single-note detail surface (wp-notes-primitive Phase 1).
 *
 * Multi-action form: `update`, `archive`, `restore`, `delete`,
 * `mark-followup-done`, `clear-followup`. Edit-in-place via `?edit=1`;
 * the loader echoes back `editing` so the page can flip between read /
 * edit views without an action round-trip.
 */

import { requireAuth } from '@ab/auth';
import {
	archiveNote,
	clearFollowUp,
	deleteNote,
	getNote,
	listCoursesForReader,
	listGoals,
	listReferences,
	markFollowUpDone,
	NoFollowUpError,
	NoteNotFoundError,
	restoreNote,
	updateNote,
	updateNoteInputSchema,
} from '@ab/bc-study/server';
import { COURSE_STATUSES, GOAL_STATUSES, QUERY_PARAMS, ROUTES } from '@ab/constants';
import { db } from '@ab/db/connection';
import type { NoteContextChip, NoteContextOptions } from '@ab/ui/components/notes/note-context-types';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export interface NoteDetailPageData {
	note: {
		id: string;
		title: string;
		bodyMd: string;
		tags: string[];
		followUpMd: string;
		followUpDoneAt: Date | null;
		archivedAt: Date | null;
		quotedExcerpt: string;
		createdAt: Date;
		updatedAt: Date;
	};
	context: {
		referenceId: string | null;
		referenceSectionId: string | null;
		knowledgeNodeId: string | null;
		courseId: string | null;
		goalId: string | null;
		syllabusNodeId: string | null;
	};
	contextOptions: NoteContextOptions;
	contextChips: NoteContextChip[];
	editing: boolean;
}

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	const { id } = event.params;

	const note = await getNote(id, user.id);
	if (note === null) throw error(404, 'Note not found.');

	const editing = event.url.searchParams.get(QUERY_PARAMS.EDIT) === '1';

	// Hydrate the picker's available options + the chip strip's labels.
	// Goals + courses are user-scoped; references come from the global
	// registry; section / knowledge / syllabus dropdowns stay empty for
	// the standalone surface (richer pickers ship with the dependent
	// reader WP).
	const [goals, courses, references] = await Promise.all([
		listGoals(user.id, { status: GOAL_STATUSES.ACTIVE }),
		listCoursesForReader(db, { statusIn: [COURSE_STATUSES.ACTIVE] }),
		listReferences({ includeSuperseded: true }),
	]);

	const goalLabelById = new Map(goals.map((g) => [g.id, g.title]));
	const courseLabelById = new Map(courses.map((c) => [c.id, c.title]));
	const referenceLabelById = new Map(references.map((r) => [r.id, r.title]));

	const contextOptions: NoteContextOptions = {
		goals: goals.map((g) => ({ id: g.id, label: g.title })),
		courses: courses.map((c) => ({ id: c.id, label: c.title })),
		references: references.map((r) => ({ id: r.id, label: r.title })),
	};

	const chips: NoteContextChip[] = [];
	if (note.referenceId !== null) {
		chips.push({
			kind: 'reference',
			id: note.referenceId,
			label: referenceLabelById.get(note.referenceId) ?? note.referenceId,
		});
	}
	if (note.referenceSectionId !== null) {
		chips.push({
			kind: 'section',
			id: note.referenceSectionId,
			label: `Section ${note.referenceSectionId}`,
		});
	}
	if (note.goalId !== null) {
		chips.push({
			kind: 'goal',
			id: note.goalId,
			label: goalLabelById.get(note.goalId) ?? note.goalId,
			href: ROUTES.PROGRAM_GOAL(note.goalId),
		});
	}
	if (note.courseId !== null) {
		chips.push({
			kind: 'course',
			id: note.courseId,
			label: courseLabelById.get(note.courseId) ?? note.courseId,
		});
	}
	if (note.knowledgeNodeId !== null) {
		chips.push({
			kind: 'knowledge',
			id: note.knowledgeNodeId,
			label: note.knowledgeNodeId,
			href: ROUTES.REFERENCE_KNOWLEDGE_SLUG(note.knowledgeNodeId),
		});
	}
	if (note.syllabusNodeId !== null) {
		chips.push({
			kind: 'syllabus',
			id: note.syllabusNodeId,
			label: note.syllabusNodeId,
		});
	}

	return {
		note: {
			id: note.id,
			title: note.title,
			bodyMd: note.bodyMd,
			tags: note.tags,
			followUpMd: note.followUpMd,
			followUpDoneAt: note.followUpDoneAt,
			archivedAt: note.archivedAt,
			quotedExcerpt: note.quotedExcerpt,
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
		},
		context: {
			referenceId: note.referenceId,
			referenceSectionId: note.referenceSectionId,
			knowledgeNodeId: note.knowledgeNodeId,
			courseId: note.courseId,
			goalId: note.goalId,
			syllabusNodeId: note.syllabusNodeId,
		},
		contextOptions,
		contextChips: chips,
		editing,
	} satisfies NoteDetailPageData;
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

function fieldErrorsFromZod(err: unknown): Record<string, string> {
	if (err === null || typeof err !== 'object') return { _: 'Invalid input.' };
	const issues = (err as { issues?: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }> }).issues;
	if (!Array.isArray(issues)) return { _: 'Invalid input.' };
	const out: Record<string, string> = {};
	for (const issue of issues) {
		const key = issue.path.join('.') || '_';
		if (out[key] === undefined) out[key] = issue.message;
	}
	return out;
}

export const actions: Actions = {
	update: async (event) => {
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
		const parsed = updateNoteInputSchema.safeParse(input);
		if (!parsed.success) {
			return fail(400, { intent: 'update', fieldErrors: fieldErrorsFromZod(parsed.error) });
		}
		try {
			await updateNote(event.params.id, user.id, parsed.data);
		} catch (err) {
			if (err instanceof NoteNotFoundError) throw error(404, 'Note not found.');
			throw err;
		}
		throw redirect(303, ROUTES.NOTE_DETAIL(event.params.id));
	},

	archive: async (event) => {
		const user = requireAuth(event);
		try {
			await archiveNote(event.params.id, user.id);
		} catch (err) {
			if (err instanceof NoteNotFoundError) throw error(404, 'Note not found.');
			throw err;
		}
		return { intent: 'archive', success: true };
	},

	restore: async (event) => {
		const user = requireAuth(event);
		try {
			await restoreNote(event.params.id, user.id);
		} catch (err) {
			if (err instanceof NoteNotFoundError) throw error(404, 'Note not found.');
			throw err;
		}
		return { intent: 'restore', success: true };
	},

	delete: async (event) => {
		const user = requireAuth(event);
		try {
			await deleteNote(event.params.id, user.id);
		} catch (err) {
			if (err instanceof NoteNotFoundError) throw error(404, 'Note not found.');
			throw err;
		}
		throw redirect(303, ROUTES.NOTES);
	},

	'mark-followup-done': async (event) => {
		const user = requireAuth(event);
		try {
			await markFollowUpDone(event.params.id, user.id);
		} catch (err) {
			if (err instanceof NoteNotFoundError) throw error(404, 'Note not found.');
			if (err instanceof NoFollowUpError) {
				return fail(400, { intent: 'mark-followup-done', error: 'No follow-up to mark done.' });
			}
			throw err;
		}
		return { intent: 'mark-followup-done', success: true };
	},

	'clear-followup': async (event) => {
		const user = requireAuth(event);
		try {
			await clearFollowUp(event.params.id, user.id);
		} catch (err) {
			if (err instanceof NoteNotFoundError) throw error(404, 'Note not found.');
			throw err;
		}
		return { intent: 'clear-followup', success: true };
	},
} satisfies Actions;
