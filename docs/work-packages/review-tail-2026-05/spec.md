---
feature: review-tail-2026-05
status: in-flight
date: 2026-05-04
driver: 6-chunk 2026-05 review program close-out audit (PRs #560/#561/#563/#564/#565/#568)
---

# Review tail — 2026-05 program

The 6-chunk review program closed ~545 of ~745 unique findings via 30+ PRs (#432 through #568). The 2026-05-04 close-out audit walked every per-category file, re-grepped current main, and surfaced what's actually still open. This work package tracks every remaining item with a concrete next-action.

## Scope

- 7 named criticals (5 chunk-1, 2 chunk-2).
- ~30 remaining majors, mostly in convergent clusters with one root cause each.
- ~150 minors/nits carried forward with named triggers (handled opportunistically as touched code passes through).

Source-of-truth references live in each per-category review file under `docs/work/reviews/`. The audit-pass `## Status as of 2026-05-04` section in each per-category file enumerates verdicts; this WP is the cross-cutting roll-up.

## Severity ladder

1. **Open criticals** (7): security/correctness hazards that should ship first.
2. **Convergent clusters** (~12): root-cause groupings where one work item closes 4+ children.
3. **Surgical majors** (~15): isolated finding-per-fix items.
4. **Minor + nit drift** (~150): close opportunistically when touching the file. Lint rule `tools/test-lint` already prevents new `.toBeTruthy()` drift; analogous rules can prevent the rest.

## Tier 1 — open criticals (7)

### chunk-1 a11y CRITICAL × 3 — `apps/study/src/lib/components/`

1. **MapPanel labels**: `aria-label` missing on the map region; `role="cell"` is misapplied. Fix: drop the cell role, add an `aria-label` describing the map's current state. Source: `docs/work/reviews/2026-05-01-study-app-surfaces-a11y.md`.
2. **Radiogroup keyboard nav**: arrow keys don't move between radios; Tab jumps the whole group. Fix: roving-tabindex + `keydown` for ArrowUp/ArrowDown, OR convert to native `<fieldset>`+`<input type="radio">` per the file's own recommendation.
3. **Read-suggestion preamble**: the suggestion list is announced to screen readers as a flat list with no preamble explaining what it is. Fix: add a `role="group"` wrapper with `aria-labelledby` pointing at a visible heading or sr-only descriptor.

### chunk-1 testing CRITICAL — `apps/study/src/lib/server/references.test.ts`

4. **Default-annotation regression test missing**: historical-lens tests assert only `kind === 'historical'`, never the default `kind === 'current'`. A regression flipping every citation to historical would pass green. Fix: add a positive assertion that the default annotation is `'current'` and a separate explicit-default test pinning it.

### chunk-1 backend CRITICAL — `apps/study/src/routes/(app)/memory/review/+page.server.ts`

5. **GET-mutation hazard**: `load()` mints `memory_review_session` rows. Prefetchers, link previews, link-checker bots, and tab restoration can all create phantom sessions. Fix: redirect the no-resumable case through the existing `actions.fresh` form action; never mint a session in `load`.

### chunk-2 architecture CRITICAL — package boundaries

6. **Package-boundary hardening**: 3 sub-items, one WP closes them all.
   - Declare `@ab/bc-hangar` dep on `bc-study` + curated re-export.
   - Add `exports` field to `@ab/db` and `@ab/auth` `package.json`.
   - Replace `@ab/bc-sim/persistence` wildcard subpath with an explicit listed subpath.
   - Source: `docs/work/reviews/2026-05-01-study-bc-domain-architecture.md`.

### chunk-2 backend CRITICAL — transaction wrap (partial-closed)

7. **Transaction-wrap pass**: `applyCertGoalsToPrimaryGoal` half landed via #481; remaining are `updateCard`, `renameSavedDeck`/`deleteSavedDeck` `onConflictDoUpdate` paths. Fix: wrap each multi-write call in `db.transaction(...)`.

## Tier 2 — convergent clusters (one root-cause fix per cluster)

### N+1 batch helpers (chunk-1 perf × 5 + backend × 6 = 11 findings)

Build six BC helpers and update six route loaders:

- `getCredentialMasteryMap(userId, credentialIds[])`
- `getHandbookProgressMap(userId, handbookSlugs[])`
- `getNodesCitingSectionsBatch(sectionIds[])`
- `getCredentialsByIds(ids[])`
- `getCitationsForSyllabusNodes(nodeIds[])`
- `getKnowledgeNodesForSyllabusLeaves(leafIds[])`

Routes that call BC functions in a per-row loop today:

- `apps/study/src/routes/(app)/credentials/+page.server.ts`
- `apps/study/src/routes/(app)/lens/handbook/+page.server.ts`
- `apps/study/src/routes/(app)/goals/[id]/+page.server.ts`
- `apps/study/src/routes/(app)/library/handbook/[slug]/+page.server.ts`
- `apps/study/src/routes/(app)/library/cert/[cert]/+page.server.ts`
- `apps/study/src/routes/(app)/credentials/[slug]/areas/[areaCode]/+page.server.ts`

### Library-by-cert SQL-side filter (chunk-2 perf × 2)

GIN index on `study.reference(subjects)` + Drizzle `arrayContains` for the membership check; `LATERAL` unnest for per-subject counts. Both queries currently fan-out via TS post-filtering.

### BC error-class hygiene sweep (chunk-2 dx × 1 + backend × 4 + correctness × 1)

- `SourceRefRequiredError` dedupe — same shape exists in 3 places.
- Shared `UpsertReturnedNoRowError` for the 5 BC writes that throw on `INSERT … RETURNING` zero-row.
- `CitationNotOwnedError`, `CredentialPrereqUnresolvedNodesError` — typed errors instead of generic `Error`.
- `LensError` style — drop the `[lensKind]` prefix from messages; the public field is the structured discriminator.

### Goals validation gap (chunk-2 security MAJOR)

Wire `createGoalInputSchema.parse(...)` (and the cousins for `updateGoal`, `addGoalSyllabus`) at the BC boundary. Today the route layer caps lengths but the BC accepts whatever it's given.

### Build-only barrel split (chunk-2 security MAJOR)

Split `@ab/bc-study` from `@ab/bc-study/build`. The build path imports actor-bypass helpers (seeders, validators) that should never be reachable from runtime code; today everything is in one barrel.

### Log-quality sweep (chunk-1 dx × 6)

Mechanical pass replacing `'<func> threw'` with `'<verb> <entity> failed'` and aligning the user-visible noun-phrase across logs + `fail()` messages. Source list in `docs/work/reviews/2026-05-01-study-app-surfaces-dx.md`.

### Heartbeat correctness tail (chunk-1 correctness × 3)

- Rating numeric key on the heartbeat payload.
- Local accumulator on POST failure (today the counter increments even on 5xx).
- Handbook-asset symlink defence (escape-the-prefix attack on `[...path]`).

### Layout effect-mirror remainder (chunk-1 svelte × 2) - CLOSED 2026-05-04

Chunk-5's audit (#568) shipped the convergent fix for 5 layouts. Verified against current main on 2026-05-04: the chunk-1-cited site (`apps/study/src/routes/(app)/+layout.svelte:36-41`) is on the optimistic-override `$derived(override ?? data.* ?? DEFAULT_*)` pattern, no `state_referenced_locally` suppression remains in the layout. Both findings (1 MAJOR + 1 related MINOR) closed via #568 - chunk-1 svelte review file Status table updated; INDEX svelte tally adjusted to 4 closed / 4 open. The other `state_referenced_locally` suppressions across `memory/[id]/_panels/`, `sessions/[id]`, `session/start/SessionLegend`, `plans/[id]`, and `knowledge/[slug]/learn` are tied to MAJOR #3 (URL-from-state side-effects) and remain open under the route-level convergent fix.

### Route-level CSS extraction (chunk-1 svelte MAJOR)

Extract Card / Toast / ScoreMeta / BadgeStatus into `libs/ui`. Token migration runs after this per project convention.

### Library completeness UX (chunk-1 ux × 4 + architecture × 1)

- Card-state indicator on cert + handbook cards.
- Topic 404 → soft empty state.
- Regulations empty buckets.
- `isReadable` hardcoded list → BC helper backed by registry.

Gated on Wave-2 spec decision per the chunk-1 INDEX.

## Tier 3 — surgical majors and deferred-with-trigger items

Carried forward in the per-category review files with concrete triggers:

- **chunk-2 schema cleanup migration** (3 minors) — `lifecycle` notNull tightening, `references_v2_migrated` drop, `cert_goals` deprecated drop. Bundle into one Drizzle migration.
- **chunk-2 knowledge-node updater audit column** (1 major) — tied to deferred `knowledge_node_version` work.
- **chunk-3 carries** (21 items) — sim/avionics auth surface (5), proxy-trust validation (2), plugin-cookie churn (2), `auditColumns` placement (2), 10 operational polish items. Each has its own trigger.
- **chunk-5 carries** (8 deferred + 17 dropped-with-rationale) — already documented in PR #568.
- **chunk-6 carries** (10 deferred) — REPO_ROOT consolidation, 9 schema partial-index migrations + cosmetic items. Already documented in PR #565.

## Tier 4 — minor + nit drift (~150)

Close opportunistically as code is touched. The `tools/test-lint` rule already enforces no `.toBeTruthy()` drift; analogous rules can be added if specific patterns recur.

## Execution plan

### Wave 1 (this WP, parallel) — close all 7 criticals

- **Agent A**: 3 chunk-1 a11y criticals (MapPanel + radiogroup + read-suggestion preamble) — single app surface.
- **Agent B**: chunk-1 testing critical (`references.test.ts` default-annotation positive assertion).
- **Agent C**: chunk-1 backend critical (memory/review GET-mutation → form action redirect).
- **Agent D**: 2 chunk-2 criticals (package-boundary hardening + remaining transaction wraps).

### Wave 2 (queued, separate) — convergent clusters

After Wave 1 lands, separate WP for the convergent clusters. Highest-leverage first: N+1 batch helpers (closes 11 findings), library-by-cert SQL filter (closes 2 + improves UX), BC error-class hygiene sweep (closes 6).

### Wave 3 — drift / opportunistic

Tier 4 items handled when their containing files are touched for other reasons.

## Acceptance

- All 7 criticals: closed with file:line evidence; INDEX `## Status as of 2026-05-04` table updated.
- Each per-category review file: `review_status: done` (already true for 5 of 6 chunks; chunk-1 flips when its 5 criticals close).
- `bun run check` clean across all PRs.
- Tests added or strengthened for each critical fix.

## Source files

- `docs/work/reviews/2026-05-01-study-app-surfaces-INDEX.md` (chunk 1)
- `docs/work/reviews/2026-05-01-study-bc-domain-INDEX.md` (chunk 2)
- `docs/work/reviews/2026-05-01-auth-identity-audit-INDEX.md` (chunk 3 — done)
- `docs/work/reviews/2026-05-01-sources-content-pipeline-INDEX.md` (chunk 4 — done)
- `docs/work/reviews/2026-05-02-ui-library-themes-INDEX.md` (chunk 5 — done)
- `docs/work/reviews/2026-05-02-hangar-cluster-INDEX.md` (chunk 6 — done)
