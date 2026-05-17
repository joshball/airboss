---
type: unfinished-rollup
sessions: 19
items: 41
first_rolled: 2026-05-17T21:02:21Z
last_rolled: 2026-05-17T21:02:21Z
consumed:
  - 0160f787-1218-43bd-8d38-56fb67570489
  - 20260515-180643-56167
  - 20260515-180930-60283
  - 20260515-181752-71057
  - 20260515-181801-71712
  - 20260515-223922-1639
  - 80d9ef12-fb09-413b-8ec5-22edba98423c
  - 9d89e07b-d64e-478c-bf06-b7658c4674b5
  - afc4eeb6-67f0-4d4e-b34e-5401e4a18613
  - ba6a23ad-37e1-49b3-ad2e-e11bdee12068
  - cd16e567-1d20-4267-86c4-750e4beac0fb-tests-validator
  - cd16e567-1d20-4267-86c4-750e4beac0fb
  - d83e4218-eda8-4ec0-bb92-2faf2f55eddc
  - 17883a4e-b98f-46fb-9528-2749da908b71
  - 20260517-145336-25547
  - 20260517-155020-81423
  - 20260517-160100-94636
  - 20260517-163554-26560
  - 9b64fd7c-3daa-4190-a412-0f87197e476e
  - e76c9f78-a389-4c89-8c61-10fc4ee1e108
---

# Unfinished Work -- Rollup

Consolidated from 19 sessions across 2 days (2026-05-15, 2026-05-17). Each item lists the session(s) that flagged it. De-duplicated by topic; highest severity kept.

## Critical (0)

None.

## High (6)

### 15 WP walkthroughs owed human sign-off

- **What**: ~15 work packages sit at `human_review_status: pending`. Code is shipped; only the user can flip the field. Includes cert-dashboard (#321), lens-ui (#323), goal-composer (#324), wx-engine, course-tree-arbitrary-depth, wp-notes-primitive, wp-flightbag-reader-ux, wp-flightbag-rich-reader, weather-comprehensive, xc-viewer-v1, card-question-tier, personal-minimums-as-typed-contract, course-reader-and-editor, hangar-content-census, and the V3.5 library card surface.
- **Where**: `docs/work/PUNT-BACKLOG.md` "User-only walkthroughs owed" table; individual WP `spec.md` frontmatter.
- **Why deferred**: `human_review_status` is lint-blocked for agents (ADR 025).
- **Next action**: walk each test plan, then `bun run wp set <slug> human-review signed-off`. cert-dashboard #321 is the shortest first step.
- **Severity**: high
- **Sessions**: 20260515-180643-56167, 20260515-181801-71712, 80d9ef12, cd16e567, 20260517-155020-81423, 20260517-163554-26560, e76c9f78

### 24 e2e failures (Buffer hydration leak + Postgres crash)

- **What**: 24 e2e failures, two root causes -- a Buffer hydration leak and a Postgres crash on `hangar.docs_search_index`. Triage docs exist.
- **Where**: `docs/work/e2e-triage-2026-05-08-*.md`.
- **Why deferred**: user explicitly said skip this round.
- **Next action**: one focused investigation (two root causes, not 24 patches).
- **Severity**: high

### Real-browser hydration verification owed across recent surfaces

- **What**: Agents ran `bun run check` + svelte-check + unit/integration tests (green) but never loaded the actual pages in a real browser for the rich-reader + reader-prefs surface and the weather-comprehensive s11 course flow (PRs #932, #948, #944). Sandbox/worktree agents have no DATABASE_URL.
- **Where**: flightbag PHAK reader + study `/notes`; `https://study.airboss.test/courses/weather-comprehensive/s11.*`.
- **Why deferred**: agents lack DATABASE_URL in worktrees; CLAUDE.md requires a real-browser load before claiming browser-correctness.
- **Next action**: spin up the dev server with DB, click through the affected pages, watch the devtools console.
- **Severity**: high
- **Sessions**: 20260515-181801-71712, 80d9ef12

### ADR 028 (content-intent frontmatter) awaits human approval

- **What**: ADR 028 defines the Layer 2 `content_status` + `intent` block contract for the content census. Status `proposed`.
- **Where**: `docs/decisions/028-*`.
- **Why deferred**: only the user can approve an ADR to `accepted`. Layer 2 frontmatter authoring is blocked at scale until then.
- **Next action**: user reviews + accepts ADR 028.
- **Severity**: high
- **Sessions**: e76c9f78

### Card question_tier hand-classification

- **What**: 256-786 cards (counts differ across sessions; most recent says 786 of 804) lack `question_tier`. The `classify-card-tier` interactive CLI exists (PR #954); the classifications themselves need CFI judgement per card.
- **Where**: `study.card` table; tool at `scripts/db/classify-card-tier.ts`.
- **Why deferred**: cannot auto-infer audience tier; requires CFI judgement.
- **Next action**: `bun scripts/db/classify-card-tier.ts` -- grind interactively.
- **Severity**: high
- **Sessions**: 20260515-180643-56167, cd16e567

### Manual walkthrough of weather-comprehensive course end-to-end

- **What**: the 11-section weather-comprehensive course has not been hand-walked in the live app to verify chart embeds, scenario directives, wiki-links, knowledge-node mounts.
- **Where**: `https://study.airboss.test/courses/weather-comprehensive`.
- **Why deferred**: user-facing review; only the user can do it.
- **Next action**: log in as `abby@airboss.test`, walk all sections, report breakage.
- **Severity**: high
- **Sessions**: cd16e567

## Medium (16)

### AvWx citation review queue grind (17 rows)

- **What**: 17 rows in `course/knowledge/.migration-review.md` await human ticking; 14 pre-matched, 3 need edition-reorg judgement, then `--apply`.
- **Where**: `course/knowledge/.migration-review.md`; tool `scripts/db/migrate-knowledge-citations.ts`.
- **Why deferred**: ADR-019 amendment D2 -- the script never auto-rewrites.
- **Next action**: walk the 17 rows, tick safe ones, run with `--apply`.
- **Severity**: medium
- **Sessions**: 20260515-180643-56167

### Implement personal-minimums-as-typed-contract WP

- **What**: WP #962 authored `status: draft`, 7 docs, 4 phases (schema -> hangar UI -> consumer function -> minimums lens). Build not started.
- **Where**: `docs/work-packages/personal-minimums-as-typed-contract/`.
- **Why deferred**: session was scoped to WP authoring, not building; also gated on sign-off.
- **Next action**: sign off, then `/ball-wp-build` Phase A.
- **Severity**: medium
- **Sessions**: 20260515-180643-56167, cd16e567

### Implement flightbag-citation-url-migration WP

- **What**: WP #979 authored `status: draft`, 7 docs. Retires the 6 live `LIBRARY_*` constants via `urlForReference()` adoption across 18 call sites; Phase C includes the POH umbrella card chrome-only fix.
- **Where**: `docs/work-packages/flightbag-citation-url-migration/`.
- **Why deferred**: architectural decisions captured; implementation is a separate effort.
- **Next action**: `/ball-wp-build`.
- **Severity**: medium
- **Sessions**: 20260515-180643-56167

### Implement xc-viewer-v1 WP

- **What**: WP authored (PR #829), 6 phases A-F. Spec is review-clean; port-collision blocker fixed (PR #1017). None implemented.
- **Where**: `docs/work-packages/xc-viewer-v1/`.
- **Why deferred**: `human_review_status: pending` gates `/ball-wp-build`.
- **Next action**: sign off, then dispatch Phase A (libs/spatial-engine scaffold + Memphis sectional ingest).
- **Severity**: medium
- **Sessions**: cd16e567, 20260517-163554-26560

### Build faa-documentation-navigation course from its WP

- **What**: the "Navigating FAA Documentation" course WP docs exist (PR #1022) but per two sessions there is ambiguity -- one session says the course was built across 5 worktrees with 8 PRs (#1022, #1024, #1027-#1031, #1036, #1037), another says only the WP was authored. Reconcile: the build PRs landed; what remains is the manual test pass.
- **Where**: `docs/work-packages/faa-documentation-navigation/`.
- **Why deferred**: WP authoring vs building are separate; if built, the 13-scenario manual test plan is unwalked.
- **Next action**: confirm build status; if built, user walks `test-plan.md` (13 FDN scenarios) and flips `human_review_status`.
- **Severity**: medium
- **Sessions**: 20260517-160100-94636, 20260517-155020-81423

### Run /ball-wp-drift

- **What**: spec-vs-code drift check across the WP corpus -- produces a punch list of WPs whose specs no longer match reality.
- **Where**: no artifact yet; `/ball-wp-drift` skill.
- **Why deferred**: out of scope for the OOS extraction request; user acknowledged but did not ask.
- **Next action**: run `/ball-wp-drift`, triage the report.
- **Severity**: medium
- **Sessions**: 20260515-181752-71057, 20260515-180930-60283

### course-reader-and-editor sign-off

- **What**: WP `course-reader-and-editor` -- `human_review_status: pending`. The deferred `/ball-review-full` ran (105 findings, all fixed in PR #1042). Review-clean, ready to sign off.
- **Where**: `docs/work-packages/course-reader-and-editor/spec.md`.
- **Why deferred**: sign-off is human-only.
- **Next action**: user walks the feature, then an agent flips `human-review signed-off` + `status signed-off` as a small PR.
- **Severity**: medium
- **Sessions**: 20260517-163554-26560

### hangar-content-census WP sign-off + Phase 3 + Layer 2

- **What**: (a) the `hangar-content-census` WP is `status: draft` awaiting sign-off; (b) Phase 3 gap-view is done for wx-catalog + knowledge-nodes only, 12 corpora still have placeholders (cards next); (c) Layer 2 content-intent frontmatter not authored anywhere -- gated on ADR 028.
- **Where**: `docs/work-packages/hangar-content-census/{spec,tasks}.md`.
- **Why deferred**: sign-off human-only; Phase 3 breadth-first; Layer 2 gated on ADR 028.
- **Next action**: user signs off; continue Phase 3 (cards corpus); author Layer 2 once ADR 028 accepted.
- **Severity**: medium
- **Sessions**: e76c9f78

### wx-engine AIRMET/SIGMET text emitter

- **What**: the wx-engine has no AIRMET/SIGMET text emitter, so that product is structurally unmatchable by the catalog coverage matcher and cannot be drilled with generated content.
- **Where**: `libs/wx-engine`; tracked in `docs/work-packages/hangar-content-census/tasks.md` "Known follow-ups".
- **Why deferred**: a real engine feature, out of scope for catalog-coverage work.
- **Next action**: design + build an AIRMET text emitter.
- **Severity**: medium
- **Sessions**: e76c9f78

### Content census Phase 3 -- remaining corpora

- **What**: Phase 3 (real gap view + next-list per corpus) done for 2 of 14 corpora; 12 remain with placeholders.
- **Where**: `docs/work-packages/hangar-content-census/tasks.md` Phase 3.
- **Why deferred**: breadth-first, value-ranked, one corpus at a time.
- **Next action**: continue Phase 3 starting with cards.
- **Severity**: medium
- **Sessions**: e76c9f78

### AIM seed intermittent crash (parallel corpus race)

- **What**: `bun run test e2e` aborted once in globalSetup with an AIM seed error -- paragraph `9-1-1` claimed missing parent `9-1`. Did not reproduce across 5+ fresh provisions; likely a transient race in the parallel `Promise.all(CORPUS_DIRS.map(...))` seeder.
- **Where**: `scripts/db/seed-references-from-manifest.ts:162`; `libs/bc/study/src/seeders/aim.ts:196`.
- **Why deferred**: could not reproduce.
- **Next action**: if it recurs, add a diagnostic dump at the throw site or serialize the corpus loop (`Promise.all` -> sequential `for await`).
- **Severity**: medium
- **Sessions**: 17883a4e

### Parallel-worker DB connection terminations in full vitest sweep

- **What**: a full `bun run vitest --run libs/bc/study/ scripts/db/` showed ~22 of ~1307 failures with Postgres `FATAL 57P01 ProcessInterrupts` -- connections killed mid-query. Suspect vitest parallel workers sharing the single connection pool; the 4 target files pass individually.
- **Where**: reproduce with `bun run vitest --run libs/bc/study/ scripts/db/`; suspect `vitest.globalSetup.ts` teardown vs worker pools.
- **Why deferred**: out of scope of the original test-isolation ask.
- **Next action**: confirm contention vs bug via `--no-file-parallelism`; then decide single-threaded DB tests / per-worker connection / transactional rollback.
- **Severity**: medium
- **Sessions**: 9d89e07b

### legacy-citation-shape warnings (200 occurrences)

- **What**: the knowledge build emits 200 `legacy-citation-shape` warnings -- citations using `source:` instead of structured `ref:` per ADR 019. (Note: the wx-product reference pages were separately verified in PR #1020; this item is the knowledge-graph corpus.)
- **Where**: `course/knowledge/weather/*/node.md` and others (ACs, AIM paragraphs, ACS, NTSB, POH cites).
- **Why deferred**: migration is intentionally human-in-the-loop; dry-run finds 0 auto-migratable rows.
- **Next action**: deliberate authoring pass mapping each legacy citation to a canonical `airboss-ref:` URI. These warnings become errors per the ADR 019 graduation plan.
- **Severity**: medium
- **Sessions**: cd16e567-tests-validator

### Pre-existing red test: upsertEdition idempotency

- **What**: `libs/sources/src/registry/edition-resolver.test.ts` ~line 206 fails (`UNIQUE(source_id, edition_label) blocks bypass-the-helper dupes`). Verified failing on origin/main before the session that flagged it.
- **Where**: `libs/sources/src/registry/edition-resolver.test.ts:206`.
- **Why deferred**: pre-existing; failure shape suggests a test-setup issue, not a regression.
- **Next action**: the edition-writer / promotion-batches WP owner triages -- fix or rewrite the assertion.
- **Severity**: medium
- **Sessions**: afc4eeb6

### fix/contrast-skips-deep-ink branch -- unmerged, needs rebase

- **What**: 38 advisory contrast skips fixed via a `deepInk` token + `edge.default` tightening; branch pushed to origin, never PR'd (agent killed mid-task). Subsequent main activity added consumer-page `deepInk` references, so a rebase is now required.
- **Where**: branch `fix/contrast-skips-deep-ink` (origin + local), 1 commit ahead / many behind.
- **Why deferred**: agent process killed before `gh pr create`.
- **Next action**: rebase against current main, resolve theme-palette + ~30 consumer-page conflicts, `bun run check` clean, 0 skipped tests, PR + merge. Or delete and redo.
- **Severity**: medium
- **Sessions**: cd16e567-tests-validator

### card-question-tier Phase 3 UI surfaces

- **What**: schema for `question_tier` / `source_authority` / `acs_codes` is live (PRs #855, #949) but no UI consumes it (filter chips, FAA-vs-CFI side-by-side, ACS coverage lens, source-authority badges).
- **Where**: `docs/work-packages/card-question-tier/spec.md` Phase 3.
- **Why deferred**: each surface is its own follow-on WP; schema landed first.
- **Next action**: after hand-classification creates data, author one filter-chip surface as proof, then per-surface WPs.
- **Severity**: medium
- **Sessions**: cd16e567

## Low (19)

### Drift-check Step 3: hangar surface

- **What**: surface the monthly source-corpus drift report inside the hangar app as a review-queue item, instead of only a dated file in `docs/work/reviews/`.
- **Where**: `docs/work/plans/2026-05-17-source-corpus-drift-check.md` Step 3; no artifact yet.
- **Why deferred**: `apps/hangar/` is a scaffold; Steps 1-2 (the CLI + monthly job, PR #1035) already deliver the value.
- **Next action**: build when a content author other than the developer needs the drift signal (recorded trigger).
- **Severity**: low
- **Sessions**: 20260517-160100-94636

### feat/wx-examples-page -- unmerged branch

- **What**: local branch `feat/wx-examples-page` with one unmerged commit `41baff85` ("/reference/wx/products/<slug>/examples browsable catalog page (Drill Phase 2)"). No PR.
- **Where**: branch `feat/wx-examples-page`.
- **Why deferred**: not created by the flagging session; ownership uncertain.
- **Next action**: the owning session opens a PR or cleans up. If abandoned, `git branch -D feat/wx-examples-page`.
- **Severity**: low
- **Sessions**: 20260517-160100-94636, ba6a23ad

### Citation verification -- ongoing maintenance

- **What**: all 25 wx-product reference pages carry zero `verified: false` citations (PR #1020). This needs re-running whenever a source document gets a new edition.
- **Where**: `course/weather/references/products/*/page.md`; gated by the `wx-citations` validator (PR #1008).
- **Why deferred**: recurring obligation, not unfinished work. The monthly drift check (PR #1035) surfaces when a source doc changes.
- **Next action**: when `bun run sources report` flags a new edition of AC 00-45H / AIM / FAA-H-8083-28, re-run a citation verification pass.
- **Severity**: low
- **Sessions**: 20260517-160100-94636

### Stale merged local branches blocked from deletion

- **What**: several merged local branches cannot be deleted -- `git branch -d` refuses squash-merged branches and a coordination hook blocks `git branch -D` on worktree-style names. Named instances: `feat/flightbag-rich-reader`, `feat/flightbag-integration-suite`, `worktree-agent-a71596afef5fefea5`, plus ~28 stale `worktree-agent-*` refs.
- **Where**: `git branch --list`.
- **Why deferred**: squash-merge SHA mismatch + hook block; agents do not work around hooks.
- **Next action**: user verifies each has no live worktree / no unmerged work, then batch `git branch -D`.
- **Severity**: low
- **Sessions**: 20260515-181801-71712, 20260515-181752-71057, 17883a4e

### Rolling-archive scheduled job wiring

- **What**: `scripts/tracking/archive.ts` exists and is tested; not wired into the launchd scheduler.
- **Where**: `scripts/tracking/archive.ts`.
- **Why deferred**: deliberately deferred during tracking-system-overhaul.
- **Next action**: wire into launchd, or accept the manual `bun run track archive --apply`.
- **Severity**: low
- **Sessions**: 20260515-180643-56167

### 3 pre-existing test failures (ac-conformance, seed-references)

- **What**: `ac-conformance.test.ts` (x2) and `seed-references-from-manifest.test.ts` (x1) -- environmental DB-state issues, pass in isolation.
- **Where**: `libs/bc/study/src/ac-conformance.test.ts`, `scripts/db/seed-references-from-manifest.test.ts`.
- **Why deferred**: not introduced by the flagging session.
- **Next action**: investigate test isolation; may be addressed by the `airboss_unit_test` isolated DB (PR #982).
- **Severity**: low
- **Sessions**: 20260515-180643-56167

### CFR body derivatives missing in fresh git worktrees

- **What**: CFR section body `.md` files are git-ignored (ADR 018 cache derivatives); `git worktree add` checks out only tracked files, so a fresh worktree has zero CFR bodies, the CFR seed adapter skips every Part, and `seed-references-from-manifest.test.ts` fails there.
- **Where**: `libs/bc/hangar/.../seeders/cfr.ts:~286`; `scripts/db/unit-test-setup.ts`; ADR 018.
- **Why deferred**: not a code bug -- passes in any environment that has run `bun run sources register cfr`.
- **Next action**: cleanest is option (c) -- make the test skip the CFR-section assertion when no CFR body files are present, so a cache-less environment reports "skipped" not "failed".
- **Severity**: low
- **Sessions**: 9b64fd7c

### Comment-vs-code mismatch in build-knowledge-index.ts

- **What**: the comment at ~line 1086 says the index writes on dry-run; the `if (!args.dryRun)` gate contradicts it.
- **Where**: `scripts/build-knowledge-index.ts:1086`.
- **Why deferred**: pre-existing, out of scope.
- **Next action**: fix the gate or fix the comment.
- **Severity**: low
- **Sessions**: 20260515-180643-56167

### Run /ball-wp-coverage

- **What**: scan for cohesive features that shipped without a work package.
- **Where**: no artifact yet; `/ball-wp-coverage` skill.
- **Why deferred**: bigger investigation, more product judgement; user did not request it.
- **Next action**: run `/ball-wp-coverage`, then per gap decide retroactive WP / archive / punt.
- **Severity**: low
- **Sessions**: 20260515-181752-71057

### Retention-bearing callouts -- Phase B + C

- **What**: the retention-bearing-callouts plan has Phase A done (PR #1016); Phase B (path-scoped build validator requiring `:::cards` in study-content `:::tip`/`:::warn`) and Phase C (author-guidance doc) are not built.
- **Where**: `docs/work/plans/2026-05-retention-bearing-callouts.md`.
- **Why deferred**: future work; no backfill needed (study corpus has zero callouts today).
- **Next action**: add the build-time validator rule scoped to `course/knowledge/**`, update authoring guidance.
- **Severity**: low
- **Sessions**: 20260517-163554-26560

### wx-charts ADR 027 deferred chart families

- **What**: 4 of 17 chart families (radar-mosaic, satellite IR/VIS/WV) lack engine-side wx-scenario derivations.
- **Where**: `docs/decisions/027-wx-charts-artifact-layout/`; `docs/work-packages/wx-engine/OUT-OF-SCOPE.md`.
- **Why deferred**: raster pipelines need separate authoring; not blocking v1.
- **Next action**: revisit when satellite or radar pedagogy is exercised.
- **Severity**: low
- **Sessions**: 80d9ef12

### Catalog coverage -- 44 uncovered METAR/TAF token families

- **What**: 44 of 87 token families have no generated example because the wx-engine does not model the producing synoptic conditions (`+FC`, `VA`, `SQ`, `WS`, `BECMG`, ...).
- **Where**: `/content/wx-catalog` gap view; `hangar-content-census/tasks.md` "Known follow-ups".
- **Why deferred**: each is a small incremental engine feature.
- **Next action**: prioritise + add engine features per token family.
- **Severity**: low
- **Sessions**: e76c9f78

### frontal-pressure-march contributes 0 catalog examples

- **What**: the temporal scenario `frontal-pressure-march` is not represented in the encoded-text catalog.
- **Where**: `hangar-content-census/tasks.md` "Known follow-ups".
- **Why deferred**: one authoring pass not yet done.
- **Next action**: author `frontal-pressure-march` products into the catalog.
- **Severity**: low
- **Sessions**: e76c9f78

### Walkthrough docs may drift from code

- **What**: six feature walkthroughs in `docs/work/walkthroughs/20260513-flight/` were written against a 2026-05-13 snapshot; lens-ui and goal-composer were "in flight" then, so those docs describe intended shape. Also: 4 walkthrough scaffolds from PR #1012 (wx-engine, course-tree-arbitrary-depth, card-question-tier, weather-comprehensive) await the user running them.
- **Where**: `docs/work/walkthroughs/20260513-flight/*.md`; `docs/work/walkthroughs/2026-05-16-*-walkthrough.md`.
- **Why deferred**: point-in-time docs; manual testing is a human action.
- **Next action**: after lens-ui / goal-composer ship signed-off, `/ball-wp-drift` reconcile `02-lens-ui.md` + `03-goal-composer.md`; user runs the 4 scaffolds.
- **Severity**: low
- **Sessions**: 20260515-180930-60283, 20260517-163554-26560

### Svelte component tests fail under bun test

- **What**: `bun test libs/help libs/aviation` reports ~118 failing svelte component tests -- they need vitest (happy-dom), not bun's runner; they pass under vitest.
- **Where**: `libs/help/src/**/*.test.ts`, `libs/aviation/src/**/*.test.ts`.
- **Why deferred**: pre-existing; cosmetic, does not gate `bun run check`.
- **Next action**: skip `*.svelte.test.ts` from the `bun test` path (a `bunfig.toml` change).
- **Severity**: low
- **Sessions**: afc4eeb6

### cleanup-cfr-part-14-orphan.ts is dead weight on fresh DBs

- **What**: `scripts/db/cleanup-cfr-part-14-orphan.ts` was a one-shot repair; PR #986 fixed the seed pipeline so it is now a no-op on fresh DBs. Still useful for long-lived DBs with the orphan baked in.
- **Where**: `scripts/db/cleanup-cfr-part-14-orphan.ts`.
- **Why deferred**: deleting now strips the repair path for un-reseeded dev DBs.
- **Next action**: once all dev DBs are confirmed reseeded, delete the script + its test (per "no legacy" rule).
- **Severity**: low
- **Sessions**: 9d89e07b

### Uncommitted test-runner logging changes

- **What**: `runTee` added to `scripts/lib/spawn.ts` + `scripts/test.ts` wired to write each unit-test run to `.cache/test/<label>-<timestamp>.log`. Verified working; was uncommitted on main at the flagging session's end.
- **Where**: `scripts/lib/spawn.ts`, `scripts/test.ts`.
- **Why deferred**: user did not ask to commit. NOTE: a later session (17883a4e) observed these two files dirty at its start and not its own -- likely the same uncommitted change; verify whether it has since landed.
- **Next action**: confirm current state of the two files vs origin/main; if still uncommitted, `/qs` to ship or discard.
- **Severity**: low
- **Sessions**: d83e4218, 17883a4e

### unresolved-edge warnings (11 occurrences)

- **What**: 11 knowledge-graph edges across 3 nodes (`vfr-weather-minimums`, `crosswind-component`, `engine-failure-after-takeoff`) point at unauthored target nodes.
- **Where**: per-node `node.md` frontmatter; `.reports/build-knowledge/warnings.json`.
- **Why deferred**: each edge is a content judgement call.
- **Next action**: walk the 11 with a content owner -- author the target or drop the edge.
- **Severity**: low
- **Sessions**: cd16e567-tests-validator

### Stale generated docs (SHIPPED.md, faa-docs.ts)

- **What**: (a) `docs/work/SHIPPED.md` is stale; `bun run track generate` refreshes it. (b) the FAA doc-registry generator was patched after Phase 1 shipped and may not have been re-run -- `libs/aviation/src/references/faa-docs.ts` may not reflect the patch (note: a later session 20260517-145336-25547 reports the generator drift was fixed at the root in PR #1013 -- likely resolved; verify).
- **Where**: `docs/work/SHIPPED.md`; `scripts/generate-faa-doc-registry.ts`, `libs/aviation/src/references/faa-docs.ts`.
- **Why deferred**: generated artifacts, out of scope of feature PRs.
- **Next action**: `bun run track generate` for SHIPPED.md; confirm faa-docs.ts is current (likely already fixed by PR #1013).
- **Severity**: low
- **Sessions**: 20260517-163554-26560, 20260515-223922-1639, 20260517-145336-25547

### Flaky hangar-jobs worker test

- **What**: `libs/hangar-jobs/src/worker.test.ts:273` failed once under parallel load, passed in isolation and on retry -- a race on `hangar_job_log` row visibility.
- **Where**: `libs/hangar-jobs/src/worker.test.ts:273`.
- **Why deferred**: intermittent, not deterministically reproducible.
- **Next action**: `bun run bug new flaky-worker-audit-log-race` if it recurs; likely fix is `await` the log insertion in the worker.
- **Severity**: low
- **Sessions**: cd16e567-tests-validator

## Per-session contributions

| Session | Date | Branch | Items |
|---------|------|--------|-------|
| 0160f787-1218-43bd-8d38-56fb67570489 | 2026-05-15 | main | 0 |
| 20260515-180643-56167 | 2026-05-15 | main | 9 |
| 20260515-180930-60283 | 2026-05-15 | main | 1 |
| 20260515-181752-71057 | 2026-05-15 | main | 3 |
| 20260515-181801-71712 | 2026-05-15 | main | 10 |
| 20260515-223922-1639 | 2026-05-15 | main | 3 |
| 80d9ef12-fb09-413b-8ec5-22edba98423c | 2026-05-15 | main | 8 |
| 9d89e07b-d64e-478c-bf06-b7658c4674b5 | 2026-05-15 | main | 2 |
| afc4eeb6-67f0-4d4e-b34e-5401e4a18613 | 2026-05-15 | main | 3 |
| ba6a23ad-37e1-49b3-ad2e-e11bdee12068 | 2026-05-15 | main | 1 |
| cd16e567-...-tests-validator | 2026-05-15 | main | 4 |
| cd16e567-1d20-4267-86c4-750e4beac0fb | 2026-05-15 | main | 7 |
| d83e4218-eda8-4ec0-bb92-2faf2f55eddc | 2026-05-15 | main | 1 |
| 17883a4e-b98f-46fb-9528-2749da908b71 | 2026-05-17 | main | 3 |
| 20260517-145336-25547 | 2026-05-17 | main | 0 |
| 20260517-155020-81423 | 2026-05-17 | main | 2 |
| 20260517-160100-94636 | 2026-05-17 | main | 4 |
| 20260517-163554-26560 | 2026-05-17 | main | 5 |
| 9b64fd7c-3daa-4190-a412-0f87197e476e | 2026-05-17 | main | 1 |
| e76c9f78-a389-4c89-8c61-10fc4ee1e108 | 2026-05-17 | main | 8 |
