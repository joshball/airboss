# Phase 2 -- Study IA Cleanup -- Program consolidation

Worktree: `.claude/worktrees/agent-a08a9e48910a5afff`
Branch: `ball/study-ia-cleanup-phase2-a1d81812`
Off main: `a10403a3` (PR #649 squash)

## Build

- [ ] 2.1 Routes + constants -- PROGRAM, PROGRAM_TAB, PROGRAM_QUAL[_AREA|_TASK], PROGRAM_GOAL, PROGRAM_PLAN; QUERY_PARAMS.PROGRAM_TAB; NAV_LABELS.PROGRAM
- [ ] 2.1b PROGRAM_TAB enum (quals/goal/plan/coverage) + PAGE_EXPLAINER_KEYS additions
- [ ] 2.2 `/program/+layout.svelte` tab strip with testids
- [ ] 2.2 `/program/+page.svelte` tab dispatcher; default tab = goal-when-exists else quals
- [ ] 2.2 git mv `/credentials/[slug]/**` -> `/program/quals/[slug]/**` (incl areas)
- [ ] 2.2 git mv `/goals/[id]/**` -> `/program/goals/[id]/**`
- [ ] 2.2 git mv `/plans/[id]/**` -> `/program/plans/[id]/**`
- [ ] 2.2 Move list pages content into `/program/quals/+page.svelte`, `/program/goals/+page.svelte`, `/program/plans/+page.svelte` (rendered as tab content); coverage tab placeholder
- [ ] 2.2 Goal detail CTA: "Build my plan" / "Start studying" with `data-testid="goal-detail-start-cta"`
- [ ] 2.2 Per-tab page explainers (4 new keys)
- [ ] 2.3 Nav update: drop CREDENTIALS/GOALS/PLANS, add PROGRAM with `data-testid="nav-program"`
- [ ] 2.4 Expand `tests/e2e/ia-flow.spec.ts` FLOW with Program + sub-tabs
- [ ] 2.4 Author `tests/e2e/ia-goal-to-session.spec.ts`
- [ ] Update all callers of old ROUTES.* (CREDENTIAL/CREDENTIAL_AREA/GOAL/PLAN/etc.) to new PROGRAM_*
- [ ] Vitest unit tests for default-tab resolver + tab parser
- [ ] `bun run check` clean (baseline acceptable)
- [ ] `bunx biome format --write` over staged
- [ ] Update tasks.md Phase 2 checkboxes

## Review (10 specialist sweep, sequential since harness can't parallel)

- [ ] UX, Svelte, Security, Perf, Architecture, Patterns, Correctness, A11y, Backend, Schema -- one .md each

## Fixes

- [ ] Consolidated fix plan
- [ ] Execute, verify, re-grep

## Ship

- [ ] Stage individual files; commit; push
- [ ] gh pr create
- [ ] Wait checks; squash merge --delete-branch; cleanup

## Notes / decisions

- Phase 3 owns 301 redirects from `/credentials/*`, `/goals/*`, `/plans/*` to new paths; Phase 2 just moves surfaces + rewires links.
- Quals/Goals/Plans list pages are reborn as the four tabs on `/program`. The list `+page.svelte` content moves under `/program/quals/+page.svelte` etc.; tab dispatcher loads them.
- Coverage tab is new -- placeholder summary today (counts by section/lifecycle); deepens in a future WP.
