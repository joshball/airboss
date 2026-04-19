---
title: 'Spec: Learning Dashboard'
product: study
feature: learning-dashboard
type: spec
status: unread
review_status: pending
---

# Spec: Learning Dashboard

A single read-only page that summarizes Joshua's learning state at a glance. Aggregates existing study data (cards, reviews, rep attempts, calibration) plus -- once their features land -- knowledge-graph mastery and study-plan progress. No new persisted data. Panels are BC aggregation queries; the route is a load function that fans them out.

Depends on: Spaced Memory Items, Decision Reps, Calibration Tracker (all landed). The graph-backed and plan-backed panels are gated on the Knowledge Graph and Study Plan + Session Engine features, which are being authored in parallel.

> **Depends on knowledge-graph spec.** Anything involving node IDs, cert relevance on a node, prerequisites, or "graph coverage" is subject to change if the graph spec settles differently. This spec flags each such panel so they can ship as skeleton-now / populated-later without a rewrite.

> **Depends on study-plan-and-session-engine spec.** The "Start my session" CTA and the "active study plan progress" panel depend on the study-plan feature existing. Until it does, the CTA links to the per-tool start pages and the plan panel is hidden.

## Scope

v1 MVP. A static, information-dense, server-rendered page at `/dashboard`. Click-throughs land on existing features (review, rep session, calibration, card/scenario detail). No interactivity beyond links. No realtime updates. No filters. No multi-user.

The dashboard is the **launchpad** -- if Joshua only has 60 seconds, this is what he opens. It answers four questions in order:

1. What should I study right now? (CTA + due counts)
2. Where am I? (cert progress + map)
3. What's slipping? (weak areas + calibration)
4. Have I been consistent? (activity)

## Panels

Panels are listed in render order. Each panel has a render rule (when to show), a gating rule (what feature must exist), and a BC surface (how it loads).

### 1. Primary CTA -- "Start my session"

- **Always visible.** Top of page.
- **Renders:** A prominent button labeled `Start my 10-min session` (label matches the study-plan session length once plans exist; defaults to `Start reviewing` until then).
- **Gating:**
  - With study plan -> links to the Session Engine entry point (`/session` or equivalent, per plan spec).
  - Without study plan (v1 MVP state) -> links to `/memory/review` if any cards are due, else `/reps/session` if scenarios exist, else `/memory/new`. Label adapts to the target.
- **BC surface:** `getDueCardCount(userId)` + a new `getRepBacklog(userId)` (see BC Surface below).

> **Depends on study-plan-and-session-engine spec.** When that lands, the CTA target, label, and fallback behavior are the session engine's job, not the dashboard's. This panel becomes a thin link.

### 2. Reviews due today

- **Always visible.**
- **Renders:** Count of cards with `cardState.dueAt <= now()` for active cards, grouped by domain (top 3 domains plus `N more`).
- **CTA:** `Start review` -> `/memory/review`. `0 due` shows `All caught up -- next due [date]` and hides the primary action.
- **BC surface:** `getDashboardStats(userId)` -> `dueNow` + `domains` (already exists in `libs/bc/study/src/stats.ts`).

### 3. Scheduled reps

- **Always visible.**
- **Renders:** Count of scenarios available to attempt (prioritizing unattempted, mirroring `getNextScenarios` logic), grouped by domain if > 0.
- **CTA:** `Start rep session` -> `/reps/session`. `No scenarios yet` shows a link to `/reps/new`.
- **BC surface:** New `getRepBacklog(userId)` -> `{ unattempted: number, totalActive: number, byDomain: { domain, unattempted, totalAttempts }[] }`. Reads `scenario` and `repAttempt` tables.

### 4. Calibration summary

- **Visible once the user has any confidence-rated reviews or rep attempts.** Hidden with copy `Needs confidence data` otherwise.
- **Renders:** One-line summary: calibration score (0.00-1.00) + biggest miscalibration gap (e.g. `overconfident on Weather: predicted 80%, actual 55%`).
- **CTA:** `View calibration` -> `/calibration`.
- **BC surface:** `getCalibration(userId)` (from the calibration-tracker BC). The `biggest gap` is the domain/bucket with the largest absolute `gap`, minimum 5 data points in that bucket/domain.

### 5. Weak areas

- **Visible once at least one card has been reviewed OR one rep attempted.** Empty state: `Study a few cards to see where you're slipping.`
- **Renders:** Top 3-5 weak areas. v1 definition of `weak` combines three signals from existing data:
  1. Card accuracy by domain (last 30 days) below 70% -- from `review.rating` and `review.reviewedAt`, correct = `rating > 1`.
  2. Rep accuracy by domain (last 30 days) below 70% -- from `repAttempt.isCorrect`.
  3. Overdue card load by domain -- `cardState` where `dueAt < now() - 2 days` for active cards.
- Each row shows: domain name, reason (accuracy % or overdue count), and a deep link to `/memory/browse?domain=X` or `/reps/browse?domain=X`.
- **BC surface:** New `getWeakAreas(userId, limit = 5)` -> `{ domain: Domain, reasons: { kind: 'card-accuracy' | 'rep-accuracy' | 'overdue', metric: number }[], link: 'cards' | 'reps' }[]`. Implementation is a single BC function that queries all three signals and ranks.
- **v1 ranking:** simple sum of `(1 - accuracy)` weighted 2x + normalized overdue count weighted 1x. Tuned later.

> **Depends on knowledge-graph spec.** Once the graph lands, `weak areas` becomes node-aware (`Emergency Procs (PPL) -- 42% mastered, 5 overdue cards, prerequisite for proc-engine-failure-after-takeoff`). v1 is domain-scoped; node-scoped is a later enhancement behind the same BC function.

### 6. Recent activity

- **Always visible.** Empty state: `No activity in the last 7 days.`
- **Renders:** Last 7 days as a compact sparkline or small per-day bars. Each day shows total items (card reviews + rep attempts). Below: `Average N items/day`, `Current streak: X days`, `This week: Y items`.
- **BC surface:** New `getRecentActivity(userId, days = 7)` -> `{ day: string (YYYY-MM-DD UTC), reviews: number, attempts: number }[]` + reuses `getDashboardStats.streakDays`. Queries `review.reviewedAt` and `repAttempt.attemptedAt` grouped by UTC day.

### 7. Cert progress

- **Gated on knowledge graph + per-user study plan.** Hidden in v1 -- rendered placeholder `Cert progress unlocks with the knowledge graph` linking to the relevant work package doc.
- **When the graph lands** -- renders one row per cert in the user's study plan: progress bar, `N / M nodes mastered`, percent. Cert filter comes from the plan; denominator (core + supporting nodes in that cert) comes from the graph.
- **BC surface (future):** `getCertProgress(userId)` -> `{ cert: 'PPL' | 'IR' | 'CPL' | 'CFI', total: number, mastered: number, inProgress: number }[]`. Owned by the graph BC; dashboard is a consumer.

> **Depends on knowledge-graph spec.** Needs `node.relevance`, `node_id` on cards/reps, and a node-mastery formula. Also needs the study plan for cert filter.

> **Depends on study-plan-and-session-engine spec.** Cert selection lives on the plan.

### 8. The map (domain x cert)

- **Gated on knowledge graph.** Hidden in v1; placeholder like cert progress.
- **When it lands** -- 14 rows (domains) x 4 columns (PPL / IR / CPL / CFI). Each cell shows percent mastery or `-` for `no nodes exist at this cert level in this domain`. Click a cell -> domain detail page (not built here; lives with the graph work package as `/dashboard/domains/[domain]`).
- **BC surface (future):** `getDomainCertMatrix(userId)` -> `{ domain: Domain, cells: { cert, total, mastered, percent }[] }[]`. Owned by graph BC.
- **Render note:** On screens < 900px wide, collapse to a cert-progress stack (panel 7) + weak-area list (panel 5) + streak -- matching the PRD's mobile-compact variant. The full matrix is a desktop feature.

> **Depends on knowledge-graph spec.** Entire panel.

### 9. Active study plan progress

- **Gated on study plan.** Hidden in v1.
- **When it lands** -- one-line summary of the active plan: cert goals, focus domains, skip domains, session length. Small `Edit plan` link.
- **BC surface (future):** `getActivePlan(userId)` from the study-plan BC.

> **Depends on study-plan-and-session-engine spec.** Entire panel.

### Panel ordering rationale

The order is the answer to `what does Joshua do with this page?` -- act (CTA, due counts), orient (cert + map), correct (weak areas, calibration), reflect (activity, plan). See [design.md](./design.md) for the alternatives considered and why this order wins.

## Route

- **Primary:** `/dashboard` -- added to `ROUTES.DASHBOARD` in `libs/constants/src/routes.ts`.
- **Root `/` behavior:** `apps/study/src/routes/(app)/+page.server.ts` currently redirects to `/memory`. Change the redirect target to `/dashboard`. The home of the study app becomes the dashboard.
- **Reasoning:** `/` is surface-typed (the study app's front door), but hard-coding dashboard content at `/` couples the home route to this feature. A distinct `/dashboard` route makes the URL legible, bookmarkable, and swappable when we add a true home page later. The redirect from `/` to `/dashboard` gives the behavior users expect (`open the app -> see my dashboard`) without conflating the two.
- **Entry points that should land here:**
  - Study app root `/` -> redirect to `/dashboard`.
  - `Dashboard` item in the primary nav (new).
  - Post-login redirect (update auth callback target from `/memory` to `/dashboard`).

## BC Surface

Aggregation functions added to `libs/bc/study/src/`. Most panels reuse existing functions. New functions are dashboard-specific aggregations over existing tables -- **no new data model, no new schema changes.**

| File                 | Function              | Status | Returns                                                                                 | Consumers                           |
| -------------------- | --------------------- | ------ | --------------------------------------------------------------------------------------- | ----------------------------------- |
| `stats.ts`           | `getDashboardStats`   | exists | `dueNow`, `reviewedToday`, `streakDays`, `stateCounts`, `domains`                       | Reviews-due panel, activity streak  |
| `stats.ts`           | `getDomainBreakdown`  | exists | Per-domain card totals / due / mastered                                                 | Map panel (v1 fallback), weak areas |
| `calibration.ts`     | `getCalibration`      | exists | Five-bucket data, score, per-domain gaps                                                | Calibration summary                 |
| `scenarios.ts`       | `getRepAccuracy`      | exists | Scenario attempt counts + accuracy                                                      | Weak areas (rep signal)             |
| `scenarios.ts`       | `getRepStats`         | exists | Attempt counts, accuracy, domain breakdown                                              | Scheduled-reps panel                |
| `dashboard.ts` (new) | `getRepBacklog`       | new    | `{ unattempted, totalActive, byDomain }`                                                | Scheduled-reps panel                |
| `dashboard.ts` (new) | `getWeakAreas`        | new    | Ranked list of weak domains with reasons                                                | Weak-areas panel                    |
| `dashboard.ts` (new) | `getRecentActivity`   | new    | Per-day reviews + attempts for last N days (default 7)                                  | Activity panel                      |
| `dashboard.ts` (new) | `getDashboardPayload` | new    | Top-level aggregator that fans out the above in parallel, returns the full panel payload | Route load function                 |
| future (graph BC)    | `getCertProgress`     | gated  | Per-cert node counts + mastery                                                          | Cert-progress panel                 |
| future (graph BC)    | `getDomainCertMatrix` | gated  | Domain x cert mastery grid                                                              | Map panel                           |
| future (plan BC)     | `getActivePlan`       | gated  | Study-plan record                                                                       | Study-plan panel                    |

`getDashboardPayload` is the single entry point the load function calls. Internally it `Promise.all`s the panel queries so there is exactly one round-trip wait. v1 has 5 parallel queries (dashboard stats, calibration, rep backlog, weak areas, recent activity). When the graph and plan panels gate in, the fan-out grows to 7-8; still one await.

### Empty-state contract per function

- `getRepBacklog` -> returns `{ unattempted: 0, totalActive: 0, byDomain: [] }` for a user with no scenarios. No throw.
- `getWeakAreas` -> returns `[]` when there is no review or attempt history. The panel renders empty state from that.
- `getRecentActivity` -> returns a 7-element array of zeros when no data exists, so the sparkline always renders the axis.
- `getCalibration` -> already returns `score: null` and `buckets: []` when there is no data (per calibration-tracker spec). Panel reads that signal to render the empty state.

## Data Model

**No new tables. No new columns. No migrations.** Every panel is an aggregation over existing data:

- `study.card`, `study.card_state`, `study.review` -- cards, state, review history
- `study.scenario`, `study.rep_attempt` -- scenarios, attempts
- (future) graph nodes + node-mastery view when the graph ships
- (future) study-plan row when that ships

This is intentional. The dashboard should never be the reason a column exists; it's a consumer. If performance later demands a denormalized snapshot table, that's a future decision -- see [design.md](./design.md) "Performance" for the reasoning.

## Validation

No user input. Dashboard is read-only.

The load function validates the session (via the existing `(app)` layout guard). No other input validation is needed.

## Edge Cases

- **Fresh user (no cards, no scenarios, no reviews).** All panels render empty states. Primary CTA links to `/memory/new`. Weak areas and calibration render hint copy (`Create your first card to start tracking`). No nulls surface to the user.
- **User with only cards, no scenarios.** Scheduled-reps panel shows `No scenarios yet -- create one`. Rest of dashboard populated normally.
- **User with only scenarios, no cards.** Mirror of above.
- **All cards suspended / archived.** Treated like `no cards` -- active filter on all queries means they don't count.
- **Confidence never rated.** Calibration panel shows empty state with prompt.
- **Streak edge (clock tick during render).** Streak is computed in UTC via `computeStreakDays`; a midnight tick between the two reads doesn't produce inconsistent state because both call `new Date()` inside the same `getDashboardPayload`.
- **Timezone.** All day bucketing is UTC, matching the existing stats module. A future enhancement may let users pick a local `day boundary`, but v1 follows the existing convention.
- **Very large history (10k+ reviews).** The `review_user_reviewed_idx` and `card_state_user_due_idx` indexes already exist; aggregation queries are O(log n). If activity-heatmap windows grow beyond 30 days, the grouped-by-day query is still small (30 rows). No additional indexes needed for v1.
- **Dashboard panel throws.** A single failing panel must not blank the whole page. `getDashboardPayload` wraps each parallel call in a try/catch and returns `{ value, error }` per panel; the view renders the error as `Unable to load [panel]` inline while other panels render normally.
- **Stale data after a session.** If Joshua completes a review session and navigates back to the dashboard, the server re-loads on navigation. SvelteKit's `invalidate` on the affected routes is sufficient -- no client cache to bust. If the user uses the browser back button, they may see stale data for a moment; that's acceptable for v1.

## Performance

Target: dashboard loads in < 500ms p95 with ~100 cards, ~30 scenarios, ~1000 reviews, ~200 attempts. No realtime updates. Each BC function must hit indexed columns only.

v1 is 5 parallel queries; existing `getDashboardStats` is already 5 parallel queries internally and meets the budget. Adding 4 more in parallel at the top level keeps total wait = slowest single query. If a panel regresses past 100ms, the fix is query-specific, not architectural.

Denormalized snapshot table (e.g., `study.learner_state`) is explicitly **out of scope for v1**. If perf becomes a problem, the right fix is either materialized views (Postgres-native) or a per-user snapshot row updated on write -- both are trivial to slot in behind the same BC functions because callers depend only on the function signatures.

## Out of Scope

- Filters (domain / cert / date range) -- v1 is a single static view.
- Interactive charts -- activity is a static sparkline; no tooltips, no drill-down.
- Multi-user -- strictly single user (the authenticated session).
- Comparison over time -- `you a month ago` is beyond MVP.
- Export (PDF / image / training log) -- post-MVP.
- CFI-viewing-student mode -- post-MVP, requires permissions model.
- Domain detail drill-down page (`/dashboard/domains/[domain]`) -- **lives with the knowledge-graph work package**, not here.
- Node detail page -- same; belongs to the graph WP.
- Customizable panel order / hidden panels -- post-MVP.
- Mobile-first redesign -- v1 renders the full matrix on wide screens and degrades to a stack on narrow; a dedicated mobile layout is post-MVP.
- Real-time updates (websockets, polling) -- never in v1; page reload is the refresh mechanism.
- Denormalized snapshot table -- deferred until a panel regresses past the perf budget.
- `Why this item` reasoning labels on weak areas -- v1 shows the reason type (accuracy / overdue) and number, not a natural-language rationale.

## Open Questions

1. **Mastery formula.** The graph PRD leaves per-node mastery open. Dashboard v1 does not need it (domain-scoped signals only), but the map and cert-progress panels will. Resolution expected to come from the graph spec.
2. **`Biggest gap` direction.** Calibration summary can lead with overconfidence (higher stakes) or the absolute largest gap. v1 picks absolute largest gap with a label (`overconfident` / `underconfident`); revisit once Joshua has lived with it.
3. **Activity window length.** 7 days on dashboard, 30-day trend lives on the calibration page. Does 7 feel too short? Alternative: render 14 days compact or a two-week grid. Revisit with real usage.
4. **Panel load failure UX.** Does per-panel `unable to load` feel right, or would a blanket `dashboard unavailable` be less alarming? v1 ships per-panel; monitor how often it happens.
5. **Post-login target.** Keeping `/dashboard` as the post-login landing is the intent, but some users may prefer `/memory/review` when they have due cards. Possible future: a user preference, or auto-redirect when due > threshold. Not v1.
6. **Weak-areas ranking weights.** v1 uses a simple rank (see panel 5). Needs real data to tune. Flag as revisit-after-30-days.
7. **Does `0 due, 0 scheduled reps, no weak areas` collapse into a single `you are caught up` empty state?** Probably yes; v1 ships the panels independently and we iterate once we see the empty dashboard in the wild.

## References

- [Learning Dashboard PRD](./PRD.md) -- this spec implements
- [design.md](./design.md) -- layout + aggregation rationale
- [tasks.md](./tasks.md) -- implementation plan
- [test-plan.md](./test-plan.md) -- manual test coverage
- [Knowledge Graph PRD](../knowledge-graph/PRD.md) -- gates panels 7 and 8
- [Study Plan + Session Engine PRD](../study-plan-and-session-engine/PRD.md) -- gates panels 1 (CTA target) and 9
- [Spaced Memory Items spec](../spaced-memory-items/spec.md) -- data source
- [Decision Reps spec](../decision-reps/spec.md) -- data source
- [Calibration Tracker spec](../calibration-tracker/spec.md) -- data source
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- architectural parent
- `libs/bc/study/src/stats.ts` -- where existing aggregates live; new dashboard aggregates colocate
- `libs/constants/src/routes.ts` -- where `ROUTES.DASHBOARD` gets added
