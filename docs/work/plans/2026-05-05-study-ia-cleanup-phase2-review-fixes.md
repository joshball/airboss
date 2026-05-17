---
title: 'Plan: Phase 2 IA cleanup -- review fix sweep'
type: plan
created: 2026-05-05
status: in-progress
---

# Phase 2 review fix sweep

Source reviews: `docs/work/reviews/2026-05-05-study-ia-cleanup-phase2-{architecture,correctness,svelte,security,perf,patterns,a11y,ux,backend,schema}.md`.

## Convergent finding count by severity

| Severity   | Count | Disposition                                                                                  |
| ---------- | ----- | -------------------------------------------------------------------------------------------- |
| critical   | 0     | --                                                                                           |
| major      | 2     | UX-1 + PT-1 -- both intentional design choices; documented + accepted, not fixed (see below) |
| minor      | 9     | one actionable (S-1); rest documented + accepted                                             |
| nit / info | 8     | accepted as-is                                                                               |

## Fixes applied this sweep

- [x] S-1: drop redundant `& LayoutData` intersection on `apps/study/src/routes/(app)/program/goals/[id]/+page.svelte` $props typing.

## Findings deliberately deferred (with explicit triggers)

| Finding    | Why not fixed now                                                           | Trigger to revisit                                                                     |
| ---------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| UX-1       | Spec design.md Q1 explicitly asks for "one mental destination -> deep link" | First user-contact feedback -- if Joshua hits "I want the LIST," flip the default      |
| PT-1       | The `program-tab-{name}` testid pattern IS the documented contract          | Phase 4 CI guard for `data-testid="page-anchor"` -- extend to validate sub-tab pattern |
| UX-2       | Coverage placeholder is intentional Phase 2 scope; deeper view is later WP  | When the gap-coverage matrix WP starts                                                 |
| AR-2 / P-1 | `getPrimaryGoal` duplicate per `/program/quals` request is sub-ms           | When a load test surfaces the bottleneck, or coverage tab grows beyond a placeholder   |
| C-3 / A-2  | `<span>` + testid wrap of Button is the documented escape hatch             | `Button.svelte` gets a `testid` prop -- new follow-on issue                            |

No "consider later" with no trigger.

## Re-verification

- `bun run check` -- 5 pre-existing baseline errors (`fast-xml-parser`, `@ab/aviation`, `three`, `@ab/bc-sim/persistence`, `libs/help/search.ts implicit-any`); no new errors. theme-lint clean, test-lint clean.
- `bun test apps/study/src/lib/program/default-tab.test.ts` -- 6 pass.
- Grep for legacy route names (`ROUTES.CREDENTIAL`, `ROUTES.GOAL\b`, `ROUTES.PLAN\b`, etc.) -- empty across `apps/`, `libs/`, `tests/`.
- Grep for legacy nav labels (`NAV_LABELS.CREDENTIALS|GOALS|PLANS`) -- empty.
- Grep for legacy paths in source (`/credentials\b`, `/goals\b`, `/plans\b`) -- only in archived docs and the design redirect-table comments; no live code.
