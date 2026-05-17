---
title: course-tree-arbitrary-depth -- manual walkthrough (N-deep course tree)
date: 2026-05-16
wp: course-tree-arbitrary-depth
status: ready-for-walk
machine: scaffold
branch: scaffold
prompt: scaffold the owed course-tree-arbitrary-depth manual-test walkthrough from spec + shipped code
---

# course-tree-arbitrary-depth -- manual walkthrough

Walk this end-to-end before flipping `human_review_status: signed-off` on the [course-tree-arbitrary-depth WP](../../work-packages/course-tree-arbitrary-depth/spec.md). This is a scaffold drafted from [spec.md](../../work-packages/course-tree-arbitrary-depth/spec.md) and [test-plan.md](../../work-packages/course-tree-arbitrary-depth/test-plan.md) and the shipped routes. Joshua runs the test and signs off. The WP does not close until he does.

After each step, check one box:

- [ ] **PASS** -- behaves as the expected-result column says
- [ ] **ISSUE** -- file via `bun run bug new <slug>` and report
- [ ] **REJECT** -- the shape itself is wrong; re-discuss before sign-off

## What this verifies

The course tree moved from a fixed 2-level shape (section -> step) to an N-deep shape (section -> lesson -> ... -> step), shipped across PRs #934, #935, #938, #943, #944 (Phases A-E). This walk confirms the recursive schema and validators hold, the renderer shows lesson and section landing pages, prev/next traverses leaves depth-first, the existing weather-comprehensive course renders unchanged as a regression baseline, and the cert overlay aggregates leaf coverage up the tree with leaf-only study-plan selection.

The automated coverage (Vitest schema / YAML / seed / lens cases, Playwright `tests/e2e/course-tree-n-deep.spec.ts`) lives in the test-plan. This walkthrough covers the manual cases: the visible UI behaviour.

## Setup

Run from the **parent repo** (the worktree this walkthrough was authored in does not carry `.env`).

```bash
cd /Users/joshua/src/_me/aviation/airboss
git checkout main && git pull --ff-only origin main
bun install
bun run db reseed
bun scripts/dev.ts study
```

Wait for `Local: http://127.0.0.1:9600/`. Open the study app in a real browser, devtools open. Sign in as Abby (`abby@airboss.test`).

The 3-level reference fixture lives at `course/courses/_fixtures/three-level-tree-fixture/`. If `bun run db reseed` did not load it, note that and report -- the nested-tree steps below depend on it.

## Steps

### 1. Reseed is clean

- **Command:** `bun run db reseed`
- **Expected:** completes with zero errors. The seeder reports the weather-comprehensive course and the 3-level fixture both seeding without `CourseSeedError`.
- [ ] PASS / ISSUE / REJECT

### 2. weather-comprehensive renders as the 2-level regression baseline

- **Route:** `/courses/weather-comprehensive`
- **Action:** view the course landing page
- **Expected:** the outline renders as before this WP: section headings, indented step lists, every link resolves. No `lesson`-level rows appear (weather-comprehensive is authored 2-level). Visually identical to the pre-WP outline (test-plan T5.1, T6.1).
- [ ] PASS / ISSUE / REJECT

### 3. A weather-comprehensive leaf step renders unchanged

- **Route:** `/courses/weather-comprehensive/<any leaf stepCode>` (pick any step from the outline)
- **Action:** open the step
- **Expected:** the leaf renders identically to before -- knowledge-node phases plus the step framing. Devtools console clean (test-plan T5.3).
- [ ] PASS / ISSUE / REJECT

### 4. 3-level course landing renders a nested outline

- **Route:** `/courses/<3-level-fixture-slug>` (the slug the fixture mounts under -- check the fixture `manifest.yaml`)
- **Action:** view the course landing page
- **Expected:** section renders as a top-level heading, lesson renders as a nested heading with an indented child-step list, every link resolves. The structure matches the authored YAML exactly (test-plan T5.2).
- [ ] PASS / ISSUE / REJECT

### 5. A section URL renders a section landing page

- **Route:** a section-level URL in the 3-level fixture
- **Action:** open the section
- **Expected:** the page shows the section title, a breadcrumb (course -> section), the section `body_md`, and a list of children -- a mix of lessons and direct steps with level badges (test-plan T5.5).
- [ ] PASS / ISSUE / REJECT

### 6. A lesson URL renders a lesson landing page

- **Route:** a lesson-level URL in the 3-level fixture
- **Action:** open the lesson
- **Expected:** the page shows the lesson title, a breadcrumb (course -> section -> lesson), the lesson `body_md`, and a list of children, each with a title, a truncated body, and a link (test-plan T5.4).
- [ ] PASS / ISSUE / REJECT

### 7. Prev/next traverses leaves depth-first

- **Route:** the first leaf of the 3-level fixture
- **Action:** click "next" repeatedly until the link is gone
- **Expected:** the visit order is leaves in document order (`flattenLeavesDepthFirst`): all leaves of lesson 1 before lesson 2, and so on. The final "next" link is absent on the last leaf (test-plan T5.6).
- [ ] PASS / ISSUE / REJECT

### 8. Prev/next on a lesson landing jumps to the lesson's first leaf

- **Route:** a lesson-level URL in the 3-level fixture
- **Action:** click "next"
- **Expected:** lands on that lesson's first leaf step (test-plan T5.7).
- [ ] PASS / ISSUE / REJECT

### 9. Prev/next on a section landing crosses section boundaries

- **Route:** a section-level URL in the 3-level fixture (not the first section)
- **Action:** click "prev"
- **Expected:** lands on the previous section's last leaf (test-plan T5.8).
- [ ] PASS / ISSUE / REJECT

### 10. Prev/next is suppressed at the course start

- **Route:** the course's very first leaf
- **Expected:** only a "next" link is shown; "prev" is suppressed (test-plan T5.9).
- [ ] PASS / ISSUE / REJECT

### 11. Prev/next labels carry destination context

- **Route:** any mid-course leaf in the 3-level fixture
- **Action:** read the prev/next link text
- **Expected:** the text reads "Next: <Section> / <Lesson> / <Step>" so the destination is unambiguous (test-plan T5.10).
- [ ] PASS / ISSUE / REJECT

### 12. Cert overlay aggregates leaf coverage up the tree

- **Route:** `/program/goals/[id]` for an Abby goal that pairs the 3-level fixture (or weather-comprehensive) with an ACS goal, then the course outline with the cert overlay active
- **Action:** view a lesson or section with some leaves covered and some not
- **Expected:** the lesson rollup shows "<covered> / <total> covered" aggregated from its leaf descendants; the section rollup mirrors the aggregate of its lessons. Coverage rolls up; it is not authored at the lesson or section level (test-plan T4.3, T6.3).
- [ ] PASS / ISSUE / REJECT

### 13. Study-plan session selection picks leaves only

- **Route:** build a study session for a goal that references a course with lessons (study app session builder)
- **Action:** start the session and inspect the selected cards
- **Expected:** every selected card resolves to a leaf step row. No lesson-level or section-level row is selected -- non-leaf rows carry no knowledge-node binding and must be skipped (test-plan T6.4).
- [ ] PASS / ISSUE / REJECT

### 14. WX Scenarios section walks end-to-end

- **Route:** `/courses/weather-comprehensive` -> WX Scenarios section -> first scenario lesson
- **Action:** open the first scenario lesson landing, click into its first substep, then click "next" through the substeps and into the next lesson
- **Expected:** the lesson landing renders with breadcrumb plus body plus a list of substeps; the first substep renders the knowledge-node content as a leaf; "next" walks all substeps in document order and then crosses into lesson 2's first substep. Devtools console clean (test-plan T6.2, manual smoke 5-9).
- [ ] PASS / ISSUE / REJECT

## Sign-off

Only flip when every step above is PASS:

```bash
bun run wp set course-tree-arbitrary-depth human-review signed-off
```

(Per the ADR-025 lint, only Joshua's email can flip `human_review_status`. The `status: shipped` move is gated on `human_review_status: signed-off`.)

## Related

- [spec.md](../../work-packages/course-tree-arbitrary-depth/spec.md) -- recursive schema, validators, renderer, overlay
- [test-plan.md](../../work-packages/course-tree-arbitrary-depth/test-plan.md) -- full T-case matrix (schema / YAML / seed / lens / renderer)
- [design.md](../../work-packages/course-tree-arbitrary-depth/design.md) -- file layout and contracts
- [OUT-OF-SCOPE.md](../../work-packages/course-tree-arbitrary-depth/OUT-OF-SCOPE.md) -- deferred items
