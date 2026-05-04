---
feature: study-app-surfaces
date: 2026-05-01
branch: main
reviewers_run: 11
total_issues: 166
critical: 6
major: 58
minor: 75
nit: 27
status: unread
review_status: done
all_criticals_closed: 2026-05-04
---

# 10x Review -- Chunk 1: study-app surfaces

11 reviewers, all complete.

## Final close-out as of 2026-05-04

Re-audited every per-category file against current main. **All 5 headline criticals closed via PRs #571 (testing default-annotation), #572 (backend GET-mutation), #574 (3 a11y -- MapPanel + radiogroup + read-suggestion preamble).** Remaining majors / minors / nits tracked in `docs/work-packages/review-tail-2026-05/` with concrete triggers per per-category review file.

| Severity | Closed | Open  | Total |
| -------- | -----: | ----: | ----: |
| CRITICAL |      6 |     0 |     6 |
| MAJOR    |     39 |    19 |    58 |
| MINOR    |     36 |    39 |    75 |
| NIT      |     12 |    15 |    27 |
| **TOTAL**|  **93**|**73** |**166**|

(Note: original critical tally rolled the (dev)-group security finding in -- that was scoped as MAJOR in the security review file but recorded as critical in the index frontmatter. Actual headline criticals on entry were 5: 3 a11y + 1 testing + 1 backend.)

### Per-category close-out

| Category     | Closed | Open | Status   | Headline open items                                                                                                  |
| ------------ | -----: | ---: | -------- | -------------------------------------------------------------------------------------------------------------------- |
| correctness  |     11 |    3 | done     | memory-review undo numeric key; heartbeat local accumulator; handbook-asset symlink defence                          |
| security     |      4 |    5 | done     | (dev) prod gate landed in this PR; remaining are seed/edition charset caps + content-type allowlist                  |
| perf         |      6 |    5 | pending  | help-registry code-split, library aggregators, regulations-section redundant fetch, knowledge-node listReferences   |
| architecture |      6 |   11 | done     | library / knowledge / session aggregator BCs, group-by enums to constants, handbook-asset to libs                    |
| a11y         |     17 |    4 | pending  | aria-controls on counter-trigger; login dev-accounts heading; toast live-region scope; KbdHint announcement          |
| patterns     |     11 |    0 | done     | all clean                                                                                                            |
| testing      |     17 |    4 | done     | savedDeck seeding; cleanup-guard removal; per-test fresh user for memory/review; reps-test ordering                  |
| dx           |      4 |   14 | pending  | handbook .catch -> typed errors; "verb entity failed" log sweep; login 5xx branch; discovery log level promotion     |
| ux           |      5 |   13 | pending  | library card-state indicator; topic 404 -> soft empty; Skip Permanently confirm copy; form-error consistency         |
| svelte       |      4 |    4 | pending  | route-level CSS extraction (work-package); URL side-effect from URL-seeded state; module-scoped timers -> $effect cleanup; calibration h2 nit |
| backend      |     16 |    2 | done     | regulations-section redundant fetch; per-action ref/chapter re-fetch (handbook chapter actions)                       |

### Closed-by-rewrite

- `apps/study/src/routes/(app)/memory/[id]/+page.svelte` -- 1172 lines -> 49 lines via `_panels/` extraction. The architecture MAJOR + svelte MAJOR (CSS proliferation) + svelte MAJOR (setTimeout cleanup) all closed for this file.
- `apps/study/src/routes/(app)/session/start/+page.svelte` -- 883 lines -> 87 lines.
- `apps/study/src/routes/(app)/library/regulations/**` -- five route files collapsed into thin BC adapters via `getRegulationsView`. Closes architecture MAJOR (bucket->slug duplication), architecture MAJOR (slug-shape parsers), patterns MAJOR (magic-string discriminants), correctness MAJOR (switch exhaustiveness).

### Remaining open by next-action trigger

- **Convergent N+1 cluster** (5 perf MAJORs + 6 backend MAJORs): CLOSED 2026-05-04 -- six batched BC helpers (`getCredentialMasteryMap`, `getHandbookProgressMap`, `getNodesCitingSectionsBatch`, `getCredentialsByIds`, `getCitationsForSyllabusNodes`, `getKnowledgeNodesForSyllabusLeaves`) and six route loader updates landed via the wave-2 worktree (review-tail-2026-05).
- **Log-quality sweep** (~6 dx items): mechanical pass replacing `'<func> threw'` with `'<verb> <entity> failed'` and aligning user-visible noun-phrase across logs + `fail()` messages.
- **Heartbeat correctness tail** (3 correctness items): rating numeric key, local accumulator on POST failure, handbook-asset symlink defence. Three small follow-ons.
- **Library completeness UX** (4 ux items + 1 architecture): card-state indicator, topic 404 -> soft empty, regulations empty buckets, isReadable hardcoded. All gated on the library-completeness Wave-2 spec decision.
- **Route-level CSS extraction** (1 svelte MAJOR): work-package scope -- extract Card / Toast / ScoreMeta / BadgeStatus primitives into `libs/ui`. Token migration is a finishing pass per project rule.
- **(app)/+layout effect-mirror** (1 svelte MAJOR + 1 svelte MINOR): CLOSED 2026-05-04 -- chunk-5's close-out audit shipped the convergent fix across 5 layouts (study `(app)`, hangar root, hangar `(app)`, sim, avionics) via PR #568. `$effect(() => mirror = data.x)` replaced with optimistic-override `$derived(override ?? data.x)`. Forward-reference MINOR closed by the same rework. See [svelte review](2026-05-01-study-app-surfaces-svelte.md) status table.
- **Backend CRITICAL** (memory/review GET-mutation): single-route fix -- redirect to a Start prompt with form action; never mint a session in `load`.
- **a11y CRITICAL × 3** -- ALL CLOSED 2026-05-04: MapPanel `aria-label` + `role="cell"` wrapper; radiogroup roving-tabindex via `radio-group-keyboard.ts`; read-suggestion preamble via `ReadSuggestionPanel.svelte`. See a11y review file for evidence.

## Summary table

| Category     | Critical | Major | Minor | Nit | Total | File |
|--------------|---------:|------:|------:|----:|------:|------|
| correctness  |        0 |     4 |     8 |   2 |    14 | [link](2026-05-01-study-app-surfaces-correctness.md) |
| security     |        0 |     1 |     6 |   2 |     9 | [link](2026-05-01-study-app-surfaces-security.md) |
| perf         |        0 |     5 |     5 |   1 |    11 | [link](2026-05-01-study-app-surfaces-perf.md) |
| architecture |        0 |     6 |     8 |   3 |    17 | [link](2026-05-01-study-app-surfaces-architecture.md) |
| a11y         |        3 |     8 |     7 |   3 |    21 | [link](2026-05-01-study-app-surfaces-a11y.md) |
| patterns     |        0 |     4 |     5 |   2 |    11 | [link](2026-05-01-study-app-surfaces-patterns.md) |
| testing      |        1 |     7 |     9 |   4 |    21 | [link](2026-05-01-study-app-surfaces-testing.md) |
| dx           |        0 |     6 |     8 |   4 |    18 | [link](2026-05-01-study-app-surfaces-dx.md) |
| ux           |        0 |     7 |     8 |   3 |    18 | [link](2026-05-01-study-app-surfaces-ux.md) |
| svelte       |        0 |     4 |     3 |   1 |     8 | [link](2026-05-01-study-app-surfaces-svelte.md) |
| backend      |        1 |     6 |     9 |   2 |    18 | [link](2026-05-01-study-app-surfaces-backend.md) |
| **TOTAL**    |    **5** |**58** |**76** |**27**|**166**| |

## Closed findings

- **patterns (major) -- `handbook-asset` URL shape not in `ROUTES`**: closed by [PR #466](https://github.com/joshball/airboss/pull/466). `ROUTES.HANDBOOK_ASSET(path)` added to `libs/constants/src/routes.ts`; all three figure-URL builders flagged in the patterns review now route through it, plus `rewriteHandbookAssetUrl` in `@ab/utils`.

## Critical findings (5)

- **a11y x3** -- ALL CLOSED 2026-05-04 (chunk-1 a11y wave-1 worktree). MapPanel `aria-label` + `role="cell"` wrapper; radiogroup roving-tabindex via `radio-group-keyboard.ts`; read-suggestion preamble via `ReadSuggestionPanel.svelte`. See [a11y review](2026-05-01-study-app-surfaces-a11y.md) status table for file:line evidence.
- **testing** -- `apps/study/src/lib/server/references.test.ts` historical-lens tests assert only `kind === 'historical'`, never the default `kind === 'current'`. A regression flipping every citation to historical would pass green.
- **backend** -- `apps/study/src/routes/(app)/memory/review/+page.server.ts` creates `memory_review_session` rows in a GET load. Prefetchers / link previews / crawlers can mint phantom sessions. Mirror of the hazard already documented (in reverse) at `sessions/[id]/summary/+page.server.ts`. Fix: route the no-resumable case through the existing `actions.fresh` form action.

## Convergent / root-cause findings

These show up across multiple reviewers and should be fixed at the root once, not N times.

### Route-level visual CSS proliferation
- **svelte (major)**: 65 of ~70 route files ship multi-screen `<style>` blocks with reusable component styling (cards, toasts, badges, score-meta, identity menu, undo-bar). Top 5 offenders carry 2300+ lines combined.
- **architecture (major)**: `memory/[id]/+page.svelte` (1172 lines, 432 CSS) and `session/start/+page.svelte` (883 lines, 438 CSS) have grown into multi-screen feature surfaces. Should follow the dashboard `_panels/` pattern.
- **Root cause**: route files are treated as pages instead of assembly. Visual primitives belong in `libs/ui/`.

### Business-logic drift into routes
- **architecture (major)**: regulations bucket->slug rule duplicated across 5 library routes; slug-shape parsers (CFR Part, AC series, dotted section codes) live in routes; view assembly (cert/topic grouping, knowledge-edge bucketing, goal status bucketing, credentials sorting, session runner kind-dispatch) runs in `+page.server.ts` despite the `getDashboardPayload` / `getCalibrationPageData` aggregator pattern existing in the same app.
- **patterns (major)**: `LIBRARY_REGULATIONS_KINDS` enum bypassed in 5 regulations route files; magic strings `'aim'`/`'ac'`/`'ntsb'`/`'14-cfr'`/`'49-cfr'` in switches and equality checks while the constant is used elsewhere in the same feature.
- **Root cause**: BC layer needs aggregator helpers for these flows; routes call them and assemble shape only.

### N+1 fan-outs
- **perf (5x major)** + **backend (6x major)** flag the same set:
  - `credentials/[slug]/areas/[areaCode]/+page.server.ts` -- triple-nested `tasks.map -> elements.map -> Promise.all([2])` (50-200 round trips per area drill)
  - `lens/handbook/+page.server.ts` -- one `getHandbookProgress` per handbook
  - `lens/handbook/[doc]/[chapter]/+page.server.ts` -- one `getNodesCitingSection` per section
  - `credentials/+page.server.ts`, `credentials/[slug]/+page.server.ts`, `goals/[id]/+page.server.ts` (sequential `for...of await`)
- **Root cause**: missing per-batch BC helpers (mirror existing `getNodeMasteryMap` / `getNodesByIds`).

### Generic error logging
- **dx (major)**: ~25 catch blocks across memory/reps/plans/goals/sessions log `'<funcName> threw'` instead of describing the operation. User-visible fallback strings ("Could not save changes.") never appear in logs.
- **dx (major)**: `/library/handbook/[slug]/[chapter]` and `[section]` route servers call `.catch(() => null)` on every BC fetch then 404 if null. Real DB outages render as 404s with no log trail.
- **dx (major)**: 404 messages echo URL slugs back to user (`'Handbook not found: phak'`) -- noise UX and slug-enumeration signal.
- **Root cause**: error logging discipline -- consistent operation/entity/state context, no `.catch(() => null)` swallowing.

### Heartbeat correctness
- **correctness (major)**: queue races on slow networks (concurrent `postHeartbeat` invocations stomp shared `pendingDeltas`)
- **correctness (major)**: never flushes on `visibilitychange` / `pagehide`, so up to 30s of read time per visit is silently dropped
- **correctness (minor)**: heartbeat increments running ahead of server truth
- **Root cause**: needs queue-discipline rewrite + lifecycle-event flush.

### Test-skip flow control
- **testing (5x major)**: `test.skip` used as flow control when seed shape doesn't match (`calibration`, `credentials`, `reps`, `library-by-cert`). Masks real coverage gaps with green skips. One file ships a permanently-skipped test (violates "no legacy in airboss").
- **testing (3x major)**: e2e files mutate shared seed state in parallel without pinning (`handbook-reader`, `library-by-cert`, `handbook-amendment`).
- **Root cause**: e2e suite needs per-suite seed isolation; skip-as-flow-control is an antipattern.

### Regulations-route exhaustiveness
- **correctness (major)**: 3 regulations-route switches drop exhaustiveness; adding a 6th `LibraryRegulationsKind` (per the library-completeness spec) silently returns undefined.

### `(dev)` route group leaks into prod
- **security (major)**: `(dev)/references/+page.server.ts` mutates the live `__sources_internal__` source registry on first request, polluting production source resolution with fixture data for the lifetime of the process. No auth gate, no env check.

## What's clean (preserve)

- **patterns**: no `any`, no `!`, no Svelte 4 syntax, no raw `nanoid()`/`ulid()`, no raw SQL, no inline `goto('/...')`, full token compliance, `@ab/*` aliases everywhere.
- **architecture**: no app-to-app or BC-to-app reverse deps; single documented cross-BC import; `(app)` layout group correctly anchors auth.
- **security**: layout-level `requireAuth` on `(app)` plus per-action re-checks, ownership filters in BC reads, sound path-traversal guard on `/handbook-asset`, safe-redirect allowlist on login, hash-locked CSP `script-src`, host-only cookie rewrite on auth responses, all `{@html}` sites consume server-authored markdown rendered through `renderMarkdown` (html-escape + protocol-allowlist).
- **backend**: form actions uniformly Zod-validated before BC calls, error mapping consistent (typed BC errors -> `fail(400/404/409)`, unknown -> log + `fail(500)`), PRG redirects use 303, `requireOpenSession` guard prevents stale-form writes after completion.
- **svelte**: zero `$:`, zero `export let`, zero `<slot>`, zero Svelte 4 stores, zero `$app/stores`, zero `createEventDispatcher`, all `{#each}` blocks keyed.
- **dx**: per-route logger namespaces; `requestId/userId/metadata` consistent across all error paths; `isUserSafeMessage` in both error boundaries; explicit env-var validation in `auth.ts`.

## Recommended fix order

1. **Critical first**: testing references (false-confidence regression risk), backend memory-review GET-mutation (data integrity).
2. **Convergent root-causes** (one fix closes many findings): N+1 batch BC helpers, regulations enum, generic error logging, heartbeat queue/lifecycle, test-skip flow control.
3. **Architecture cleanups** in their own pass: extract `_panels/` for memory/[id] and session/start; lift slug parsers and view-assembly into `@ab/bc-study`; misplaced helpers (`handbook-asset` streamer, `isSafeRedirect`, `ActivityHost`).
4. **Token migration**: route-level visual CSS extraction to `libs/ui/` -- runs LAST per project convention (token migration passes are finishing passes, not parallel with UX/a11y/style-editing work).

## Severity guide

- **critical**: data loss/corruption, exploitable vuln, broken access path, false-confidence test, severe a11y blocker
- **major**: plausible-edge-case bug, missing protection, won't-scale, business-logic-in-wrong-layer, swallowed errors
- **minor**: defensive gap, suboptimal, naming/comments
- **nit**: polish, style preference
