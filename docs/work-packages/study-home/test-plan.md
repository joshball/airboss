---
title: 'Test Plan: Study home'
product: study
feature: study-home
type: test-plan
status: draft
review_status: pending
created: 2026-05-04
---

## Setup

- Dev DB seeded (`bun run db reset --force`).
- Logged in as Abby (`abby@airboss.test`). Abby has a primary goal targeting PPL-ASEL with mixed evidence (some recall progress, some scenarios attempted, no flight evidence yet).
- Browser: Chrome at 1440x900 (desktop happy path) and 600x900 (mobile).

---

## SH-1: Landing page renders

1. Sign in as Abby.
2. Navigate to `/study`.
3. **Expected:** Page loads in under 1 second. Title "Study" visible. Three progress bars (Understood / Memorized / Practiced) visible with percentages and absolute counts. Today panel renders a paragraph. Five tiles visible. Map renders below tiles, default tab is ACS.

## SH-2: Progress strip shows three numbers

1. Land on `/study`.
2. **Expected:** Three independent progress indicators render. Each shows a percentage (whole number, no decimals) and the absolute count `N / M`. The three labels are "Understood", "Memorized", "Practiced" in that order, left to right.

## SH-3: Today prose -- focus state

1. Confirm Abby's seed has at least one weak area with at least one card or rep evidence row dated 3+ days ago.
2. Land on `/study`.
3. **Expected:** Today panel shows a focus headline (e.g., "Weight & balance -- arm and moment"), a body paragraph that includes the day count ("You've been working on this for N days") AND at least one of: "you miss this M out of K times", "% understood / % memorized", or "haven't started this yet". A focus link / CTA navigates to the leaf's knowledge node page when clicked.

## SH-3a: Today prose -- never-touched node has no day count

1. Use a focus leaf with no evidence touches (e.g., a freshly seeded user with weakness signal but no card / rep history).
2. **Expected:** Prose elides the "you've been working on this for N days" clause. Renders "Topic. You haven't started this yet. ..." style.

## SH-4: Today prose -- caught-up state

1. Set up a test user with no weak areas (or use a fresh user).
2. Land on `/study`.
3. **Expected:** Today panel shows "You're caught up. Pick a topic from the map to dig in." Tiles render with neutral / zero badges. Map below renders with no auto-expanded area.

## SH-5: Today prose -- no primary goal

1. Sign in as a user with no primary goal set.
2. Navigate to `/study`.
3. **Expected:** A banner appears: "Set a primary goal to personalize your study home" with a link to `/goals/new`. Below the banner, the page renders in cert-agnostic mode: no progress strip, no map, generic tiles ("Browse handbook", "Open cards", etc.).

## SH-6: Tiles -- five visible, equal weight

1. Land on `/study` as Abby.
2. **Expected:** Exactly five tiles in this order: Read, Cards, Sim, Scenarios, Flight. Each tile has the same visual prominence -- same border, same padding, same internal layout. No tile has a "primary CTA" treatment.

## SH-7: Tile -- Read

1. Land on `/study` as Abby with a focus topic resolved.
2. Click the Read tile.
3. **Expected:** Navigation to `/library` (or `/library/...` filtered to the focus topic). URL reflects the navigation. No errors.

## SH-8: Tile -- Cards (with focus)

1. Land on `/study` as Abby with a focus topic resolved.
2. Click the Cards tile.
3. **Expected:** Navigation to `/memory/review/<sessionId>` (or `/memory/review` with `?nodeId=<focusNodeId>`). The review session, once started, prioritizes cards on the focus node.

## SH-9: Tile -- Cards (no focus)

1. Land on `/study` as a caught-up user.
2. Click the Cards tile.
3. **Expected:** Navigation to `/memory/review` (without a focus filter). Standard review queue.

## SH-10: Tile -- Scenarios

1. Land on `/study`.
2. Click the Scenarios tile.
3. **Expected:** Navigation to `/reps`. Existing reps page renders.

## SH-11: Tile -- Sim

1. Land on `/study`.
2. Click the Sim tile.
3. **Expected:** Cross-app link opens the sim app's home page. May open in a new tab or replace the current depending on existing cross-app conventions; behavior is consistent with how other study-app links to sim work today.

## SH-12: Tile -- Flight (placeholder)

1. Land on `/study`.
2. Click the Flight tile.
3. **Expected:** Navigation to `/flight`. Placeholder page renders with "Logging flights is coming in WP 2" text and a back-link to `/study`. No errors.

## SH-13: Map -- ACS projection (default)

1. Land on `/study`.
2. **Expected:** Map shows a tab strip `[ACS] [Handbook] [Course]` with ACS selected. Below: a list of areas (Roman-numeral coded). The area containing the today-focus leaf is auto-expanded; others are collapsed.

## SH-14: Map -- area expand reveals tasks and leaves

1. On the ACS map, click an unexpanded area (e.g., "II. Preflight Procedures").
2. **Expected:** The area expands to show its child tasks. Each task has a mastery dot bar and percentage. Tasks have child leaves; leaves show the status glyph + three pills + title.

## SH-15: Map -- per-leaf U/M/P pills

1. Expand a task with at least one leaf.
2. **Expected:** Each leaf row shows three pills labeled U, M, P. Each pill is one of `●` (mastered), `○` (covered or attempted, not mastered), or `--` (not applicable for this leaf). At least one leaf in the seed has `--` for at least one pill (e.g., a recall-only leaf shows `M:--`).

## SH-16: Map -- citation panel opens with two stacks

1. Click on a leaf row to expand its citation panel.
2. **Expected:** Panel opens below the leaf showing two columns: "Handbook" (default expanded) and "Regulation" (default collapsed but visible / clickable). Each entry is a citation chip linking to a flightbag section.

## SH-17: Map -- citation order toggle (server-persisted)

1. Expand a leaf citation panel.
2. Click the `[reg]` toggle button.
3. **Expected:** Regulation stack expands; handbook stack collapses. POST to `?/setPref` succeeds. `study.user_pref` row written for `study.home.citation_order = 'reg'`. Audit row emitted.
4. Reload the page; expand a different leaf -- regulation stack is now the default-expanded one (preference loaded from server).
5. Sign in on a second browser / device -- citation order is still `reg`.

## SH-18: Map -- Handbook projection

1. Click the `Handbook` tab in the map tab strip.
2. **Expected:** URL updates to `?tab=handbook`. Map renders a list of handbooks (PHAK, AFH, AvWX, 14 CFR, AIM). Each handbook is expandable to chapters. Each chapter shows a mastery rollup over the union of citing knowledge nodes.

## SH-19: Map -- Course projection

1. Click the `Course` tab in the map tab strip.
2. **Expected:** URL updates to `?tab=course`. Map renders 10 weeks (FAR navigation course). Each week is expandable to lessons. Each lesson with `cites.knowledge_nodes` or `cites.acs_leaves` shows a mastery rollup; lessons that cite only handbook sections show a "(reading)" badge.

## SH-20: Map -- expand all

1. On any projection, click the "expand all" affordance.
2. **Expected:** All top-level groups expand. Performance is acceptable (under 500 ms render).

## SH-21: Tab persistence (server-persisted, cross-device)

1. Switch to the Handbook tab.
2. POST to `?/setPref` writes `study.home.map_tab = 'handbook'`.
3. Reload `/study` (no `?tab=`); page renders with Handbook tab selected.
4. Sign in on a different browser; still Handbook.
5. Navigate `/study?tab=acs` -- URL wins, ACS renders for this navigation; pref stays `handbook` for next default load.

## SH-22: Mobile -- explicit degraded layout

1. Resize browser to 600x900.
2. Land on `/study`.
3. **Expected:** Progress pills stack vertically. Tiles wrap to 2 per row. Map collapses to ACS-only with a notice "Switch to desktop for the full map." Citation panel stacks handbook above regulation. Functional but visibly secondary -- mobile is supported, not optimized.

## SH-23: Validation -- invalid tab param

1. Navigate to `/study?tab=bogus`.
2. **Expected:** Server redirects to `/study` (no tab param) or silently falls back to `acs`. No 500 error.

## SH-24: Edge case -- syllabus not yet authored

1. Set a primary goal pointing at a credential whose primary syllabus is not yet authored (or seed one for testing).
2. Land on `/study`.
3. **Expected:** ACS map shows empty-state "Syllabus not yet authored." Progress strip shows 0/0 (renders as `--%` or `0%`). Today prose: "You're caught up." or equivalent. Tiles still functional.

## SH-25: Edge case -- handbook with no citing nodes

1. Switch to Handbook tab.
2. **Expected:** Handbooks with zero citing knowledge nodes do not appear in the list. If all handbooks are empty, the panel shows "No knowledge nodes have citations yet."

## SH-26: Edge case -- course lesson with broken citation

1. Manually edit a course lesson frontmatter to cite a nonexistent knowledge node slug.
2. Reload the Course tab.
3. **Expected:** The lesson still renders. The broken cite is silently dropped from the rollup. Dev console shows a warning.

## SH-27: Performance -- initial render

1. Open Chrome DevTools Network tab, hard reload `/study` as Abby.
2. **Expected:** Server response under 200 ms. Total page load under 1 second on a fresh dev server.

## SH-28: Accessibility -- keyboard navigation

1. From the URL bar, focus the page (Tab into it).
2. Tab through the page.
3. **Expected:** Focus order is logical (page header -> credential dropdown -> progress strip -> today panel link -> tile 1 -> tile 2 -> tile 3 -> tile 4 -> tile 5 -> map tab strip -> first map area). Each focusable element shows a visible focus ring.

## SH-29: Accessibility -- screen reader

1. Enable VoiceOver (or screen reader of choice).
2. Navigate to `/study`.
3. **Expected:** Progress strip is announced as "37 percent understood, 154 of 412 leaves" (or equivalent). Today prose is read as a paragraph. Tiles announce their label and badge ("Cards, 12 due"). Map area announces its title and rollup ("I. Preflight Preparation, 32 percent").

## SH-30: Citation chip click

1. Expand a leaf citation panel.
2. Click any citation chip.
3. **Expected:** Navigation to the flightbag section the chip links to. The chip's `href` resolves via `urlForReference()` and lands on the correct page.

## SH-31: Today panel focus link

1. With a focus topic resolved, click the focus topic title in the Today panel.
2. **Expected:** Navigation to `/knowledge/<focusNodeSlug>`. The knowledge node detail page renders.

## SH-32: bun run check

1. From the repo root: `bun run check`.
2. **Expected:** 0 errors, 0 warnings. The new files conform to project conventions.

## SH-33: Vitest suite

1. From the repo root: `bun test`.
2. **Expected:** All tests pass, including new tests under `apps/study/src/routes/(app)/study/_lib/`.

## SH-34: Playwright e2e

1. From the repo root: `bunx playwright test tests/e2e/study-home.spec.ts`.
2. **Expected:** All e2e cases pass on the local dev server.

## SH-35: user_pref -- invalid value rejected

1. Direct POST to `?/setPref` with `key = 'study.home.citation_order'` and `value = 'bogus'`.
2. **Expected:** Validation rejects (Zod failure). No row written. Form returns an error.

## SH-36: user_pref -- audit emitted

1. Set citation order to `'reg'`.
2. Navigate to `/admin/audit` (hangar).
3. **Expected:** Audit row visible with `target_type = 'study.user_pref'`, op `update` (or `create` on first set), actor = the user.

## SH-37: user_pref -- cascade on user delete

1. Test fixture: create a user, set 2 prefs, delete the user.
2. **Expected:** Both `user_pref` rows deleted (FK ON DELETE CASCADE).

## SH-38: Course frontmatter -- all 10 weeks have cites

1. Run `bun run check:course-frontmatter`.
2. **Expected:** 0 errors. Every lesson has either a `cites:` block or a `pending_review:` marker.

## SH-39: Course projection -- pending_review badge

1. Set up a fixture lesson with `pending_review: 'no clear ACS leaf'`.
2. Switch map to Course tab; expand the week containing that lesson.
3. **Expected:** Lesson row renders with a `(pending review)` badge. Lesson does not contribute to week mastery rollup.
