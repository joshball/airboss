---
title: 'Walkthrough plan -- 11 areas, vetted against current main'
date: 2026-04-25
status: ready
---

# Walkthrough plan -- 11 areas, vetted against current main

## How to use this doc

Each area below has been audited against the current state of `main`. The "Walkthrough checklist" lists ONLY the test-plan steps that are still meaningful today; each step names the route, the action, and a yes/no assertion. The "Skipped / open / blocked" section lists every step that was pruned, with the PR / ADR / handoff that obsoleted it. Walk areas top-to-bottom. If an area shows "< 3 valid steps -- skip", do exactly that and move on. The user is the walker; the agent does not run these. One open PR exists right now (#150 ENGINE_SCORING refactor) and does not touch any of these surfaces.

---

## 2. Decision Reps

The original Decision Reps test plan was authored before ADR 012 (`reps-session-substrate`, 2026-04-22) collapsed `/reps/session` into the session engine. The runtime path for a "rep" today is: pick a preset on `/session/start` -> `/sessions/[id]` -> rep slots interleave with card slots. There is no standalone rep runner, no rep-only confidence slider, no rep-only summary. Every test step that pokes at `/reps/session` is dead. What survives are the authoring + browse steps, plus rep-via-session steps if you reframe them through `/session/start`.

### Walkthrough checklist

1. **DR-1 (authoring) Create a scenario with 3 options.** Navigate to `/reps/new`. Title "Engine rough at 800 AGL", situation paragraph, Domain = Emergency Procedures, Difficulty = Intermediate. Add 3 options (A continue, B turn back, C land straight ahead -- mark C correct). Fill teaching point. Save. **Assertion:** redirects to `/reps/browse`; the new scenario appears with correct domain + difficulty badges.
2. **DR-2 Validation, fewer than 2 options.** `/reps/new`, fill all fields, add only 1 option, Save. **Assertion:** validation error: minimum 2 options.
3. **DR-3 Validation, no correct option.** `/reps/new`, add 3 options, mark none correct, Save. **Assertion:** validation error: exactly 1 must be correct.
4. **DR-4 Validation, two correct options.** `/reps/new`, mark 2 of 3 options correct, Save. **Assertion:** validation error: exactly 1 must be correct.
5. **DR-5 Browse with filters.** Create three scenarios spanning Beginner/Weather, Intermediate/Regulations, Advanced/Emergency. Open `/reps/browse`. **Assertion:** all three listed. Filter difficulty=Advanced -> only the Advanced scenario. Filter domain=Weather -> only the Weather scenario. (Note: the phase-of-flight filter key is now `?flight-phase=` per ADR 013, the domain filter is the same.)
6. **DR-12 Empty state.** Suspend or archive every personal scenario (or use a fresh user). Open `/reps`. **Assertion:** empty state with "create scenarios" prompt; no broken numbers.
7. **DR-13 Reps dashboard accuracy.** With several rep attempts already recorded inside sessions (run a Quick reps preset session and answer some scenarios first), open `/reps`. **Assertion:** dashboard shows accuracy by domain over the last 30 days; numbers match the attempts you just made.

### Skipped / open / blocked

- **DR-6 Rep session, correct answer / DR-7 incorrect answer / DR-8 randomized order / DR-9 confidence slider / DR-10 session summary / DR-11 prioritizes unattempted.** All target the deleted `/reps/session` route. **OUT OF SCOPE** per ADR 012 (`docs/decisions/012-reps-session-substrate.md`, "Phase 6"). The replacement flow is "pick the Quick reps preset on `/session/start`," and that surface is exercised under area #5 (Study Plan + Session Engine), not here.
- **DR-14 Multiple attempts on same scenario.** The DB shape changed: rep attempts are stored as `study.session_item_result` rows with `item_kind='rep'`, not `study.rep_attempt` rows (table dropped). The behavioural assertion ("each attempt has its own row, accuracy reflects all attempts") is still true but is exercised inside the session engine walkthrough (SP-19, SP-27). **STALE** per ADR 012.

### Estimated time: 12 minutes

---

## 3. Calibration Tracker

Most steps remain valid because the calibration page reads from `study.review` and `study.session_item_result` -- the substrate ADR 012 already migrated everything onto. The big gotcha is that any step that says "start a rep session at `/reps/session`" must be reframed as "start a session at `/session/start` and play through it." Several steps require seed data the user doesn't have today (specific overconfident / underconfident profiles). Mark those as Blocked.

### Walkthrough checklist

1. **CT-1 ConfidenceSlider in card review.** Start a memory review (Memory -> Review in nav -> redirects to `/memory/review/<sessionId>`). Review several cards. **Assertion:** on roughly half the cards a confidence chicklet row appears on the question screen before the answer reveals; labels visible from Wild Guess (1) to Certain (5). (Per PR #138, confidence is now chicklets on the question screen, not a separate post-space prompt -- this is the post-review-flow-v2 shape.)
2. **CT-2 ConfidenceSlider in rep session.** Start a session via `/session/start` Quick reps preset. Play a few rep slots. **Assertion:** on roughly half the rep slots a `<ConfidenceSlider>` (live in `apps/study/src/routes/(app)/sessions/[id]/+page.svelte`) appears before options reveal.
3. **CT-3 Skip works.** When the slider/chicklet appears in either flow, dismiss without picking. **Assertion:** review/attempt saves; no error; calibration page later shows the row with `confidence = NULL`.
4. **CT-4 Value saved.** When the slider appears, pick 4 (Probably). Complete the slot. **Assertion:** the row is recorded with confidence = 4 (verify either via the calibration page bucket count incrementing in bucket 4, or via psql).
5. **CT-5 Five-bucket chart.** Open `/calibration` after seeding spans (you'll need real data across 5 confidence levels to see this populated; if your data isn't there yet, this step is a "renders without crashing" sanity check). **Assertion:** five-bucket bar chart visible; per-bucket count + actual accuracy + gap shown.
6. **CT-9 Per-domain breakdown.** Open `/calibration`. **Assertion:** per-domain section renders one row per domain that has data; numbers add up to the global bucket totals.
7. **CT-10 No data.** Use a fresh user (or seed-strip confidence values). Open `/calibration`. **Assertion:** empty state copy "complete some reviews with confidence ratings to see your calibration"; link routes to `/memory/review`.
8. **CT-11 Calibration score.** With seed data, open `/calibration`. **Assertion:** calibration score 0.0-1.0 shown; only buckets with >= 5 data points contribute.

### Skipped / open / blocked

- **CT-6 Overconfidence visible / CT-7 Underconfidence visible / CT-8 Insufficient data bucket / CT-12 30-day trend / CT-13 Combined data from cards and reps.** All require pre-staged seed data with specific confidence-vs-correctness profiles. **Blocked on prereq:** the user has not authored a calibration seed; seeding random reviews is not enough. Either author a `bun run db seed calibration` fixture (does not exist today) or skip until enough natural data accrues from real use. Surfacing CT-6/7/8 as stand-alone steps would force the user to fabricate data by hand.

### Estimated time: 8 minutes (plus 2-3 mins of pre-walk play to generate confidence data)

---

## 4. Knowledge Graph

The KG test plan is enormous (41 steps) and most of it is exercise-the-build-script + schema verification, which has been continuously validated by `bun run check` + the BC test suite + every PR that touched the graph since #15. The valuable manual steps are the UI flows. The build steps stay valuable only if the user wants a real authoring round-trip.

### Walkthrough checklist

1. **KG-26 Browse page.** Open `/knowledge`. **Assertion:** all authored nodes listed, grouped by domain (Airspace, Weather, Navigation, Aerodynamics, Regulations, Teaching, Flight Planning). Each row shows lifecycle badge (skeleton / started / complete).
2. **KG-27 Filter by cert.** On `/knowledge`, set cert = PPL. **Assertion:** only nodes with a PPL relevance entry survive the filter.
3. **KG-29 Filter by lifecycle.** Set lifecycle = complete. **Assertion:** only the deep-built nodes appear (3 today: `airspace-vfr-weather-minimums`, `proc-engine-failure-after-takeoff`, `perf-crosswind-component`).
4. **KG-30 Open a deep-built node.** Click `airspace-vfr-weather-minimums` from `/knowledge`. **Assertion:** at `/knowledge/airspace-vfr-weather-minimums`. Page shows: title + domain tag + cross-domain tags; mastery bar (likely 0% on a fresh user); cert relevance table with PPL/IR/CFI rows; Prerequisites list; Applies-in list; Taught-by list; seven phase indicators all marked available; references PHAK Ch. 15 + 14 CFR 91.155; primary CTA "Start learning this node"; secondary CTA "Just review cards".
5. **KG-31 Skeleton node honesty.** Open any skeleton node from `/knowledge` (lifecycle badge = skeleton). **Assertion:** all seven phases marked "gap -- not yet authored"; primary CTA disabled or labeled "content coming soon"; metadata (relevance, references, edges) still renders.
6. **KG-32 Guided learning, deep node.** From a deep-built node detail page, click "Start learning this node". **Assertion:** lands on `/knowledge/<slug>/learn` Phase 1 of 7 (Context); progress 1/7. Click Continue across all seven phases. Each phase renders the authored markdown. Discover phase on `perf-crosswind-component` embeds the wind triangle widget. Practice phase lists attached cards/reps. Final phase offers "Back to node" + "Review practice cards now" CTAs. (Per ADR 013, phase moves now use `?step=<slug>` URL state; reload mid-flow should land you back on the same step.)
7. **KG-33 Skip to phase.** From the learn page, jump from Phase 1 to Phase 4 (Reveal) using the phase shortcut UI. **Assertion:** jump works; intermediate phases not required.
8. **KG-36 Nav item.** From any page in study, click the Knowledge nav item. **Assertion:** routes to `/knowledge`.
9. **KG-37 Unknown slug 404.** Visit `/knowledge/this-does-not-exist`. **Assertion:** 404.

### Skipped / open / blocked

- **KG-1 .. KG-11 Build script tests.** Continuously exercised by `bun run check` + pre-commit hook. Re-running them by hand adds zero value over the gates already in CI; if any one of them silently regressed, `bun run check` would already be red on main. **STALE** for manual walking. If the user wants to validate the authoring loop end-to-end, KG-38 below covers it.
- **KG-12 .. KG-18 Schema + BC.** Exercised by the BC test suite (`libs/bc/study/src/knowledge.test.ts`, `knowledge.cert.test.ts`, `knowledge.progress.test.ts`). Pre-existing workspace bug #8/#9 was fixed in PR #134, so these now run cleanly. Manual walking adds zero value. **STALE.**
- **KG-19 .. KG-25 Card / scenario node linkage.** These exercise the `node_id` / `content_phase` columns; the linkage path is via `/memory/new` and `/reps/new` (still works) but the assertions ("attach card to node, mastery aggregates") need real data accumulated over a session and are better verified inside the SP / dashboard walkthroughs. **Blocked on prereq:** seeded cards attached to specific nodes; user does not have this seed today (PR #15 cards are unseeded per `Phase F1` of the post-hangar handoff).
- **KG-28 Filter by priority.** Works in principle but the priority-pill UI on `/knowledge` is dependent on relevance-entry priority field which most skeleton nodes don't carry; risk of empty result confusing the walk. Defer until skeleton nodes get CFI-reviewed priorities (Phase 7 of the build order in NOW.md).
- **KG-34 Started lifecycle, unauthored phases / KG-35 Mastery updates after review.** Both require staged data that doesn't exist (a node in `started` lifecycle with phases mixed; review history attached to a node's cards). **Blocked on prereq:** seed cards + author a partial node.
- **KG-38 Full-cycle authoring round trip / KG-39 Rebuild after data attached / KG-40 Graph index match / KG-41 Existing flows unaffected.** Worth doing as a single ~10 min smoke pass *if* the user wants to flex the authoring loop. Listed here as one optional combined step rather than four. The four-step granularity is overkill for one user.

### Estimated time: 15 minutes (UI-only). +10 minutes if the user wants the optional KG-38 authoring round trip.

---

## 5. Study Plan + Session Engine

The session engine is the surface that absorbed the old `/reps/session` (ADR 012) and the new `/memory/review/<sessionId>` (PR #128) flows. Test plan was authored before either landed, so several steps need their entry points retargeted (e.g., "click Start in tab 2" now applies to `/session/start`, not the legacy rep starter). Many `[graph]`-tagged steps are now executable because the graph is wired (PR #13/#14/#15). Streak / suggested-next / abandon-resume steps work but require multi-day setup and can't be authentically walked in one session. Skip those.

### Walkthrough checklist

1. **SP-1 First-run, no plan.** Ensure no plan row exists for the user (archive any plan from `/plans/[id]`). Visit `/session/start`. **Assertion:** "set up your plan" empty state OR the preset gallery (per ADR 012) with primary action linking to `/plans/new` or letting you pick a preset directly. (This step's expected outcome was reframed by ADR 012 -- the empty-state IS the preset gallery.)
2. **SP-2 First-run wizard.** Click `/plans/new` (or use the "Create your own study plan" tile in the preset gallery). Cert goals = PPL + IR; session length = 10; focus domain = Weather; submit. **Assertion:** redirect to `/plans/[id]`; plan active; fields match; depth = working; default mode = mixed.
3. **SP-3 Validation, empty cert goals.** `/plans/new`, submit with no cert goals. **Assertion:** validation error: at least 1 cert goal required. (Note: presets allow empty cert goals; the manual `/plans/new` form does not, per the appendix in ADR 012.)
4. **SP-5 Edit plan, add focus domain.** `/plans/[id]`, add Regulations to focus_domains, Save. **Assertion:** plan field shows Weather + Regulations.
5. **SP-6 Focus and skip cannot overlap.** `/plans/[id]`, attempt to add Weather to skip_domains while in focus_domains. **Assertion:** validation error; not saved.
6. **SP-7 Activate second plan archives first.** With plan A active, create plan B. **Assertion:** plan B active; plan A archived. Verify exactly one active plan in DB (or via the plans list).
7. **SP-8 Mixed-mode preview.** With an active plan and seeded cards across domains, open `/session/start`. **Assertion:** ten items displayed grouped by slice (Continue / Strengthen / Expand / Diversify); each item has a reasoning label.
8. **SP-9 Mode = continue.** Visit `/session/start?mode=continue`. **Assertion:** preview tilts heavily toward Continue (~7/2/0/1 for length 10).
9. **SP-13 Shuffle.** Load `/session/start`, click Shuffle. **Assertion:** at least one slot changes; if pools are smaller than length, "no other items to pick from" message.
10. **SP-14 Replace an item.** Note the item in slot 3, click Replace. **Assertion:** slot 3 swaps for a different item in the same slice; other 9 slots unchanged.
11. **SP-15 Reasoning labels are specific.** Look at any Strengthen item. **Assertion:** reason references a concrete fact ("rated Again yesterday", "accuracy 40%"), not an enum code.
12. **SP-16 Commit session.** Click Start. **Assertion:** redirect to `/sessions/[id]`; first item presented.
13. **SP-18 Card item play.** Complete a card slot (rate Good). **Assertion:** session advances to next slot; review row created.
14. **SP-19 Rep item play.** Hit a rep slot, pick an option. **Assertion:** session advances; `session_item_result` row recorded with `item_kind='rep'`.
15. **SP-21 Skip today.** Mid-session, click Skip -> Today. **Assertion:** slot advances; the active plan is unchanged.
16. **SP-22 Skip topic, card without node_id.** Mid-session on a card slot whose card has no node_id, click Skip -> Topic. **Assertion:** card's domain is added to active plan's skip_domains; future previews exclude that domain.
17. **SP-26 Finish early.** Mid-session at slot 5 of 10, click Finish Early. **Assertion:** remaining slots recorded as `today` skips; transitions to summary.
18. **SP-27 Summary metrics.** Complete a session of 10 items with mixed outcomes. **Assertion:** summary shows attempted count + correct count + accuracy + domains; numbers match what you actually did.
19. **SP-36 All pools empty.** Empty deck (or fresh user with active plan but no cards/reps). Visit `/session/start`. **Assertion:** preview shows 0 items + helpful empty state.
20. **SP-39 Interleave order.** With a mixed preview, look at the slot order. **Assertion:** items are interleaved across slices, not grouped by slice.
21. **SP-40 Archive all plans.** Archive the only active plan from `/plans/[id]`. Visit `/session/start`. **Assertion:** back to SP-1 empty/preset state.
22. **SP-41 Skipped item count separate from attempted.** Complete a session with 3 skips out of 10. **Assertion:** summary shows 7 attempted, 3 skipped; accuracy is over 7, not 10.
23. **SP-42 Session history.** Complete a couple sessions, visit `/sessions`. **Assertion:** list shows rows with date/mode/items attempted/accuracy; most recent first.

### Skipped / open / blocked

- **SP-4 Validation, session_length out of range.** Requires devtools to bypass the form's range input. **STALE** in walkable form -- the form's `min/max` attributes already cap input; the test was for a server-side guard the user can't easily reach by clicking. Leave the unit test (already in `libs/bc/study/src/plans.test.ts`) as the gate.
- **SP-10 Mode = strengthen / SP-11 Mode = expand / SP-12 Focus override.** Useful but redundant once SP-9 Continue mode is verified; the slice-redistribution code path is one function. Cover with one of the three (SP-9) plus the unit tests.
- **SP-17 Commit race.** Hard to reproduce reliably by hand (two-tab race within the dedupe window). **STALE** as a manual walk; covered by the dedupe-window unit test.
- **SP-20 node_start item / SP-23 Skip topic node-linked / SP-25 Skip permanent node / SP-33 Suggested next finish node / SP-43 Cert override narrows session.** All `[graph]`-tagged scenarios. Achievable today (graph is wired) but require seeded card-node attachments which the user does not have (Phase F1 of the post-hangar handoff hasn't run). **Blocked on prereq:** `bun run db seed cards` to load the 12 vfr-weather-minimums cards, then attach a few reps to nodes.
- **SP-24 Skip permanent card.** This now collides with the snooze-and-flag work (PR #135 + #138): the Skip Permanent action is being subsumed by the snooze "remove" reason. Per `docs/work-packages/snooze-and-flag/spec.md`, the soft-delete flow is changing. **AT RISK:** walking it today risks confirming a behavior that's about to change. Skip until snooze-and-flag work-package is reviewed.
- **SP-28 Streak consecutive days / SP-29 Streak tz boundary / SP-30 Streak gap resets.** All require a clock that advances across multiple calendar days. Cannot be walked in one session. **STALE** as a manual walk; rely on the streak unit tests (`libs/bc/study/src/streak.test.ts` if it exists) and an in-the-wild observation over a few days.
- **SP-31 Suggested next, cards due tomorrow / SP-32 Suggested next, Strengthen hint.** Require pre-staged scheduling, rebuild from real reviews, or fake-clock harness. **Blocked on prereq:** seeded due-tomorrow + relearning-cards data set.
- **SP-34 Resume within window / SP-35 Stale after window.** Require a 30-min wait or fake clock. **STALE** as a manual walk; the resume route exists at `/sessions/[id]` and abandonment-stale-cleanup is unit-tested in `libs/bc/study/src/sessions.test.ts`.
- **SP-37 Expand redistribution without graph.** The graph IS wired now (PR #13/#14/#15), so this scenario describes a state that no longer exists by default. **OUT OF SCOPE.**
- **SP-38 Duplicate candidate across slices.** Edge case; one-attempt manual walk is unreliable without seed-engineering the inputs. **STALE** as a manual walk; covered in `libs/bc/study/src/engine.test.ts`.
- **SP-44 Multiple skip-topic accumulate / SP-45 Skipped items recoverable.** Touch the same suspended-vs-removed surface as SP-24; **AT RISK** until snooze-and-flag lands fully.

### Estimated time: 25 minutes (one full session play covers SP-16 through SP-19, SP-21, SP-26, SP-27, SP-41 in sequence).

---

## 6. Learning Dashboard

LD-1 through LD-15 cover the core dashboard surface. The graph-gated panels (LD-21 + LD-22) are now live (graph + plan engine both shipped), so the placeholders described in LD-3 / LD-11 may have been replaced with real content. Confirm during walkthrough; if the panels are still placeholders, the test plan's expectation matches reality. Most LD steps require staged seed data (`FRESH`, `CARDS_ONLY`, `TYPICAL`, `STALE`) which the user does not have. Limit to behaviour-on-real-data-as-it-stands.

### Walkthrough checklist

1. **LD-1 Route.** Visit `/dashboard` directly. **Assertion:** renders, HTTP 200. Then visit `/`. **Assertion:** redirects to `/dashboard`.
2. **LD-2 Navigation.** On `/dashboard`, the Dashboard nav link shows `aria-current="page"`. Click Memory. **Assertion:** nav active state moves to Memory. Click Dashboard, returns.
3. **LD-3 Empty/fresh-state panels.** With your current data state (whatever it is), open `/dashboard`. **Assertion:** every one of the 9 panels renders something; nothing shows `undefined`, `null`, `NaN%`, or `0 of 0`. CTA, Reviews due, Scheduled reps, Calibration, Weak areas, Activity, Cert progress, Map, Study plan -- nine boxes with sane copy.
4. **LD-5 Populated dashboard sanity.** With the data you actually have, eyeball each panel. **Assertion:** counts in Reviews due / Scheduled reps match the deck you know exists. Calibration score (if any) is between 0 and 1. Activity sparkline shows bars roughly matching what you've done.
5. **LD-12 Deep link reviews due.** Click a domain row in the Reviews-due panel. **Assertion:** lands on `/memory/browse?domain=<that-domain>` with the filter applied; cards listed are in that domain.
6. **LD-13 Deep link scheduled reps.** Click a domain row in Scheduled reps. **Assertion:** lands on `/reps/browse?domain=<that-domain>` with the filter applied.
7. **LD-14 Deep link calibration.** Click `View calibration` (or the panel). **Assertion:** lands on `/calibration`.
8. **LD-17 Post-review return.** From `/dashboard`, click Start review. Complete 3 cards. Navigate back to `/dashboard`. **Assertion:** Reviews due count decreased by 3; today's bar in Activity sparkline incremented; no force-refresh needed.
9. **LD-19 Mobile / narrow viewport.** Resize the browser to ~400px (or use devtools mobile emulator). **Assertion:** panels stack vertically; CTA stays prominent; no horizontal scroll; no clipped text.
10. **LD-20 Keyboard navigation.** Press Tab repeatedly. **Assertion:** every link/CTA reachable; focus ring visible; Enter activates. (Skip the screen-reader sub-step unless the user has VoiceOver/NVDA queued up; that's a separate audit pass.)

### Skipped / open / blocked

- **LD-4 Cards but no scenarios / LD-6 Stale content / LD-7 Insufficient calibration data / LD-8 Clear overconfidence / LD-9 Activity sparkline against hand-query.** All require either a specific seed state (`STALE`, hand-rated overconfident reviews) or live psql access for hand verification. **Blocked on prereq:** seed fixtures for each named state; not authored today. Acceptable to skip.
- **LD-10 Per-panel error isolation.** Asks the user to monkey-patch `getWeakAreas` to throw mid-build. **STALE** as a user walk; this is a dev-time fault-injection test and belongs in the BC test suite, not the manual pass.
- **LD-11 Graph-gated panels render as placeholders.** The graph IS wired; the placeholder copy may or may not still be there depending on whether the panel implementation cut over to real data after PR #13/#14. **AT RISK:** walking against the obsolete expectation will mis-fire. Treat as covered by LD-3 (it's a panel, it renders something coherent), and note any "this still says placeholder but the graph is alive" as a follow-up.
- **LD-15 Deep link weak area.** Same shape as LD-12/13; redundant.
- **LD-16 LARGE seed performance.** Requires `LARGE` seed (~100 cards / ~1000 reviews). **Blocked on prereq:** seed fixture not authored.
- **LD-18 Timezone sanity.** Requires either a timezone toggle or a wait until UTC midnight. **STALE** as a real-time walk; covered by `dashboard.test.ts`.
- **LD-21 / LD-22 graph + plan light up (future).** The graph and plan ARE live now. Run only if the user wants to verify the gated panels actually grew real content (probably yes, but it's a "compare to spec" check, not a routine walk).

### Estimated time: 10 minutes

---

## 7. PageHelp adoption (PR #110)

This was item 23 in the post-hangar handoff: confirm `<PageHelp>` chicklets are present on every dashboard / reps / knowledge route. PR #132 then changed the chicklet's behaviour from "navigate to /help/<id>" to "open a slide-over drawer with `?help=<id>` URL state." So the test plan's "lands on `/help/<id>`" assertion is wrong now -- the drawer is the new contract. Walk this AFTER #132's drawer work merged, which it did 2026-04-24.

### Walkthrough checklist

1. **Dashboard chicklet.** Open `/dashboard`. **Assertion:** `?Help` chicklet visible in the page header. Click it. Drawer slides in from the side with the dashboard help content. URL acquires `?help=dashboard`.
2. **Drawer focus + Esc.** With drawer open, press Tab a few times. **Assertion:** focus stays inside the drawer (focus-trap). Press Escape. **Assertion:** drawer closes; focus returns to the chicklet button; URL drops `?help=dashboard`.
3. **Reps cluster.** Open `/reps`, `/reps/browse`, `/reps/new`. **Assertion:** each route has its own chicklet that opens a drawer with route-specific help content (`reps`, `reps-browse`, `reps-new` ids). The `/reps/[id]` route's chicklet opens the `reps-session` help (legacy id, kept).
4. **Knowledge cluster.** Open `/knowledge`, then a node detail (e.g. `/knowledge/airspace-vfr-weather-minimums`), then its learn page (`/knowledge/airspace-vfr-weather-minimums/learn`). **Assertion:** each route's chicklet opens a drawer with the same `knowledge-graph` help content (intentional reuse).
5. **Drawer URL persistence.** With a drawer open on `/dashboard`, copy the URL (`?help=dashboard`) and reload. **Assertion:** drawer auto-opens on load with the same content.
6. **Light/dark contrast.** Toggle appearance to dark while a drawer is open. **Assertion:** scrim + drawer body re-render with WCAG AA contrast in both appearances; no flicker.
7. **Reduced motion.** With OS-level "reduce motion" enabled, click a chicklet. **Assertion:** drawer appears without slide animation (instant-open).

### Skipped / open / blocked

- The handoff's original assertion "chicklet routes to `/help/<id>`" is **STALE** per PR #132. Replaced by the drawer-based assertions above.

### Estimated time: 5 minutes

---

## 8. Shiki dual-theme code blocks (PR #99)

Single, narrow walk. Item 24 in the post-hangar handoff.

### Walkthrough checklist

1. **Code block in light.** Open any `/help/<id>` page that contains a fenced code block (e.g. `/help/concepts/fsrs`, `/help/concepts/stability`, `/help/dashboard` -- any concept page with a `typescript` or `text` block). With light appearance active, **assertion:** code block renders against a near-white background with the github-light token palette.
2. **Toggle to dark.** Switch appearance to dark via the user menu. **Assertion:** the code block's tokens AND background repaint to the github-dark palette. No flash; no white code-block panel surviving the toggle.
3. **Dark on first paint.** Hard reload while in dark appearance. **Assertion:** first paint is already dark across the whole page including the code block (no FOUC from the pre-hydration theme script in `app.html`).

### Skipped / open / blocked

- None to skip.

### Estimated time: 2 minutes

---

## 9. Review chrome + drawer overlay (PRs #132, #138)

PR #132 is the drawer overlay (covered in area #7 above; do not re-walk here). This area covers PR #138's review-chrome rewrite: confidence chicklets on the question screen, two-line rating buttons with intervals, undo toast repositioned with 10s fade window, snooze popover, per-card like/dislike/flag pills, re-entry banner. PR #135 (Bundle A) shipped the substrate (snooze + feedback tables + BCs + Removed filter + return-to-detail link); the chrome wires it on the session-backed `/memory/review/<sessionId>` page.

There is no formal test-plan file. The checklist below is derived from the PR #132 + #138 + #135 bodies.

### Walkthrough checklist

1. **Memory nav -> review.** Click Memory in the nav, then Review (sub-menu). **Assertion:** lands on `/memory/review/<sessionId>` after a 303 from `/memory/review` (the session-creation redirect from PR #128).
2. **Confidence chicklet on question.** On the question screen for the first card, **assertion:** confidence chicklets (Wild guess / Unsure / Maybe / Probably / Certain) appear inline on the question screen, not as a post-space interstitial. Pressing 1-5 selects; clicking selects; Space proceeds.
3. **Two-line rating buttons.** Press Space (or click reveal) to show the answer. **Assertion:** the four rating buttons (Again / Hard / Good / Easy) are two-line, with the next-interval label on the second line (e.g. "Again -- 10 min", "Good -- 3 days"). Intervals are computed from the FSRS state and look plausible.
4. **Undo toast.** Rate one card. **Assertion:** an undo toast appears below the card area; stays visible for ~10 seconds with a fade. The card body does not jump up/down on toast appearance (SMI walkthrough item 12 fix). Click Undo within the window -> rating reverses; FSRS state restored.
5. **Per-card feedback pills.** On a question screen, **assertion:** like / dislike / flag pills are visible above (or near) the rating area. Click dislike. **Assertion:** the dislike click requires a comment (mandatory comment per SMI item 11). Submitting writes a `study.card_feedback` row.
6. **Snooze button.** On a question screen, click the Snooze button in the chrome. **Assertion:** the SnoozeReasonPopover opens with the four reasons (Bad question / Wrong domain / Know it bored / Remove). Pick "Wrong domain" + a duration. Submit. **Assertion:** the card shrinks/animates out of the deck; replacement card slides in from `getReplacementCard`. A `study.card_snooze` row records the reason + duration + comment.
7. **Re-entry banner on bad-question rerun.** This requires that you (a) snoozed a card with `bad-question` reason on a previous run, and (b) the card's content was edited via `/memory/[id]` since the snooze. Re-enter a fresh session. **Assertion:** the snoozed card surfaces with a re-entry banner ("you flagged this as a bad question; we updated it -- review again?"). If the card hasn't been edited, the banner doesn't fire.
8. **Removed filter on browse.** Use Snooze with reason "Remove" on a card. Open `/memory/browse`. **Assertion:** a `Removed` filter chip is available; selecting it shows the removed card with a Restore action. Click Restore. **Assertion:** card returns to the active deck.
9. **Return-to-detail link.** After rating a card, the undo toast carries a "View card" link. **Assertion:** clicking it lands on `/memory/[id]` for the just-rated card.
10. **Light/dark contrast on review surface.** Toggle appearance mid-review. **Assertion:** confidence chicklets, rating buttons, snooze popover, feedback pills all re-paint with WCAG AA contrast in both appearances; no flicker.

### Skipped / open / blocked

- The "review-chrome rewrite" PR description in #138 explicitly closes review-flow-v2 and snooze-and-flag. No deferrals to walk around. The drawer overlay is covered in area #7.
- PR #135's `card_snooze` re-entry-banner trigger is data-driven (resolved when `card_edited_at` advances after a `bad-question` snooze). To exercise step 7 fully, the user has to edit a card detail between sessions. If that's not feasible during the walk, mark step 7 as "covered by the edit + banner unit tests in `libs/bc/study/src/snooze.test.ts`."

### Estimated time: 12 minutes (for one full session play that exercises 1 -> 6, 8, 9, 10; step 7 needs the edit-between-sessions setup)

---

## 10. Hangar registry (PR #98)

The `/glossary` + `/glossary/sources` + `/jobs` admin surface. Most of the test plan is automated (unit + integration). Manual walkthrough is 21 steps; almost all are valid because PR #98 is the source of truth for these routes and nothing has superseded it. The two exceptions: PR mode (steps 9-11) requires `HANGAR_SYNC_MODE=pr` env wiring + a working gh CLI, which the user may not have set up; mark as Blocked.

### Walkthrough checklist

1. **Boot.** `bun run db migrate`, then `bun run dev hangar`. **Assertion:** hangar app boots. (Step 1 of the test plan -- modified to drop the "all three apps" reference; only study + hangar are live in airboss today.)
2. **Glossary parity.** Visit study `/glossary` and hangar `/glossary`. **Assertion:** identical reference list. (Note: study `/glossary` has been live since pre-pivot; hangar's mirrors it via the registry.)
3. **Edit + dirty badge.** Click any reference in hangar `/glossary`. **Assertion:** edit form renders; markdown preview works on the paraphrase field. Change the paraphrase, save. **Assertion:** row shows dirty badge; detail page shows "dirty, last synced at SHA <old>".
4. **Sync all pending (local mode).** With `HANGAR_SYNC_MODE` unset (defaults to local-commit), click Sync all pending. **Assertion:** redirects to `/jobs/<id>`; log streams; completes in < 5 s. **Assertion:** `git log -1` in the parent repo shows a commit "hangar: sync 1 references (actor: ...)"; reopening the reference shows dirty cleared + last-synced SHA = new commit.
5. **Two-tab rev-conflict.** Open the same reference in two tabs. Save tab 1; attempt save in tab 2. **Assertion:** tab 2 shows a 409 page with a diff; reload the tab to retry.
6. **Soft-delete.** Delete a reference. **Assertion:** disappears from the `/glossary` list but the DB row is retained (verify in Drizzle Studio or psql -- `deletedAt` set, row not gone).
7. **Glossary -> sources mirror.** Repeat steps 3-6 at `/glossary/sources` for any source row (e.g., 14-cfr). **Assertion:** same dirty / sync / 409 / soft-delete flow works on the source surface.
8. **Jobs list + cancel.** Click Sync all pending -> `/jobs/[id]` shows the live log. While a job is queued, hit Cancel. **Assertion:** status flips to `cancelled` in the chip.
9. **Appearance toggle persists.** Toggle light / dark / system from the identity menu. Reload. **Assertion:** appearance survives reload; first paint matches stored appearance (no FOUC).
10. **Token-enforcement lint.** From the repo root, `bun tools/theme-lint/bin.ts apps/hangar`. **Assertion:** zero violations.

### Skipped / open / blocked

- **Steps 9-11 PR mode (`HANGAR_SYNC_MODE=pr`).** **Blocked on prereq:** requires the user to set the env var, restart hangar, and have an authenticated `gh` CLI for the test repo. If the user wants to verify, this is a 5-min add-on but most users won't need it.
- **Steps 12-14 Multi-user.** **Blocked on prereq:** requires two separate authenticated browser sessions (different identity cookies). The 409-conflict path is covered in step 5; the parallel-edits path (different references) is covered by the registry CRUD test in PR #98.
- **Step 15 Resilience: kill mid-sync.** Asks the user to `ctrl-c` the hangar process at the right millisecond, then restart. **STALE** as a routine walk; covered by the recovery unit test (`worker.test.ts`).
- **Step 16 Out-of-band edit.** Asks the user to manually edit `libs/db/seed/glossary.toml` while a sync is queued. Reproducible with care; **AT RISK** of leaving the seed file dirty if the conflict path doesn't roll back cleanly. Skip unless the user wants to stress-test.
- **Step 17 Theme invariants light/dark.** Covered in step 9 above (collapsed).
- **Step 18 Pre-hydration script + curl.** Asks for `curl hangar.airboss.test`. **Blocked on prereq:** requires the user has the local `.test` host wired in `/etc/hosts`. Functionally redundant with step 9.
- **Step 19 Token-enforcement lint.** Covered by step 10 above.
- **Step 20 Contrast suite.** **Blocked on prereq:** the contrast test runner `bun run test:contrast` (or wherever it lives) -- run from CLI, not a manual walk. Already gated in `bun run check`.
- **Step 21 Audit completeness.** Asks for `psql` query against `audit.event`. **Blocked on prereq:** psql access; not a click-walk. The audit-row writes are unit-tested in the BC.

### Estimated time: 12 minutes

---

## 11. Hangar sources-v1 + polish (PRs #104, #139)

The `/sources` operational surface. PR #104 shipped the core; PR #139 shipped the polish (animated SVG flow arrows, full-fidelity PDF/CSV/Markdown previews, busy-pre-check banner). Most steps in the WP test plan are valid. Steps that require tiny demo binaries or admin role bits the user doesn't have are blocked.

### Walkthrough checklist

1. **Flow diagram.** Open `/sources`. **Assertion:** flow diagram renders with counts populated; SVG arrows connect tile centres (per PR #139); animation plays on `.tile.busy` when an adjacent job is running. Inspect a tile's computed style -- no hex / rgb / hsl values.
2. **Tab through the diagram.** Press Tab repeatedly from the diagram. **Assertion:** every action button is reachable with a visible focus ring.
3. **Fetch on a small source.** Pick the smallest source row in the table (something like a small XML or JSON). Click Fetch. **Assertion:** redirects to `/jobs/[id]`; log streams `download -> archive -> ...`; completes; the source row's `checksum` + `downloaded_at` update.
4. **Re-fetch (no change).** Click Fetch on the same source again. **Assertion:** job ends with "no change (304 / sha match)" in the log; no new archive directory.
5. **Upload.** Click Upload on the same source; select a small modified file + a new version string. **Assertion:** old file archived under `<id>@<version>.<ext>` in `data/sources/<type>/`; source row updated.
6. **Upload no-change.** Re-upload the same file. **Assertion:** job ends with "no change" in the log.
7. **Files browser.** Open `/sources/<id>/files`. **Assertion:** lists files in `data/sources/<type>/` scoped to that id. Inline previews per extension: text -> raw, JSON -> pretty-printed, CSV -> table (per PR #139), PDF -> object embed, Markdown -> rendered (per PR #139). Geotiff/jpeg/zip have dedicated previews per PR #133 (covered separately under area #12).
8. **Diff.** Click Diff on a source that has two versions on disk. **Assertion:** `+` lines render in the success role colour, `-` lines in the destructive role colour, `@@` lines as headers.
9. **Validate + Build (global).** From `/sources`, click Revalidate. **Assertion:** job runs, status tile updates. Click Build. **Assertion:** scan + extract + diff pipeline runs; generated files refresh; diff available.
10. **Busy pre-check banner.** Submit a Fetch on source A. While it's running, click Fetch on source A again from a different tab. **Assertion:** form is disabled and a clear "this source has a running operation" banner appears before the POST (per PR #139). Server-side serialisation still kicks in if the banner is bypassed.
11. **Light/dark on the operational surface.** Toggle appearance. **Assertion:** every tile + state chip + flow arrow + preview tile retains contrast.

### Skipped / open / blocked

- **Step 7 Upload exceeding size limit.** **Blocked on prereq:** generating a >SOURCE_UPLOAD_MAX_BYTES test file by hand is awkward; covered by `upload-helpers.test.ts`.
- **Steps 13-15 Concurrency multi-user.** **Blocked on prereq:** two authenticated sessions. Step 10 above covers the per-source serialisation in single-user mode.
- **Step 17 Click an archived-version file.** Useful but redundant with step 7's Files browser walk; the archived state is just a flag in the metadata.
- **Step 18 Cancel a queued job.** Same as hangar-registry step 8; one cancel walk is enough.
- **Step 19 Job log scrollable.** Covered in step 3.
- **Step 20 Kill hangar mid-job.** **STALE** as a manual walk; recovery unit-tested.
- **Steps 21-24 Theme invariants + token-enforcement lint + contrast suite + FOUC.** Covered by area #10 step 10 (token lint) + area #10 step 9 (FOUC); collapsed.
- **Step 25 Yearly refresh simulation.** Multi-step content authoring + commit; covered piecemeal by steps 3-9 above.

### Estimated time: 12 minutes

---

## 12. Hangar non-textual + previews (PRs #113, #133)

The Denver VFR Sectional + binary-visual source family. PR #113 landed the source kind, fetch pipeline, and preview tile. PR #133 added dedicated GeotiffPreview / JpegPreview / ZipPreview components for the files browser (closing deferred #6 from the post-hangar handoff). Several test-plan steps are blocked by prereqs the post-hangar handoff itself called out: the `sectional-denver` row needs to be authored via the hangar UI (Deferred #4), and the next-edition stub requires a manual env-var setup (PR #131 landed the resolver hook).

### Walkthrough checklist

1. **Form reveals non-textual panel.** Open hangar `/glossary/sources/new`. Pick type "VFR Sectional". **Assertion:** the "Non-textual details" panel reveals; cadence defaults to 56.
2. **Author sectional-denver.** Fill: id `sectional-denver`, region `Denver`, index URL `https://aeronav.faa.gov/visual/`, URL template `https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip`. Submit. **Assertion:** redirects to `/glossary/sources/sectional-denver`; row is dirty.
3. **Sync to disk.** Click Sync all pending. **Assertion:** `/jobs/[id]` shows the sync; `libs/db/seed/sources.toml` gains the new entry (verify with `git diff`); commit lands locally.
4. **Initial state on detail.** Navigate to `/sources/sectional-denver`. **Assertion:** state shows "pending download"; no preview tile yet.
5. **First fetch.** Click Fetch. **Assertion:** `/jobs/[id]` streams the binary-visual sequence (`edition resolved -> download -> archive -> thumbnail -> meta.json -> update`). Job completes. Reload `/sources/sectional-denver`. **Assertion:** preview tile renders inline with thumbnail; metadata stack shows edition + archive size + downloaded-at + generator. Alt-text describes the edition.
6. **Files browser.** Click `/sources/sectional-denver/files`. **Assertion:** nested `<edition>/` directory shows `chart.zip`, `thumb.jpg`, `meta.json`. Click `chart.zip` -> ZipPreview lists archive entries (per PR #133). Click `thumb.jpg` -> JpegPreview renders inline with caption. Click `meta.json` -> JsonPreview pretty-prints.
7. **Re-fetch no-change.** Click Fetch again. **Assertion:** completes quickly with `no change (edition + bytes match)` in the log; no new directory.
8. **Extract is no-op.** From a terminal: `bun run references extract --id sectional-denver`. **Assertion:** prints `binary-visual source, skipping extraction (not applicable)`; exit 0. Same for `scan`, `validate`, `build`, `diff`.
9. **Light/dark contrast on detail + files.** Toggle appearance on `/sources/sectional-denver` and `/sources/sectional-denver/files`. **Assertion:** every element re-renders with WCAG AA contrast.

### Skipped / open / blocked

- **Step 18 Re-fetch next edition.** Requires the `HANGAR_EDITION_STUB_URL` env var (PR #131 landed the hook). **Blocked on prereq:** user must restart hangar with the env var pointing at a hand-written stub HTML fixture. 5-min add-on if desired; otherwise rely on the unit tests in `libs/aviation/src/sources/sectional/resolve-edition.test.ts`.
- **Step 21 Archive retention.** Asks for repeated fetches with simulated edition drift to exceed `ARCHIVE_RETENTION`. **Blocked on prereq:** stub setup + multiple distinct fixtures. Covered by the rotation unit test.
- **Step 22 Edition drift.** Asks the user to hand-edit `meta.json` to fake a sha mismatch. Reproducible but mutates dev data; **AT RISK** of leaving the data dir in a stale state if the rollback path doesn't restore cleanly. Skip unless the user wants to stress-test.
- **Step 26 Concurrency two browsers.** **Blocked on prereq:** two authenticated sessions. Single-user serialisation is exercised in area #11 step 10 (busy banner).
- **Step 32 Audit completeness query.** psql access not a manual walk.
- **Step 33 Tool detection on a fresh machine.** Asks the user to rename gdal_translate / sips on PATH. **STALE** as a manual walk; covered by `generateSectionalThumbnail` unit test that mocks both binaries absent.

### Estimated time: 12 minutes

---

## Walkthrough load summary

- Total valid steps across the 11 areas: **104** (DR 7 + CT 8 + KG 9 + SP 23 + LD 10 + PageHelp 7 + Shiki 3 + ReviewChrome 10 + HangarRegistry 10 + SourcesV1 11 + NonTextual 9 = 107; minus 3 collapsed in narrative).
- Total estimated walk time: **125 minutes** (~2 hours), best split across 2-3 sittings.
- Recommended order: walk study-side first (Decision Reps -> Calibration -> Knowledge Graph -> Study Plan -> Learning Dashboard -> PageHelp -> Shiki -> Review Chrome), then hangar-side (Hangar Registry -> Sources v1 -> Non-textual). Each block is independent; stop after any area to capture findings without losing context.
