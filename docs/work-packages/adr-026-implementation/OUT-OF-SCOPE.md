---
title: 'Out of Scope: ADR 026 Implementation -- Registry-Canonical Edition Coherence'
product: platform
feature: adr-026-implementation
type: out-of-scope
status: unread
---

# Out of Scope: ADR 026 Implementation -- Registry-Canonical Edition Coherence

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Non-goals" section of [spec.md](./spec.md) and the "Out of scope -- explicitly deferred" section of [tasks.md](./tasks.md). The deeper rationale lives in [ADR 026](../../decisions/026-edition-coherence/decision.md) (especially §3, §4, and the "Out of scope -- captured for future work" section) and the [2026-05-06 schema review](../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md).

## Summary

| Item                                                                                    | Status       | Trigger to revisit                                                   |
| --------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| Drop `study.reference.edition` cache column                                             | Deferred     | When the next column-touching pass on `study.reference` is in flight |
| Remove `study.syllabus.edition` for personal/school syllabi                             | Deferred     | When the FAA-syllabus share of `study.syllabus` crosses 50%          |
| Touch amendment 2026-05 branch validator + script + plumbing                            | Rejected     | Never -- see detail below                                            |
| Schema-review item B (drop/generate `reference_section.airboss_ref`)                    | Follow-on WP | When ADR 019's path-grammar evolves                                  |
| Schema-review item C (move `knowledge_node.references` jsonb to `content_citations`)    | Follow-on WP | When the amendment 2026-05 sentinel-vocabulary work stabilizes       |
| Schema-review item D (migrate `scenario.regReferences` jsonb to `content_citations`)    | Follow-on WP | Triggered alongside C                                                |
| Schema-review item G (CHECK enforcing edition-sensitive locator implies edition pinned) | Follow-on WP | Triggered alongside C                                                |

## Drop `study.reference.edition` cache column

Status: Deferred

What was deferred:
Removing the `edition` column from `study.reference`. Per ADR 026 §3, the column is kept as a seed-only denormalized cache. The seed becomes the only writer (this WP), but the column itself stays on the table.

Why:
Per [spec.md](./spec.md) Non-goals and [ADR 026 §3](../../decisions/026-edition-coherence/decision.md): conservative default. Dropping the column would force every reader of `reference.edition` to consult the registry, which adds query cost on the hot library-render path. The cache column lets readers carry the label inline without changing the rendering layer's contract. Revisit when a future schema pass is touching neighboring columns -- batch the drop with that work.

Trigger to revisit:
The next column-touching pass on `study.reference` (e.g., a new column being added, an existing column being renamed or dropped). Bundle the `edition` removal with that pass so the regen + reseed cost amortizes.

Implementation pattern when triggered:
Delete the `edition` column from `study.reference` in [libs/bc/study/src/schema.ts](../../../libs/bc/study/src/schema.ts). Regenerate `drizzle/0000_initial.sql`. Migrate every reader of `reference.edition` to call `getCurrentEdition(sourceIdFromRef(ref))` from `@ab/sources/server` and read `editionLabel` from the registry row. Update test fixtures the same way the supersededById drop did in this WP (task 7).

References:

- [spec.md](./spec.md) Non-goals
- [ADR 026 §3](../../decisions/026-edition-coherence/decision.md) (`reference.edition` kept as seed-only cache)

## Remove `study.syllabus.edition` for personal/school syllabi

Status: Deferred

What was deferred:
Removing the `edition` column from `study.syllabus` for rows where `kind IN ('school', 'personal')`. ACS/PTS rows go through the registry; non-FAA syllabi (school curricula, learner-authored personal syllabi) keep `edition` as a free-form text field.

Why:
Per [spec.md](./spec.md) Non-goals and [ADR 026 §4](../../decisions/026-edition-coherence/decision.md): conservative default. Personal and school syllabi don't have a registry-backed edition concept -- a school curriculum's "Spring 2026" semester is meaningful but not a registered FAA edition. Forcing the registry path on every syllabus would crash on every personal row. The ADR keeps the column free-form for non-FAA syllabi until the data shape proves the constraint is needed.

Trigger to revisit:
When the FAA-syllabus share of `study.syllabus` crosses 50% (count `kind IN ('acs', 'pts')` vs total). At that point the free-form column is the minority and the registry path is the majority -- worth a separate kind-aware design pass to decide whether non-FAA rows go through a different schema (a separate `school_syllabus` table, or a tagged-union) or whether the free-form column survives indefinitely.

Implementation pattern when triggered:
Either (a) keep the column on `study.syllabus` and add a CHECK constraint (`edition IS NULL OR kind IN ('school', 'personal')` -- registry-driven kinds reject inline edition), or (b) split `study.syllabus` into a tagged-union with a separate non-FAA table. Decide based on the share at the trigger moment. The registry-driven path for ACS/PTS is already the canonical reader (this WP).

References:

- [spec.md](./spec.md) Non-goals
- [ADR 026 §4](../../decisions/026-edition-coherence/decision.md) (`syllabus.edition` kept free-form for non-FAA)

## Touch amendment 2026-05 branch validator + script + plumbing

Status: Rejected

What was rejected:
Editing the amendment 2026-05 branch's validator, the `migrate-knowledge-citations` script, or the `redirected_from` plumbing as part of this WP. The amendment lands on a separate branch (`feat/adr-019-amendment-optional-edition`) and rebases into this work cleanly.

Why:
Per [spec.md](./spec.md) Non-goals: the two pieces of work intentionally ship on separate branches to limit blast radius. This WP touches the storage path (registry as canonical, drop the parallel columns); the amendment branch touches the per-corpus resolver internals + the citation migration script. Mixing them on one PR would mean the amendment can't ship without this WP and vice versa, which the design deliberately avoids -- a merge race is the price of independent shipping.

A re-decision would have to clear: a use case where the validator / script / plumbing changes are inseparable from the storage-path change, AND the merge race is impossible to manage with rebases. Neither has surfaced in the design discussion (the per-corpus resolvers swap a single call site to `getCurrentEdition` once both ship).

References:

- [spec.md](./spec.md) Non-goals
- [ADR 019 amendment 2026-05](../../decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md)
- [spec.md](./spec.md) Risks (the rebase/merge-race mitigation)

## Schema-review item B (drop or generate `study.reference_section.airboss_ref`)

Status: Follow-on WP

What was postponed:
The schema cleanup that either drops the `reference_section.airboss_ref` column (in favor of a generated computed value) or generates it deterministically from the section's parent reference. This WP unblocks the change by landing the resolver API; the actual schema edit lives in its own WP.

Why:
Per [spec.md](./spec.md) Non-goals and [ADR 026 "Out of scope"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work): item B's design depends on the resolver API existing first (so a generated column or runtime helper has somewhere to call). With the resolver API now landing here, B is unblocked and can be its own WP.

Trigger that fires the follow-on:
When ADR 019's path-grammar evolves (the current shape is stable, so a path-grammar change is the natural trigger to revisit how `airboss_ref` is stored).

Implementation pattern when triggered:
Authoring follows the schema-review fix pattern. Decide between (a) drop the column + recompute on read via `parseIdentifier(ref) -> airbossRef`, or (b) keep the column but add a CHECK or generated-column constraint that asserts `airboss_ref` matches the parent reference's expected ref string. Reference the [2026-05-06 schema review §B](../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md) for the original finding.

References:

- [spec.md](./spec.md) Non-goals + Why this matters (lists B as unblocked)
- [tasks.md](./tasks.md) Out of scope -- explicitly deferred
- [ADR 026 "Out of scope -- captured for future work"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work)
- [2026-05-06 schema review §B](../../work/reviews/2026-05-06-full-schema-consistency-flexibility-efficiency.md)

## Schema-review item C (move `study.knowledge_node.references` jsonb to `content_citations`)

Status: Follow-on WP

What was postponed:
Migration of the `knowledge_node.references` jsonb column to per-citation rows in a `content_citations` table. Per-row representation lets each citation drift-check independently against the registry.

Why:
Per [spec.md](./spec.md) Non-goals and [ADR 026 "Out of scope"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work): the migration depends on the resolver API being in place so per-citation rows can call `isEditionSuperseded` / `getCurrentEdition`. With the resolver API landing here, C is unblocked but lives as its own WP because the migration touches every knowledge node citation across the seeded content.

Trigger that fires the follow-on:
When the amendment 2026-05 sentinel-vocabulary work in flight stabilizes. The amendment introduces sentinel + edition columns on `content_citations`; once those land, the C migration has a target schema to write into.

Implementation pattern when triggered:
Author a WP that (a) defines the `content_citations` row shape (existing per-citation schema is the starting point), (b) writes a migration script that walks every `knowledge_node.references` jsonb array and emits `content_citations` rows, (c) updates the BC reader (`getNodesCitingSection` and friends) to query the new table, (d) drops the jsonb column. Mirror the [migrate-knowledge-citations](../../decisions/019-reference-identifier-system/amendment-2026-05-optional-edition.md) pattern from the amendment branch.

References:

- [spec.md](./spec.md) Non-goals + Why this matters (lists C as unblocked)
- [tasks.md](./tasks.md) Out of scope -- explicitly deferred
- [ADR 026 "Out of scope -- captured for future work"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work)

## Schema-review item D (migrate `study.scenario.regReferences` jsonb to `content_citations`)

Status: Follow-on WP

What was postponed:
Migration of the `scenario.regReferences` jsonb column to per-citation rows in `content_citations`. Same shape as C, applied to the scenario corpus instead of the knowledge-node corpus.

Why:
Per [spec.md](./spec.md) Non-goals and [ADR 026 "Out of scope"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work): same dependency as C -- the migration needs the resolver API in place so per-citation rows can drift-check. Bundled with C as a follow-on because both migrations consume the same target schema and benefit from being authored together.

Trigger that fires the follow-on:
Triggered alongside C. Either bundled into the same WP as C (one migration script, two source columns) or its own WP that ships immediately after C.

Implementation pattern when triggered:
Mirror the C migration pattern but read from `scenario.regReferences` instead of `knowledge_node.references`. Update the scenario BC reader to query `content_citations`. Drop the jsonb column.

References:

- [spec.md](./spec.md) Non-goals + Why this matters (lists D as unblocked)
- [tasks.md](./tasks.md) Out of scope -- explicitly deferred
- [ADR 026 "Out of scope -- captured for future work"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work)

## Schema-review item G (CHECK enforcing edition-sensitive locator implies edition pinned)

Status: Follow-on WP

What was postponed:
A CHECK constraint on `content_citations` that asserts "if the locator is edition-sensitive (e.g. page number, paragraph reference), the row carries an edition pin." Defense-in-depth on top of C/D's per-citation rows.

Why:
Per [tasks.md](./tasks.md) Out of scope -- explicitly deferred and [ADR 026 "Out of scope"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work): the schema review concedes the structure is fine without the CHECK; the CHECK is promoted to "do" only when C lands and the rows exist to constrain. Building it before C ships would constrain a table that doesn't exist.

Trigger that fires the follow-on:
Triggered alongside C. When sentinel + edition columns land on `content_citations`, add the CHECK in the same WP.

Implementation pattern when triggered:
A Postgres CHECK constraint of the shape `(NOT locator_is_edition_sensitive) OR (edition IS NOT NULL)`, with the `locator_is_edition_sensitive` predicate reading from the locator's sentinel column. Add to the `content_citations` schema in `libs/bc/study/src/schema.ts`. Regenerate `drizzle/0000_initial.sql`.

References:

- [tasks.md](./tasks.md) Out of scope -- explicitly deferred
- [ADR 026 "Out of scope -- captured for future work"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work)

## Note on ADR 026's broader "Out of scope" list

ADR 026's "Out of scope -- captured for future work" section lists additional items beyond B/C/D/G: L (string-list standardization), O (completed-column naming), nits T / U / X / Y / Z / AA, and M / P / Q / R / S / W. Each has its own trigger documented in the ADR itself. Those items are NOT this WP's deferrals -- they belong to the ADR's broader scope discipline. The WP confirms it does not touch them; the ADR is the canonical record. See [ADR 026 §"Out of scope -- captured for future work"](../../decisions/026-edition-coherence/decision.md#out-of-scope----captured-for-future-work) for the per-item triggers.
