---
title: ADR 019 phase 2 -- registry core + --fix
date: 2026-04-27
worktree: .claude/worktrees/agent-a2bdbeb53d3cbec1a
branch: worktree-agent-a2bdbeb53d3cbec1a
---

# ADR 019 phase 2 -- registry core + --fix

Implements ADR 019 §2 (registry, query API, lifecycle, render-time loading), §1.3 (`--fix` mode), §6 (aliases / supersession / acknowledgment cascade). Replaces the `NULL_REGISTRY` stub from phase 1 with the production registry and activates the row-1 corpus-enumeration check.

## Phase A -- author work package

- [x] Create `docs/work-packages/reference-source-registry-core/` with spec, tasks, design, test-plan, user-stories
- [x] Frontmatter: status: unread, review_status: pending, product: cross-cutting

## Phase B -- implement

- [x] Lib structure additions: `libs/sources/src/registry/` directory
- [x] `SOURCES` constants table (typed, initially empty)
- [x] In-memory `Edition[]` map
- [x] `CorpusResolver` registration mechanism + default no-op resolver per corpus
- [x] Query API surface (`resolveIdentifier`, `hasEntry`, `getChildren`, `walkSupersessionChain`, `findEntriesByCanonicalShort`, `findLessonsCitingEntry`, `findLessonsTransitivelyCitingEntry`, `findLessonsCitingMultiple`, `getCurrentEdition`, `getEditions`, `isPinStale`)
- [x] Lifecycle state machine (5 states, transition rules, `promotion_batches` audit shape)
- [x] `--fix` mode: walks lessons, auto-stamps `?at=<currentAccepted>` on unpinned identifiers
- [x] JSON snapshot generator: `bun scripts/airboss-ref.ts snapshot` (or `bun run sources snapshot`)
- [x] `scripts/check.ts` swap: `NULL_REGISTRY` -> production registry
- [x] Activate validator row-1 corpus-enumeration check (uses `isCorpusKnown`)
- [x] Tests (Vitest) for query API, lifecycle transitions, `--fix` correctness, snapshot output, validator integration
- [x] `bun run check` clean; `bun test libs/sources/` clean

## Phase C -- ship PR

- [x] Stage files individually
- [x] Push branch, open PR via gh pr create
- [x] Update `docs/work/plans/adr-019-rollout.md`
- [x] Write PR URL to `.ball-coord/to-dispatcher.md`
