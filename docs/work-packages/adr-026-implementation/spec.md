---
id: adr-026-implementation
title: 'Spec: ADR 026 implementation -- registry-canonical edition coherence'
product: platform
category: platform
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-09
owner: agent
depends_on: []
unblocks:
  - schema-review-followup-b
  - schema-review-followup-c
  - schema-review-followup-d
tags:
  - schema
  - references
  - registry
  - editions
---

# Spec: ADR 026 implementation -- registry-canonical edition coherence

[ADR 026](../../decisions/026-edition-coherence/decision.md) ratifies `sources_registry.editions` as the single source of truth for edition identity, edition history, retire-at semantics, and the supersedes chain. It drops the two carryover `superseded_by_id` columns on `study.reference` + `study.syllabus`, makes `study.reference.edition` a seed-only denormalized cache, and routes the amendment 2026-05 drift sentinels to the registry directly. This work package builds it.

The repo has no migrations -- `drizzle/0000_initial.sql` is regenerated from `libs/**/schema.ts` whenever schema changes. The implementation is therefore one cohesive change, not a phased migration: edit the schema, port the 4 BC consumers + 3 route handlers + regulations.ts:964, add the resolver API in `@ab/sources/server`, add the `bun run check` guard, regenerate the schema SQL, reseed.

## Goals

1. **Drop both `superseded_by_id` columns** from `study.reference` and `study.syllabus`. Drop the `referenceDocSupersededIdx` index. Regenerate `drizzle/0000_initial.sql`.
2. **Add the resolver API** at [libs/sources/src/registry/edition-resolver.ts](../../../libs/sources/src/registry/edition-resolver.ts) with the four helpers ADR 026 §6 specifies: `getCurrentEdition`, `getEditionByLabel`, `isEditionSuperseded`, `listEditionsForSource`. Export them through a new `@ab/sources/server` entry-point.
3. **Migrate every reader** of the dropped columns to the resolver API. Closed list: 4 BC consumers (`references.ts`, `library-by-cert.ts`, `syllabi.ts`, `regulations.ts`), 3 route handlers (`apps/study/src/routes/(app)/library/handbook/[slug]/+page.server.ts` + `[chapter]` + `[chapter]/[section]`), and one chain-walk in `regulations.ts:964`.
4. **Make the seed the only writer** of `study.reference.edition`. Seed reads `sources_registry.editions.edition_label` and writes it through; manifest's edition string becomes a verification probe (mismatch is a seed-time error, not a write).
5. **Add a `bun run check` guard** at [scripts/lint/edition-cache-write-guard.ts](../../../scripts/lint/edition-cache-write-guard.ts) that greps for non-seed writes to `reference.edition` and fails the check. Wire into the orchestrator at [scripts/check.ts](../../../scripts/check.ts).
6. **Migrate amendment 2026-05 drift sentinels** to read `sources_registry.editions` directly (per ADR 026 §5). The amendment ships separately on `feat/adr-019-amendment-optional-edition`; this WP's resolver API is the surface that branch's per-corpus resolvers will call.

## Non-goals

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md) for the deferred items, rationale, and revisit triggers.

## Why this matters

Three independent edition mechanisms coexist on main: `sources_registry.editions`, `study.reference.supersededById`, `study.syllabus.supersededById`. None know about the others. The amendment 2026-05 drift sentinels become precision-aware about edition pinning, but they can only consult one of the three -- whichever they consult is right for that corpus and silently wrong for the others. Concrete failure modes already latent: registry-driven AFH promotion leaves the handbook reader's "newer edition available" banner stale by a sync window; ACS edition advances don't reach the registry; sentinel drift checks fire against a mirror that disagrees with the registry. ADR 026's design closes that. This WP turns the design into code.

This WP also unblocks three other items from the [2026-05-06 schema review](../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md):

- **B** -- drop or generate `study.reference_section.airboss_ref`. Triggered when ADR 019's path-grammar evolves; depends on this WP's resolver API.
- **C** -- move `study.knowledge_node.references` jsonb to `content_citations` rows. Depends on the resolver API so per-citation rows can drift-check.
- **D** -- migrate `study.scenario.regReferences` jsonb to `content_citations`. Same dependency.

Until this WP ships, items B / C / D are blocked.

## Dependencies

- ADR 026 must be `accepted` (currently `proposed`, dated 2026-05-06). The first task of this WP flips its status.
- ADR 019 amendment 2026-05 lands on `feat/adr-019-amendment-optional-edition` independently. This WP does not block on the amendment merging; the amendment branch's per-corpus resolvers will swap a single call site to use this WP's resolver API once both ship.
- `sources_registry.editions` must be populated for every slug consulted by readers. Today's seed pipeline writes editions for handbooks via [scripts/db/seed-references-from-manifest.ts](../../../scripts/db/seed-references-from-manifest.ts); CFR / ACS / regs seeds need an audit pass to confirm they land in the registry.

## Success criteria

This WP is `signed-off` when:

1. `grep -rn 'supersededById\|superseded_by_id' libs/ apps/ scripts/` returns zero hits in production code (test fixtures with `supersededById: null` in row-shape constructors are allowed only after the column itself is dropped, which removes them as well).
2. `study.reference` + `study.syllabus` schema in `libs/bc/study/src/schema.ts` no longer declare `supersededById`. The `referenceDocSupersededIdx` index is gone. `drizzle/0000_initial.sql` is regenerated and matches.
3. The resolver API at `libs/sources/src/registry/edition-resolver.ts` is reachable via `import { getCurrentEdition, getEditionByLabel, isEditionSuperseded, listEditionsForSource } from '@ab/sources/server'`. The browser-bundle barrel (`@ab/sources`) does NOT re-export them as values.
4. The four BC consumer files + three route handler files + `regulations.ts:964` all call the resolver. None of them imports `reference.supersededById` or `syllabus.supersededById` (the columns no longer exist).
5. The seed populates `study.reference.edition` from `sources_registry.editions.edition_label`. A manifest-vs-registry mismatch fails the seed with a clear error.
6. `bun run check edition-cache-write-guard` finds no non-seed writes to `reference.edition`. A synthetic violation (a scratch script that writes the column) is caught by the guard.
7. The four banner-bearing routes (top library handbook page, chapter page, section page, regulations detail) render the "newer edition available" affordance reading the registry's current row, verified by hand on `/library/handbook/afh` after seeding two AFH editions.
8. All affected tests pass: 8 test files reference `supersededById` today and need updating ([references-render.test.ts](../../../libs/bc/study/src/references-render.test.ts), [library-by-cert.test.ts](../../../libs/bc/study/src/library-by-cert.test.ts), [regulations.test.ts](../../../libs/bc/study/src/regulations.test.ts), [syllabi.test.ts](../../../libs/bc/study/src/syllabi.test.ts), [references.test.ts](../../../libs/bc/study/src/references.test.ts), [library-card-projection.test.ts](../../../libs/bc/study/src/library-card-projection.test.ts), [seed-references-from-manifest.test.ts](../../../scripts/db/seed-references-from-manifest.test.ts), and the new resolver tests at `libs/sources/src/registry/edition-resolver.test.ts`).
9. `bun run check all` is green.

## Risks

- **Seed pipelines that don't yet populate `sources_registry.editions`** for their slug. If a CFR or ACS seeder skips the registry, post-WP readers crash with "no current edition for slug." Audit during task 2 of [tasks.md](./tasks.md). Confirmed today: handbook seeders write editions; CFR seeders need verification.
- **Personal-syllabus rows that don't go through the registry.** ADR 026 §4 keeps `study.syllabus.edition` free-form for `kind IN ('school', 'personal')`. The resolver call must be gated on `kind IN ('acs', 'pts')` -- a naive "always consult registry" call would crash on every personal syllabus.
- **The amendment branch rebases into this work.** [feat/adr-019-amendment-optional-edition](https://github.com/joshball/airboss/compare/main...feat/adr-019-amendment-optional-edition) lands its own per-corpus resolver changes; this WP's `getCurrentEdition` is the surface those resolvers call after both ship. A merge race is possible -- mitigated by this WP touching only the storage path, not the per-corpus resolver internals.
- **Test fixtures with hand-built `ReferenceRow` shapes.** Eight test files set `supersededById: null` explicitly. Once the column is gone, every fixture needs an edit pass -- not subtle, just tedious. Caught at compile time.

## Links

- [ADR 026 -- edition coherence](../../decisions/026-edition-coherence/decision.md) -- the design contract this WP implements
- [ADR 019 §6.1](../../decisions/019-reference-identifier-system/decision.md#61-aliases-within-an-edition-transition) -- the original "registry as source of truth" decision
- [ADR 019 amendment 2026-05](../../decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md) -- the amendment whose drift sentinels migrate to the registry
- [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md) -- handbook edition + errata cadence
- [Schema review 2026-05-06 §A](../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md#a-critical-three-parallel-edition-stories-that-dont-know-about-each-other) -- the original finding
- [tasks.md](./tasks.md) -- ordered build plan
- [test-plan.md](./test-plan.md) -- manual + automated verification
- [design.md](./design.md) -- resolver API surface, browser/server split, seed contract
- [user-stories.md](./user-stories.md) -- thin user-facing slice
