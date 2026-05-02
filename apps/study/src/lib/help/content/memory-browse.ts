/**
 * Memory browse help page.
 *
 * Wave 2a of the help-system fix pass
 * (docs/work/handoffs/20260424-help-system-fix-pass.md). Covers the
 * `/memory/browse` listing surface: what browse shows vs review, the
 * four filters (Domain / Type / Source / Status), the status lifecycle,
 * and the per-card badges.
 *
 * Section ids are anchor targets for the upcoming InfoTip placement pass;
 * keep them stable.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const memoryBrowseIndex: HelpPageIndex = {
	id: 'memory-browse',
	title: 'Memory browse',
	summary:
		'What the browse view is for, the four filters (Domain / Type / Source / Status), and the status lifecycle that decides whether a card is schedulable.',
	tags: {
		appSurface: [APP_SURFACES.MEMORY],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: [
			'memory',
			'browse',
			'filter',
			'domain',
			'type',
			'source',
			'status',
			'active',
			'suspended',
			'archived',
			'badges',
		],
	},
	sections: [
		{ id: 'browse-vs-review', title: 'What browse shows vs review' },
		{ id: 'filters', title: 'Filters' },
		{ id: 'status-lifecycle', title: 'Status lifecycle' },
		{ id: 'badges', title: 'Per-card badges' },
	],
	searchHaystack:
		"what the browse view is for, the four filters (domain / type / source / status), and the status lifecycle that decides whether a card is schedulable. browse and review answer two different questions.\n\n- **[review](/help/memory-review)** (`/memory/review`) shows the cards the fsrs scheduler has queued for right now: due, one at a time, rate-as-you-go. it ignores everything that isn't due.\n- **browse** (`/memory/browse`) shows the full card library -- every card you own, regardless of due date, state, or status. it exists for finding, editing, and inspecting cards, not for running through them.\n\nuse browse to audit the deck (coverage gaps, duplicates, misfiled cards), to jump to a specific card's detail page, or to filter down to a subset and act on it. use review to actually do your daily reps. four filters narrow the list. they compose: every active filter ands with the others.\n\n| filter  | values                                                       | what it's for                                                               |\n| ------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |\n| domain  | weather, regs, procedures, aerodynamics, systems, ...        | narrow to one topic. see domain for why domain matters.     |\n| type    | basic (more coming)                                          | narrow by card shape. today every card is basic; see type.  |\n| source  | personal, course                                             | narrow to cards you authored vs cards ported from course content.           |\n| status  | active, suspended, archived                                  | narrow by lifecycle state. see [status lifecycle](#status-lifecycle) below. |\n\nthe filter bar preserves selections in the url, so a filtered view is shareable and survives reload. clearing a filter broadens the list; clearing all filters returns the full deck. every card is in one of three lifecycle states. the status controls whether the card is schedulable, not whether it's visible.\n\n:::note\n**active** cards are in the scheduler. they appear in the review queue when due; their fsrs state evolves with every rating. this is the default for every newly authored card.\n\n**suspended** cards are held back temporarily. they keep their fsrs state (stability, difficulty, due date) but the scheduler skips them. suspend a card when you know the answer is wrong or outdated and you plan to fix it soon. reactivating resumes scheduling without resetting memory state.\n\n**archived** cards are retired. they're excluded from the scheduler, from dashboard counts, and from most filters by default. archive a card when you no longer want to study it but don't want to delete it. archived cards can be reactivated if you change your mind.\n:::\n\nsuspend and archive do not delete. they're reversible from the [card detail page](/help/memory-card#lifecycle). prefer either to deleting a card outright; deleted cards lose their review history and can't come back. each row in the browse list carries the same set of badges you see on the [card detail page](/help/memory-card): domain, type, status, and source. they're a quick visual audit of the deck without having to click into each card.\n\n- **domain** -- the topic bucket the card belongs to. see domain.\n- **type** -- basic (the only type today). see type.\n- **status** -- active, suspended, or archived. see [status lifecycle](#status-lifecycle) above.\n- **source** -- personal (you authored it) or course (ported from course content; read-only in most cases). see [source](/help/memory-card#source).\n\nscan the badges on a filtered list to spot outliers: one course card in a sea of personal, one suspended card you forgot to fix, a domain you didn't mean to file the card under. memory browse filter domain type source status active suspended archived badges",
	documents: '/memory/browse',
	related: ['memory-dashboard', 'memory-new', 'memory-card', 'memory-review', 'concept-fsrs'],
	reviewedAt: '2026-04-24',
};
