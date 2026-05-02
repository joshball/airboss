/**
 * Body markdown for help page `goals`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const goalsBody: HelpPageBody = {
	id: 'goals',
	sections: [
		{
			id: 'overview',
			title: 'Overview',
			body: `A goal is the learner's union -- syllabi (e.g. PPL ACS) plus ad-hoc knowledge nodes you care about. The cert dashboard reads your *primary* goal and uses it to default-filter the credentials index.

Three surfaces:

- \`/goals\` -- index, grouped by status, primary pinned at the top.
- \`/goals/new\` -- create a goal (title, notes, target date, optional primary).
- \`/goals/[id]\` -- detail; \`?edit=1\` switches to edit mode.`,
		},
		{
			id: 'composition',
			title: 'Composing a goal',
			body: `On the detail page, add syllabi and nodes from the inline pickers below each list:

- **Syllabus picker** offers every active credential's primary syllabus you have not already added.
- **Node picker** offers up to 25 not-yet-added nodes, ordered by domain. (Scaling to a filterable modal is a follow-on.)

Each row carries a weight in [0, 10] you can edit inline. Default weight is 1.0.`,
		},
		{
			id: 'primary',
			title: 'Primary goal',
			body: `Only one goal can be primary at a time. Setting a goal primary atomically clears the flag on whichever goal currently holds it. Other surfaces (cert dashboard, weakness lens, the engine's future cutover) read \`getPrimaryGoal\` and default-filter to its scope.

A goal does not have to be primary to use it; primary is a *default-filter* signal, not an exclusivity flag.`,
		},
		{
			id: 'lifecycle',
			title: 'Lifecycle',
			body: `Four statuses:

- **Active** -- in pursuit. The engine targets the primary active goal.
- **Paused** -- not actively pursued, retained for a future restart.
- **Completed** -- reached. Archived state.
- **Abandoned** -- archived state via the Archive button. Use Pause if you might come back.

Buttons on the detail page handle every transition. The Archive button moves a goal to *abandoned*; pause / resume / mark-complete handle the rest.`,
		},
	],
};
