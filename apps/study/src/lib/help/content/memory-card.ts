/**
 * Memory card detail help page.
 *
 * Wave 2a of the help-system fix pass
 * (docs/work/handoffs/20260424-help-system-fix-pass.md). Covers the
 * `/memory/[id]` detail surface: badges (domain, type, lifecycle,
 * source) and the schedule stats block (state, due, stability,
 * difficulty, reviews, lapses).
 *
 * Section ids are anchor targets for the upcoming InfoTip placement
 * pass; keep them stable. The placement spec points InfoTips at
 * `memory-card#domain`, `#type`, `#lifecycle`, `#source`, and the
 * per-stat anchors below.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const memoryCardIndex: HelpPageIndex = {
	id: 'memory-card',
	title: 'Memory card detail',
	summary:
		'What every badge and stat on the card detail page means: domain, type, lifecycle, source, and the FSRS schedule numbers.',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'memory',
			'card',
			'domain',
			'type',
			'lifecycle',
			'source',
			'state',
			'stability',
			'difficulty',
			'lapses',
			'suspend',
			'archive',
		],
	},
	sections: [
		{ id: 'overview', title: 'Overview' },
		{ id: 'domain', title: 'Domain' },
		{ id: 'type', title: 'Type' },
		{ id: 'lifecycle', title: 'Lifecycle' },
		{ id: 'source', title: 'Source' },
		{ id: 'schedule-stats', title: 'Schedule stats' },
		{ id: 'state', title: 'State' },
		{ id: 'due', title: 'Due' },
		{ id: 'stability', title: 'Stability' },
		{ id: 'difficulty', title: 'Difficulty' },
		{ id: 'reviews', title: 'Reviews' },
		{ id: 'lapses', title: 'Lapses' },
	],
	searchHaystack:
		"what every badge and stat on the card detail page means: domain, type, lifecycle, source, and the fsrs schedule numbers. the card detail page shows one card's content, its lifecycle state, and the scheduler's current model of your memory for it. badges along the top (domain, type, status, source) answer _what kind of card is this?_ the schedule stats block further down answers _when does the scheduler plan to show it again, and why?_\n\nmost users never open this page: the review queue handles scheduling invisibly. open a card when you need to fix its content, suspend it, archive it, or understand why the scheduler keeps bringing it back. the domain badge is the topic bucket this card belongs to (weather, regs, procedures, aerodynamics, systems, etc.). it drives filtering on the [browse page](/help/memory-browse), per-domain metrics on the [dashboard](/help/memory-dashboard), and session mix when a plan weights domains differently.\n\nsee domain classification for the authoring-side view -- how to pick the right domain when you write a card, and why the choice is not decorative. the type badge identifies the card's rendering and rating shape. today every card is **basic**: a front (cue), a back (answer), four fsrs ratings after reveal.\n\ncloze, image-occlusion, and typed-answer types are on the roadmap but not shipped. see type selector on the new-card page for the full list and for why you should split awkward cards into two basic cards rather than wait for a better type. every card is in one of three lifecycle states. the detail page shows the current state as a badge and exposes the buttons that move between states.\n\n| state      | in the scheduler? | visible on dashboard counts? | buttons available                    |\n| ---------- | ----------------- | ---------------------------- | ------------------------------------ |\n| active     | yes               | yes                          | suspend, archive                     |\n| suspended  | no (held back)    | no (scheduler skips it)      | reactivate, archive                  |\n| archived   | no (retired)      | no                           | reactivate                           |\n\n**suspend** holds the card back temporarily. fsrs state (stability, difficulty, due date) is preserved; the scheduler just skips this card until you reactivate. use suspend when you spot a wrong or outdated answer and plan to fix it.\n\n**archive** retires the card. it's excluded from counts and the scheduler, but not deleted. archive cards you've outgrown or deprecated; reactivate if you change your mind.\n\n**reactivate** puts a suspended or archived card back in the active state. for suspended cards the scheduler resumes from where it left off (no memory-state reset). for archived cards the same -- archiving doesn't erase fsrs history.\n\n:::tip\nprefer suspend or archive to deleting. deletion drops the card and its entire review history, which means you lose the scheduler's model and can't recover it.\n::: the source badge marks where the card came from.\n\n- **personal** cards are cards you authored in [the new-card flow](/help/memory-new). you own them; you can edit everything.\n- **course** cards are ported from course content (a module's canonical question bank, a knowledge-graph node's built-in cards, etc.). they track a source of truth outside your deck. most course cards are read-only -- the front and back shouldn't drift from the course text -- but you can still suspend, archive, and review them like any active card.\n\nthe distinction matters on the [browse page](/help/memory-browse): filter by source to separate \"cards i wrote\" from \"cards the platform gave me.\" it also matters when a course updates -- course cards can pull corrected content; personal cards never change under you. the schedule block shows the scheduler's current model of your memory for this card. six numbers, each with its own anchor below.\n\nsee [fsrs overview](/help/concept-fsrs) for the full model; the per-stat anchors below cover the one-line definitions. the card's fsrs state: new, learning, review, or relearning. see [fsrs states](/help/concept-fsrs#states) for the full definitions and transitions.\n\nthe short version: new = never reviewed; learning = in the initial short-interval loop; review = graduated and on long-interval spaced repetition; relearning = lapsed from review and back in a short-interval recovery loop. the next scheduled review date. if it's in the past, the card is in today's queue. if it's in the future, the card is not due yet and the scheduler will skip it in `/memory/review` until then.\n\nthe due date is derived from stability and the target retention rate (default 90%). see how fsrs picks intervals for the mechanism. how long, in days, it takes for your predicted recall of this card to decay to the target retention rate. grows when you recall correctly at the right interval; collapses when you rate again.\n\na card's stability is the single best summary of _how well you actually know it_. see [stability and mastery](/help/concept-fsrs#stability-and-mastery) for the mastery threshold and what \"mastered\" means on this card. how hard this card is _for you_ specifically, on a 1-10 scale. rises when you rate again; drifts back toward your long-run average with good.\n\nhigh difficulty means the scheduler brings the card back frequently even when you're getting it right -- the model thinks you're close to the edge of forgetting. see stability vs difficulty for why these two variables measure different things. the total number of times you've rated this card across all ratings (again / hard / good / easy). a rough indicator of how much history the scheduler has to work with: a card with 2 reviews has a loose model; a card with 30 reviews has a tight one. the number of times you've rated this card again after it was in review state (i.e., it had graduated and you forgot it). each lapse drops the card back into relearning and collapses stability.\n\na high lapse count on a card usually means the card is too broad. see minimum-information -- consider splitting it into two narrower cards rather than pounding the same wide card to memorization. memory card domain type lifecycle source state stability difficulty lapses suspend archive",
	documents: '/memory/[id]',
	related: ['memory-dashboard', 'memory-browse', 'memory-new', 'memory-review', 'concept-fsrs', 'concept-spaced-rep'],
	reviewedAt: '2026-04-24',
};
