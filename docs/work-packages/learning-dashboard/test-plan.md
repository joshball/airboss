---
title: 'Test Plan: Learning Dashboard'
product: study
feature: learning-dashboard
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Learning Dashboard

## Setup

- Study app running at `study.airboss.test:9600`
- Logged in as test user
- Database running with `study` schema and all three sibling features (memory, reps, calibration) landed
- Knowledge Graph and Study Plan + Session Engine features are NOT expected to be present for v1 tests -- their panels should render as gated placeholders
- Multiple seed states available:
  - `FRESH` -- zero cards, zero scenarios, zero reviews, zero attempts
  - `CARDS_ONLY` -- 5 cards across 2 domains, no scenarios, no reviews
  - `TYPICAL` -- 20 cards across 3+ domains, 10+ reviews with mixed ratings and ~half with confidence, 10 scenarios with 15+ attempts (mix of correct and incorrect)
  - `STALE` -- `TYPICAL` plus 3 cards whose `cardState.dueAt` is > 2 days in the past
  - `LARGE` -- ~100 cards, ~30 scenarios, ~1000 reviews, ~200 attempts for performance check

---

## LD-1: Route and redirect

1. Visit `/dashboard` directly.
2. **Expected:** Dashboard renders. HTTP 200. Page title includes `Dashboard`.
3. Visit `/` (the `(app)` root).
4. **Expected:** Redirect (302) to `/dashboard`.

## LD-2: Navigation

1. Land on `/dashboard`.
2. **Expected:** `Dashboard` nav link shows `aria-current="page"`. `Memory` link is not active.
3. Click `Memory`.
4. **Expected:** Route changes to `/memory`. `Memory` nav link becomes active.
5. Click `Dashboard`.
6. **Expected:** Route changes back to `/dashboard`. Active state swaps.

## LD-3: Fresh user -- every panel renders an empty state

Seed: `FRESH`.

1. Visit `/dashboard`.
2. **Expected:**
   - CTA panel: button reads `Create your first card` or equivalent; target is `/memory/new`.
   - Reviews due panel: shows `0 due`. No error.
   - Scheduled reps panel: shows `No scenarios yet -- create one`. Link goes to `/reps/new`.
   - Calibration panel: empty state copy; no score. Link goes to `/calibration`.
   - Weak areas panel: `Study a few cards to see where you're slipping`. No list.
   - Activity panel: `No activity in the last 7 days` plus a zero-filled sparkline axis.
   - Cert progress panel: placeholder copy `Cert progress unlocks with the knowledge graph`.
   - Map panel: placeholder copy.
   - Study plan panel: placeholder copy.
3. **Expected:** No nulls, no `undefined`, no empty `0 of 0 (NaN%)`. No panel looks broken.

## LD-4: Cards but no scenarios

Seed: `CARDS_ONLY`.

1. Visit `/dashboard`.
2. **Expected:**
   - CTA: target is `/memory/review` (since reviews are now due for fresh cards) OR `/memory/new` if all 5 cards are not yet due -- matches spec CTA rules.
   - Reviews due panel: shows correct count (up to 5 depending on timing).
   - Scheduled reps panel: shows `No scenarios yet -- create one`.
   - Weak areas panel: still renders empty state (not enough review history).
   - Activity: if you created cards today, today's bar shows 0 reviews + 0 attempts OR reflects any reviews done; depends on test sequence.
3. No crashes. No panel depends on scenarios existing to render.

## LD-5: Typical populated dashboard

Seed: `TYPICAL`.

1. Visit `/dashboard`.
2. **Expected:**
   - CTA prominent; target is session / review / reps per spec rules.
   - Reviews due panel: due count matches actual due-card count. Top 3 domains listed, each with its count.
   - Scheduled reps panel: unattempted + totalActive counts match seed data. Domain breakdown readable.
   - Calibration panel: score between 0 and 1. `biggest gap` references a real domain and direction (overconfident / underconfident).
   - Weak areas panel: top domains with reasons (accuracy %, overdue counts).
   - Activity panel: 7-day sparkline with bars reflecting seed distribution. Average / streak / weekly-total numbers match a hand-calculation.
3. Every link clicks through to the correct deep link with the correct query string.

## LD-6: Stale content surfaces as weak areas

Seed: `STALE`.

1. Visit `/dashboard`.
2. **Expected:** Weak areas panel includes the domain(s) of the overdue cards. Reason includes `overdue: 3` (or the seed count).
3. Click the weak-area row.
4. **Expected:** Deep link lands on `/memory/browse?domain=...` with the correct domain filter applied.

## LD-7: Calibration summary with insufficient data

Seed: `TYPICAL` but with confidence rated on only 3 reviews.

1. Visit `/dashboard`.
2. **Expected:** Calibration panel shows empty-ish state -- either `Needs more calibration data` or `score: -- , collect more reviews`. No misleading percentage.

## LD-8: Calibration summary with clear overconfidence

Seed: `TYPICAL` with confidence=5 (`Certain`) ratings on 10 reviews that were actually `Again` (rating=1).

1. Visit `/dashboard`.
2. **Expected:** Calibration one-liner calls out the affected domain as `overconfident`. Direction label is correct. Deep link goes to `/calibration`.

## LD-9: Activity sparkline and streak

Seed: `TYPICAL` where today, yesterday, and 3 of the last 4 days had reviews.

1. Visit `/dashboard`.
2. **Expected:** Sparkline shows bars of approximately the right heights. `Streak: 2 days` (today + yesterday).
3. Compare rendered bar counts to a hand-queried `SELECT count(*) FROM study.review WHERE reviewed_at >= DATE_TRUNC('day', now() - interval '6 days') GROUP BY day` -- they match.

## LD-10: Per-panel error isolation

Temporarily make `getWeakAreas` throw (e.g., add `throw new Error('test')` at the top of the function in the running dev build, or mock via a test-only env flag).

1. Visit `/dashboard`.
2. **Expected:** The weak-areas panel shows `Unable to load weak areas` inline. All other panels render normally.
3. Remove the injected failure.
4. **Expected:** Panel recovers on next load.

## LD-11: Graph-gated panels render as placeholders (v1)

1. Visit `/dashboard`.
2. **Expected:** Cert progress, map, and study-plan panels each show their placeholder copy. Each placeholder links to the relevant work package PRD so Joshua can see what the full panel will look like when it lands.
3. **Expected:** Placeholders are visibly distinguished from populated panels (muted styling, no fake data).

## LD-12: Deep link -- reviews due domain

1. Click a domain row inside the reviews-due panel.
2. **Expected:** Navigate to `/memory/browse` with the correct `domain` filter applied. Browse page shows only cards in that domain.

## LD-13: Deep link -- scheduled reps domain

1. Click a domain row inside the scheduled-reps panel.
2. **Expected:** Navigate to `/reps/browse?domain=...` and filter applies.

## LD-14: Deep link -- calibration

1. Click `View calibration` (or the panel itself if it is the link target).
2. **Expected:** Navigate to `/calibration`. Full calibration view renders.

## LD-15: Deep link -- weak area

1. Click a weak-area row.
2. **Expected:** Navigate to the correct browse page for that domain. Filter applies. Items listed are in the selected domain.

## LD-16: Performance with LARGE seed

Seed: `LARGE`.

1. Open browser devtools `Network` tab.
2. Visit `/dashboard` from a cold server.
3. **Expected:** Server-side TTFB under 500ms. Content renders within 1 second total. No long slow waterfall (each panel's BC call is parallel; total wait is the slowest single call, not the sum).

## LD-17: Post-review return

1. From `/dashboard`, click `Start review`.
2. Complete 3 cards.
3. Navigate back to `/dashboard` (via nav or browser back).
4. **Expected:** Dashboard numbers reflect the 3 reviews: due count decreased, reviewed-today count increased by 3, streak correct, activity sparkline updated.
5. No stale cache. No force-refresh needed.

## LD-18: Timezone sanity

1. Note current UTC day. Complete a review.
2. Check `Activity` panel.
3. **Expected:** Today's bar (UTC) shows the review. If the local day has rolled over but UTC hasn't, the bar lands on the UTC day.
4. Note: document any local-time surprises for later follow-up (not a ship blocker for v1).

## LD-19: Mobile / narrow viewport

1. Resize browser to ~400px width (or open devtools mobile emulator).
2. Visit `/dashboard`.
3. **Expected:** Panels stack vertically. CTA stays prominent. Gated-panel placeholders still render. No horizontal scroll. No text clipped or overlapping.

## LD-20: Keyboard navigation

1. Visit `/dashboard`. Press `Tab` repeatedly.
2. **Expected:** Every link and CTA is reachable via keyboard. Focus ring visible. `Enter` activates. `Skip to main content` link at the top of the layout works.
3. Use a screen reader (VoiceOver / NVDA). Navigate the page.
4. **Expected:** Headings form a readable outline. Panel sections are landmarked. Empty-state copy is read (not hidden from AT). Sparkline has an accessible text equivalent (`Last 7 days: 3, 0, 5, 2, 0, 1, 4 items`).

## LD-21: Graph-gated panels light up (future -- run after graph lands)

**Do not run this scenario until the knowledge-graph work package is complete.**

Seed: `TYPICAL` plus graph with at least 10 nodes spread across domains + certs, with mastery state for a subset.

1. Visit `/dashboard`.
2. **Expected:** Cert progress panel replaces its placeholder with real cert bars. Map panel renders the domain x cert grid. Percentages match the graph BC's `getCertProgress` and `getDomainCertMatrix` outputs.

## LD-22: Study-plan CTA target (future -- run after plan lands)

**Do not run this scenario until the study-plan-and-session-engine work package is complete.**

1. Create a study plan (PPL + IR, session length 10).
2. Visit `/dashboard`.
3. **Expected:** Primary CTA reads `Start my 10-min session` and routes to the session engine, not to the per-tool pages.

---

## Definition of Done

- All LD-1 through LD-20 pass on the current build.
- `bun run check` reports 0 errors, 0 warnings.
- `bun test` passes, including `dashboard.test.ts`.
- The three gated panels (cert progress, map, study plan) render placeholder copy with links to the corresponding work package PRDs, visibly distinguished from populated panels.
- No panel renders `undefined`, `null`, or a broken number (`NaN%`) in any seed state.
- Page loads under 500ms p95 against the `LARGE` seed.
