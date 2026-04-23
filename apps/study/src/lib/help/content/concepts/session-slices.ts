/**
 * Concept: Session slices.
 *
 * Continue / Strengthen / Expand / Diversify -- the four buckets that
 * make up every airboss session. This page's section ids match the
 * InfoTip anchors on /session/start.
 */

import { APP_SURFACES, CONCEPT_GROUPS, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const conceptSessionSlices: HelpPage = {
	id: 'concept-session-slices',
	title: 'Session slices',
	summary:
		'Every airboss session is a mix from four slices: Continue, Strengthen, Expand, Diversify. Here is what each one does.',
	tags: {
		appSurface: [APP_SURFACES.SESSION],
		helpKind: HELP_KINDS.CONCEPT,
		conceptGroup: CONCEPT_GROUPS.AIRBOSS_ARCHITECTURE,
		keywords: ['session', 'slice', 'continue', 'strengthen', 'expand', 'diversify', 'reason code', 'priority'],
	},
	concept: true,
	related: ['concept-interleaving', 'concept-knowledge-graph', 'concept-fsrs'],
	reviewedAt: '2026-04-23',
	sections: [
		{
			id: 'overview',
			title: 'The four slices',
			body: `Every session the engine assembles pulls from four slices. Each slice has a different question it answers, a different priority order, and its own set of reason codes explaining _why_ a particular item landed in it.

| Slice       | Question                                                | Typical count per 30-item session |
| ----------- | ------------------------------------------------------- | --------------------------------- |
| Continue    | What did I touch last session that is worth continuing? | 6-10                              |
| Strengthen  | What am I losing?                                       | 10-14                             |
| Expand      | What should I learn next?                               | 4-8                               |
| Diversify   | What have I ignored?                                    | 2-4                               |

The exact weights depend on your current mode (daily drill, cram, review, exam prep). Modes shift the mix; the slices themselves are stable. See also [[interleaving::concept-interleaving]] for why sessions intentionally mix across slices rather than running them in sequence.`,
		},
		{
			id: 'continue',
			title: 'Continue',
			body: `**Question: what did I touch last session that is worth continuing?**

Continue preserves momentum. If you spent last session's Strengthen on weather cards, the engine pulls forward the cards/reps from that domain that are coming due, so you're not whiplashed between domains across sessions.

:::note
Reason codes in this slice:

| Code                         | Why the item is here                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| continue_recent_domain       | This item is in a domain you studied in your last session or two.        |
| continue_due_in_domain       | This item is due and happens to be in a recently-touched domain.         |
| continue_in_progress_topic   | You have an in-progress teach-node in this topic; the item supports it.  |
:::`,
		},
		{
			id: 'strengthen',
			title: 'Strengthen',
			body: `**Question: what am I losing?**

Strengthen is the biggest slice. It's pure [[FSRS::concept-fsrs]]: items the scheduler predicts are dropping in retrievability. This is where due reviews show up.

:::note
Reason codes:

| Code                         | Why the item is here                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| strengthen_due               | Standard due-today card.                                                 |
| strengthen_relearning        | Card is in relearning state after recent Again rating. High priority.    |
| strengthen_low_stability     | FSRS stability is low; item is fragile even if not due today.            |
| strengthen_recent_miss       | Rep scenario you got wrong recently; re-surface to confirm recovery.     |
:::

:::tip
Relearning cards always rank first in Strengthen. The scheduler's prediction is that a missed card becomes trustworthy again only after a few short-interval hits.
:::`,
		},
		{
			id: 'expand',
			title: 'Expand',
			body: `**Question: what should I learn next?**

Expand pulls new material -- cards in domains you're already working in, but that you haven't seen yet, and teach nodes whose prerequisites are now mature. It's bounded: too much expand per session dilutes the strengthen signal.

:::note
Reason codes:

| Code                         | Why the item is here                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| expand_new_card_in_domain    | New card in a domain you already study.                                  |
| expand_teach_node_ready      | Teach node unlocked because prerequisites reached mature stability.      |
| expand_recommended_next      | Next node in a curriculum path you're following.                         |
:::

:::warn
Expand is capped because learning new material while due reviews pile up is how you end up buried. The engine refuses to expand when Strengthen is above a threshold count.
:::`,
		},
		{
			id: 'diversify',
			title: 'Diversify',
			body: `**Question: what have I been ignoring?**

Diversify is the "wildcard slot." It surfaces items from domains you haven't touched in weeks, or teach nodes flagged as cold. Small count per session by design -- one or two items is enough to keep breadth alive without drowning focus.

:::note
Reason codes:

| Code                         | Why the item is here                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| diversify_unused_domain      | You haven't touched this domain in 14+ days.                             |
| diversify_coverage_gap       | This domain has fewer items started than peer domains.                   |
| diversify_anniversary        | It has been exactly 30 / 90 / 365 days since you saw this item. Sample. |
:::

> Diversify is the reason a commercial-pilot student who has spent three weeks on IFR sees one weather card today. Without it, sessions would funnel narrower over time and you'd walk into the checkride oral strong in one area and blank in another.`,
		},
		{
			id: 'priorities',
			title: 'Priorities',
			body: `Within a slice, items rank by priority. airboss uses three priority tiers, surfaced on preview rows.

| Priority        | Meaning                                                       | Example                                                                   |
| --------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Core**        | Must-know for the target certificate / rating / proficiency.  | Engine-failure response for commercial-pilot training.                    |
| **Supporting** | Adjacent knowledge that makes core material stick.            | Understanding NOTAM structure well enough to find what you need.          |
| **Elective**   | Useful but not required for the current goal.                 | History of the airway system; differences between FAA and ICAO phraseology. |

Within the same slice, core beats supporting beats elective. Across slices, Strengthen's core items beat Expand's core items by default (because forgetting is the bigger risk than not-yet-learning).`,
		},
	],
	externalRefs: [
		{
			title: 'Interleaving (Wikipedia)',
			url: 'https://en.wikipedia.org/wiki/Interleaved_practice',
			source: 'wikipedia',
			note: 'The cross-domain evidence base behind mixing slices within a session.',
		},
		{
			title: 'Bjork Learning and Forgetting Lab',
			url: 'https://bjorklab.psych.ucla.edu/research/',
			source: 'other',
			note: 'Research on retrieval-practice, spacing, and interleaving -- the three effects the slice mix operationalizes.',
		},
	],
};
