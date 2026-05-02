/**
 * Body markdown for help page `reps`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const repsBody: HelpPageBody = {
	id: 'reps',
	sections: [
		{
			id: 'what-the-page-is',
			title: 'What the reps landing is',
			body: `The \`/reps\` page is the dashboard for decision reps: short "read a situation, pick a call, see what happens" scenarios that train pilot judgment rather than recall.

:::note
A **rep** is one scenario attempt. A **scenario** is an authored prompt with 2-5 options, one correct, plus teaching points. Scenarios are reusable; reps are the attempts you make against them.
:::

The page answers three questions at a glance:

1. How many scenarios exist in the library?
2. How accurate have you been lately?
3. Where does accuracy drop off by domain?

The top row is actions (Browse, New scenario, Start session). The stat tiles are snapshots. The domain breakdown is the drill-in.`,
		},
		{
			id: 'entry-points',
			title: 'The three entry points',
			body: `The header row has three actions, each linking to a different flow:

| Action          | Route                 | Use when                                                                 |
| --------------- | --------------------- | ------------------------------------------------------------------------ |
| Browse          | \`/reps/browse\`      | You want to read, filter, or edit the scenario library                   |
| New scenario    | \`/reps/new\`         | You want to author a new rep                                             |
| Start session   | \`/session/start\`    | You want to do reps now (part of a mixed session with cards and nodes)   |

:::tip
Start session is the common path. Browse is for authoring or reviewing the catalog. New scenario is for when you want to add reps to the library.
:::

Start session routes through the unified session pipeline (see [Your session preview](/help/session-start)). There is no reps-only session anymore; reps are mixed into the active plan's session slices alongside cards and knowledge-graph starts.`,
		},
		{
			id: 'stat-tiles',
			title: 'The stat tiles',
			body: `Four tiles summarise your standing:

- **Available.** Total scenarios in the library that match the current filters (currently: all authored reps). Links to the session pipeline when there are any.
- **Unattempted.** Scenarios you have not tried yet. Links to \`/reps/browse\` so you can see which ones.
- **Today.** Reps attempted today across all sessions.
- **Accuracy (30d).** Correct-over-attempted across the last thirty days. Links to [Calibration](/help/calibration) when you have attempts, because rep accuracy feeds the calibration score alongside card confidence.

:::note
A zero in Today does not mean you did no learning - memory reviews and knowledge-node starts are tracked separately. Today counts only rep attempts.
:::`,
		},
		{
			id: 'domain-breakdown',
			title: 'Accuracy by domain',
			body: `Below the tiles, each domain with attempts in the last 30 days appears as a horizontal bar: percent correct, correct-over-attempted, and a coloured fill.

Use this to spot uneven practice. Weather at 92% and Procedures at 54% says: do more procedure reps, and when you do, read the teaching points carefully. Green across the board says: push into harder material (difficulty filter on Browse) or expand into a domain that is not yet represented.

The breakdown is strictly rep accuracy. Card accuracy (FSRS Again/Hard/Good/Easy) and knowledge-node mastery both live on [the dashboard](/help/dashboard).`,
		},
		{
			id: 'empty-state',
			title: 'When the library is empty',
			body: `On a fresh account or before any reps have been authored, the page shows an empty state inviting you to write your first scenario.

:::example
First rep: pick a situation from a recent flight, write 2-3 sentences of context, give 2-5 options with one correct, and name the teaching point in a sentence. Sixty seconds of authoring gets you a rep you will face again later, shuffled into your next session.
:::

Once at least one scenario exists, Start session becomes enabled. Until then it is disabled with a tooltip explaining why.`,
		},
	],
};
