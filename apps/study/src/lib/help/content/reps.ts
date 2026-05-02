/**
 * Reps landing help page.
 *
 * Documents the /reps index surface: the Decision Reps dashboard with
 * scenario counts, accuracy breakdown, and the three entry points
 * (Browse, New scenario, Start session).
 *
 * Complements the existing `reps-session` page (in-session flow) and
 * `session-start` page (session preview decoder) by explaining what the
 * landing page is for and how the stats connect to the rest of the app.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const repsIndex: HelpPageIndex = {
	id: 'reps',
	title: 'Decision Reps',
	summary: 'What the reps landing page shows: scenario counts, accuracy by domain, and the three entry points.',
	tags: {
		appSurface: [APP_SURFACES.REPS],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['reps', 'decision', 'scenario', 'landing', 'dashboard', 'accuracy'],
	},
	sections: [
		{ id: 'what-the-page-is', title: 'What the reps landing is' },
		{ id: 'entry-points', title: 'The three entry points' },
		{ id: 'stat-tiles', title: 'The stat tiles' },
		{ id: 'domain-breakdown', title: 'Accuracy by domain' },
		{ id: 'empty-state', title: 'When the library is empty' },
	],
	searchHaystack:
		'what the reps landing page shows: scenario counts, accuracy by domain, and the three entry points. the `/reps` page is the dashboard for decision reps: short "read a situation, pick a call, see what happens" scenarios that train pilot judgment rather than recall.\n\n:::note\na **rep** is one scenario attempt. a **scenario** is an authored prompt with 2-5 options, one correct, plus teaching points. scenarios are reusable; reps are the attempts you make against them.\n:::\n\nthe page answers three questions at a glance:\n\n1. how many scenarios exist in the library?\n2. how accurate have you been lately?\n3. where does accuracy drop off by domain?\n\nthe top row is actions (browse, new scenario, start session). the stat tiles are snapshots. the domain breakdown is the drill-in. the header row has three actions, each linking to a different flow:\n\n| action          | route                 | use when                                                                 |\n| --------------- | --------------------- | ------------------------------------------------------------------------ |\n| browse          | `/reps/browse`      | you want to read, filter, or edit the scenario library                   |\n| new scenario    | `/reps/new`         | you want to author a new rep                                             |\n| start session   | `/session/start`    | you want to do reps now (part of a mixed session with cards and nodes)   |\n\n:::tip\nstart session is the common path. browse is for authoring or reviewing the catalog. new scenario is for when you want to add reps to the library.\n:::\n\nstart session routes through the unified session pipeline (see [your session preview](/help/session-start)). there is no reps-only session anymore; reps are mixed into the active plan\'s session slices alongside cards and knowledge-graph starts. four tiles summarise your standing:\n\n- **available.** total scenarios in the library that match the current filters (currently: all authored reps). links to the session pipeline when there are any.\n- **unattempted.** scenarios you have not tried yet. links to `/reps/browse` so you can see which ones.\n- **today.** reps attempted today across all sessions.\n- **accuracy (30d).** correct-over-attempted across the last thirty days. links to [calibration](/help/calibration) when you have attempts, because rep accuracy feeds the calibration score alongside card confidence.\n\n:::note\na zero in today does not mean you did no learning - memory reviews and knowledge-node starts are tracked separately. today counts only rep attempts.\n::: below the tiles, each domain with attempts in the last 30 days appears as a horizontal bar: percent correct, correct-over-attempted, and a coloured fill.\n\nuse this to spot uneven practice. weather at 92% and procedures at 54% says: do more procedure reps, and when you do, read the teaching points carefully. green across the board says: push into harder material (difficulty filter on browse) or expand into a domain that is not yet represented.\n\nthe breakdown is strictly rep accuracy. card accuracy (fsrs again/hard/good/easy) and knowledge-node mastery both live on [the dashboard](/help/dashboard). on a fresh account or before any reps have been authored, the page shows an empty state inviting you to write your first scenario.\n\n:::example\nfirst rep: pick a situation from a recent flight, write 2-3 sentences of context, give 2-5 options with one correct, and name the teaching point in a sentence. sixty seconds of authoring gets you a rep you will face again later, shuffled into your next session.\n:::\n\nonce at least one scenario exists, start session becomes enabled. until then it is disabled with a tooltip explaining why. reps decision scenario landing dashboard accuracy',
	documents: '/reps',
	related: ['reps-session', 'session-start', 'calibration', 'getting-started'],
	reviewedAt: '2026-04-24',
};
