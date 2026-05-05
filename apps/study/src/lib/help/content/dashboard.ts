/**
 * Dashboard help page.
 *
 * UX gaps addressed (docs/work/reviews/2026-04-22-app-wide-ux.md):
 *   - MINOR "Dashboard h1 is 'Learning Dashboard' but the section is
 *     'Dashboard'" -- page names the concept, explains both labels.
 *   - MINOR "Dashboard nav doesn't show which section you're in when
 *     panels deep-link you there" -- panel descriptions document the
 *     deep-link behavior so users can predict where a click lands.
 *   - No per-panel explanations for the nine panels -- full section for
 *     each panel: what it shows, where the data comes from, empty-state
 *     meaning, actionable-state meaning.
 *   - Error-tuple pattern (dashed-border "couldn't load" card) undocumented.
 */

import { APP_SURFACES, HELP_KINDS } from '@ab/constants';
import type { HelpPageIndex } from '@ab/help';

export const dashboardIndex: HelpPageIndex = {
	id: 'dashboard',
	title: 'Dashboard',
	summary: 'Panel-by-panel reference for the dashboard launchpad.',
	tags: {
		appSurface: [APP_SURFACES.DASHBOARD],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['dashboard', 'panels', 'launchpad', 'cta', 'tui'],
	},
	sections: [
		{ id: 'what-the-dashboard-is', title: 'What the dashboard is' },
		{ id: 'cta-panel', title: 'CTA panel' },
		{ id: 'reviews-due-panel', title: 'Reviews Due panel' },
		{ id: 'scheduled-reps-panel', title: 'Scheduled Reps panel' },
		{ id: 'calibration-panel', title: 'Calibration panel' },
		{ id: 'weak-areas-panel', title: 'Weak Areas panel' },
		{ id: 'activity-panel', title: 'Recent Activity panel' },
		{ id: 'cert-progress-panel', title: 'Cert Progress panel' },
		{ id: 'map-panel', title: 'Map panel' },
		{ id: 'study-plan-panel', title: 'Study Plan panel' },
		{ id: 'error-tuples-and-resilience', title: 'When a panel fails to load' },
	],
	searchHaystack:
		'panel-by-panel reference for the dashboard launchpad. the dashboard is the launchpad. `/` redirects to `/dashboard`. the page heading currently reads "learning dashboard" and the nav label reads "dashboard" - same surface, two labels. "dashboard" is the short name; "learning dashboard" hints that other dashboards (spatial, audio, reflect) will exist once their apps land.\n\nthe dashboard uses a dense tui style: monospace, 2px corners, full-bleed 12-col grid, 0.5rem gaps, uppercase panel headers. this is deliberate. other surfaces use the `web` theme (rounded, reading-column, readable type). the dual-theme system is in `libs/themes` and routes opt in via `data-theme`.\n\npanels load independently. each panel\'s server loader returns an error tuple `{ ok: true, data } | { ok: false, error }`. if one panel\'s load fails, that panel renders a dashed-border "couldn\'t load" card with a short reason; the rest of the dashboard still renders. a panel crashing does not blank the page. top-left. tells you the single most useful next action based on your current state.\n\n- brand-new account: "create your first card" or "create your first scenario."\n- cards due today: "review cards due today (n)."\n- active plan with unresolved session slots: "continue today\'s session."\n- nothing immediately actionable: "review your plan" or a weak-area prompt.\n\nthe cta is the answer to "what should i do right now?" if you ignore every other panel, the cta is still the right starting point. lists how many cards are due for memory review, split by domain (weather, regs, procedures, etc.). each domain count is a link to `/memory/browse?domain=x` pre-filtered to that domain. the summary count is a link to the full review queue at `/memory/review`.\n\ndata source: `libs/bc/study` - fsrs-5 `next_review_at` in the past relative to `now()`.\n\nempty ("no cards due"): either you are caught up or you have not created cards yet. the cta panel will tell you which.\n\nfilled with a big number: run the queue. spaced repetition degrades fast when reviews slip - fsrs recovery ratings punish lapsed cards more than well-timed again ratings. shows today\'s scheduled decision reps, grouped by domain. each row links to `/reps/browse?domain=x`. the summary links to `/session/start`, which is the entry point for rep sessions. (the legacy `/reps/session` route was retired in adr 012 phase 3; every entry point now routes through the unified session pipeline.)\n\ndata source: the active plan\'s next session slot plus any ad-hoc scheduled reps.\n\nempty: no active plan or no reps scheduled for today. create or activate a plan at `/plans`. one-line summary of your current calibration score plus the biggest gap. example: "calibration 0.73. biggest gap: overconfident at level 4 in weather by 18%." the panel links to `/calibration` for the full breakdown.\n\ndata source: per-review `confidence` and `correct` records, scored against a brier-like metric. see [calibration](/help/calibration) for what the score means and what to do about a gap.\n\nempty ("need n more rated reviews"): calibration requires a minimum of confidence-rated reviews before the score stabilizes. keep rating confidence on reviews and reps. the domains where your accuracy is lowest or your calibration gap is largest. each row is a link to a pre-filtered review queue. weak areas are computed across both card reviews and decision reps - if you miss weather questions on cards and also miss weather reps, weather shows up here.\n\ndata source: rolling 30-day window of reviews and reps, scored by domain.\n\nempty: either too few reviews to compute or your accuracy is uniform. the first case is normal on a new account. a reverse-chronological feed of the last n reviews, reps, and session completions. each row shows timestamp, domain, and result. primarily diagnostic - useful when you want to see what you did last time without opening the history page.\n\ndata source: the `audit` schema event stream, filtered to the current user.\n\nempty: new account. do some reviews or reps. if you have declared a target cert (ppl, ir, cpl, cfi, etc.), this panel shows progress against that cert\'s knowledge-graph coverage: how many knowledge nodes you have touched, how many are mastered (dual-gate), and how many remain unauthored.\n\ndata source: the knowledge graph\'s cert-taxonomy mapping plus your per-node mastery state. see [knowledge graph](/help/knowledge-graph) for what mastery means.\n\nempty: you have not declared a target cert. set one in profile settings once they land. a small map view hinting at the future spatial surface. currently shows a static local area; will become a route-aware pre-brief surface once the `spatial` app exists.\n\ndata source: placeholder. no user data yet. summarizes your active plan: target cert, domains in scope, session length, cadence, and next session slot. links to plan detail at `/plans/[id]` for edits and to `/session/start` to begin the next session.\n\ndata source: the plans bc in `libs/bc/study`.\n\nempty: no active plan. create one at `/plans/new`. without a plan, the scheduled-reps and cta panels will not know what to queue. each panel\'s server loader uses an error tuple (`{ ok: true, data } | { ok: false, error }`) rather than throwing. if a panel\'s query fails, the panel renders a dashed-border card with a short message ("couldn\'t load weak areas"). the rest of the dashboard renders normally.\n\nif every panel shows a dashed border, the root `+layout.server.ts` failed - usually an auth or database issue. check `/login` first, then the server logs. if only one panel fails, the corresponding bc is healthy elsewhere but returned an error for your specific user; report it with the time and the panel name. dashboard panels launchpad cta tui',
	documents: '/insights',
	related: ['getting-started', 'memory-review', 'reps-session', 'calibration'],
	reviewedAt: '2026-04-22',
};
