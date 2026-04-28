---
title: 'Test Plan: Lens UI'
product: study
feature: lens-ui
type: test-plan
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 8
---

# Test Plan: Lens UI

Manual walkthrough for [spec.md](./spec.md). User zero (Joshua) walks every row, on dev seed (Abby user), before the WP merges. Per project rule: no merge without a manual test plan signed off.

## Setup

| Step | Action                                                        | Expected                                                              |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | `bun run db:reset && bun run db:seed`                         | OrbStack postgres (port 5435) reset; Abby + handbooks + ACS seeded.   |
| 2    | `bun run dev`                                                 | Study app live on the configured dev port.                            |
| 3    | Sign in as `abby@airboss.test`                                | Lands on `/dashboard` with non-empty cards / reps / calibration data. |
| 4    | Confirm at least one PHAK Ch. 12 section has a citing node    | Use Drizzle Studio or `bun run db sources show phak ch-12 sec-3`.      |

## Handbook lens

| #   | Route                                                    | Action                                                                                | Expected                                                                                                     |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| H1  | `/lens/handbook`                                         | Open via LensPicker -> Handbook                                                       | Index lists PHAK / AFH / AvWX with active edition; per-doc rollup (sections read, nodes citing).             |
| H2  | `/lens/handbook`                                         | Click PHAK card                                                                       | Lands on `/lens/handbook/phak?edition=<active-slug>`. URL contains the resolved active edition.              |
| H3  | `/lens/handbook/phak`                                    | Inspect chapter list                                                                  | Each chapter row shows section count, citing-node count, mastered-count chip.                                |
| H4  | `/lens/handbook/phak/ch-12`                              | Open chapter view                                                                     | Sections list with per-section citing-node chips. Mastery state pill visible for each chip.                  |
| H5  | `/lens/handbook/phak/ch-12`                              | Click a citing-node chip                                                              | Navigates to `/knowledge/<slug>` (existing detail page). Browser back returns to chapter view, scroll kept.  |
| H6  | `/lens/handbook/phak?edition=<superseded-slug>`          | Manually pin a superseded edition via query string                                    | Edition banner appears: "Newer edition available -- switch". Banner CTA flips back to active edition.        |
| H7  | `/lens/handbook/phak/ch-12`                              | Mark a section "comprehended" via the inline read-state widget                        | Toast confirms; rollup on `/lens/handbook/phak` reflects new mastery within one navigation cycle.            |
| H8  | `/lens/handbook/this-doc-does-not-exist`                 | Hit a doc that has no `reference` row                                                 | 404-style empty state with a "Back to handbook lens" link. No console error.                                 |

## Weakness lens

| #   | Route                                | Action                                                                  | Expected                                                                                                     |
| --- | ------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| W1  | `/lens/weakness`                     | Open via LensPicker -> Weakness                                         | Domain rollup at top (existing `WeakAreasPanel` shape). Three severity sections below.                       |
| W2  | `/lens/weakness`                     | Inspect `severe` bucket                                                 | Top-N nodes (default 10) listed with score and reasons chips. Sort: score descending.                        |
| W3  | `/lens/weakness`                     | Inspect `mild` bucket                                                   | At least one node, fewer reasons per row than `severe`. Score < 0.40.                                        |
| W4  | `/lens/weakness/severe`              | Drill into severe                                                       | Full ranked list (default 100). Reasons fully expanded per row. Pagination if > 100.                         |
| W5  | `/lens/weakness/severe`              | Click "Drill" CTA on a row                                              | Routes to a new study session prefilled with that node. Confirm the session targets the node ID.             |
| W6  | `/lens/weakness/moderate`            | Reload                                                                  | URL persists. Bucket loads independently of severe / mild buckets.                                           |
| W7  | `/lens/weakness`                     | Sign in as a fresh user with no calibration / cards                     | All three buckets render the empty state with onboarding link to start a session.                            |
| W8  | `/lens/weakness/not-a-severity`      | Hit invalid severity                                                    | 404-style empty state, no crash.                                                                             |

## Cross-cutting / regressions

| #   | Concern                                                               | Action                                                                | Expected                                                                                |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| R1  | LensPicker shows correct active state                                 | Navigate handbook -> weakness -> credentials -> goals                 | Picker highlights the matching kind on each surface.                                    |
| R2  | Existing `/handbook/...` reader still works                           | Open `/handbook/phak/ch-12/sec-3`                                     | Renders normally; no shared-state bleed from `/lens/...`.                               |
| R3  | Existing `/dashboard` `WeakAreasPanel` still works                    | Open `/dashboard`                                                     | Domain panel renders; no errors. Same data shape as before.                             |
| R4  | Existing `/credentials/[slug]` (sibling WP) reachable from picker     | Click ACS in the picker                                               | Routes to `/credentials` index (sibling WP renders the page).                           |
| R5  | a11y: keyboard nav across LensPicker + bucket sections                | Tab through every focusable element on `/lens/weakness`               | Focus order matches visual order; visible focus ring on every control.                  |
| R6  | a11y: screen reader announces severity buckets                        | Use macOS VoiceOver on `/lens/weakness`                               | Each section has a heading announced as "Severe weaknesses, 10 items" (or similar).     |
| R7  | Performance: chapter view with many citing nodes                      | Open the PHAK chapter with the most citing nodes (likely Ch. 8 or 12) | Page paints in < 500ms on the dev machine; no layout shift after data hydrates.         |

## Sign-off

- [ ] Joshua walked every row above and confirmed expected behavior on dev seed.
- [ ] No row is `[s]`-skipped without an explicit reason captured in `tasks.md`.
- [ ] Date + commit SHA recorded here on sign-off.
