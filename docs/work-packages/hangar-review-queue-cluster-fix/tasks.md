---
id: hangar-review-queue-cluster-fix
type: tasks
created: 2026-05-08
---

# Tasks: Hangar Review Queue e2e Cluster Fix

Five-phase build per [spec.md](./spec.md). Phases sequential - do not parallelize.

## Phase 1: Buffer hydration leak (CRITICAL - 12 specs)

- [ ] Read [docs/agents/debug-playbooks/browser-hydration.md](../../agents/debug-playbooks/browser-hydration.md) end-to-end
- [ ] `bun scripts/dev.ts clean && bun run dev` from `apps/hangar` root
- [ ] Open `http://localhost:9603/review` in Chrome with devtools open
- [ ] Confirm `ReferenceError: Buffer is not defined at chunk-VQMZUIKA.js` reproduces
- [ ] In devtools Sources panel: open the chunk-VQMZUIKA.js entry, identify which lib(s) it sources from
- [ ] Walk runtime imports of `apps/hangar/src/routes/(app)/review/+page.svelte` (and `+layout.svelte`) to find the offending value re-export
- [ ] Suspect targets to inspect first: `libs/bc/hangar/src/index.ts`, `libs/sources/src/index.ts`, `libs/hangar-jobs/src/index.ts`, `libs/hangar-sync/src/index.ts`
- [ ] Move the value re-export to a `/server.ts` barrel; convert any svelte-page imports to type-only or to the `/server` entry point as appropriate
- [ ] Run `bun scripts/check-browser-globals.ts` and confirm clean
- [ ] If validator missed the leak: add the missing edge to its graph walker
- [ ] Re-run the 12 affected specs:

  ```bash
  for f in board per-kind walker tasks; do
    bunx playwright test tests/e2e/hangar-review-queue/$f.spec.ts --project=hangar-review-queue --workers=1
  done
  ```

- [ ] Add `/review`, `/review/wp_spec/<seed-id>`, `/review/wp_spec/<seed-id>/walker` to `tests/e2e/browser-hydration-smoke.spec.ts`

## Phase 2: docs FTS query crash (3 specs)

- [ ] Open `libs/bc/hangar/src/docs-search.ts` and read `searchDocs` end-to-end
- [ ] Connect to `airboss_e2e`: `psql $DEV_DB_URL_E2E -c '\d hangar.docs_search_index'`
- [ ] Confirm columns: `path text, title text, body text, tsv tsvector` and `tsv` index exists
- [ ] Sample 3 rows: `select path, title, length(body), tsv is not null from hangar.docs_search_index limit 3;`
- [ ] If `body` column missing or renamed: align the Drizzle query with the schema
- [ ] If table is empty: trace the loader path - `hangar-review-queue/global.setup.ts` calls the admin loader; verify the loader actually populates `docs_search_index`
- [ ] Re-run docs FTS specs:

  ```bash
  bunx playwright test tests/e2e/hangar-review-queue/docs.spec.ts --project=hangar-review-queue --workers=1
  ```

- [ ] Expect 5/5 docs.spec.ts passes (3 FTS + 2 cosmetic, but cosmetic still depends on phase 3)

## Phase 3: docs cosmetics (2 specs)

- [ ] Edit `tests/e2e/hangar-review-queue/docs.spec.ts:38` - scope the `Docs` link assertion to the breadcrumbs landmark
- [ ] Investigate `apps/hangar/src/routes/(app)/docs/[...path]/+page.server.ts` for the CLAUDE.md 404
- [ ] Decide: extend the docs reader to support top-level repo files, OR retarget the test to a doc that is in-scope
- [ ] If extending the reader: confirm the docs loader picks up CLAUDE.md, README.md, etc.
- [ ] Re-run docs.spec.ts; expect 5/5 pass

## Phase 4: Form-action cascade (7 specs)

- [ ] Re-run admin/tasks/walker WITHOUT source changes:

  ```bash
  bunx playwright test tests/e2e/hangar-review-queue/{admin,tasks,walker}.spec.ts --project=hangar-review-queue --workers=1
  ```

- [ ] Identify any specs still failing after phase 1
- [ ] For each remaining failure: open the form action handler and verify it returns `fail()` with errors on validation OR redirects on success
- [ ] Spot-fix any silent error-swallow

## Phase 5: Verification

- [ ] `bun run test e2e --project=hangar-review-queue` - expect 24/24 pass
- [ ] `bun run test e2e --project=hangar-review-queue-unauthed` - expect already-passing specs stay green
- [ ] `bun run check all` - expect clean
- [ ] Manual smoke in real browser: `/review`, click into a card, navigate walker - no console errors
- [ ] Update `docs/work/NOW.md` to mark cluster closed
- [ ] Mark spec.md `agent_review_status: done`
