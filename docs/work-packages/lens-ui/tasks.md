---
title: 'Tasks: Lens UI'
product: study
feature: lens-ui
type: tasks
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 8
---

# Tasks: Lens UI

Phased plan for [spec.md](./spec.md). Order: contract first (constants + the one new BC function), then handbook lens routes, then weakness lens routes, then picker shell, then polish.

Depends on: cert-syllabus-and-goal-composer (lens framework + ACS lens shipped, PR #254). Depends on: handbook-ingestion-and-reader (`reference`, `handbook_section`, `handbook_figure`, `getNodesCitingSection`). Depends on: calibration-tracker (calibration BC + `getCalibrationPageData`).

## Status legend

- `[ ]` not started
- `[~]` in progress
- `[x]` done
- `[s]` skipped (with reason)

## Pre-flight

- [ ] Read `docs/decisions/016-cert-syllabus-goal-model/decision.md` phase 8 row.
- [ ] Read `docs/decisions/020-handbook-edition-and-amendment-policy.md`.
- [ ] Read `docs/agents/reference-citations-pattern.md` (mounting picker, chips, cited-by panel).
- [ ] Read `libs/bc/study/src/lenses.ts` (lens framework types + ACS / Domain implementations).
- [ ] Read `libs/bc/study/src/handbooks.ts` (every BC function the handbook lens consumes).
- [ ] Read `libs/bc/study/src/dashboard.ts` (`getWeakAreas`, `getRepBacklog`, `WeakArea*` types).
- [ ] Read `libs/bc/study/src/calibration.ts` (`getCalibrationPageData`).
- [ ] Read `apps/study/src/routes/(app)/dashboard/_panels/WeakAreasPanel.svelte` (existing weak-area UI shape).
- [ ] Read existing handbook reader pages under `apps/study/src/routes/(app)/handbook/` for chapter / section composition patterns.
- [ ] Confirm Open Question 1 (weakness signal weights) with Joshua before Phase 0.

## Phase 0: Constants + types contract

- [ ] Add `WEAKNESS_SEVERITY` + `WEAKNESS_SEVERITY_VALUES` + `WeaknessSeverity` + `WEAKNESS_SEVERITY_LABELS` to `libs/constants/src/credentials.ts`.
- [ ] Add `WEAKNESS_SIGNAL_KINDS` + values + `WeaknessSignalKind` + labels.
- [ ] Add `WEAKNESS_SIGNAL_WEIGHTS` (numeric record keyed by signal kind; values from spec open question).
- [ ] Add `WEAKNESS_SEVERITY_THRESHOLDS` (numeric record keyed by severity; defaults from spec).
- [ ] Add `WEAKNESS_LIMITS` (`indexTopN`, `bucketTopN`).
- [ ] Add `ROUTES.LENS_HANDBOOK`, `ROUTES.LENS_HANDBOOK_DOC`, `ROUTES.LENS_HANDBOOK_CHAPTER`, `ROUTES.LENS_WEAKNESS`, `ROUTES.LENS_WEAKNESS_BUCKET` to `libs/constants/src/routes.ts`.
- [ ] Update `LENS_KIND_LABELS` if any label drift; otherwise leave alone.
- [ ] Unit tests for `WEAKNESS_SIGNAL_WEIGHTS` summing to 1.00 and severity thresholds being monotonically decreasing.
- [ ] `bun run check` clean.

## Phase 1: Weak-node BC

- [ ] Add `WeakNode` interface and `WeakNodeReason` discriminated union to `libs/bc/study/src/dashboard.ts`.
- [ ] Implement `getWeakNodes(userId, options, db, now)` reading: card stats, rep stats, calibration points, never-attempted graph nodes scoped to the user's active goal (or all studied nodes if no goal).
- [ ] Score each candidate node: weighted sum of normalized signals (each in `[0, 1]`).
- [ ] Bucket by `WEAKNESS_SEVERITY_THRESHOLDS`; below `mild` floor -> excluded.
- [ ] Unit tests in `dashboard.test.ts`: calibration-only, overdue-only, accuracy-only, never-attempted-only, mixed; severity bucketing.
- [ ] Integration test: seeded Abby session yields a non-empty `severe` bucket.
- [ ] `bun run check` clean.

## Phase 2: Handbook lens routes

- [ ] Create `apps/study/src/routes/(app)/lens/+layout.svelte` housing the `LensPicker`.
- [ ] Create `apps/study/src/routes/(app)/lens/handbook/+page.server.ts` and `+page.svelte` for the index view (Spec In-Scope #1).
- [ ] Create `apps/study/src/routes/(app)/lens/handbook/[doc]/+page.server.ts` and `+page.svelte` for the doc view (#2). Honor `?edition=` query.
- [ ] Create `apps/study/src/routes/(app)/lens/handbook/[doc]/[chapter]/+page.server.ts` and `+page.svelte` for the chapter view (#3).
- [ ] Reuse `HandbookSectionCard` and section read-state widget components from the handbook reader (move to `libs/ui/` if currently inlined under reader).
- [ ] Citing-nodes panel per section: list of node chips with mastery state pill (mastered / due / overdue / never-attempted).
- [ ] Edition banner component when active edition <> resolved edition (Spec #8).
- [ ] Empty / loading / error states wired (Spec #9).
- [ ] e2e test (Playwright) covering: index -> doc -> chapter -> citing node link works on dev seed.

## Phase 3: Weakness lens routes

- [ ] Create `apps/study/src/routes/(app)/lens/weakness/+page.server.ts` and `+page.svelte` for the index view (Spec #4).
- [ ] Top section reuses `WeakAreasPanel` (domain-level rollup) -- import from existing dashboard panel rather than re-implementing.
- [ ] Three severity buckets render `getWeakNodes` results limited by `WEAKNESS_LIMITS.indexTopN`.
- [ ] Create `apps/study/src/routes/(app)/lens/weakness/[severity]/+page.server.ts` and `+page.svelte` (Spec #5).
- [ ] Per-row reasons rendered via small `WeaknessReasonChip` (one per signal kind).
- [ ] "Drill" CTA links to `ROUTES.STUDY_SESSION_NEW` with the node ID prefilled (existing form-action route).
- [ ] Empty / loading / error states wired.
- [ ] e2e test (Playwright): index -> severe bucket -> drill button queues a session.

## Phase 4: LensPicker + cross-links

- [ ] Build `LensPicker` component in `libs/ui/src/components/` reading from `LENS_KINDS`.
- [ ] Mount `LensPicker` in `(app)` shell header.
- [ ] Picker entries for ACS / Domain link out to `/credentials` and `/credentials` index respectively (sibling WP `cert-dashboard` owns those targets; this WP only links).
- [ ] Picker preserves query state when switching between handbook and weakness lenses (filter chips persist where they overlap).
- [ ] Visual a11y review (focus trap, keyboard nav, color contrast against existing tokens).

## Phase 5: Polish + docs

- [ ] Run `/ball-review-full`. Address every finding.
- [ ] Run `/ball-review-a11y` against the new routes.
- [ ] Update `docs/products/study/PRD.md` lens UI section.
- [ ] Update `docs/products/study/ROADMAP.md`: ADR 016 phase 8 row.
- [ ] Update `docs/decisions/016-cert-syllabus-goal-model/decision.md` migration plan: phase 8 status -> shipped.
- [ ] Walk `test-plan.md` end-to-end with Joshua. Capture sign-off.
- [ ] `bun run check` clean. All tests pass. PR opens.
