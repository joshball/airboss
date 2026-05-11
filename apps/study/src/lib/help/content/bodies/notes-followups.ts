/**
 * Body markdown for help page `notes-followups`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const notesFollowupsBody: HelpPageBody = {
	id: 'notes-followups',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `A **follow-up** is the optional second body on a note: a short markdown blurb that says "come back to this." It does not have a due date, a project, or assignees -- only a body and a *done* timestamp. Follow-ups are the answer to "I want to remember to look at this later" without inventing a task system.

Add a follow-up at note creation or edit time -- the field is optional and most notes won't carry one.`,
		},
		{
			id: 'inbox',
			title: 'Follow-ups inbox',
			body: `The inbox lives at \`/notes?view=follow-ups\`. It lists every note with a non-empty follow-up that has not been marked done and is not archived, ordered newest first.

Notes are grouped by the month the note was created (e.g. "May 2026"). Each group has a "Mark all in this month done" affordance that flips the done timestamp on every open follow-up in that month -- useful for sweeping out a stale stack without opening each one.`,
		},
		{
			id: 'mark-done',
			title: 'Marking done',
			body: `Click **Mark done** on a single note to flip the done timestamp without losing the follow-up text. The follow-up body sticks around so you can still see what you intended.

**Clear follow-up** empties the body and the done timestamp atomically -- use this when the follow-up turned out to be wrong or irrelevant.`,
		},
		{
			id: 'not-a-task-manager',
			title: 'Why this is not a task manager',
			body: `Follow-ups intentionally lack the surface area of a task manager. No due dates, no priorities, no project boards, no assignees. The absence is the feature -- if a follow-up needs that scaffolding, it is a goal or a course step, not a note follow-up.

This keeps the cognitive cost of capturing one near zero: a thought, a quick "remind me," and you move on. The inbox is the lazy garbage collector.`,
		},
	],
};
