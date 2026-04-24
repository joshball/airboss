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

import { APP_SURFACES, HELP_KINDS, ROUTES } from '@ab/constants';
import type { HelpPage } from '@ab/help';

export const dashboard: HelpPage = {
	id: 'dashboard',
	title: 'Dashboard',
	summary: 'Panel-by-panel reference for the dashboard launchpad.',
	documents: ROUTES.DASHBOARD,
	tags: {
		appSurface: [APP_SURFACES.DASHBOARD],
		helpKind: HELP_KINDS.REFERENCE,
		keywords: ['dashboard', 'panels', 'launchpad', 'cta', 'tui'],
	},
	related: ['getting-started', 'memory-review', 'reps-session', 'calibration'],
	reviewedAt: '2026-04-22',
	sections: [
		{
			id: 'what-the-dashboard-is',
			title: 'What the dashboard is',
			body: `The dashboard is the launchpad. \`/\` redirects to \`/dashboard\`. The page heading currently reads "Learning Dashboard" and the nav label reads "Dashboard" - same surface, two labels. "Dashboard" is the short name; "Learning Dashboard" hints that other dashboards (spatial, audio, reflect) will exist once their apps land.

The dashboard uses a dense TUI style: monospace, 2px corners, full-bleed 12-col grid, 0.5rem gaps, uppercase panel headers. This is deliberate. Other surfaces use the \`web\` theme (rounded, reading-column, readable type). The dual-theme system is in \`libs/themes\` and routes opt in via \`data-theme\`.

Panels load independently. Each panel's server loader returns an error tuple \`{ ok: true, data } | { ok: false, error }\`. If one panel's load fails, that panel renders a dashed-border "couldn't load" card with a short reason; the rest of the dashboard still renders. A panel crashing does not blank the page.`,
		},
		{
			id: 'cta-panel',
			title: 'CTA panel',
			body: `Top-left. Tells you the single most useful next action based on your current state.

- Brand-new account: "Create your first card" or "Create your first scenario."
- Cards due today: "Review cards due today (N)."
- Active plan with unresolved session slots: "Continue today's session."
- Nothing immediately actionable: "Review your plan" or a weak-area prompt.

The CTA is the answer to "what should I do right now?" If you ignore every other panel, the CTA is still the right starting point.`,
		},
		{
			id: 'reviews-due-panel',
			title: 'Reviews Due panel',
			body: `Lists how many cards are due for memory review, split by domain (Weather, Regs, Procedures, etc.). Each domain count is a link to \`/memory/browse?domain=X\` pre-filtered to that domain. The summary count is a link to the full review queue at \`/memory/review\`.

Data source: \`libs/bc/study\` - FSRS-5 \`next_review_at\` in the past relative to \`now()\`.

Empty ("No cards due"): either you are caught up or you have not created cards yet. The CTA panel will tell you which.

Filled with a big number: run the queue. Spaced repetition degrades fast when reviews slip - FSRS recovery ratings punish lapsed cards more than well-timed Again ratings.`,
		},
		{
			id: 'scheduled-reps-panel',
			title: 'Scheduled Reps panel',
			body: `Shows today's scheduled decision reps, grouped by domain. Each row links to \`/reps/browse?domain=X\`. The summary links to \`/session/start\`, which is the entry point for rep sessions. (The legacy \`/reps/session\` route was retired in ADR 012 phase 3; every entry point now routes through the unified session pipeline.)

Data source: the active plan's next session slot plus any ad-hoc scheduled reps.

Empty: no active plan or no reps scheduled for today. Create or activate a plan at \`/plans\`.`,
		},
		{
			id: 'calibration-panel',
			title: 'Calibration panel',
			body: `One-line summary of your current calibration score plus the biggest gap. Example: "Calibration 0.73. Biggest gap: overconfident at level 4 in Weather by 18%." The panel links to \`/calibration\` for the full breakdown.

Data source: per-review \`confidence\` and \`correct\` records, scored against a Brier-like metric. See [Calibration](/help/calibration) for what the score means and what to do about a gap.

Empty ("Need N more rated reviews"): calibration requires a minimum of confidence-rated reviews before the score stabilizes. Keep rating confidence on reviews and reps.`,
		},
		{
			id: 'weak-areas-panel',
			title: 'Weak Areas panel',
			body: `The domains where your accuracy is lowest or your calibration gap is largest. Each row is a link to a pre-filtered review queue. Weak areas are computed across both card reviews and decision reps - if you miss weather questions on cards and also miss weather reps, weather shows up here.

Data source: rolling 30-day window of reviews and reps, scored by domain.

Empty: either too few reviews to compute or your accuracy is uniform. The first case is normal on a new account.`,
		},
		{
			id: 'activity-panel',
			title: 'Recent Activity panel',
			body: `A reverse-chronological feed of the last N reviews, reps, and session completions. Each row shows timestamp, domain, and result. Primarily diagnostic - useful when you want to see what you did last time without opening the history page.

Data source: the \`audit\` schema event stream, filtered to the current user.

Empty: new account. Do some reviews or reps.`,
		},
		{
			id: 'cert-progress-panel',
			title: 'Cert Progress panel',
			body: `If you have declared a target cert (PPL, IR, CPL, CFI, etc.), this panel shows progress against that cert's knowledge-graph coverage: how many knowledge nodes you have touched, how many are mastered (dual-gate), and how many remain unauthored.

Data source: the knowledge graph's cert-taxonomy mapping plus your per-node mastery state. See [Knowledge graph](/help/knowledge-graph) for what mastery means.

Empty: you have not declared a target cert. Set one in profile settings once they land.`,
		},
		{
			id: 'map-panel',
			title: 'Map panel',
			body: `A small map view hinting at the future spatial surface. Currently shows a static local area; will become a route-aware pre-brief surface once the \`spatial\` app exists.

Data source: placeholder. No user data yet.`,
		},
		{
			id: 'study-plan-panel',
			title: 'Study Plan panel',
			body: `Summarizes your active plan: target cert, domains in scope, session length, cadence, and next session slot. Links to plan detail at \`/plans/[id]\` for edits and to \`/session/start\` to begin the next session.

Data source: the plans BC in \`libs/bc/study\`.

Empty: no active plan. Create one at \`/plans/new\`. Without a plan, the Scheduled-Reps and CTA panels will not know what to queue.`,
		},
		{
			id: 'error-tuples-and-resilience',
			title: 'When a panel fails to load',
			body: `Each panel's server loader uses an error tuple (\`{ ok: true, data } | { ok: false, error }\`) rather than throwing. If a panel's query fails, the panel renders a dashed-border card with a short message ("couldn't load Weak Areas"). The rest of the dashboard renders normally.

If every panel shows a dashed border, the root \`+layout.server.ts\` failed - usually an auth or database issue. Check \`/login\` first, then the server logs. If only one panel fails, the corresponding BC is healthy elsewhere but returned an error for your specific user; report it with the time and the panel name.`,
		},
	],
};
