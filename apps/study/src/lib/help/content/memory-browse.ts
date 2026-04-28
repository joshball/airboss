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

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const memoryBrowse: HelpPage = {
	id: 'memory-browse',
	title: 'Memory browse',
	summary:
		'What the browse view is for, the four filters (Domain / Type / Source / Status), and the status lifecycle that decides whether a card is schedulable.',
	documents: ROUTES.MEMORY_BROWSE,
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
	related: ['memory-dashboard', 'memory-new', 'memory-card', 'memory-review', 'concept-fsrs'],
	reviewedAt: '2026-04-24',
	sections: [
		{
			id: 'browse-vs-review',
			title: 'What browse shows vs review',
			body: `Browse and review answer two different questions.

- **[Review](/help/memory-review)** (\`/memory/review\`) shows the cards the FSRS scheduler has queued for right now: due, one at a time, rate-as-you-go. It ignores everything that isn't due.
- **Browse** (\`/memory/browse\`) shows the full card library -- every card you own, regardless of due date, state, or status. It exists for finding, editing, and inspecting cards, not for running through them.

Use browse to audit the deck (coverage gaps, duplicates, misfiled cards), to jump to a specific card's detail page, or to filter down to a subset and act on it. Use review to actually do your daily reps.`,
		},
		{
			id: 'filters',
			title: 'Filters',
			body: `Four filters narrow the list. They compose: every active filter ANDs with the others.

| Filter  | Values                                                       | What it's for                                                               |
| ------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Domain  | Weather, Regs, Procedures, Aerodynamics, Systems, ...        | Narrow to one topic. See [[domain::memory-new]] for why domain matters.     |
| Type    | Basic (more coming)                                          | Narrow by card shape. Today every card is Basic; see [[type::memory-new]].  |
| Source  | Personal, Course                                             | Narrow to cards you authored vs cards ported from course content.           |
| Status  | Active, Suspended, Archived                                  | Narrow by lifecycle state. See [Status lifecycle](#status-lifecycle) below. |

The filter bar preserves selections in the URL, so a filtered view is shareable and survives reload. Clearing a filter broadens the list; clearing all filters returns the full deck.`,
		},
		{
			id: 'status-lifecycle',
			title: 'Status lifecycle',
			body: `Every card is in one of three lifecycle states. The status controls whether the card is schedulable, not whether it's visible.

:::note
**Active** cards are in the scheduler. They appear in the review queue when due; their FSRS state evolves with every rating. This is the default for every newly authored card.

**Suspended** cards are held back temporarily. They keep their FSRS state (stability, difficulty, due date) but the scheduler skips them. Suspend a card when you know the answer is wrong or outdated and you plan to fix it soon. Reactivating resumes scheduling without resetting memory state.

**Archived** cards are retired. They're excluded from the scheduler, from dashboard counts, and from most filters by default. Archive a card when you no longer want to study it but don't want to delete it. Archived cards can be reactivated if you change your mind.
:::

Suspend and Archive do not delete. They're reversible from the [card detail page](/help/memory-card#lifecycle). Prefer either to deleting a card outright; deleted cards lose their review history and can't come back.`,
		},
		{
			id: 'badges',
			title: 'Per-card badges',
			body: `Each row in the browse list carries the same set of badges you see on the [card detail page](/help/memory-card): Domain, Type, Status, and Source. They're a quick visual audit of the deck without having to click into each card.

- **Domain** -- the topic bucket the card belongs to. See [[domain::memory-new]].
- **Type** -- Basic (the only type today). See [[type::memory-new]].
- **Status** -- Active, Suspended, or Archived. See [Status lifecycle](#status-lifecycle) above.
- **Source** -- Personal (you authored it) or Course (ported from course content; read-only in most cases). See [Source](/help/memory-card#source).

Scan the badges on a filtered list to spot outliers: one Course card in a sea of Personal, one Suspended card you forgot to fix, a Domain you didn't mean to file the card under.`,
		},
	],
};
