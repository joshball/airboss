---
type: unfinished-rollup
sessions: 24
items: 44
first_rolled: 2026-05-17T21:02:21Z
last_rolled: 2026-05-18T04:30:00Z
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
  - 20260517-212403-79769
  - 20260517-212610-82094
  - 20260517-215641-9754
  - 20260517-222752-41597
  - 5756488e-807a-478e-91ad-f15964f9d39e
---

# Unfinished Work -- Rollup

Consolidated from 24 sessions across 2 days (2026-05-15, 2026-05-17). Each item lists the session(s) that flagged it. De-duplicated by topic; highest severity kept.

## Critical (0)

None.

## High (8)

### `integration --full` never verified green on merged main

- **What**: `bun run test integration --full` (~5530-URL prod-build sweep -- the original crash repro) has never had a clean uninterrupted pass. The 480-URL sample sweep passes cleanly (verified 2026-05-18, all 46 books 100%, 0 failures), proving the prod server + zod-4 fix work under load -- but the full run is the explicit gate.
- **Where**: `bun run test integration --full`; artefacts at `tests/integration/.out/last-run.json` + `coverage-summary.json`.
- **Why deferred**: sessions ended before a clean full run. The *tooling* that previously obscured this -- unreadable output, no TTY for the progress dashboard, a stale-DB seed crash dumping raw SQL -- was fixed 2026-05-18 (PRs #1072, #1076, #1077); the sweep output is now legible and the sample run is demonstrably green. What remains is running the full 5530-URL sweep to completion.
- **Next action**: `pkill -f 'build/index.js'; pkill -f playwright`, confirm port 9647 free, then run `bun run test integration --full` to completion from a clean worktree off `main`; confirm it survives without the server OOM-crashing.
- **Severity**: high
- **Sessions**: 20260517-212403-79769, 20260517-222752-41597, 5756488e-807a-478e-91ad-f15964f9d39e

### `@ab/sources/regs/ingest` subpath export missing -- breaks register.test.ts

- **What**: `scripts/sources/register.test.ts` fails -- `Cannot find package '@ab/sources/regs/ingest'`. PR #1056 changed `scripts/sources/register/cfr.ts` to import `@ab/sources/regs/ingest`, but `libs/sources/package.json` `exports` only declares `.` and `./server` -- no `./regs/ingest` entry.
- **Where**: `libs/sources/package.json` exports map; `scripts/sources/register/cfr.ts:15`; `libs/sources/src/regs/ingest.ts` (target file exists).
- **Why deferred**: pre-existing breakage from merged sibling PR #1056; unrelated to the zod work that surfaced it.
- **Next action**: add a `"./regs/ingest"` (and likely `"./regs"`) entry to the `exports` map in `libs/sources/package.json` pointing at `./src/regs/ingest.ts`; re-run `scripts/sources/register.test.ts`.
- **Severity**: high
- **Sessions**: 20260517-222752-41597, 5756488e-807a-478e-91ad-f15964f9d39e

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

- **What**: Agents ran `bun run check` + svelte-check + unit/integration tests (green) but never loaded the actual pages in a real browser for the rich-reader + reader-prefs surface and the weather-comprehensive s11 course flow (PRs #932, #948, #944). The rich-reader WP `wp-flightbag-rich-reader` is on main but still `status: draft` with pending human review, and NOW.md flags its shipped code has never been loaded in a real browser. Sandbox/worktree agents have no DATABASE_URL.
- **Where**: flightbag PHAK reader + study `/notes`; `https://study.airboss.test/courses/weather-comprehensive/s11.*`.
- **Why deferred**: agents lack DATABASE_URL in worktrees; CLAUDE.md requires a real-browser load before claiming browser-correctness.
- **Next action**: spin up the dev server with DB, click through the affected pages, watch the devtools console.
- **Severity**: high
- **Sessions**: 20260515-181801-71712, 80d9ef12, 5756488e-807a-478e-91ad-f15964f9d39e

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

## Medium (17)

### `14cfr14` missing CFR section rows (failing seed-shape test)

- **What**: `scripts/db/seed-references-from-manifest.test.ts` fails -- "every CFR reference with sections has at least one top-level section row", missing `14cfr14`. Likely the same class of environment-dependent failure as the "3 pre-existing test failures" / "CFR body derivatives missing in fresh worktrees" items below.
- **Where**: `scripts/db/seed-references-from-manifest.test.ts:1456`.
- **Why deferred**: missing-source-corpus / environment-dependent; the test message says to run `bun run sources register cfr --title=14 --edition=<date>` then re-seed.
- **Next action**: determine whether Title 14 CFR Part 14 should be in the registered corpus; if so register + re-seed it, otherwise scope the test to the parts actually present (see the "CFR body derivatives" low item -- option c).
- **Severity**: medium
- **Sessions**: 20260517-222752-41597, 5756488e-807a-478e-91ad-f15964f9d39e

### `bun run check branch` not run on the zod-4 merged end-state

- **What**: the integration-sweep brief asked for `bun run check branch` clean as the end gate. The zod-4 PRs (#1064/#1065) passed `check dirty` individually pre-merge, but a final `check branch` against merged `main` was not run. (The later contrast PR #1067 did pass a full `check branch` from its worktree.)
- **Where**: repo root, `bun run check branch`.
- **Why deferred**: session ended before the final verification pass.
- **Next action**: from a clean worktree on latest `main`, run `bun run check branch` and confirm 0 errors / 0 warnings.
- **Severity**: medium
- **Sessions**: 20260517-222752-41597

### `ball-worktree/guard.sh` syntax error blocked all tool calls

- **What**: the `ball-worktree` PreToolUse guard hook crashed on a bash syntax error at line 331 -- `unexpected token ';&'`. Because it is a PreToolUse hook it blocked EVERY Bash and Read call until fixed out-of-band. `;&` is a `case`-fallthrough operator, invalid inside a `[[ ]]` conditional.
- **Where**: `~/src/_me/ai/agent-skills/skills/worktree/ball-worktree/guard.sh:331` (a shared skills repo, outside airboss).
- **Why deferred**: not an airboss-repo file; fixed out-of-band mid-session so work could continue, but the root cause should be confirmed.
- **Next action**: verify line 331 of guard.sh (likely `;&` -> `;;`, or a misplaced `[[`/`case` boundary); confirm `bash -n guard.sh` parses cleanly.
- **Severity**: medium
- **Sessions**: 5756488e-807a-478e-91ad-f15964f9d39e

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

- **What**: WP #979 authored `status: draft`, 7 docs. Retires the 6 live `LIBRARY_*` constants via `urlForReference()` adoption across 18 call sites; Phase C includes the POH umbrella card chrome-only fix. (Note: a duplicate spec branch `wp-flightbag-citation-url-migration-spec` was triaged as stale and deleted on 2026-05-17 -- the spec is already on main via #979.)
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

- **What**: the "Navigating FAA Documentation" course WP docs exist (PR #1022); per two sessions there is ambiguity -- one says the course was built across 5 worktrees with 8 PRs (#1022, #1024, #1027-#1031, #1036, #1037), another says only the WP was authored. Reconcile: the build PRs landed; what remains is the manual test pass.
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

- **What**: the knowledge build emits 200 `legacy-citation-shape` warnings -- citations using `source:` instead of structured `ref:` per ADR 019. (The wx-product reference pages were separately verified in PR #1020; this item is the knowledge-graph corpus.)
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

- **What**: several merged local branches cannot be deleted -- `git branch -d` refuses squash-merged branches and a coordination hook blocks `git branch -D` on worktree-style names. Named instances: `feat/flightbag-rich-reader`, `feat/flightbag-integration-suite`, `worktree-agent-a71596afef5fefea5`, plus ~28 stale `worktree-agent-*` refs. (Note: the 2026-05-17 branch-triage session cleared its own four -- `feat/flightbag-rich-reader`, `wp-flightbag-citation-url-migration-spec`, `fix/contrast-skips-deep-ink`, plus the rebase worktree -- so the named set here may be smaller now.)
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

- **What**: `ac-conformance.test.ts` (x2) and `seed-references-from-manifest.test.ts` (x1) -- environmental DB-state issues, pass in isolation. Related to the `14cfr14` medium item and the CFR-body-derivatives item below.
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
- **Sessions**: 9d89e07b

### Other agents' worktrees / branches accumulated in shared tree

- **What**: multiple sessions flagged ~8-12 other-agent branches and locked worktrees in the shared repo (`worktree-agent-*`, `track-a/*`, `track-c/*`, `feat/flightbag-*`, `feat/integration-sweep-*`, `chore/zod-4-upgrade`, etc.). The 2026-05-17 branch-triage session resolved the four it owned; most of the rest were cleared by a concurrent cleanup. Worktree-boundary rule means non-owning agents leave them alone.
- **Where**: `git worktree list`, `git branch`.
- **Why deferred**: not the flagging sessions' worktrees.
- **Next action**: `/audit-worktrees` or `/loose-ends`; owning agents clean up. As of the last 2026-05-17 session only `main` remained locally.
- **Severity**: low
- **Sessions**: 20260517-212403-79769, 20260517-212610-82094

### Stale session-todo files on disk

- **What**: the 2026-05-17 review + cleanup sessions wrote ~8 session todos under `docs/work/todos/` (`20260517-{03,04,05,06,10,11,12,14}-TODO.md`). Committed to main as part of their PRs but now spent.
- **Where**: `docs/work/todos/20260517-*-TODO.md`.
- **Why deferred**: not deferred work -- completed-session scratch; the `bun run track archive` 60-day rolling convention sweeps them.
- **Next action**: none required; they archive automatically. A future scan should treat all `20260517-*` todo files as closed.
- **Severity**: low
- **Sessions**: 20260517-215641-9754

## Resolved since the previous roll

- **`fix/contrast-skips-deep-ink` branch** -- was a medium item ("unmerged, needs rebase"). Resolved 2026-05-17: the branch was rebased onto current main, the theme-palette conflict resolved, `bun run check branch` ran clean (contrast-matrix 119 passed / 0 skipped), and it merged as **PR #1067**. The branch is deleted.
- **zod 3->4 / better-auth prod-build boot crash** -- the adapter-node servers crashed at boot (`z.coerce.boolean().meta is not a function`). Resolved via **PR #1064** (catalog zod -> 4, migration fixes). Both flightbag + study build and boot clean.
- **`integration list` wrong exit code** -- resolved via **PR #1065** (`--pass-with-no-tests`).
- **Integration sweep output unreadable + slow** -- the `bun run test integration` output was a wall of vite build spam, repeating `drizzle-kit push` ticks, interleaved seed streams, and a raw multi-screen SQL dump on a stale DB. Resolved 2026-05-18 across three PRs: **#1072** (list mode skips DB provisioning, one-line seed diagnosis instead of a raw stack, bordered colour tables, full-coverage manifest, list exits 0 via a sentinel test; also cleared a zod-4 `ZodLazy` type error in `credentials.validation.ts` and 13 svelte warnings), **#1076** (integration sweep runs Playwright with inherited stdio so the reporter's progress bars + colour actually render -- they were gated on `isTTY`, which the old `runTee` pipe always made false; vite build captured to a log), **#1077** (dropped the redundant third per-book table, dashboard is `DOCUMENT / PROGRESS / RESULT`, added tier legends). The 480-URL sample sweep is verified green.

## Per-session contributions

| Session                              | Date       | Branch | Items contributed |
| ------------------------------------ | ---------- | ------ | ----------------- |
| 0160f787                             | 2026-05-15 | -      | 0                 |
| 20260515-180643-56167                | 2026-05-15 | -      | 6                 |
| 20260515-180930-60283                | 2026-05-15 | -      | 1                 |
| 20260515-181752-71057                | 2026-05-15 | -      | 2                 |
| 20260515-181801-71712                | 2026-05-15 | -      | 3                 |
| 20260515-223922-1639                 | 2026-05-15 | -      | 0                 |
| 80d9ef12                             | 2026-05-15 | -      | 2                 |
| 9d89e07b                             | 2026-05-15 | -      | 2                 |
| afc4eeb6                             | 2026-05-15 | -      | 1                 |
| ba6a23ad                             | 2026-05-15 | -      | 1                 |
| cd16e567-tests-validator             | 2026-05-15 | -      | 2                 |
| cd16e567                             | 2026-05-15 | -      | 6                 |
| d83e4218                             | 2026-05-15 | -      | 0                 |
| 17883a4e                             | 2026-05-17 | main   | 2                 |
| 20260517-145336-25547                | 2026-05-17 | main   | 0                 |
| 20260517-155020-81423                | 2026-05-17 | main   | 2                 |
| 20260517-160100-94636                | 2026-05-17 | main   | 4                 |
| 20260517-163554-26560                | 2026-05-17 | main   | 3                 |
| 9b64fd7c                             | 2026-05-17 | main   | 0                 |
| e76c9f78                             | 2026-05-17 | main   | 5                 |
| 20260517-212403-79769                | 2026-05-17 | main   | 3                 |
| 20260517-212610-82094                | 2026-05-17 | main   | 1                 |
| 20260517-215641-9754                 | 2026-05-17 | main   | 1                 |
| 20260517-222752-41597                | 2026-05-17 | main   | 5                 |
| 5756488e-807a-478e-91ad-f15964f9d39e | 2026-05-17 | main   | 4                 |
