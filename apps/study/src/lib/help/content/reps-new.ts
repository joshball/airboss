/**
 * Reps new help page.
 *
 * Documents the /reps/new scenario-authoring form: required fields,
 * option constraints, teaching point, and how to pick a good scenario
 * subject.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const repsNewIndex: HelpPageIndex = {
	id: 'reps-new',
	title: 'Author a new scenario',
	summary:
		'How to write a good decision rep: field-by-field, the 2-5 option rule, and what a useful teaching point looks like.',
	tags: {
		appSurface: [APP_SURFACES.REPS],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: ['reps', 'authoring', 'new', 'scenario', 'form', 'options', 'teaching-point'],
	},
	sections: [
		{ id: 'what-makes-a-good-scenario', title: 'What makes a good scenario' },
		{ id: 'required-fields', title: 'Required fields' },
		{ id: 'options', title: 'Writing the options' },
		{ id: 'teaching-point', title: 'The teaching point' },
		{ id: 'submit-flow', title: 'What happens on submit' },
	],
	searchHaystack:
		'how to write a good decision rep: field-by-field, the 2-5 option rule, and what a useful teaching point looks like. a decision rep is a micro-decision: one situation, one call, one teaching point.\n\n:::tip\npick a moment from a real flight (yours or one you read about) where the right call was not obvious at the time. the friction is the learning.\n:::\n\ngood subjects:\n\n- a go / no-go call at a specific point in a specific flight\n- a divert decision with two realistic airports\n- a "you notice x while doing y" workload-management moment\n- a regulation call where a reasonable pilot could pick the wrong answer\n\nweak subjects:\n\n- fact recall ("what is the vfr cloud clearance for class e below 10,000?") - those are cards, not reps\n- obvious-correct-answer scenarios - four wrong options and one right one means you are writing a card with extra steps\n- multi-part questions - reps are one decision, not a chain | field           | constraint                                          | notes                                                      |\n| --------------- | --------------------------------------------------- | ---------------------------------------------------------- |\n| title           | 1-200 chars                                         | short enough to scan in a list                             |\n| situation       | 1-10,000 chars                                      | 2-3 sentences of context, pilot-voice                      |\n| domain          | one of the 14 domains                               | drives filtering and session slices                        |\n| difficulty      | beginner / intermediate / advanced                  | author-declared; rep selection respects this               |\n| options         | 2-5 entries, exactly one correct                    | each option needs text and an outcome                      |\n| teaching point  | 1-5,000 chars                                       | the "why" that makes this rep worth attempting             |\n\nphase of flight, reg references, and source type are optional but useful for filter coverage. every option has three parts:\n\n- **text.** what the pilot does or decides.\n- **correct?** one option must be marked correct. the radio enforces this.\n- **outcome.** what happens if the pilot picks this option. shown on reveal.\n- **why not.** optional but valuable. on wrong options, explains the trap.\n\n:::example\nengine rough at 800 agl after takeoff.\n\n- option a (wrong): turn back to the runway. outcome: stalled base turn, off-airport forced landing. why not: 800 agl is below the impossible-turn altitude for most light singles.\n- option b (correct): land straight ahead or slightly off-heading. outcome: controlled off-airport landing, airframe survivable.\n- option c (wrong): restart the engine. outcome: distracted from flying the airplane, stall. why not: at 800 agl with a rough engine, aviate first.\n:::\n\n:::warn\nthe "correct" option is randomised by the session shuffle, so do not put a as the correct answer pattern-wise. the app handles positional cues, but you writing "obviously a, always a" is a giveaway in the text itself.\n::: the teaching point is what the rep exists to teach. three rules:\n\n1. one concept, not five. if you find yourself writing "and also...", split it into two scenarios.\n2. regulation-free if possible. reps test judgment; cards test recall. if the teaching point reduces to "14 cfr 91.x says...", it is a card.\n3. cite the source when the call is doctrinal. aim chapter, poh page, faa handbook section - not so you can test memorisation, but so the learner can read deeper if they want.\n\n:::note\nthe teaching point renders on reveal, below the option outcomes. keep it tight; this is not the place for a full explainer. link to the glossary or a knowledge node for depth.\n::: on successful validation the form creates the scenario, redirects to `/reps/browse?created=<id>`, and renders a success banner with the new scenario highlighted.\n\nif validation fails, the form redraws with your values preserved and per-field errors shown. the most common failures:\n\n- option count out of range (need 2-5)\n- no option marked correct (or two marked correct - the radio prevents this visually)\n- empty teaching point\n- title or situation over the length cap\n\n:::tip\nscenarios start in active status by default. to hold one back for editing, switch status to draft on the next edit pass - drafts do not enter session selection.\n::: reps authoring new scenario form options teaching-point',
	documents: '/reps/new',
	related: ['reps', 'reps-browse', 'reps-session'],
	reviewedAt: '2026-04-24',
};
