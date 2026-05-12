---
title: Hangar Platform Dashboard -- Tasks
product: hangar
feature: hangar-platform-dashboard
type: tasks
status: ready-for-review
review_status: pending
---

# Hangar Platform Dashboard -- Tasks

Phased build. Phases 1-2 are data structure + agent rules (must precede dashboard code). Phases 3-4 ship the drift skill + size check (so the dashboard has data). Phases 5-7 ship the dashboard. Phase 8 is polish + e2e.

**Depends on [hangar-review-queue](../hangar-review-queue/spec.md) Phases 1-3** (substrate, loader, docs browser).

## Phase 1 -- Structured frontmatter blocks (data backfill)

Goal: every authoritative source has the structured shape the dashboard needs.

- [ ] Add structured `in_flight` / `just_shipped` / `follow_ons` blocks to `docs/work/NOW.md`. Backfill from current prose: 3 in-flight items, 8 most recent shipped items, all named follow-ons from the cert-syllabus and other sections.
- [ ] Add structured `items:` array to each `docs/products/{app}/ROADMAP.md`. Apps: study, sim, hangar, runway. Backfill ~10-30 items each from existing prose. Status values per spec.
- [ ] Standardize ADR frontmatter: every `docs/decisions/NNN-*.md` and `NNN-*/decision.md` has `adr`, `title`, `status`, `superseded_by` (optional), `date` fields. Backfill missing values from body content.
- [ ] Add light frontmatter to `docs/platform/IDEAS.md`: `last_reviewed` + per-section `last_reviewed`.
- [ ] Verify all changes parse with the planned validators (run them locally before committing).

Acceptance: `bun run check` clean, every structured block parses, no auth/lint errors. WP list / NOW.md / ROADMAPs / ADRs / IDEAS.md all have the documented frontmatter shape.

## Phase 2 -- CLAUDE.md updates (agent rules)

Goal: agents know to keep the structured blocks and the prose in sync.

- [ ] Add "Platform tracking -- keeping the dashboard accurate" section to CLAUDE.md, listing the rules from [spec.md Pillar 2](./spec.md#pillar-2----discipline-agent-rules--drift-skill).
- [ ] Add "Doc size limits" section to CLAUDE.md per [spec.md Pillar 4](./spec.md#pillar-4----doc-size-discipline). Hard cap 500, warn 400, listed split patterns.
- [ ] Reference both new sections from "Before You Build" and "Critical Rules."
- [ ] Verify CLAUDE.md itself stays under 500 lines (it's already long; this might force its own split -- if so, do it now per the index-and-linked-sub-docs pattern).

Acceptance: a fresh agent reading CLAUDE.md learns the structured-block update rule and the 500-line cap.

## Phase 3 -- /wp-drift skill

Goal: agents (and the dashboard) have a single way to detect and fix drift, with don't-repeat-work checkpointing.

- [ ] Create `~/src/_me/ai/agent-skills/skills/wp-drift/` with the layout in [design.md](./design.md#wp-drift-skill-internals).
- [ ] `lib/checkpoint.ts`: load/save/migrate the JSON checkpoint at `.claude/skills-state/wp-drift/last-run.json`. Schema version 1. Migration path placeholder.
- [ ] `lib/fingerprint.ts`: SHA256 of file content. Bun's `Bun.hash` or Node `crypto`.
- [ ] `lib/scan.ts`: enumerate sources -- WPs, NOW.md, each ROADMAP, each ADR, IDEAS.md.
- [ ] `lib/validate.ts`: per-source validators per [design.md table](./design.md#validators-one-per-source). Each returns a typed result.
- [ ] `lib/autofix.ts`: implementations for the safe-fix cases. Each touches one file, returns success/error.
- [ ] `lib/triage.ts`: pretty-print the human-judgement list.
- [ ] CLI surface: `--all`, `--since=DATE`, `--touched-since=REF`, `--fix`, `--triage` flags.
- [ ] Output format per [design.md](./design.md#output-format).
- [ ] Add `.claude/skills-state/` to `.gitignore` (per-machine state).
- [ ] Tests: Vitest cases for each validator with golden frontmatter fixtures; one auto-fixer end-to-end (modifies a temp file, asserts post-state).

Acceptance: `/wp-drift` runs cold, scans everything, reports drift. Re-running with no changes runs in <30s (fingerprint-skip). `/wp-drift --fix` resolves the obvious cases. The triage list is short and actionable.

## Phase 4 -- Doc size check script

Goal: enforce the 500-line cap.

- [ ] `scripts/docs/size-check.ts`: walks `docs/**`, `course/**`, `handbooks/**`, `regulations/**`. Emits JSON report `{ violations: [{ path, lines, suggested_split }], near_limit: [...] }`.
- [ ] `bun run docs:size-check` package.json alias.
- [ ] Wire into `/wp-drift`: drift skill calls the size-check, merges its output into the checkpoint's `size_violations` array.
- [ ] Suggested-split pattern: per-file lookup matching the spec's table; defaults to "index-and-linked-sub-docs" for unknown patterns.

Acceptance: running `bun run docs:size-check` lists current violators (NOW.md probably qualifies). `/wp-drift` includes size violations in its report.

## Phase 5 -- Dashboard substrate + Now bar + WP status board

Goal: the simplest dashboard panes wired up first.

- [ ] Constants: `libs/constants/src/platform.ts` (statuses, thresholds, app list), routes additions.
- [ ] Schema: add `hangar.coverage_scan_result` table.
- [ ] BC: `libs/bc/hangar/src/platform.ts` -- `getNowBarData`, `getWpStatusList`, `getDriftSummary`, `getDocHealthSummary`.
- [ ] Loader extensions per [design.md](./design.md#loader-extensions): roadmap_item, adr discovery rules. Items appear in `review_item` rows.
- [ ] `/platform/+page.server.ts` -- aggregates pane data via `getPlatformDashboard()`.
- [ ] `/platform/+page.svelte` -- composes panes.
- [ ] Components: `NowBar.svelte`, `WpStatusBoard.svelte`, `DriftPane.svelte`, `DocHealthPane.svelte` in `libs/ui/src/platform/`.
- [ ] Filter bar: app / status / search. URL state.
- [ ] Sidebar nav: add Platform entry.

Acceptance: `/platform` renders with NowBar + WP board + drift pane + doc health pane populated from real data.

## Phase 6 -- Roadmap + ADR + Ideas + Recent activity

Goal: more panes wired up.

- [ ] `RoadmapPanes.svelte` -- per-app columns. Card per item with status pill + WP link. Timeline toggle stub (disabled, "Coming soon").
- [ ] `AdrIndex.svelte` -- table sorted by ADR number, status pill.
- [ ] `IdeasFunnel.svelte` -- section list with counts + freshness chip ("3 days ago" / "stale -- 30+ days").
- [ ] `RecentActivity.svelte` -- last N commits via `getRecentActivity(50)`. Detects WP-touched commits and highlights with WP-link chip.
- [ ] BC: `getRoadmapData`, `getAdrIndex`, `getIdeasFunnelData`, `getRecentActivity`.
- [ ] Full-page detail routes: `/platform/wp`, `/platform/roadmap`, `/platform/adr`, `/platform/drift` -- each shows the full pane unconstrained.

Acceptance: every pane in the layout sketch is rendering real data. Click-throughs go to the right `/docs/...` or `/review/...` deep links.

## Phase 7 -- Coverage gaps + drift fix actions

Goal: the action-oriented panes.

- [ ] `scripts/wp/coverage.ts` -- walks `apps/{app}/src/routes/**`, `libs/bc/**`, computes uncovered features. Emits JSON.
- [ ] `bun run wp:coverage` alias.
- [ ] BC: `runCoverageScan` (spawns the script, persists to `coverage_scan_result`), `getCoverageScanResult`.
- [ ] `CoverageGaps.svelte` -- button + result table. Button disabled while running.
- [ ] DriftPane "Auto-fix" button: form action invokes `/wp-drift --fix --only=<id>`. Snooze action sets a 7-day expiry on the drift item in the checkpoint.
- [ ] Fold the existing `now-md-drift` scheduled job into `/wp-drift`. Update the job to call the skill; the dashboard reads the checkpoint.

Acceptance: clicking "Run scan" populates coverage gaps. Clicking "Auto-fix" on a drift row resolves it and removes the row.

## Phase 8 -- Polish + e2e

- [ ] Playwright e2e: load /platform, verify all panes render, click through to a WP review view.
- [ ] Playwright e2e: trigger coverage scan, verify result renders.
- [ ] Playwright e2e: drift auto-fix flow on a seeded drift case.
- [ ] Visual polish: status color tokens, spacing, animation on pane expand.
- [ ] `/ball-review-full` pass; fix everything; flip status to ready-for-review.
- [ ] Verify CLAUDE.md updates from Phase 2 are still accurate.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
