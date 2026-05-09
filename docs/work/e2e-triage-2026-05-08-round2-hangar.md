---
date: 2026-05-08
agent: hangar-review-queue-triage-round2
branch: docs/course-as-peer-primitive
worktree: .claude/worktrees/agent-a593c1584b7a889ed
input:
  - /tmp/e2e-audit-2026-05-08-round2/full-run.log
  - /tmp/e2e-audit-2026-05-08-round2/failures-detail.log
  - tests/e2e/.out/hangar-review-queue-*/
output:
  - docs/work-packages/hangar-review-queue-cluster-fix/spec.md
  - docs/work-packages/hangar-review-queue-cluster-fix/tasks.md
  - docs/work-packages/hangar-review-queue-cluster-fix/test-plan.md
  - this report
decision: path B (file WP, do not fix in triage)
---

# e2e triage round 2 - hangar-review-queue cluster (24 failures)

## Summary

A full e2e suite run on 2026-05-08 left **24 specs failing in the `hangar-review-queue` Playwright project**. The dispatcher's hint that the failures were largely "test-cosmetic strict-mode violations" did not survive trace inspection: only 1 of 24 is cosmetic. **12 of 24 are a recurrence of the canonical airboss browser-hydration bundle leak** (`ReferenceError: Buffer is not defined` at `chunk-VQMZUIKA.js`), and 3 more are a server-side Postgres query crash on `hangar.docs_search_index`.

This is path B (real app bugs). I have NOT shipped any source fixes from this triage agent. A focused work package lands at [`docs/work-packages/hangar-review-queue-cluster-fix/`](../work-packages/hangar-review-queue-cluster-fix/).

## How I diagnosed

The dispatcher's captured snapshot data shows the rendered page after a failure but does NOT distinguish "server returned 500" from "client-side hydration crashed and SvelteKit's error boundary rendered a fake 500 page." Both look identical in the snapshot YAML. Without the trace network log + console events, the cluster looks like a server bug; with them, the dominant cause is client-side.

The diagnostic path that mattered:

1. Read all 24 `error-context.md` files en bloc (cheap; immediately reveals the snapshot taxonomy)
2. Notice 11/24 snapshots are bare `heading "500" / Internal Error` - but the trace network log shows `/review` responded HTTP 200
3. Pull `0-trace.trace` from a representative `trace.zip`, grep for `console error` entries
4. Find `ReferenceError: Buffer is not defined at chunk-VQMZUIKA.js`
5. Recognize the failure mode from CLAUDE.md (the `/memory` crash family - PRs #656/659/661/663/664)
6. Spot-check 11 more traces - all 12 board/per-kind/walker/tasks specs share the same console error
7. Check the dispatcher's `full-run.log` for server-side errors: 3 `ERROR Internal Error` lines, all from `searchDocs` against `hangar.docs_search_index`. That's a separate cluster (the docs FTS popover specs)
8. The 1 strict-mode violation is real but isolated; the 1 docs 404 (`CLAUDE.md`) is a different surface

## Cluster taxonomy

| Cluster                           | Count | Specs                                              | Root cause                                                                                               |
| --------------------------------- | ----- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Browser-hydration `Buffer` leak   | 12    | board 4, per-kind 5, walker 2, tasks 1             | A value re-export in a hangar-app browser-bundled lib drags Node `Buffer` into `chunk-VQMZUIKA.js`       |
| `searchDocs` Postgres query crash | 3     | docs 3                                             | `hangar.docs_search_index` query at `libs/bc/hangar/src/docs-search.ts:96` throws server-side            |
| Strict-mode duplicate `Docs` link | 1     | docs.spec.ts:29                                    | breadcrumbs added a second `Docs` link; selector needs scope                                             |
| 404 on `/docs/CLAUDE.md`          | 1     | docs.spec.ts:92                                    | docs reader rejects top-level repo files OR loader didn't index them                                     |
| Form-action `waitForURL` cascade  | 7     | admin 3, tasks 2 (1 overlap), walker 2 (1 overlap) | Likely Buffer-cluster downstream effects; re-run after phase 1 to isolate true server-action regressions |

## Why path B

Per the dispatcher's decision rule: "if the cluster is truly app bugs (>50% real 500 errors or app-side regressions), STOP fixing and file a focused WP."

The Buffer cluster alone is 12/24 = 50%. Add the 3 server-side Postgres crashes and the count is 15/24 = 62.5%. Triage threshold met.

More importantly, the Buffer cluster requires the canonical browser-hydration playbook (open the page in a real browser, walk vite's chunk graph in devtools). That playbook is documented in [docs/agents/debug-playbooks/browser-hydration.md](../agents/debug-playbooks/browser-hydration.md) and was won the hard way over PRs #656/659/661/663/664. A fix attempt without that playbook is exactly the "fix from memory of the codebase" anti-pattern that cost four wrong PRs on the /memory crash. Hand off cleanly.

## Recommended urgency

**High.** The Buffer leak ships to anyone who clicks a hangar review board card; it's not behind a feature flag. Anyone running the e2e suite hits it. Anyone using the hangar review surface in dev hits it. Backlog this as the next hangar work item.

## What I did NOT do

- No source edits in `apps/hangar/` or `libs/`
- No selector fixes in `tests/e2e/hangar-review-queue/` (the 1 strict-mode violation IS in scope but waiting for the WP to land it as part of the cosmetics phase, since the cosmetics specs run AFTER the Buffer fix)
- No PR opened - dispatcher consolidates
- No worktree-isolated repro of the Buffer leak (would need `bun install` in the worktree, which the dispatcher constraints don't expressly authorize for a triage agent and which would dirty the working tree)

## Files modified

- `docs/work-packages/hangar-review-queue-cluster-fix/spec.md` (new)
- `docs/work-packages/hangar-review-queue-cluster-fix/tasks.md` (new)
- `docs/work-packages/hangar-review-queue-cluster-fix/test-plan.md` (new)
- `docs/work/e2e-triage-2026-05-08-round2-hangar.md` (this file, new)
