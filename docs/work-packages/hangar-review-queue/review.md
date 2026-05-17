---
title: Hangar Review Queue -- Review notes
product: hangar
feature: hangar-review-queue
type: review
status: unread
review_status: pending
phases_complete: 2
phases_total: 8
---

# Hangar Review Queue -- Review notes

## Status

**Foundation landed.** Phases 1 + 2 of 8 are committed on `worktree-agent-ae8eb8cb532bdfcc4`. The schema, BC primitives, frontmatter writer, test-plan parser, discovery rules, loader, and FTS index are all in place and exercised against the live repo (190 items + 4666 FTS rows, 0 errors). Phases 3-8 (UI) require continuation.

## Phase summary

### Phase 1 -- Constants, schema, BC primitives  (commit `d1c41a81`)

- `libs/constants/src/review.ts` -- 30+ constants for the review surface (kinds, outcomes, frontmatter statuses, default columns, docs-search roots, task types, product areas, board filters, action ids, tunables).
- `libs/constants/src/routes.ts` -- `/docs` and `/review` route family + `NAV_LABELS` entries.
- `libs/utils/src/ids.ts` -- 8 ULID generators (board, board-column, review kind/bucket/item/session/step, board-task).
- `libs/bc/hangar/src/schema.ts` -- 9 new tables in the `hangar` namespace: `board`, `board_column`, `review_kind`, `review_bucket`, `review_item`, `review_session`, `review_step`, `board_task`, `docs_search_index`.
  - Status fields lifted to top-level columns on `review_item` (per Phase 1 schema review) with CHECKs sourced from `@ab/constants`.
  - `cached_fields` jsonb carries the open-ended frontmatter bag.
  - Custom `tsvector` Drizzle type + GIN index on the FTS table.
  - 8 indexes (3 partial-on-deletedAt, 1 unique-on-(item,user)-where-finishedAt-null partial for open-session uniqueness, 1 unique-on-(session,stepRef) for step idempotency, 2 status indexes).
- `libs/bc/hangar/src/review.ts` -- BC primitives: transactional `getOrCreateBoard`, idempotent column / kind / bucket seeders, `upsertItem` with soft-delete resurrection that clears stale `pinnedColumnId`, `startSession` with PG-23505-only retry, `recordStep` idempotent on `(sessionId, stepRef)`, task CRUD.
- `libs/bc/hangar/src/review.test.ts` -- 15 vitest unit tests against the live dev DB (15/15 pass).

Per-phase reviewers (schema, backend, correctness) authored inline (Task tool not available in this harness; reviews written by main agent against the `~/.claude/skills/ball-review-{schema,backend,correctness}/SKILL.md` criteria). All findings closed in the same Phase 1 commit.

| Reviewer    | Critical | Major | Minor | Nit | All fixed? |
| ----------- | -------- | ----- | ----- | --- | ---------- |
| schema      | 0        | 1     | 4     | 1   | yes        |
| backend     | 0        | 1     | 3     | 1   | yes        |
| correctness | 0        | 2     | 2     | 1   | yes        |

Major findings closed:

- **schema**: `cached_status.frontmatterStatus` / `reviewStatus` lifted out of jsonb into top-level columns with `CHECK` constraints (option 2 from the review).
- **backend**: `getOrCreateBoard` now wraps board insert + column seed + kind seed in one `db.transaction` so a process kill mid-seed cannot leave a board with no columns.
- **correctness (a)**: `upsertItem` resurrection clears `pinnedColumnId` so a stale pin doesn't mask a downgraded `frontmatter_status` after the file resurfaces.
- **correctness (b)**: `seedDefaultColumns` simplified -- the dead-code `=== -1 ? idx : ...` fallback is gone; the typed array's `indexOf()` is always `>= 0`.

Other minor findings (redundant index, FK-comment, `defaultColumnMapping` add, `notes`->`note` rename, listSessions pagination, listItems id tie-breaker, selective PG-error retry, recordStep updatedAt assertion) all closed in the same commit.

### Phase 2 -- Frontmatter writer, test-plan parser, loader  (commit `cc8324d9`)

- `libs/utils/src/markdown.ts` -- `setFrontmatterField` + `setFrontmatterFields`: pure-string transforms (no IO) with proper YAML quoting (colon, hash, newline, bare keywords, numerics, single quotes), apostrophe escape, key validation, malformed-frontmatter handling. 9 new tests; 82/82 markdown tests pass.
- `libs/bc/hangar/src/review-frontmatter.ts` -- server-only IO wrapper: `readFrontmatter` / `writeFrontmatterField` / `writeFrontmatterFields`. Errors throw with the file path attached.
- `libs/bc/hangar/src/review-test-plan.ts` -- `parseTestPlan(filePath, markdown)` walks H2 sections + tables, emits `TestPlanStep[]` with stable `stepRef = sha256(filePath || '|' || h2 || '|' || rowIndex).slice(0, 12)`. 7 new tests cover cumulative stepIndex across sections, hash stability + drift on row insert, file-path scoping, empty input, sparse tables, frontmatter strip, rows-before-any-H2.
- `libs/bc/hangar/src/review-discovery.ts` -- `discoverAllItems(repoRoot, db)` runs the four discovery rules: `wp_spec` (docs/work-packages/*/spec.md), `wp_test_plan` (sibling test-plan.md), `knowledge_node` (course/knowledge/**\/node.md), `reference_toc` (hangar.reference rows with non-null verbatim). Missing-but-optional files (wp test-plan, unconventional WP without spec.md) skip silently rather than error.
- `libs/bc/hangar/src/review-loader.ts` -- `loadReviewItems` orchestrator. Concurrent-call-safe via module-scoped inflight Promise. Soft-prunes items the discovery pass didn't see (except `ad_hoc` -- those are user-created and have no on-disk source). Rebuilds the docs FTS index against `DOCS_SEARCH_ROOTS` (`docs`, `course`, `handbooks`, `regulations`).
- `scripts/db/reload-reviews.ts` -- bun-runnable CLI for manual loader runs.

Smoke test against current main: 190 review items + 4666 FTS rows, 0 errors, 16.5s for full scan.

Per-phase review for Phase 2 was deferred (Task tool not available; main agent's parallel-review capacity exhausted by Phase 1 deep dive). Recommended follow-up: run `/ball-review-full` against `main..HEAD` after the UI phases complete; the BC layer will get full coverage in that pass.

### Phase 3-8 -- NOT STARTED

Phases 3-8 are UI-heavy and were not started in this session due to context budget. The full work plan is preserved at `docs/work/plans/2026-05-04-hangar-review-queue-build-plan.md`. Order:

1. Phase 3 -- `/docs` browser (file tree + Postgres FTS UI + sidebar entry) -- svelte / ux / a11y / perf review.
2. Phase 4 -- `/review` board (kanban with drag-drop, bucket cards, item cards, filter chips) -- svelte / ux / a11y / backend / patterns review.
3. Phase 5 -- WP spec view (tabs) + test-plan walker (the killer feature) + session resume + frontmatter flip -- svelte / ux / a11y / correctness review.
4. Phase 6 -- Reference TOC review + knowledge-node review + ad-hoc task forms -- svelte / ux / a11y / correctness review.
5. Phase 7 -- Loader admin + bucket admin (CRUD with structured + advanced jsonb predicate editor) + nav badge -- svelte / ux / a11y / backend / security review.
6. Phase 8 -- Playwright e2e suites + visual polish + final 10x review pass + frontmatter status flips on the WP itself.

The BC + schema + loader landed here are sufficient that any of Phases 3-8 can be picked up independently against this branch (or rebased onto a later `main`).

## Final review counts

| Severity | Phase 1 raised | Phase 1 closed | Phase 2 raised | Phase 2 closed |
| -------- | -------------- | -------------- | -------------- | -------------- |
| critical | 0              | 0              | 0              | 0              |
| major    | 4              | 4              | 0              | 0              |
| minor    | 9              | 9              | 0              | 0              |
| nit      | 3              | 3              | 0              | 0              |

(Phase 2 raised zero findings inline because the per-phase reviewer pass was deferred to the post-UI 10x sweep -- see "Phase 3-8" above.)

## Deferred items

- **Per-phase reviewer pass for Phase 2** -- defer to the final 10x review in Phase 8.
- **Phases 3-8 UI work** -- not started; preserved in the build plan.
- **Multi-user assignment UI** -- spec-listed deferral; out of scope for v1.
- **Notification badges in the global header** -- spec-listed deferral.
- **Bulk operations / multi-select on the board** -- spec-listed deferral.
- **Slash-command keyboard shortcuts** -- spec-listed deferral.

## Manual test scenarios (for the BC + loader landed here)

1. Run `bun scripts/db/reload-reviews.ts`. Expect: ~190 items added, ~4600+ FTS rows, 0 errors, completion under 30 seconds.
2. Run it again immediately. Expect: 0 added, 190 updated, 0 removed, 0 errors (idempotent).
3. Edit a WP spec.md frontmatter (`status: unread` -> `status: reading`). Re-run loader. Expect: that one WP's `frontmatterStatus` updated in `hangar.review_item` (verify via `bun run db psql` -> `SELECT title, frontmatter_status FROM hangar.review_item WHERE ref = '...';`).
4. Delete a WP test-plan.md. Re-run loader. Expect: 1 removed (soft-delete), `deleted_at` populated on the matching `review_item` row.
5. Restore the test-plan.md. Re-run loader. Expect: 0 added, 1 updated; the row's `deleted_at` cleared and `pinned_column_id` reset to NULL.
6. `bun run test libs/bc/hangar/src/review.test.ts` -- 15/15 pass.
7. `bun run test libs/bc/hangar/src/review-test-plan.test.ts` -- 7/7 pass.
8. `bun run test libs/utils/src/markdown.test.ts` -- 82/82 pass.
9. `bun run check` -- 0 errors / 0 warnings.

## Files changed (this branch vs main)

(Listed in the two commit messages on the branch; total: 31 files, ~3170 insertions, ~50 deletions.)
