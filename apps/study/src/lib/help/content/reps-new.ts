/**
 * Reps new help page.
 *
 * Documents the /reps/new scenario-authoring form: required fields,
 * option constraints, teaching point, and how to pick a good scenario
 * subject.
 */

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const repsNew: HelpPage = {
	id: 'reps-new',
	title: 'Author a new scenario',
	summary:
		'How to write a good decision rep: field-by-field, the 2-5 option rule, and what a useful teaching point looks like.',
	documents: ROUTES.REPS_NEW,
	tags: {
		appSurface: [APP_SURFACES.REPS],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['reps', 'authoring', 'new', 'scenario', 'form', 'options', 'teaching-point'],
	},
	related: ['reps', 'reps-browse', 'reps-session'],
	reviewedAt: '2026-04-24',
	sections: [
		{
			id: 'what-makes-a-good-scenario',
			title: 'What makes a good scenario',
			body: `A decision rep is a micro-decision: one situation, one call, one teaching point.

:::tip
Pick a moment from a real flight (yours or one you read about) where the right call was not obvious at the time. The friction is the learning.
:::

Good subjects:

- A go / no-go call at a specific point in a specific flight
- A divert decision with two realistic airports
- A "you notice X while doing Y" workload-management moment
- A regulation call where a reasonable pilot could pick the wrong answer

Weak subjects:

- Fact recall ("what is the VFR cloud clearance for Class E below 10,000?") - those are cards, not reps
- Obvious-correct-answer scenarios - four wrong options and one right one means you are writing a card with extra steps
- Multi-part questions - reps are one decision, not a chain`,
		},
		{
			id: 'required-fields',
			title: 'Required fields',
			body: `| Field           | Constraint                                          | Notes                                                      |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| Title           | 1-200 chars                                         | Short enough to scan in a list                             |
| Situation       | 1-10,000 chars                                      | 2-3 sentences of context, pilot-voice                      |
| Domain          | One of the 14 domains                               | Drives filtering and session slices                        |
| Difficulty      | Beginner / Intermediate / Advanced                  | Author-declared; rep selection respects this               |
| Options         | 2-5 entries, exactly one correct                    | Each option needs text and an outcome                      |
| Teaching point  | 1-5,000 chars                                       | The "why" that makes this rep worth attempting             |

Phase of flight, reg references, and source type are optional but useful for filter coverage.`,
		},
		{
			id: 'options',
			title: 'Writing the options',
			body: `Every option has three parts:

- **Text.** What the pilot does or decides.
- **Correct?** One option must be marked correct. The radio enforces this.
- **Outcome.** What happens if the pilot picks this option. Shown on reveal.
- **Why not.** Optional but valuable. On wrong options, explains the trap.

:::example
Engine rough at 800 AGL after takeoff.

- Option A (wrong): Turn back to the runway. Outcome: stalled base turn, off-airport forced landing. Why not: 800 AGL is below the impossible-turn altitude for most light singles.
- Option B (correct): Land straight ahead or slightly off-heading. Outcome: controlled off-airport landing, airframe survivable.
- Option C (wrong): Restart the engine. Outcome: distracted from flying the airplane, stall. Why not: at 800 AGL with a rough engine, aviate first.
:::

:::warn
The "correct" option is randomised by the session shuffle, so do not put A as the correct answer pattern-wise. The app handles positional cues, but you writing "obviously A, always A" is a giveaway in the text itself.
:::`,
		},
		{
			id: 'teaching-point',
			title: 'The teaching point',
			body: `The teaching point is what the rep exists to teach. Three rules:

1. One concept, not five. If you find yourself writing "and also...", split it into two scenarios.
2. Regulation-free if possible. Reps test judgment; cards test recall. If the teaching point reduces to "14 CFR 91.X says...", it is a card.
3. Cite the source when the call is doctrinal. AIM chapter, POH page, FAA handbook section - not so you can test memorisation, but so the learner can read deeper if they want.

:::note
The teaching point renders on reveal, below the option outcomes. Keep it tight; this is not the place for a full explainer. Link to the glossary or a knowledge node for depth.
:::`,
		},
		{
			id: 'submit-flow',
			title: 'What happens on submit',
			body: `On successful validation the form creates the scenario, redirects to \`/reps/browse?created=<id>\`, and renders a success banner with the new scenario highlighted.

If validation fails, the form redraws with your values preserved and per-field errors shown. The most common failures:

- Option count out of range (need 2-5)
- No option marked correct (or two marked correct - the radio prevents this visually)
- Empty teaching point
- Title or situation over the length cap

:::tip
Scenarios start in Active status by default. To hold one back for editing, switch status to Draft on the next edit pass - drafts do not enter session selection.
:::`,
		},
	],
};
