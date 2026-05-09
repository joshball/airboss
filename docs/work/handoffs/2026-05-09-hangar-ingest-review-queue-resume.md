---
date: 2026-05-09
type: handoff
status: open
branch: feat/hangar-ingest-review-queue
remote: origin/feat/hangar-ingest-review-queue
prior_dispatcher_session: aba1b47a-0c57-444a-976a-4eb0a3522f34
prior_agent_id: a8a6cfcf0bd8747a7
prior_outcome: incomplete -- agent killed after ~13 hours, never reported PR or BLOCKER
---

# Handoff: hangar-ingest-review-queue resume

## What happened

The original build dispatch (2026-05-08 20:30, dispatcher session `aba1b47a-0c57-444a-976a-4eb0a3522f34`) launched an async sub-agent to execute `/ball-wp-build` for `docs/work-packages/hangar-ingest-review-queue/`. The agent (`a8a6cfcf0bd8747a7`) ran in `.claude/worktrees/agent-a8a6cfcf0bd8747a7/` for ~13 hours and was killed without producing a terminal `PR URL` or `BLOCKER` message. That violates the sub-agent contract.

What the agent left behind:

- 2 commits implementing the feature surface (3e7a77f5 + 6a791bb4)
- 3 dirty in-flight files (now committed as `08505481 wip(hangar-ingest-review): in-flight polish`)
- A self-reported TODO at `docs/work/todos/20260508-01-TODO.md` claiming all phases done

Audit revealed the self-report was **partial**:

- `bun run check all` was never verified at branch tip
- 4 of 8 unit-test files claimed by `test-plan.md` are MISSING
- 4 of 4 integration-test files claimed by `test-plan.md` are MISSING
- The Playwright e2e spec claimed by `test-plan.md` is MISSING
- The full test-plan checklist (56 items) shows 0 / 56 ticked
- `/ball-review-full` was never run
- No PR opened
- The branch is 28 commits behind `origin/main` and was never rebased

## Audit -- exact missing files

```text
MISSING libs/bc/ingest-review/src/queries.test.ts
MISSING libs/bc/ingest-review/src/producer.test.ts
MISSING libs/bc/ingest-review/src/integration/caption-orphan-roundtrip.test.ts
MISSING libs/bc/ingest-review/src/integration/image-orphan-roundtrip.test.ts
MISSING libs/bc/ingest-review/src/integration/yaml-stability.test.ts
MISSING libs/bc/ingest-review/src/integration/staleness.test.ts
MISSING tests/e2e/hangar/ingest-review.spec.ts
MISSING apps/hangar/src/lib/ingest-review/OrphanCard.svelte (may be inline in [issueId]/+page.svelte -- verify)
MISSING apps/hangar/src/lib/ingest-review/ActionBar.svelte (may be inline -- verify)
```

`OrphanCard.svelte` and `ActionBar.svelte` were claimed in `tasks.md` Phase 5 file table but the agent's TODO says they were folded inline. Decide and document: keep inline (update tasks.md) OR extract (write the components). Don't leave the spec drifted from the code.

## Original dispatch prompt (verbatim source)

The original dispatch is preserved in the dispatcher session jsonl at:

```text
~/.claude/projects/-Users-joshua-src--me-aviation-airboss/aba1b47a-0c57-444a-976a-4eb0a3522f34.jsonl
```

The prompt's hard requirements summarised below (paraphrased; pull the full text from that jsonl if needed):

- Run `/ball-wp-build` against `docs/work-packages/hangar-ingest-review-queue/`.
- Plugin scope: TWO plugins for v1 (`handbook.caption-orphan` + `handbook.image-orphan`). Image-orphan is included even at zero live count so the plugin contract is exercised in both directions.
- BC name: `libs/bc/ingest-review/`. Sidecar filename: `<slug>-overrides.yaml` flat.
- Caption orphans: 21 residual entries are deferred -- they are the queue's first work item AFTER ship. Do NOT manually fix them in YAML during the build.
- Browser-safety: `@ab/bc-ingest-review` is browser-safe runtime barrel. `@ab/bc-ingest-review/server` holds every DB-touching helper. Verify with `scripts/check-browser-globals.ts` after each phase.
- After all phases: `bun run check all` clean, full vitest, then `/ball-review-full`. Fix every finding (critical / major / minor / nit -- no menu picking, no "future considerations"). Re-verify clean.
- PR title: `feat(hangar): ingest-review queue (caption + image orphans)`. PR body must include a manual test script.
- Terminal outcome: PR URL OR BLOCKER. Staged-but-uncommitted = contract violation.

## State on entry (for the next agent)

```text
Branch:      feat/hangar-ingest-review-queue (pushed to origin)
Tip:         08505481 wip(hangar-ingest-review): in-flight polish from prior build agent
Behind:      28 commits behind origin/main
Ahead:       3 commits (2 feature + 1 wip polish)
WP docs:     docs/work-packages/hangar-ingest-review-queue/{spec,design,tasks,test-plan,user-stories}.md
Prior TODO:  docs/work/todos/20260508-01-TODO.md (self-report; treat as a starting hint, NOT ground truth)
```

## What the next agent must do

In order:

1. **Read this entire handoff first.** Then read the WP directory in full (spec, design, tasks, test-plan, user-stories). Then re-read the original dispatch from the dispatcher session jsonl above (for any nuance not captured here).

2. **Rebase or merge `origin/main` into the branch.** 28 commits behind. The bc-hangar barrel split (PR #740, 2026-05-08) lives in adjacent territory -- expect conflicts in `libs/bc/` package layouts and `scripts/check-browser-globals.ts`. Resolve carefully. After rebase, verify `bun run check all` still passes on the existing surface before adding more code.

3. **Verify the existing surface works.** Before adding tests, run:
   - `bun run check all` -- must be clean
   - `bunx vitest run libs/bc/ingest-review/ scripts/ingest-review/ tools/handbook-ingest/` -- all existing tests pass
   - Boot the dev server and load `/ingest-review` in a real browser. Per CLAUDE.md, vitest passing is not browser-correct. Confirm no `Buffer is not defined` / postgres-driver-in-bundle leak. The new BC ships its own `/server` barrel; verify the validator covers it.

4. **Decide OrphanCard / ActionBar.** Inspect `apps/hangar/src/routes/(app)/ingest-review/[issueId]/+page.svelte`. If the orphan rendering and action bar are inline (the agent's TODO claims so), update `tasks.md` to remove the two component file rows so the spec matches code. If the inline version is bloated and the component split improves clarity, extract them. Don't paper over the gap.

5. **Write the missing tests** (see audit above). Cover each unchecked item in `test-plan.md`. Existing tests (schema, plugin, plugins/handbook-shared, plugins/handbook-caption-orphan, plugins/handbook-image-orphan, scripts/yaml-sidecar) demonstrate the testing style this project expects -- mirror it. Integration tests go under `libs/bc/ingest-review/src/integration/`. The e2e spec belongs at `tests/e2e/hangar/ingest-review.spec.ts` (per the test-plan); pair it with the existing hangar e2e setup.

6. **Tick the test-plan checkboxes** as each lands. The 56 items are the contract -- close them.

7. **Run `/ball-review-full`** (or specialist reviewers manually) and fix every finding. Convergent findings get fixed at the root once.

8. **Re-verify everything clean:**
   - `bun run check all`
   - `bunx vitest run`
   - Real-browser smoke
   - Manual test plan in `test-plan.md` Manual section (Pre-flight / Walk / Smoke) walked end-to-end

9. **Open a PR** via `gh pr create`. Title: `feat(hangar): ingest-review queue (caption + image orphans)`. Body: WP path + the manual test script (copy-paste from `test-plan.md`'s Manual section) + summary of what landed. No AI attribution. No em-dashes / `--` as separators. No "honest" anywhere.

10. **Terminal outcome:** PR URL OR BLOCKER. No silent exit. No staged-but-uncommitted. If the original WP can't ship as authored (e.g. drift from current main makes a key design choice obsolete), surface that as a BLOCKER with the specific decision needed -- do not unilaterally redesign.

## Hard rules (from project + global -- non-negotiable)

- No stubs, no shortcuts, no "MVP" compromises. If something is hard, do it right or surface a blocker.
- No `any`. No magic strings/numbers. No non-null assertions. No `// @ts-expect-error` / `@ts-ignore`.
- No `.toBeTruthy()` -- use `.toBeInTheDocument()`, `.toMatch(...)`, `.toMatchObject(...)`, `.toBe(true)`.
- Never use the word "honest" in agent voice (commits, PR body, code comments, chat).
- Never use em-dashes / en-dashes / `--` as sentence separators.
- No AI attribution anywhere.
- Stage individual files by name. Never `git add -A` / `git add .`.
- Drizzle ORM only, no raw SQL. All routes via `ROUTES`. Svelte 5 runes only.

## Why this handoff exists

The prior agent's terminal contract was `(A) PR URL` or `(B) BLOCKER`. It produced neither. The codebase rule "Mind your own business on other agents' work" means I (the audit agent) cannot finish someone else's task; I can only document the gap and hand it off. This file is that handoff.

The next agent inherits a surface that is 60-70% done by line count but missing critical verification scaffolding. The prior agent's self-report is a starting hint, not a contract. Treat the WP's `test-plan.md` (56 items, 0 ticked) as the actual contract.
