/**
 * Reps browse help page.
 *
 * Documents the /reps/browse scenario catalog: filter chips, pagination,
 * scenario rows, and the created-scenario banner that appears after a
 * successful /reps/new submission.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const repsBrowseIndex: HelpPageIndex = {
	id: 'reps-browse',
	title: 'Browse scenarios',
	summary: 'How the reps browse page works: filters, paging, row details, and the catalog-level actions.',
	tags: {
		appSurface: [APP_SURFACES.REPS],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['reps', 'browse', 'scenarios', 'filters', 'catalog', 'pagination'],
	},
	sections: [
		{ id: 'what-it-shows', title: 'What the browse page shows' },
		{ id: 'filters', title: 'Filters and filter chips' },
		{ id: 'after-creating-a-scenario', title: 'After you create a scenario' },
		{ id: 'pagination', title: 'Pagination' },
	],
	searchHaystack:
		'how the reps browse page works: filters, paging, row details, and the catalog-level actions. the browse page is the full scenario catalog. every authored rep lives here, regardless of whether you have attempted it.\n\nrows show title, domain, difficulty, phase of flight (if set), status, and a short excerpt of the situation. clicking the title opens the rep detail page at `/reps/[id]`, which shows the prompt, your last-5 attempts, and the entry point to a new attempt.\n\n:::note\nbrowse is a catalog. it is not the session. starting a session uses the active plan; browsing shows you the library.\n::: five filters narrow the catalog:\n\n| filter     | values                                  | notes                                              |\n| ---------- | --------------------------------------- | -------------------------------------------------- |\n| domain     | the 14 aviation domains                 | weather, regs, procedures, etc.                    |\n| difficulty | beginner / intermediate / advanced      | author-declared, not computed from accuracy        |\n| phase      | taxi / takeoff / climb / ... / landing  | optional on a scenario                             |\n| source     | where the scenario came from            | official / community / personal                    |\n| status     | active / draft / retired / all          | defaults to active                                 |\n\nactive filters render as removable chips under the filter bar. each chip is a link that strips that single filter while preserving the rest. the chip bar and the counts ("showing 21-40 of 137") stay consistent because both read from the same url state.\n\n:::tip\nfilters compose via url params. share a filtered url to show someone a specific slice of the catalog - all state is in the querystring.\n::: when you submit `/reps/new`, it redirects to `/reps/browse?created=<id>`. on load, the page:\n\n- dismisses to a success banner naming the new scenario.\n- scrolls to the row for that scenario and highlights it briefly.\n- clears the `?created` parameter so refresh does not re-trigger the scroll-and-highlight.\n\nthis is the only signal that your new scenario made it. from there you can filter to confirm it appears under the right domain and status, or open its detail to attempt it. the catalog paginates at 20 rows by default. the page footer shows current range ("21-40 of 137") and first / previous / next / last controls.\n\npagination preserves filters. navigating past page 1 encodes `?page=n` but keeps the filter querystring intact so deep-linking into page 3 of a filtered view works.\n\n:::warn\nclicking reset (clear filters) goes back to page 1. pagination state does not survive a filter change because the result set changes size.\n::: reps browse scenarios filters catalog pagination',
	documents: '/reps/browse',
	related: ['reps', 'reps-session', 'session-start'],
	reviewedAt: '2026-04-24',
};
