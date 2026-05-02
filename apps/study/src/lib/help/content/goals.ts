/**
 * Goals help page.
 *
 * Covers the goal-composer surface (ADR 016 phase 9): /goals index,
 * /goals/new create, /goals/[id] read-and-edit detail. Explains the
 * primary-goal semantics and the lifecycle states.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const goalsIndex: HelpPageIndex = {
	id: 'goals',
	title: 'Goals',
	summary: 'Compose what you are pursuing -- a goal mixes syllabi and ad-hoc nodes; one goal can be primary.',
	tags: {
		appSurface: [APP_SURFACES.PLANS],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['goal', 'composer', 'syllabus', 'primary', 'lifecycle', 'archive'],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'composition', title: 'Composing a goal' },
		{ id: 'primary', title: 'Primary goal' },
		{ id: 'lifecycle', title: 'Lifecycle' },
	],
	searchHaystack:
		"compose what you are pursuing -- a goal mixes syllabi and ad-hoc nodes; one goal can be primary. a goal is the learner's union -- syllabi (e.g. ppl acs) plus ad-hoc knowledge nodes you care about. the cert dashboard reads your *primary* goal and uses it to default-filter the credentials index.\n\nthree surfaces:\n\n- `/goals` -- index, grouped by status, primary pinned at the top.\n- `/goals/new` -- create a goal (title, notes, target date, optional primary).\n- `/goals/[id]` -- detail; `?edit=1` switches to edit mode. on the detail page, add syllabi and nodes from the inline pickers below each list:\n\n- **syllabus picker** offers every active credential's primary syllabus you have not already added.\n- **node picker** offers up to 25 not-yet-added nodes, ordered by domain. (scaling to a filterable modal is a follow-on.)\n\neach row carries a weight in [0, 10] you can edit inline. default weight is 1.0. only one goal can be primary at a time. setting a goal primary atomically clears the flag on whichever goal currently holds it. other surfaces (cert dashboard, weakness lens, the engine's future cutover) read `getprimarygoal` and default-filter to its scope.\n\na goal does not have to be primary to use it; primary is a *default-filter* signal, not an exclusivity flag. four statuses:\n\n- **active** -- in pursuit. the engine targets the primary active goal.\n- **paused** -- not actively pursued, retained for a future restart.\n- **completed** -- reached. archived state.\n- **abandoned** -- archived state via the archive button. use pause if you might come back.\n\nbuttons on the detail page handle every transition. the archive button moves a goal to *abandoned*; pause / resume / mark-complete handle the rest. goal composer syllabus primary lifecycle archive",
	documents: '/goals',
	related: ['credentials', 'knowledge-graph', 'getting-started'],
	reviewedAt: '2026-04-28',
};
