/**
 * Reps browse help page.
 *
 * Documents the /reps/browse scenario catalog: filter chips, pagination,
 * scenario rows, and the created-scenario banner that appears after a
 * successful /reps/new submission.
 */

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const repsBrowse: HelpPage = {
	id: 'reps-browse',
	title: 'Browse scenarios',
	summary: 'How the reps browse page works: filters, paging, row details, and the catalog-level actions.',
	documents: ROUTES.REPS_BROWSE,
	tags: {
		appSurface: [APP_SURFACES.REPS],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['reps', 'browse', 'scenarios', 'filters', 'catalog', 'pagination'],
	},
	related: ['reps', 'reps-session', 'session-start'],
	reviewedAt: '2026-04-24',
	sections: [
		{
			id: 'what-it-shows',
			title: 'What the browse page shows',
			body: `The browse page is the full scenario catalog. Every authored rep lives here, regardless of whether you have attempted it.

Rows show title, domain, difficulty, phase of flight (if set), status, and a short excerpt of the situation. Clicking the title opens the rep detail page at \`/reps/[id]\`, which shows the prompt, your last-5 attempts, and the entry point to a new attempt.

:::note
Browse is a catalog. It is not the session. Starting a session uses the active plan; browsing shows you the library.
:::`,
		},
		{
			id: 'filters',
			title: 'Filters and filter chips',
			body: `Five filters narrow the catalog:

| Filter     | Values                                  | Notes                                              |
| ---------- | --------------------------------------- | -------------------------------------------------- |
| Domain     | The 14 aviation domains                 | Weather, Regs, Procedures, etc.                    |
| Difficulty | Beginner / Intermediate / Advanced      | Author-declared, not computed from accuracy        |
| Phase      | Taxi / Takeoff / Climb / ... / Landing  | Optional on a scenario                             |
| Source     | Where the scenario came from            | Official / Community / Personal                    |
| Status     | Active / Draft / Retired / All          | Defaults to Active                                 |

Active filters render as removable chips under the filter bar. Each chip is a link that strips that single filter while preserving the rest. The chip bar and the counts ("Showing 21-40 of 137") stay consistent because both read from the same URL state.

:::tip
Filters compose via URL params. Share a filtered URL to show someone a specific slice of the catalog - all state is in the querystring.
:::`,
		},
		{
			id: 'after-creating-a-scenario',
			title: 'After you create a scenario',
			body: `When you submit \`/reps/new\`, it redirects to \`/reps/browse?created=<id>\`. On load, the page:

- Dismisses to a success banner naming the new scenario.
- Scrolls to the row for that scenario and highlights it briefly.
- Clears the \`?created\` parameter so refresh does not re-trigger the scroll-and-highlight.

This is the only signal that your new scenario made it. From there you can filter to confirm it appears under the right domain and status, or open its detail to attempt it.`,
		},
		{
			id: 'pagination',
			title: 'Pagination',
			body: `The catalog paginates at 20 rows by default. The page footer shows current range ("21-40 of 137") and first / previous / next / last controls.

Pagination preserves filters. Navigating past page 1 encodes \`?page=N\` but keeps the filter querystring intact so deep-linking into page 3 of a filtered view works.

:::warn
Clicking Reset (clear filters) goes back to page 1. Pagination state does not survive a filter change because the result set changes size.
:::`,
		},
	],
};
