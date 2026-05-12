---
title: 'Out of Scope: Learning Dashboard'
product: study
feature: learning-dashboard
type: out-of-scope
status: unread
---

# Out of Scope: Learning Dashboard

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                     | Status       | Trigger to revisit                                                   |
| -------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Filters (domain / cert / date range)                     | Deferred     | When the single static view stops answering "what should I do now?"  |
| Interactive charts (tooltips, drill-down)                | Deferred     | When static sparkline genuinely blocks reading the page              |
| Multi-user                                               | Rejected     | Never -- see detail below                                            |
| Comparison over time ("you a month ago")                 | Deferred     | When 30 days of real usage exists and a comparison view is asked for |
| Export (PDF / image / training log)                      | Deferred     | When user has an external reporting requirement (CFI logbook, FAA)   |
| CFI-viewing-student mode                                 | Deferred     | When a permissions model lands AND a second user exists              |
| Domain detail drill-down (`/dashboard/domains/[domain]`) | Follow-on WP | Handled inside the knowledge-graph WP, not the dashboard             |
| Node detail page                                         | Follow-on WP | Already in flight inside the knowledge-graph WP                      |
| Customizable panel order / hidden panels                 | Deferred     | When the user has lived with the v1 panel order and wants to remix   |
| Mobile-first redesign                                    | Deferred     | When mobile becomes a real surface for studying                      |
| Real-time updates (websockets, polling)                  | Rejected     | Never -- see detail below                                            |
| Denormalized snapshot table (`study.learner_state`)      | Deferred     | When a v1 panel regresses past the perf budget (< 500ms p95)         |
| "Why this item" natural-language reasoning on weak areas | Deferred     | When the reason-type + number signal isn't enough for the user       |
| Weak-areas ranking weights tuning                        | Deferred     | After 30 days of real usage                                          |
| "You are caught up" collapsed empty state                | Deferred     | After living with independent panels and seeing the empty case       |
| Cert progress panel (panel 7)                            | Follow-on WP | When the knowledge-graph + study-plan features land                  |
| Map (domain x cert) panel (panel 8)                      | Follow-on WP | When the knowledge-graph feature lands                               |
| Active study-plan-progress panel (panel 9)               | Follow-on WP | When the study-plan-and-session-engine feature lands                 |
| User-selectable local day-boundary timezone              | Deferred     | When a non-UTC author needs accurate-per-day buckets                 |
| Customizable activity window length                      | Deferred     | When real usage indicates 7 days is too short / too long             |
| Post-login target preference (auto-redirect on due > N)  | Deferred     | When the default `/dashboard` landing produces friction              |
| Panel-failure UX (per-panel vs blanket "dashboard down") | Deferred     | When per-panel error inline display proves alarming or unhelpful     |

## Filters (domain / cert / date range)

Status: Deferred

What was deferred:
Top-of-page filter controls letting the user scope the entire
dashboard to one domain or cert or time window.

Why:
v1 is "the single static view." The whole point of the dashboard is to
answer four questions (what should I study, where am I, what's
slipping, have I been consistent) at a glance, with no choices to
make. Filters defeat the at-a-glance purpose. If the user wants
filtered views, the existing surfaces (`/memory/browse`,
`/reps/browse`) own that affordance.

Trigger to revisit:
The single view stops answering the four-question goal (e.g., user
consistently has to leave the page to scope to one cert).

Implementation pattern when triggered:
Sidebar or top filter strip that scopes `getDashboardPayload`. The BC
already keys on `userId`; adding `domain?` / `cert?` / `windowDays?`
is additive. UI follows the existing browse-page filter pattern.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- [spec.md](./spec.md) `Scope` -- v1 MVP framing as "static view"

## Interactive charts (tooltips, drill-down)

Status: Deferred

What was deferred:
Hover tooltips on the activity sparkline, click-to-drill on bars,
animated transitions.

Why:
v1's activity panel is "a static sparkline" by design. Interactive
charts pull weight (a charting lib, focus management, mobile-touch
behavior) that isn't justified for a panel meant to convey "have you
been consistent" in a glance.

Trigger to revisit:
The static sparkline isn't answering the consistency question, OR a
deeper "what did I do on day X" question becomes common.

Implementation pattern when triggered:
Day-detail popover that calls a new BC `getActivityForDay(userId, day)`
returning the cards reviewed and reps attempted on that day. No
schema change; existing tables already carry the timestamps.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note

## Multi-user

Status: Rejected

What was rejected:
Cross-user features (compare to a peer, share progress, leaderboards,
classroom dashboards).

Why:
airboss is private and hosted by Joshua only per the [license + hosting
decision (2026-04-30)](../../platform/PIVOT.md). User zero is Joshua,
the test user is Abby, and there is no plan for additional human
users at the platform level. Multi-user is rejected at the platform
layer, not just at the dashboard.

Trigger to revisit:
Never as it stands. Re-decision would require Joshua reopening the
license + hosting decision and a concrete second-user requirement.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- MEMORY.md note: License + hosting -- private / all-rights-reserved (2026-04-30)

## Comparison over time

Status: Deferred

What was deferred:
"You a month ago vs you today" comparison panels (mastery delta,
calibration delta, weak-area delta).

Why:
v1 has no historical snapshots and only single-user history.
Comparison adds storage (snapshot table or query window machinery) and
visual complexity for a question that may not be the right one for
the dashboard.

Trigger to revisit:
30 days of real usage AND the user asks "am I getting better?" without
a way to see it.

Implementation pattern when triggered:
Either a snapshot table (`learner_state_snapshot` keyed on
`(userId, snapshotDate)` written daily) OR window queries over
existing `review` / `repAttempt` tables. The aggregator
(`getDashboardPayload`) gains a `comparison?` parameter.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note

## Export (PDF / image / training log)

Status: Deferred

What was deferred:
PDF export of the dashboard, image-share, exportable training log.

Why:
External reporting (CFI logbook, FAA training records) is a separate
concern with its own legal / formatting constraints. The dashboard is
a screen-first interface; exporting it produces output that is not
fit for any actual reporting purpose.

Trigger to revisit:
A concrete external reporting requirement appears (e.g., FAA flight
review log, CFI ground school record).

Implementation pattern when triggered:
Separate feature with its own WP -- not a button on the dashboard. The
reporting format dictates the data shape, not the dashboard layout.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note

## CFI-viewing-student mode

Status: Deferred

What was deferred:
A CFI logged in as themselves viewing a student's dashboard
(impersonation or share-link semantics).

Why:
Requires a permissions model that doesn't exist yet. The platform is
single-user (Joshua) per the license + hosting decision; CFI-student
relationships are not a current platform concept.

Trigger to revisit:
A permissions model lands AND there is a second human user, AND that
user is a student of a CFI on the platform.

Implementation pattern when triggered:
`viewerId` vs `learnerId` separation through the BC layer. Every read
function takes both; permission middleware validates the relationship.
Then the dashboard route accepts `?learnerId=...` and the layout shows
"Viewing X's dashboard as Y" banner.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note

## Domain detail drill-down

Status: Follow-on WP

What was deferred:
`/dashboard/domains/[domain]` -- a per-domain detail page surfaced
from clicking a cell of the map panel or a row of weak-areas.

Why:
Belongs to the knowledge-graph work package, not the dashboard. The
graph WP owns node-level UI; a domain detail is a graph view, not a
dashboard view.

Trigger to revisit:
Already in flight: handled inside the knowledge-graph WP.

Implementation pattern when triggered:
See `docs/work-packages/knowledge-graph/spec.md` and the graph BC's
`getNodesByDomain`.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- [docs/work-packages/knowledge-graph/spec.md](../knowledge-graph/spec.md)

## Node detail page

Status: Follow-on WP

What was deferred:
`/knowledge/[slug]` -- per-node detail page.

Why:
Belongs to the knowledge-graph work package. The dashboard links to it
when it ships.

Trigger to revisit:
Already in flight: shipped as part of the knowledge-graph WP (route
`/knowledge/[slug]`).

Implementation pattern when triggered:
See `docs/work-packages/knowledge-graph/spec.md` `Node detail page`.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- [docs/work-packages/knowledge-graph/spec.md](../knowledge-graph/spec.md)

## Customizable panel order / hidden panels

Status: Deferred

What was deferred:
User preferences for reordering panels or hiding the ones they don't
use (e.g., always hide the map panel, move activity to the top).

Why:
The v1 panel order is the answer to "what does Joshua do with this
page?" (act, orient, correct, reflect -- see the panel-ordering
rationale in `spec.md`). Letting the user remix the page before that
order has been lived with is premature; preferences also add a user
config surface that doesn't exist today.

Trigger to revisit:
After ~30 days of usage, the v1 order is consistently wrong for the
user's actual workflow.

Implementation pattern when triggered:
`user_pref` table keyed by `(userId, prefKey)`. Panels read order from
prefs with the v1 order as fallback. UI is a drag-to-reorder list in
settings.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- [spec.md](./spec.md) "Panel ordering rationale"

## Mobile-first redesign

Status: Deferred

What was deferred:
A dedicated mobile layout for `/dashboard`. v1 renders the full matrix
on wide screens and degrades to a stack on narrow screens.

Why:
Study sessions happen primarily on desktop in v1 (Joshua's usage). A
mobile-first redesign would invert that priority without a user
signal saying it's needed.

Trigger to revisit:
Mobile becomes a real surface for studying (e.g., a flightbag mobile
sibling app), OR the user reports the v1 narrow-screen stack is unusable.

Implementation pattern when triggered:
Mobile-first responsive layout. The BC aggregator is unchanged; the
view layer rewires panel composition.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note

## Real-time updates

Status: Rejected

What was rejected:
Websockets, polling, server-sent events on the dashboard.

Why:
The dashboard is read-only and the data behind it changes only when
the user takes an action (review a card, attempt a scenario) that
already triggers a SvelteKit `invalidate` on navigation back to the
dashboard. Real-time push solves no problem v1 has and adds a server

+ client subscription surface.

Trigger to revisit:
Never as designed. A re-decision would require a multi-user feature
where someone else's action changes the viewer's dashboard.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- [spec.md](./spec.md) `Edge Cases` "Stale data after a session"

## Denormalized snapshot table (`study.learner_state`)

Status: Deferred

What was deferred:
A per-user snapshot row updated on every card/rep write, so the
dashboard reads one row instead of fanning out to five aggregations.

Why:
v1 perf budget is < 500ms p95 on ~100 cards / ~30 scenarios / ~1000
reviews. The existing indexes already keep the aggregations sub-100ms.
A snapshot table is premature optimization that adds a write-side
invariant to maintain.

Trigger to revisit:
A v1 panel regresses past the perf budget AND the regression cannot
be fixed by tuning the offending query.

Implementation pattern when triggered:
Either `study.learner_state` row updated transactionally on every
write, OR Postgres materialized views refreshed on a write trigger.
Both slot in behind the existing BC function signatures so the route
doesn't change.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note
- [spec.md](./spec.md) `Performance` -- explicit deferral

## "Why this item" natural-language reasoning on weak areas

Status: Deferred

What was deferred:
Human-readable rationale on each weak-area row (e.g., "Weather is weak
because you've reviewed 12 cards in the last 30 days, missed 5 of
them, and have 3 cards overdue by 4 days").

Why:
v1 shows the reason type (accuracy / overdue) and number, which is
enough to act on. Natural-language rationale adds an LLM dependency
(or a template engine) for marginal clarity over a one-line reason
chip.

Trigger to revisit:
User feedback that the reason chips don't carry enough information to
decide what to attack.

Implementation pattern when triggered:
Either template-based (`reason.kind` + `reason.metric` -> sentence) or
LLM-based with the four reason values as prompt context. Template is
preferred; cheaper and deterministic.

References:

- [spec.md](./spec.md) `Out of Scope` -- original deferral note

## Weak-areas ranking weights tuning

Status: Deferred

What was deferred:
Empirical tuning of the v1 weak-area ranking formula:
`(1 - accuracy) * 2 + normalized_overdue * 1`.

Why:
The formula was chosen on paper, not from data. Tuning requires real
usage to learn what "feels right" as the top-ranked weak area.

Trigger to revisit:
After ~30 days of usage; documented as a "revisit-after-30-days"
question in the spec.

Implementation pattern when triggered:
Constants in `libs/constants/src/study.ts`:
`WEAK_AREA_ACCURACY_WEIGHT`, `WEAK_AREA_OVERDUE_WEIGHT`, etc. No
schema change; only the formula in `getWeakAreas`.

References:

- [spec.md](./spec.md) `Open Questions` #6 -- "Weak-areas ranking weights"

## "You are caught up" collapsed empty state

Status: Deferred

What was deferred:
A single celebratory empty state replacing all panels when due == 0
and scheduled-reps == 0 and weak-areas empty.

Why:
v1 ships panels independently to see how often the all-empty case
actually fires in real usage. Collapsing too early hides signal
(maybe the user wants to see the empty reviews panel as a beat in their
mental model).

Trigger to revisit:
After living with the empty-panel composite for a while; if it feels
noisy or misleading on "caught-up days," collapse it.

Implementation pattern when triggered:
The route's load function detects the all-empty condition and renders
a single `CaughtUpPanel` snippet instead of the panel stack.

References:

- [spec.md](./spec.md) `Open Questions` #7

## Cert progress panel (panel 7)

Status: Follow-on WP

What was deferred:
Panel 7 from the spec: per-cert progress bar + `N / M nodes mastered`

+ percent.

Why:
Gated on knowledge-graph (`getNodeMastery`, `node.relevance`) and
study-plan (cert filter from the active plan). Until both land, the
dashboard renders the panel as a placeholder linking to the WP doc.

Trigger to revisit:
Knowledge-graph and study-plan-and-session-engine features have both
landed (specifically: `getCertProgress` BC + active study plan are
available).

Implementation pattern when triggered:
Per `tasks.md` "Gating-panel follow-ups": the knowledge-graph WP
implements `getCertProgress`; the dashboard's `CertProgressPanel`
swaps from placeholder to real render. The dashboard's load function
gains the new fetcher.

References:

- [spec.md](./spec.md) Panel 7 -- "Cert progress"
- [tasks.md](./tasks.md) "Gating-panel follow-ups"
- [docs/work-packages/knowledge-graph/spec.md](../knowledge-graph/spec.md)
- [docs/work-packages/study-plan-and-session-engine/](../study-plan-and-session-engine/)

## Map (domain x cert) panel (panel 8)

Status: Follow-on WP

What was deferred:
Panel 8 from the spec: 14 domain rows x 4 cert columns mastery matrix.

Why:
Entirely gated on the knowledge graph (`getDomainCertMatrix`).
Renders as a placeholder in v1 of the dashboard.

Trigger to revisit:
Knowledge-graph feature has landed with `getDomainCertMatrix`
available.

Implementation pattern when triggered:
Per `tasks.md` "Gating-panel follow-ups": the knowledge-graph WP
implements `getDomainCertMatrix`; `MapPanel` swaps from placeholder
to real render.

References:

- [spec.md](./spec.md) Panel 8 -- "The map (domain x cert)"
- [tasks.md](./tasks.md) "Gating-panel follow-ups"
- [docs/work-packages/knowledge-graph/spec.md](../knowledge-graph/spec.md)

## Active study-plan-progress panel (panel 9)

Status: Follow-on WP

What was deferred:
Panel 9 from the spec: one-line summary of the active plan (cert
goals, focus / skip domains, session length).

Why:
Gated on the study-plan feature. Renders as a placeholder in v1 of
the dashboard.

Trigger to revisit:
Study-plan-and-session-engine feature has landed with `getActivePlan`
available.

Implementation pattern when triggered:
Per `tasks.md` "Gating-panel follow-ups": the study-plan WP implements
`getActivePlan`; `StudyPlanPanel` swaps from placeholder to real
render. The CTA target (panel 1) re-routes through the session engine.

References:

- [spec.md](./spec.md) Panel 9 -- "Active study plan progress"
- [tasks.md](./tasks.md) "Gating-panel follow-ups"
- [docs/work-packages/study-plan-and-session-engine/](../study-plan-and-session-engine/)

## User-selectable local day-boundary timezone

Status: Deferred

What was deferred:
A user preference letting the dashboard bucket days by the user's
local timezone instead of UTC.

Why:
All existing bucketing in the study BC is UTC. The dashboard follows
the existing convention to avoid two contradictory streak / activity
windows on the same data.

Trigger to revisit:
A user whose local timezone produces a meaningfully different
"day" boundary needs accurate per-day buckets.

Implementation pattern when triggered:
Per-user `dayBoundary` pref; `computeStreakDays` and `getRecentActivity`
gain a timezone parameter. The streak math in
`libs/bc/study/src/stats.ts` is the canonical place to thread it
through.

References:

- [spec.md](./spec.md) `Edge Cases` "Timezone"

## Customizable activity window length

Status: Deferred

What was deferred:
A user-selectable activity window (7 days, 14 days, 30 days).

Why:
v1 ships 7 days on the dashboard and 30 days on the calibration page.
Choosing per-user adds preferences without a signal that 7 is wrong.

Trigger to revisit:
Real usage indicates 7 is too short (user wants to see longer streaks
on the dashboard) or too long.

Implementation pattern when triggered:
`ACTIVITY_WINDOW_DAYS` constant becomes a user pref; the route load
function reads the pref and passes it to `getRecentActivity`.

References:

- [spec.md](./spec.md) `Open Questions` #3 -- "Activity window length"

## Post-login target preference (auto-redirect on due > N)

Status: Deferred

What was deferred:
A preference letting some users land on `/memory/review` instead of
`/dashboard` after login (e.g., when due cards exceed a threshold).

Why:
v1 picks one default (`/dashboard`) and lets the user navigate from
there. Preferences here add a config surface for a question that may
not survive once the dashboard is lived with.

Trigger to revisit:
User feedback that the default `/dashboard` landing slows down the
review workflow.

Implementation pattern when triggered:
Either a user pref (`postLoginTarget`) or an auto-redirect rule
(`if dueCount > threshold redirect /memory/review`). Both slot into
the auth callback. Threshold lives in `libs/constants/src/study.ts`.

References:

- [spec.md](./spec.md) `Open Questions` #5

## Panel-failure UX (per-panel vs blanket "dashboard down")

Status: Deferred

What was deferred:
A choice between per-panel inline "Unable to load X" error rendering
(v1 ships this) and a blanket "Dashboard unavailable" screen.

Why:
v1 ships per-panel because a single panel failing should not blank
the page. The choice between per-panel and blanket is a UX-feel
question that needs real failure data to answer.

Trigger to revisit:
Per-panel error renders prove alarming or unhelpful in real failures.

Implementation pattern when triggered:
Per-panel is already implemented via the `{ value, error }` tuple
contract in `getDashboardPayload`. Switching to blanket is a single
route-level check on whether any panel failed.

References:

- [spec.md](./spec.md) `Open Questions` #4 -- "Panel load failure UX"
- [spec.md](./spec.md) `Edge Cases` "Dashboard panel throws"
