/**
 * New memory card help page.
 *
 * Wave 2a of the help-system fix pass
 * (docs/work/handoffs/20260424-help-system-fix-pass.md). Covers the
 * `/memory/new` authoring surface: minimum-information principle, front
 * and back guidance, domain classification, type selector, tags, and the
 * "save and add another" affordance.
 *
 * Section ids double as anchor targets the upcoming placement pass will
 * link to from per-field InfoTips.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const memoryNew: HelpPage = {
	id: 'memory-new',
	title: 'New memory card',
	summary:
		'How to author a memory card that spaced repetition can actually work with: one fact, tight front, tight back, the right domain and tags.',
	documents: '/memory/new',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.HOW_TO,
		keywords: [
			'memory',
			'new',
			'create',
			'author',
			'card',
			'front',
			'back',
			'domain',
			'type',
			'tags',
			'minimum-information',
		],
	},
	related: [
		'memory-dashboard',
		'memory-browse',
		'memory-card',
		'memory-review',
		'concept-fsrs',
		'concept-spaced-rep',
		'concept-active-recall',
	],
	reviewedAt: '2026-04-24',
	sections: [
		{
			id: 'minimum-information',
			title: 'Minimum-information principle',
			body: `Write cards small. One fact per card. A card that asks _two_ things can't be rated honestly: you got one right and one wrong, so what was it, Good or Again? Neither is true, and the scheduler learns a lie.

:::tip
If the back of a card has a comma, an "and," or a numbered list longer than three items, split it. Two narrow cards always beat one wide card. You'll review them faster, rate them more accurately, and the scheduler will converge on the right interval for each.
:::

The classic formulation is Piotr Wozniak's "make it as simple as possible, but no simpler." In practice that means: one concept, one relationship, one fact. A regulation's number on the front, the meaning on the back. A procedure's trigger on the front, the response on the back. Not "everything about VFR weather minimums" on one card.`,
		},
		{
			id: 'front-back',
			title: 'Front and back',
			body: `The front is the cue. The back is the answer. The cue has to be specific enough that the answer is unambiguous.

**Front guidance:**

- Pose a question, not a topic. "What is VR?" beats "VR" as a front.
- Include enough context that you can't answer two different ways. "What's the minimum visibility for VFR at night in Class G below 1,200 AGL?" is a good front. "VFR visibility?" is not.
- Avoid pronouns that point at the back. If the front contains "it," the back usually has to repeat itself.

**Back guidance:**

- Shortest true answer. Not a paragraph.
- If the answer has a number and a unit, include both. "3 statute miles," not "3."
- Don't cheat the front by putting the question context on the back. The back is the answer only.

[[Active recall::concept-active-recall]] is the mechanism that makes cards work; a card that doesn't force recall is just a re-reading exercise. Tight fronts + tight backs maximize the recall signal.`,
		},
		{
			id: 'domain',
			title: 'Domain',
			body: `Every card belongs to one domain (Weather, Regs, Procedures, Aerodynamics, Systems, etc.). The domain is not decorative: it drives three things.

1. **Filtering.** The [browse page](/help/memory-browse) and the dashboard state groupings let you narrow to a single domain, which is how you study a single area without distraction.
2. **Session mix.** Plans and sessions can weight domains differently. Misfiling a Weather card as Regs means your Weather sessions miss it.
3. **Weak-area detection.** The dashboard Weak Areas panel computes per-domain accuracy. If a card is misfiled, its misses land in the wrong column.

Pick the domain the card's _back_ is about, not the front. A card whose front is a METAR and whose back is a Class-G visibility rule is a Regs card, not a Weather card.`,
		},
		{
			id: 'type',
			title: 'Type',
			body: `The Type selector picks the rendering and rating shape of the card. Today the only type is **Basic**: a front (cue), a back (answer), reveal the back, rate against the four FSRS ratings (Again / Hard / Good / Easy).

Future types may include cloze deletion (fill-in-the-blank), image-occlusion (hide-a-region on a diagram), and typed-answer (cheap typo-tolerant string match). They aren't shipped yet; every card in the system today is Basic.

If a card doesn't fit Basic cleanly, that's usually a signal to split it into two Basic cards rather than wait for the type that fits. See [Minimum-information principle](#minimum-information) above.`,
		},
		{
			id: 'tags',
			title: 'Tags',
			body: `Tags are free-text labels you attach to a card. Unlike domain, tags are optional, multi-valued, and user-defined. Use them for any grouping the fixed domain list doesn't cover: cross-cuts ("checkride-prep"), personal emphasis ("weak-spot"), source tracking ("gleim-ch4"), or scenario linkage.

Tags power filtering on the [browse page](/help/memory-browse) and show up as badges on [card detail pages](/help/memory-card). They don't feed the scheduler or any metric; they're there so you can find your own cards.

:::note
Tags are not synonyms for domain. A single-domain card can have many tags; a card with no tags is fine. Use them when they earn their keep and ignore them when they don't.
:::`,
		},
		{
			id: 'save-and-add-another',
			title: 'Save and add another',
			body: `The "Save and add another" button saves the current card and resets the form for the next one, with domain and tags carried forward. The front and back fields clear; the type stays on Basic.

This is the right button when you're authoring a batch of cards for the same topic. Set domain and tags once, then fire cards at it without re-selecting the same dropdowns for each. The "Save" button alone saves and returns to the deck; pick it for the last card in a batch.

Batch-authoring cards in a single sitting (10-20 at a time, all same domain) is faster and produces more consistent card quality than drip-feeding one card every few days.`,
		},
	],
};
