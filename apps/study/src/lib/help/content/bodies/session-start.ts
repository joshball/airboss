/**
 * Body markdown for help page `session-start`.
 *
 * Hand-edit this file -- the body is the source of truth. Run
 * `bun scripts/help/split-content.ts` to re-sync the matching index
 * file (precomputed search haystack) after editing a body.
 */

import type { HelpPageBody } from '@ab/help';

export const sessionStartBody: HelpPageBody = {
	id: 'session-start',
	sections: [
		{
			id: 'what-you-see',
			title: 'What you see',
			body: `The session preview is a transparent window into what the engine thinks you should do next. Every item in the queue is tagged with a **slice**, a **kind**, and a **reason code** so you can tell at a glance *why* each item is there and decide whether to run the session as-is or shuffle.

:::tip
Hover any \`?\` icon on \`/session/start\` for a short definition. Click it to pin the popover, or press Enter while focused to open it from the keyboard. "Learn more" jumps you back to the relevant section of this page or the matching concept page.
:::

Nothing ends up in the queue by accident. If a row looks wrong, its reason code is the starting place for debugging. Every reason code is defined below along with the slice it belongs to and the condition that triggers it.`,
		},
		{
			id: 'slices',
			title: 'Slices',
			body: `Each session is built from four **slices**: Continue, Strengthen, Expand, and Diversify. Your current mode (Mixed, Continue, Strengthen, Expand, Diversify) assigns a weight to each slice and the engine fills slots in that ratio.

| Slice       | In one sentence                                                                                                     | When it fires                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Continue    | Pick up where you left off: cards due in a domain you just touched, or nodes you started but didn't finish.         | You studied recently and there's more to do in that same domain.                               |
| Strengthen  | Fix things the engine thinks are slipping: relearning cards, overdue cards, recently-missed reps, mastery dropouts. | FSRS flags a card, your rep accuracy in a domain drops, or a previously-mastered node regresses. |
| Expand      | Move the frontier forward: unstarted core nodes whose prerequisites are met, focus-domain matches.                  | You're ready for new material and have set cert goals or a focus domain.                       |
| Diversify   | Rotate into domains you've been ignoring so the queue doesn't collapse into a single topic.                         | You haven't touched a domain in several sessions, or a node applies knowledge cross-domain.    |

For the full rationale behind each slice and a deeper walkthrough of the triggers, read [[Session slices::concept-session-slices]].`,
		},
		{
			id: 'kinds',
			title: 'Kinds',
			body: `Every preview row is one of three **kinds**: Card, Rep, or Node. The kind determines both the experience and the ID link.

| Kind     | What it is                                                                                                             | Click the ID to...                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Card     | A flashcard scheduled by FSRS. You reveal the answer and rate Again/Hard/Good/Easy.                                    | Open the card detail page: front, back, state, recent reviews.                 |
| Rep      | A decision-rep scenario. You read the situation, pick an option, see the outcome and teaching point.                   | Open the scenario detail page: prompt, last-5 accuracy, start-attempt button.  |
| Node     | A [[knowledge-graph::concept-knowledge-graph]] node you haven't started yet. Launches the 7-phase guided learn flow.   | Open the knowledge-node detail page, with every phase readable.                |

Cards run through [[Memory review::memory-review]]; reps run through [[the rep session::reps-session]]; nodes run through guided learn.`,
		},
		{
			id: 'reason-codes',
			title: 'Reason codes',
			body: `Every queue row carries a **reason code** that names the specific signal the engine used to include it. 13 codes, split across the four slices:

| Label | Slice | Why it fires |
| ----- | ----- | ------------ |
| Due in recent domain | Continue where you left off | This card is coming due and happens to be in a domain you just touched. Good overlap between the scheduler and your current focus. |
| Recent domain | Continue where you left off | This item lives in a domain you studied in your last session or two. Continuing there builds momentum in that topic. |
| Unfinished node | Continue where you left off | You started learning this knowledge node recently but did not finish all seven phases. Continuing closes the loop. |
| Low rep accuracy | Strengthen | Your accuracy on reps in this domain has dropped below the threshold. Targeted practice here restores judgment before deeper work. |
| Mastery dropping | Strengthen | This node crossed back from mastered to not-mastered because the dual-gate (card stability and rep accuracy) slipped. It needs reinforcement. |
| Overdue | Strengthen | This card passed its FSRS due date more than the grace period ago. Each day overdue erodes the stability estimate, so the sooner the better. |
| Rated Again recently | Strengthen | You rated this Again within the last few sessions. Surfacing it now catches the memory before it collapses further. |
| Recent sim weakness | Strengthen | You have been grading low on a sim scenario that exercises this knowledge. Surfacing the card now ties the study queue back to your recent flight evidence. |
| Recent sim weakness | Strengthen | A sim scenario tied to this rep has been grading low recently. The rep is here so the judgment behind the maneuver gets practised before the next flight. |
| Relearning | Strengthen | FSRS marked this card as relearning after a recent Again rating. It needs a few short-interval reviews before it stabilises again. |
| Core topic, unstarted | Expand | This is a core topic for your cert goals and you have not started it yet. Core knowledge is non-negotiable; this makes the queue. |
| Matches focus | Expand | This node matches the focus domain you set for this session. You asked for more of this; you are getting more of this. |
| Prerequisites met | Expand | All the prerequisite knowledge nodes for this one are mastered. You are ready to learn it. |
| Cross-domain application | Diversify | This node applies knowledge you already have from another domain. Cross-domain connections are how real pilot judgment forms. |
| Unused domain | Diversify | You have not touched this domain in several sessions. Rotating through it prevents the schedule from collapsing into a single topic. |

Reason codes are stable API: the set above is the full authoritative list. If you see one of these chips on a row, you can predict why the row is there without opening anything.`,
		},
		{
			id: 'priorities',
			title: 'Study priority',
			body: `Knowledge nodes are tagged with a **study priority** that says where to spend study time. Every node a learner sees is already on the ACS/PTS for their cert -- "must-know" is the regulatory default. Priority answers a different question: *if you only have 30 minutes today, what's the highest-leverage thing to drill?* Priorities flow through reason-code selection (e.g., \`expand_unstarted_priority\` surfaces \`critical\` first) and through tiebreakers when multiple slices compete for the same slot.

| Priority   | Meaning                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Safety-of-flight or examiner-favorite. Surfaces in Expand even when you haven't set a focus.                                            |
| Standard | Everything else on the ACS/PTS for the cert. Queued as capacity allows once critical topics are in flight.                              |
| Stretch  | Useful adjacent knowledge below the floor or beyond strict ACS scope. Won't surface unless you explicitly focus on the domain.          |

A preview row labelled "Critical topic, unstarted" is a Priority: Critical node the engine wants you to begin on; the Expand slice is how it gets there.`,
		},
		{
			id: 'domains',
			title: 'Domains',
			body: `Every card, scenario, and knowledge node is tagged with exactly one **domain**. Domains are the unit of rotation for Diversify and the unit of focus for plan configuration.

- **Regulations** (\`regulations\`)
- **Weather** (\`weather\`)
- **Airspace** (\`airspace\`)
- **Glass Cockpits** (\`glass-cockpits\`)
- **IFR Procedures** (\`ifr-procedures\`)
- **VFR Operations** (\`vfr-operations\`)
- **Aerodynamics** (\`aerodynamics\`)
- **Teaching Methodology** (\`teaching-methodology\`)
- **ADM / Human Factors** (\`adm-human-factors\`)
- **Safety / Accident Analysis** (\`safety-accident-analysis\`)
- **Aircraft Systems** (\`aircraft-systems\`)
- **Flight Planning** (\`flight-planning\`)
- **Emergency Procedures** (\`emergency-procedures\`)
- **FAA Practical Standards** (\`faa-practical-standards\`)

The "Unused domain" reason chip means you haven't touched the named domain in enough recent sessions that the Diversify slice wants to rotate it back in. The "Recent domain" reason means the opposite: you *did* touch it, and Continue is picking up where you left off.`,
		},
		{
			id: 'modes-and-weights',
			title: 'Modes and weights',
			body: `**Mode** is the top-level dial that shapes a session. Pick one from the dropdown above the preview. Each mode assigns a weight to every slice; the engine multiplies those weights by the session length and uses largest-remainder rounding to allocate slots.

| Mode | Continue where you left off | Strengthen | Expand | Diversify |
| ---- | --- | --- | --- | --- |
| Continue where I left off | 0.70 | 0.20 | 0.00 | 0.10 |
| Hit my weak spots | 0.10 | 0.70 | 0.00 | 0.20 |
| Mixed (default) | 0.30 | 0.30 | 0.20 | 0.20 |
| Try something new | 0.10 | 0.10 | 0.70 | 0.10 |

All rows sum to 1.00 exactly. "Mixed" is the default balanced mode; "Continue" is the best pick when you're returning mid-topic and want to build momentum; "Strengthen" is the pick after a rough stretch where accuracy is low. If a slice pool is under-supplied (e.g., no Expand candidates because every core node is already started), the engine redistributes those slots to adjacent slices rather than shipping short. The "Short: N items" banner tells you when redistribution couldn't make up the difference.`,
		},
	],
};
