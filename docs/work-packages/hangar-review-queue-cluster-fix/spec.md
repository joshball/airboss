---
id: hangar-review-queue-cluster-fix
title: "Spec: Hangar Review Queue e2e Cluster Fix"
product: hangar
category: feature
status: signed-off
agent_review_status: done
human_review_status: pending
created: 2026-05-08
shipped_prs:
  - 740
owner: agent
depends_on: []
unblocks:
  - hangar-e2e-infrastructure
tags:
  - hangar
  - e2e
  - browser-hydration
  - regression
legacy_fields:
  feature: hangar-review-queue-cluster-fix
  type: spec
  review_status: pending
---

# Spec: Hangar Review Queue e2e Cluster Fix

A full e2e suite run on 2026-05-08 surfaced **24 failing specs in the `hangar-review-queue` Playwright project**. Triage of every failure's `error-context.md` and `trace.zip` (artifacts in `tests/e2e/.out/hangar-review-queue-*/`) shows the cluster is not a single bug but **five distinct root causes**, dominated by a recurrence of the canonical airboss browser-hydration bundle leak (`ReferenceError: Buffer is not defined`).

The cluster has been flagged twice prior (see [docs/work/walkthroughs/20260506/01-e2e-isolation-and-figure-pairing.md](../../work/walkthroughs/20260506/01-e2e-isolation-and-figure-pairing.md) section 4 and [docs/work/e2e-triage-2026-05-08-hangar.md](../../work/e2e-triage-2026-05-08-hangar.md)) but never investigated end-to-end. This WP delivers the investigation and the structured fix.

## Goals

1. Restore the `hangar-review-queue` Playwright project to a green baseline (24/24 pass) on `bun run test e2e`.
2. Identify and fix the chunk-VQMZUIKA.js Buffer leak at root (one diff, not 12).
3. Identify and fix the `searchDocs` server-side query crash on `hangar.docs_search_index`.
4. Update test selectors that legitimately need scope (Docs link strict-mode), and update the docs reader / loader to handle the canonical "top-level repo doc" case (CLAUDE.md).
5. Add the `tests/e2e/browser-hydration-smoke.spec.ts` canonical surfaces to include the affected hangar routes (`/review`, `/review/<kind>/<id>`, `/review/<kind>/<id>/walker`) so the next regression of this kind fails in <30s instead of in a 24-spec cascade.

## Non-goals

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Cluster taxonomy

All 24 failures grouped by root cause, evidence file paths included so the build phase can verify each independently.

| Cluster                           | Count | Affected specs                                        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser-hydration `Buffer` leak   | 12    | board 4, per-kind 5, walker 2, tasks 1                | Console error in trace.zip: `ReferenceError: Buffer is not defined at http://127.0.0.1:9623/node_modules/.vite/deps/chunk-VQMZUIKA.js`. Page snapshot: literal `heading "500" / Internal Error` rendered client-side after hydration crash. HTTP requests in the trace network log all return 200 - the SvelteKit error boundary is rendering AFTER `goto()` succeeds, on a client-side `goto()` triggered by a click.         |
| `searchDocs` Postgres query crash | 3     | docs.spec.ts (3 search-popover specs)                 | Server log in `/tmp/e2e-audit-2026-05-08-round2/full-run.log`: `ERROR Internal Error req=… Failed query: select "path", "title", ts_headline(...) from "hangar"."docs_search_index" … at searchDocs (libs/bc/hangar/src/docs-search.ts:96) at GET (apps/hangar/src/routes/(app)/docs/search.json/+server.ts:23)`. Snapshots show the docs page rendered fine; the popover never appears because the JSON endpoint returns 500. |
| Strict-mode duplicate `Docs` link | 1     | docs.spec.ts:29                                       | `getByRole('link', { name: /^Docs$/ })` resolves to two elements: nav link + breadcrumbs link. Test was authored before breadcrumbs were added.                                                                                                                                                                                                                                                                                |
| 404 on `/docs/CLAUDE.md`          | 1     | docs.spec.ts:92                                       | Page snapshot: `heading "404" / Doc not found`. Test asserts CLAUDE.md is reachable as a top-level repo doc; reader rejects it. Either the docs allowlist excludes top-level files OR the docs loader doesn't index them.                                                                                                                                                                                                      |
| Form-action `waitForURL` cascade  | 7     | admin 3, tasks 2, walker 2 (1 walker overlaps Buffer) | Snapshots show the page mostly rendered - banner + nav present, breadcrumbs partial. The form action posts but `page.waitForURL` for the redirect destination times out at 15s. Some specs likely chase the Buffer cluster (the redirect target is /review/...). Re-run after Buffer fix; isolate any remaining as a server-action regression.                                                                                 |

Total: 12 + 3 + 1 + 1 + 7 = 24.

### Cluster 1: Buffer-not-defined hydration crash (CRITICAL - 12 specs)

This is the dominant cluster and it is a known, well-documented airboss failure mode. Per [CLAUDE.md](../../../CLAUDE.md#critical-rules):

> **Every value re-export in a runtime barrel is load-bearing.** `libs/bc/study/src/index.ts` is bundled into the browser; any `export { foo } from './bar'` line forces `bar.ts` to evaluate at hydration, plus its transitive runtime imports. One stray value re-export of a module that reaches `@ab/db/connection` ships the postgres driver to every page that imports anything from `@ab/bc-study`.

The same failure mode previously hit `apps/study /memory` route (PRs #656, #659, #661, #663, #664) and is documented in [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md). Today's incarnation is in the **hangar** app, not study, but the diagnostic path is identical:

1. `bun scripts/dev.ts clean && bun run dev` (apps/hangar)
2. Open `/review` in a real browser with devtools
3. Inspect chunk-VQMZUIKA.js in the Sources panel; identify which lib it sources from
4. Walk the runtime-import graph from the affected hangar `+page.svelte` files (board, per-kind, walker, tasks) until a value re-export of a server-only helper is found
5. Move the offending re-export to a `/server` barrel

Likely culprits (to investigate, not assume):

- `libs/bc/hangar/src/index.ts` - does it re-export anything that touches `@ab/db/connection`?
- `libs/hangar-jobs/src/index.ts` or `libs/hangar-sync/src/index.ts` - same question
- `libs/sources/src/index.ts` - `xml-walker.ts` lives here and pulls `fast-xml-parser`; if anything in this lib reaches the hangar runtime barrel, the whole regs ingest stack ships to the browser. (The worktree-isolated repro of `fast-xml-parser missing` is a parallel symptom of the same kind of leak - a node-only module reaching browser-eligible code.)

The `scripts/check-browser-globals.ts` validator should also be re-run; it's a graph walker for exactly this regression class. If chunk-VQMZUIKA is bundling Buffer, the validator either has a hangar-app blind spot or the offending import path doesn't match its filter. Patch the validator if the leak slipped past it.

### Cluster 2: `searchDocs` Postgres query crash (3 specs)

Three docs.spec.ts specs fail because the `/docs/search.json` endpoint returns 500. The actual server log:

```text
Error: Failed query: select "path", "title",
  ts_headline('english', substring("body", 1, $1), plainto_tsquery('english', $2), $3),
  ts_rank_cd("tsv", plainto_tsquery('english', $4))
from "hangar"."docs_search_index"
where "hangar"."docs_search_index"."tsv" @@ plainto_tsquery('english', $5)
order by rank DESC limit $6
params: 16384, 'discovery-first pedagogy', 'StartSel=MARK_OPEN, StopSel=MARK_CLOSE, MaxWords=24, MinWords=10, ShortWord=3, MaxFragments=2', ...
  at searchDocs (libs/bc/hangar/src/docs-search.ts:96)
  at GET (apps/hangar/src/routes/(app)/docs/search.json/+server.ts:23)
```

Hypotheses (need DB inspection to confirm):

- `hangar.docs_search_index.body` column is missing or renamed (the substring + ts_headline reach for it directly)
- `tsv` generated column out of date / index missing
- `ts_headline` options string is being passed as the wrong parameter position (params array shows the options string at index 3 - this is the canonical Drizzle pattern for `ts_headline` and SHOULD work)
- The seed loader (run by `hangar-review-queue/global.setup.ts` via the admin loader) doesn't actually populate `docs_search_index` rows

Investigate at `libs/bc/hangar/src/docs-search.ts:96` and the FTS migration that defined `docs_search_index`.

### Cluster 3: Strict-mode duplicate `Docs` link (1 spec)

```text
Error: strict mode violation: getByRole('link', { name: /^Docs$/ }) resolved to 2 elements:
  1) <a href="/docs" aria-current="page">Docs</a>  inside getByRole('banner')
  2) <a href="/docs" class="crumb">Docs</a>       inside getByTestId('breadcrumbs-root')
```

Cosmetic. The fix at `tests/e2e/hangar-review-queue/docs.spec.ts:38`:

```ts
await expect(page.getByTestId('breadcrumbs-root').getByRole('link', { name: /^Docs$/ })).toBeVisible();
```

Tighten to the breadcrumbs landmark - that's what the test is actually trying to assert (the breadcrumb rendered). The banner-link assertion is implicitly covered by the layout test (`docs.spec.ts:21`).

### Cluster 4: 404 on `/docs/CLAUDE.md` (1 spec)

`docs.spec.ts:92` asserts `CLAUDE.md` is reachable as a top-level repo doc. Snapshot: `heading "404" / Doc not found`. Either:

- The docs reader allowlist for top-level repo files (CLAUDE.md, etc.) was tightened or removed
- The docs loader (`global.setup.ts` calls the admin loader) doesn't index files outside `docs/`
- The route param interpretation differs ("/docs/CLAUDE.md" vs "/docs/path?file=CLAUDE.md")

Investigate `apps/hangar/src/routes/(app)/docs/[...path]/+page.server.ts` and the docs loader. If top-level docs are intentionally out-of-scope, the test should be retargeted; if they are in-scope, fix the loader to index them.

### Cluster 5: Form-action `waitForURL` cascade (7 specs)

After the Buffer cluster lands, re-run admin/tasks/walker. Most likely the page-level Buffer crash blocks the post-submit navigation; once hydration is clean, these resolve. If 1-3 still fail, isolate the actual server-action handler at `apps/hangar/src/routes/(app)/review/+page.server.ts` and check whether the action returns `fail()` correctly, OR if the redirect target's loader (the same /review page) is the actual blocker.

## Phased plan

The three clusters are independent. Build in this order - do **not** parallelize, because the Buffer cluster is the highest-leverage and may dissolve part of cluster 5.

### Phase 1: Buffer-not-defined hydration leak (12 specs)

1. Reproduce in a real browser per the playbook (`bun scripts/dev.ts clean && bun run dev` in apps/hangar; open `/review`; devtools)
2. Identify chunk-VQMZUIKA.js's source library (vite's chunk explorer + grep for the chunk's exports in `libs/`)
3. Trace the runtime-import graph from the broken hangar pages back to the value re-export
4. Move the offending re-export to a `/server` barrel; type-only re-exports stay in the runtime barrel
5. Re-run `bun scripts/check-browser-globals.ts` - if it didn't catch this leak, file the validator's blind spot and patch it
6. Re-run the 12 specs; expect green
7. Add `/review`, `/review/wp_spec/<id>`, `/review/wp_spec/<id>/walker` to `tests/e2e/browser-hydration-smoke.spec.ts`

### Phase 2: docs FTS query crash (3 specs)

1. Inspect `libs/bc/hangar/src/docs-search.ts:96` and the migration that defined `hangar.docs_search_index`
2. Connect to `airboss_e2e` and check the table state: `\d hangar.docs_search_index`, sample rows, tsv column populated
3. If the `body` column is missing or renamed: align query with schema (or vice versa)
4. If the seed loader doesn't populate the table: fix the loader path in `hangar-review-queue/global.setup.ts`
5. Re-run the 3 docs search specs; expect green

### Phase 3: docs cosmetics (2 specs)

1. Fix the strict-mode `Docs` link selector at `docs.spec.ts:38` (scope to breadcrumbs landmark)
2. Investigate `/docs/CLAUDE.md` 404; either fix the docs reader to handle top-level files OR retarget the test to a doc that is in-scope (e.g. another `docs/` file already known to be indexed)
3. Re-run the 2 docs specs; expect green

### Phase 4: Form-action cascade re-run (7 specs)

1. Re-run admin (3) + tasks (2) + walker (2) without source changes
2. For any specs still failing, inspect the form action handler in `apps/hangar/src/routes/(app)/review/+page.server.ts` (and admin loader at `/review/admin/buckets`)
3. Verify the action returns `fail(400, { errors })` on validation failures and redirects on success
4. Spot-fix any specific action that's silently catching errors

### Phase 5: Verification

1. `bun run test e2e --project=hangar-review-queue` - expect 24/24 pass
2. `bun run test e2e --project=hangar-review-queue-unauthed` - expect already-passing specs stay green
3. `bun run check all` - expect clean
4. Manual smoke in real browser per `tests/e2e/browser-hydration-smoke.spec.ts` for the new hangar routes added in phase 1

## Risks

- **Buffer leak may have a non-trivial root cause.** The /memory crash family took five PRs to close out. Budget a real investigation phase, not a one-shot patch. The playbook is good; follow it.
- **The seed loader for docs_search_index may be slow or undeterministic.** If `searchDocs` works in production but breaks under e2e, the seed step is the gap. Don't assume the production code is wrong without checking the seed first.
- **Some "form-action" failures may also be Buffer.** Re-run after phase 1 before opening any form-action investigation.

## References

- [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md) - the canonical playbook, MANDATORY reading before phase 1
- [tests/e2e/browser-hydration-smoke.spec.ts](../../../tests/e2e/browser-hydration-smoke.spec.ts) - canonical smoke; extend in phase 1
- [scripts/check-browser-globals.ts](../../../scripts/check-browser-globals.ts) - graph walker; verify it covers the hangar app surface
- [libs/bc/hangar/src/docs-search.ts](../../../libs/bc/hangar/src/docs-search.ts) - phase 2 entry point
- [tests/e2e/hangar-review-queue/](../../../tests/e2e/hangar-review-queue/) - the failing project
- `tests/e2e/.out/hangar-review-queue-*/` - per-failure trace artifacts (preserved by Playwright `retain-on-failure`)
- `/tmp/e2e-audit-2026-05-08-round2/full-run.log` - captured server log from the 2026-05-08 full-suite run
- [docs/work/e2e-triage-2026-05-08-round2-hangar.md](../../work/e2e-triage-2026-05-08-round2-hangar.md) - triage report driving this WP
- Prior `/memory` Buffer-leak PRs: #656, #659, #661, #663, #664 - read the merged diffs to see the shape of the fix and the wrong-fix patterns to avoid

## Definition of done

- 24/24 hangar-review-queue specs pass on `bun run test e2e --project=hangar-review-queue`
- `bun run check all` clean
- `tests/e2e/browser-hydration-smoke.spec.ts` extended with the affected hangar routes
- If `scripts/check-browser-globals.ts` had a blind spot for the hangar app, the validator is patched
- WP marked `agent_review_status: done` after `/ball-review-full` returns no critical findings
- Manual user verification in a real browser: load `/review`, click a board card, navigate to the walker - no console errors
