/**
 * Notes follow-ups help page.
 *
 * Explains the follow-up affordance on a note: it's an optional intent
 * capture, not a task manager. The follow-ups inbox at
 * `/notes?view=follow-ups` lists open follow-ups grouped by created
 * month, with a per-month "mark all done" action.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const notesFollowupsIndex: HelpPageIndex = {
	id: 'notes-followups',
	title: 'Notes -- follow-ups',
	summary: 'Optional intent capture on a note. The inbox view groups them by created month.',
	tags: {
		appSurface: [APP_SURFACES.PLANS],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['notes', 'follow-up', 'inbox', 'reminder', 'intent'],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'inbox', title: 'Follow-ups inbox' },
		{ id: 'mark-done', title: 'Marking done' },
		{ id: 'not-a-task-manager', title: 'Why this is not a task manager' },
	],
	searchHaystack:
		"optional intent capture on a note. the inbox view groups them by created month. a follow-up is the optional second body on a note: a short markdown blurb that says 'come back to this'. it does not have a due date, a project, or assignees -- only a body and a 'done' timestamp. follow-ups are the answer to 'i want to remember to look at this later' without inventing a task system.\n\nthe inbox lives at /notes?view=follow-ups. it lists every note with a non-empty follow-up that has not been marked done and is not archived, ordered newest first and grouped by the month the note was created. each group has a 'mark all in this month done' affordance for cleanup.\n\nclick 'mark done' on a single note to flip the done timestamp without losing the follow-up text. clearing a follow-up empties the body and the done timestamp atomically.\n\nfollow-ups intentionally lack the surface area of a task manager. no due dates, no priorities, no project boards, no assignees. the absence is the feature -- if a follow-up needs that scaffolding, it is a goal or a course step, not a note follow-up. notes follow-up inbox reminder intent",
	documents: '/notes?view=follow-ups',
	related: ['goals', 'memory-dashboard'],
	reviewedAt: '2026-05-11',
};
