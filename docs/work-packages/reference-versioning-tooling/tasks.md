---
title: 'Tasks: Reference versioning tooling'
product: cross-cutting
feature: reference-versioning-tooling
type: tasks
status: unread
review_status: pending
---

# Tasks: Reference versioning tooling

Phase 5 of the ADR 019 rollout. Implementation order is tight: build pair-walker first, then body-hasher, then orchestrator, then rewriter, then CLI wiring, then fixture + integration tests.

## Phase A -- WP authoring

- [x] Author `spec.md`
- [x] Author `design.md`
- [x] Author `tasks.md` (this file)
- [x] Author `test-plan.md`
- [x] Author `user-stories.md`

## Phase B -- Implementation

### B1. Module scaffolding

- [ ] Create `libs/sources/src/diff/` directory.
- [ ] Create `libs/sources/src/diff/index.ts` (empty re-exports for now).
- [ ] Add a side-effect-free unit-test bootstrap for the diff module so `bun test libs/sources/diff/` works.

### B2. Pair walker

- [ ] Implement `walkEditionPairs(corpus)` against `getEditionsMap()` + `__sources_internal__.getActiveTable()`.
- [ ] Implement `latestEditionPair(corpus)` (returns null when fewer than two editions exist for the corpus).
- [ ] Define `EditionPair` type.
- [ ] Vitest `pair-walker.test.ts`: empty registry, single-edition, multi-edition (3 editions -> 3 cumulative pairs), multi-corpus (filter respects `corpus`).

### B3. Body hasher

- [ ] Implement `hashEditionBody(id, edition, opts)` -- resolve derivative path, read file, normalize body, SHA-256.
- [ ] Process-local cache keyed on `${id}::${edition}`.
- [ ] Re-export `normalizeText` from `regs/normalizer.ts` for the diff module's internal use.
- [ ] Vitest `body-hasher.test.ts`: hash equality for byte-identical bodies, hash equality across CRLF / LF, hash inequality for content change, missing-file returns null, cache hit on second call.

### B4. Alias resolver

- [ ] Implement `resolveAliasOutcome(pair)` -- wraps `productionRegistry.walkAliases`.
- [ ] Map alias kinds to outcome kinds per [§6.1](../../decisions/019-reference-identifier-system/decision.md).
- [ ] Vitest `alias-resolver.test.ts`: silent / content-change / cross-section / split / merge classification; `null` when no alias entry exists.

### B5. Diff orchestrator

- [ ] Implement `runDiffJob(args)` per the algorithm in `design.md`.
- [ ] Build the unified-diff snippet helper inline (myers-diff, ~30 lines, no new deps).
- [ ] Write report to `data/sources-diff/<corpus>-<old>-vs-<new>-<ISO-timestamp>.json`.
- [ ] Print human-readable summary: per-kind counts + top-10 needs-review entries with one-line snippet.
- [ ] Vitest `diff-job.test.ts`: end-to-end against 2026 + 2027 fixtures.

### B6. Lesson rewriter

- [ ] Implement `runRewrite(report, opts)` per `design.md`.
- [ ] Idempotent: second call with the same report mutates nothing.
- [ ] Refuse on non-empty `git status --porcelain` (production); test bypass via `skipGitCheck`.
- [ ] Preserves original line endings.
- [ ] Vitest `lesson-rewriter.test.ts`: single occurrence rewrite, multiple occurrences (mixed pins), idempotence, empty report no-op, dirty-tree refusal.

### B7. CLI runners

- [ ] Implement `runDiffCli(argv)` -- arg parsing, fixture-pair short-circuit, calls `runDiffJob`.
- [ ] Implement `runAdvanceCli(argv)` -- arg parsing, calls `runRewrite`.
- [ ] Vitest `cli.test.ts`: argv parsing for both, error paths.

### B8. `airboss-ref.ts` dispatcher

- [ ] Add `case 'diff'` and `case 'advance'` branches in `scripts/airboss-ref.ts`.
- [ ] Update `USAGE` constant.

### B9. Fixture: title-14-2027

- [ ] Author `tests/fixtures/cfr/title-14-2027-fixture.xml` per `design.md`'s fixture spec.
- [ ] Update `tests/fixtures/cfr/README.md` describing the 2026 vs 2027 differences.

### B10. Validator row-6 round-trip test

- [ ] Vitest `getEditionDistance.test.ts`:
    - Ingest 2026 + 2027 fixtures.
    - Set current edition to `'2027'`.
    - Validate a synthetic lesson with `?at=2025` -> expect row-6 WARNING.
    - Run `runRewrite` against a synthetic `2025 -> 2027` auto-advance report.
    - Re-validate -> expect zero findings.

### B11. Public surface

- [ ] Wire `libs/sources/src/diff/index.ts` re-exports.
- [ ] Add module-level JSDoc citing ADR 019 §5 + §6.1.

### B12. Gitignore + data dir

- [ ] Add `data/sources-diff/*.json` to `.gitignore`.
- [ ] Create `data/sources-diff/.gitkeep`.

### B13. `bun run check`

- [ ] Confirm `bun run check` exits 0.
- [ ] Confirm `bun test libs/sources/` passes.
- [ ] Confirm `bun run airboss-ref diff --fixture-pair=...` exits 0.

## Phase C -- PR

- [ ] Update `docs/work/plans/adr-019-rollout.md` Phase 5 row to ✅ with the merged PR number.
- [ ] Open PR with title `feat(sources): ADR 019 phase 5 -- versioning + diff job`. Body links ADR 019 §5, prior PRs (#241, #246, #247, #249), this WP.

## Out of scope (revisit triggers)

- PR-creation tooling for `advance` -- operator opens manually.
- Notifications on diff job result -- `revisit.md` R3, R14.
- Cross-reference staleness -- `revisit.md` R4.
- Multi-corpus diff in one run -- ergonomics, not a Phase 5 requirement.
- Hangar UI for review -- when `apps/hangar/` revives.
