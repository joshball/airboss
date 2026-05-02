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
import type { HelpPageIndex } from '@ab/help';

export const memoryNewIndex: HelpPageIndex = {
	id: 'memory-new',
	title: 'New memory card',
	summary:
		'How to author a memory card that spaced repetition can actually work with: one fact, tight front, tight back, the right domain and tags.',
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
	sections: [
		{ id: 'minimum-information', title: 'Minimum-information principle' },
		{ id: 'front-back', title: 'Front and back' },
		{ id: 'domain', title: 'Domain' },
		{ id: 'type', title: 'Type' },
		{ id: 'tags', title: 'Tags' },
		{ id: 'save-and-add-another', title: 'Save and add another' },
	],
	searchHaystack:
		'how to author a memory card that spaced repetition can actually work with: one fact, tight front, tight back, the right domain and tags. write cards small. one fact per card. a card that asks _two_ things can\'t be rated honestly: you got one right and one wrong, so what was it, good or again? neither is true, and the scheduler learns a lie.\n\n:::tip\nif the back of a card has a comma, an "and," or a numbered list longer than three items, split it. two narrow cards always beat one wide card. you\'ll review them faster, rate them more accurately, and the scheduler will converge on the right interval for each.\n:::\n\nthe classic formulation is piotr wozniak\'s "make it as simple as possible, but no simpler." in practice that means: one concept, one relationship, one fact. a regulation\'s number on the front, the meaning on the back. a procedure\'s trigger on the front, the response on the back. not "everything about vfr weather minimums" on one card. the front is the cue. the back is the answer. the cue has to be specific enough that the answer is unambiguous.\n\n**front guidance:**\n\n- pose a question, not a topic. "what is vr?" beats "vr" as a front.\n- include enough context that you can\'t answer two different ways. "what\'s the minimum visibility for vfr at night in class g below 1,200 agl?" is a good front. "vfr visibility?" is not.\n- avoid pronouns that point at the back. if the front contains "it," the back usually has to repeat itself.\n\n**back guidance:**\n\n- shortest true answer. not a paragraph.\n- if the answer has a number and a unit, include both. "3 statute miles," not "3."\n- don\'t cheat the front by putting the question context on the back. the back is the answer only.\n\nactive recall is the mechanism that makes cards work; a card that doesn\'t force recall is just a re-reading exercise. tight fronts + tight backs maximize the recall signal. every card belongs to one domain (weather, regs, procedures, aerodynamics, systems, etc.). the domain is not decorative: it drives three things.\n\n1. **filtering.** the [browse page](/help/memory-browse) and the dashboard state groupings let you narrow to a single domain, which is how you study a single area without distraction.\n2. **session mix.** plans and sessions can weight domains differently. misfiling a weather card as regs means your weather sessions miss it.\n3. **weak-area detection.** the dashboard weak areas panel computes per-domain accuracy. if a card is misfiled, its misses land in the wrong column.\n\npick the domain the card\'s _back_ is about, not the front. a card whose front is a metar and whose back is a class-g visibility rule is a regs card, not a weather card. the type selector picks the rendering and rating shape of the card. today the only type is **basic**: a front (cue), a back (answer), reveal the back, rate against the four fsrs ratings (again / hard / good / easy).\n\nfuture types may include cloze deletion (fill-in-the-blank), image-occlusion (hide-a-region on a diagram), and typed-answer (cheap typo-tolerant string match). they aren\'t shipped yet; every card in the system today is basic.\n\nif a card doesn\'t fit basic cleanly, that\'s usually a signal to split it into two basic cards rather than wait for the type that fits. see [minimum-information principle](#minimum-information) above. tags are free-text labels you attach to a card. unlike domain, tags are optional, multi-valued, and user-defined. use them for any grouping the fixed domain list doesn\'t cover: cross-cuts ("checkride-prep"), personal emphasis ("weak-spot"), source tracking ("gleim-ch4"), or scenario linkage.\n\ntags power filtering on the [browse page](/help/memory-browse) and show up as badges on [card detail pages](/help/memory-card). they don\'t feed the scheduler or any metric; they\'re there so you can find your own cards.\n\n:::note\ntags are not synonyms for domain. a single-domain card can have many tags; a card with no tags is fine. use them when they earn their keep and ignore them when they don\'t.\n::: the "save and add another" button saves the current card and resets the form for the next one, with domain and tags carried forward. the front and back fields clear; the type stays on basic.\n\nthis is the right button when you\'re authoring a batch of cards for the same topic. set domain and tags once, then fire cards at it without re-selecting the same dropdowns for each. the "save" button alone saves and returns to the deck; pick it for the last card in a batch.\n\nbatch-authoring cards in a single sitting (10-20 at a time, all same domain) is faster and produces more consistent card quality than drip-feeding one card every few days. memory new create author card front back domain type tags minimum-information',
	documents: '/memory/new',
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
};
