---
title: 'Design: Learning Dashboard'
product: study
feature: learning-dashboard
type: design
status: unread
review_status: pending
---

# Design: Learning Dashboard

## One page, seven panels, one load

**Question:** How is the dashboard assembled -- one giant route, many small routes, progressive enhancement?

**Options considered:**

- **One monolithic route.** Single `+page.server.ts` loads everything, single `+page.svelte` renders everything. No sub-routes.
- **Panel sub-routes with hydrate-on-client.** Each panel is an independent fetch on mount; skeleton initially.
- **Per-panel SSR islands.** Each panel renders its own server component.

**Chosen:** One monolithic route with a single load function that fans out via `Promise.all`.

**Why:**

- Matches the existing stats pattern (`getDashboardStats` already fans out 5 parallel queries). Consistent architecture beats novel architecture.
- SvelteKit load functions are already parallel at the top level; no need to add a second concurrency layer.
- No client-side hydration work needed. Dashboard is read-only and re-renders on navigation. SSR is sufficient.
- Debuggability: one load function, one error surface, one place to add logging.
- Progressive rendering is an optimization we don't need at v1 scale. If the page ever takes > 500ms, we can stream with SvelteKit `streamed` properties without rearchitecting.

**Cost accepted:** A single slow panel (e.g., a future graph query) slows the whole page. Mitigation: per-panel error boundaries inside `getDashboardPayload` so failures degrade to inline messages, not a blank page. If any panel becomes reliably slow, it can be promoted to a `streamed` prop without touching the view contract.

## Panel ordering: act -> orient -> correct -> reflect

**Question:** What order do panels appear on the page?

**Alternatives considered:**

- **Summary-first (calibration score + weak areas top).** Starts with the `honest read` then gives actions.
- **Map-first (the big grid top).** Emphasizes the territory metaphor; study is navigation.
- **Activity-first (streak + heatmap top).** Gamified / motivational shell.
- **Action-first (CTA + due counts top), chosen.** Dashboard is a launchpad; primary action is one click away.

**Chosen order:**

| # | Panel                   | Answers                        |
| - | ----------------------- | ------------------------------ |
| 1 | Primary CTA             | What do I do right now?        |
| 2 | Reviews due today       | How much work is waiting?      |
| 3 | Scheduled reps          | How much work is waiting?      |
| 4 | Calibration summary     | How honest is my self-picture? |
| 5 | Weak areas              | Where do I need attention?     |
| 6 | Recent activity         | Have I been consistent?        |
| 7 | Cert progress (gated)   | How far along am I?            |
| 8 | The map (gated)         | Where across the territory?    |
| 9 | Study plan (gated)      | What am I aiming at?           |

**Why this order:**

- The PRD's information hierarchy (CTA, cert progress, map, weak areas, calibration, activity) is written assuming the graph exists. For v1 without the graph, cert progress and map are placeholders; pushing them down past the signals that actually have data (reviews, calibration, weak areas, activity) matches what Joshua can act on today.
- `Act first` is a design principle from DESIGN_PRINCIPLES.md "Emotional Safety" inverted -- instead of `what am I bad at?` hitting first, `what should I do?` hits first. The truth comes immediately after, but it comes after an option to act.
- When cert progress and map gate in, they slot above weak areas, matching the PRD order. The page becomes PRD-shaped as the graph populates. Until then, v1 renders the available signals in priority order, with placeholders for gated panels at the bottom so their absence is visible (honest emptiness -- PRD design principle).

**Cost accepted:** Once the graph lands, panel ordering changes. This is a deliberate choice to not prematurely lay out for a world that does not exist yet. The CSS is panel-by-panel; reordering is a template change, not a rewrite.

## Where the BC surface lives

**Question:** Do dashboard aggregations go in a new BC, a new file inside `bc/study`, or scattered across existing files?

**Options considered:**

- **New `libs/bc/dashboard/`.** Separate BC for `dashboard aggregations`.
- **New file `libs/bc/study/src/dashboard.ts`.** Colocated with other stats.
- **Scattered additions to existing files (`stats.ts`, `scenarios.ts`, `calibration.ts`).** Each function goes where its data lives.

**Chosen:** New file `libs/bc/study/src/dashboard.ts`, exporting `getDashboardPayload`, `getRepBacklog`, `getWeakAreas`, `getRecentActivity`.

**Why:**

- Dashboard is a consumer of the study BC, not a new BC. CLAUDE.md warns against `premature separation costs more than premature coupling` -- same reasoning as `one BC, not three` for the spaced-memory-items / decision-reps / calibration triple.
- Colocating keeps the read-only aggregates in one place. `stats.ts` already has `getDashboardStats`; the dashboard functions are its siblings, not cousins.
- Scattering would make `getDashboardPayload` import from four files and split the fan-out logic across modules. That's a cost to the next reader.

**Cost accepted:** `libs/bc/study/src/` grows by one file. Acceptable -- the file's purpose is clear (`everything the learning dashboard needs`), and the existing module structure handles growth well.

## No new data model

**Question:** Should the dashboard have its own materialized snapshot table?

**Options considered:**

- **`study.learner_state` snapshot row per user.** Updated on every review / attempt. Dashboard reads the row directly.
- **Aggregated views (Postgres materialized views).** Refreshed on a schedule or on demand.
- **No persistence -- aggregate on read, chosen.** Every dashboard load is fresh from source tables.

**Chosen:** No persistence. v1 aggregates from source tables on every request.

**Why:**

- Single-user scale. Joshua is user zero. A dashboard hit at most once per session, < 1000 reviews / month, < 200 attempts / month. Every query hits indexed columns. The perf budget (< 500ms) is met by existing indexes.
- `Prime directive: do the right thing`. A snapshot table is a cache -- cache invalidation is hard, snapshot drift is hard to diagnose. A stub is a known issue; so is a premature optimization with a correctness failure mode.
- The BC function signatures (`getRepBacklog`, `getWeakAreas`, `getRecentActivity`) do not leak the data shape. If the implementation later switches to a materialized view, callers are unaffected.
- Adding a snapshot table now also means adding write paths in `reviews.ts` and `scenarios.ts` to keep it in sync. That's a contract change in already-shipped code for a problem we do not yet have.

**Cost accepted:** Each dashboard page load does 5-8 queries. At Joshua's scale this is negligible. Trigger to revisit: any query exceeding 100ms p95, or concurrent dashboard loads (unlikely in v1).

**Escape hatch:** If perf regresses, the right fix is a per-user snapshot row written in the same transaction as reviews/attempts. We already have idempotency windows and transactional writes for reviews; extending them to update a snapshot is additive.

## Route: `/dashboard`, with `/` redirect

**Question:** Where does the dashboard live -- `/`, `/dashboard`, or `/home`?

**Options considered:**

- **`/` directly.** The app's front door is the dashboard.
- **`/dashboard` with `/` redirect to it, chosen.**
- **`/home` with `/` redirect to it.** Naming convention from other apps.

**Chosen:** `/dashboard`, with `/` (the `(app)` layout's root) redirecting to it.

**Why:**

- Bookmarkability. `https://study.airboss.test:9600/dashboard` reads as `the dashboard`. `https://study.airboss.test:9600/` reads as `the app` -- fine for users, worse for agents writing test plans or referencing routes.
- Future flexibility. The root `/` may host a landing page, a switcher between products (once the audio / spatial / etc. apps exist), or a multi-product shell. Keeping `/` separate from dashboard content preserves that optionality.
- Matches existing route naming. `/memory`, `/reps`, `/calibration` are all surface names; `/dashboard` fits the same pattern.
- `/home` was considered and rejected -- `home` is a stronger claim than this page deserves. This page is a learning dashboard, not the app's homepage. When a true homepage exists (product picker, profile, settings), it will live at `/` and `/dashboard` stays where it is.

**Cost accepted:** The `(app)/+page.server.ts` redirect currently sends `/` to `/memory`. We change it to `/dashboard`. Any deep links or docs referencing `/memory` as the landing will need a sweep -- the only known reference is the `(app)` layout's `Memory` nav item, which stays (the nav still works, memory is still its own route).

## Weak-areas ranking: explicit signals, simple weights

**Question:** How does v1 identify a weak area?

**Options considered:**

- **Accuracy threshold only.** "Domain with accuracy < 70%". Simple, sometimes misleading (a domain with 5 attempts may rank above a domain with 500).
- **Mastery-based (requires graph).** "Domain with lowest mastery %". Not available in v1.
- **Multi-signal rank, chosen.** Combine card accuracy, rep accuracy, overdue load.

**Chosen v1 formula:**

```text
for each domain with >= 10 total data points (reviews + attempts in last 30 days):
  card_weakness = max(0, 0.70 - card_accuracy)           -- 0 if >= 70%, else gap below 70%
  rep_weakness  = max(0, 0.70 - rep_accuracy)            -- same
  overdue_load  = overdue_card_count / max(1, total_active_cards_in_domain)
  score         = 2 * card_weakness + 2 * rep_weakness + overdue_load
```

Return the top N (default 5) domains by score, with the reason data (accuracy %, overdue count) attached so the panel can render the `why`.

**Why:**

- The 70% threshold is an opinionated default borrowed from the FAA 70% passing standard. If you're below 70%, you would not pass a knowledge test -- that is the right `honest read` threshold.
- Three signals catch different failure modes: low accuracy (you don't know it), missed reps (you can't apply it), overdue cards (you're avoiding it). A weak domain tends to trigger more than one.
- The 2x weight on accuracy over overdue load reflects DESIGN_PRINCIPLES.md `Tell the truth` -- missed answers are stronger signal than procrastination.
- Minimum 10 data points in the last 30 days prevents a single bad day from nominating a domain as weak. Tunable.

**Cost accepted:** The formula is guesswork until Joshua lives with it. Open Question #6 in the spec flags this as `revisit-after-30-days`. The formula lives entirely inside `getWeakAreas` so tuning is a single-file change.

## Activity heatmap: sparkline, not grid

**Question:** What does the activity visualization look like?

**Options considered:**

- **GitHub-style contribution grid.** 52-week x 7-day grid.
- **30-day bar chart.** One bar per day, height = item count.
- **7-day sparkline, chosen.**
- **Weekly rollup (4 bars, last 4 weeks).** Coarser, less signal.

**Chosen:** 7-day sparkline. 7 bars, each = one day's total (reviews + attempts).

**Why:**

- The dashboard asks `have I been consistent?` -- a week is the right window for that question. `Did I study every day this week?` is actionable; `did I study on March 14?` is not.
- The 30-day trend lives on the calibration page. The dashboard does not need to duplicate it.
- A 7-bar sparkline fits in any layout (mobile included), rendered with CSS-only (no chart library). Aligns with DESIGN_PRINCIPLES.md `Information density over whitespace`.
- GitHub-style grid is engineered for consistency visualization over years. Joshua's history is days-to-weeks old at v1 launch; the grid would be mostly empty.

**Cost accepted:** No longitudinal view on the dashboard. Users who want `how have I been doing this month?` go to the calibration page (where the 30-day trend already lives) or the memory browse page (filter by reviewed date). Acceptable: dashboard is a snapshot, longitudinal views are elsewhere.

## Mobile handling

**Question:** What happens on narrow screens?

**Approach:** CSS-driven progressive collapse. The spec identifies < 900px as the breakpoint where the domain x cert matrix collapses. Other panels scale down naturally (single-column, CTAs stay prominent).

**Why not a dedicated mobile layout:**

- PRD mobile-compact sketch is a subset of the desktop dashboard, not a different page. The same server load feeds both.
- Joshua uses this on a laptop primarily. Mobile is secondary for v1.
- A separate `/dashboard/mobile` route or `$app/stores` device detection adds complexity for no gain.

**Cost accepted:** Very narrow screens may wrap awkwardly. Monitor during test and fix with CSS only if needed.

## Panel error boundaries

**Question:** What happens when a BC query throws?

**Approach:** `getDashboardPayload` catches per-panel errors and returns `{ value, error }` tuples. The view renders the panel's error state inline (`Unable to load reviews due -- try refreshing`) without affecting other panels.

**Why:**

- One panel failing should not hide all the other ones. The dashboard's value is density; a blank page with `error` destroys that.
- Per-panel error state is visible and reportable. A silent retry (or a global try/catch in the load function) hides problems.
- Aligns with DESIGN_PRINCIPLES.md `Emotional Safety` -- don't punish the user for system problems.

**Cost accepted:** More code in `getDashboardPayload`. The per-panel tuple pattern is already used in other backends; it is small.

## What's deliberately deferred

The PRD describes the full vision. This design takes the v1 slice. Deferred to later iterations:

- **Domain detail page** -- belongs to the knowledge-graph work package (it renders graph data, not dashboard data).
- **Node detail page** -- same; graph-WP territory.
- **Compare-over-time** -- needs a longitudinal dimension not present in v1 signals.
- **Filters / custom views** -- v1 is a single canonical view. Filters add complexity that does not serve `tell the truth, no cheerleading`.
- **Per-user panel customization** -- premature.
- **Export / print** -- a training-log export is a real need later, but not today.

Each of these is enumerated in the spec's `Out of Scope` section for traceability.

## Alternatives considered and rejected

### "Aggregate everything into one giant BC function"

Rejected. `getDashboardPayload` is an aggregator, not a kitchen-sink. Each panel's logic lives in a focused function (`getRepBacklog`, `getWeakAreas`, `getRecentActivity`) that is independently testable and reusable. The aggregator does one thing: fan out + bundle.

### "Put the aggregator in the route"

Rejected. Routes are SvelteKit glue. Keeping the fan-out in the BC makes it unit-testable (Vitest) without SvelteKit. Also keeps the route file small.

### "Build the graph-gated panels as stubs now, unlock with feature flag"

Rejected for v1. Hiding with a placeholder (`unlocks with knowledge graph`) is more honest than shipping a non-functional panel behind a flag. When the graph lands, the panel appears -- same commit, no mystery flip.

### "Add a `getLearnerSummary()` one-liner for external consumers"

Deferred. Other products (FIRC, hangar, audio) may want a headline read from study. That's a future export from the study BC, not a v1 dashboard concern. Today's dashboard loads via `getDashboardPayload`; an external-summary variant can compose from the same building blocks later.
