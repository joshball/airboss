---
title: Command palette Phase 2 -- schema review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: schema
status: pending
review_status: done
issues_found: 0
---

# Schema review

DB schema quality -- normalization, indexes, constraints, naming, relationships, Drizzle patterns.

## Summary

No schema changes in this PR (correctly -- the palette is a query surface, not a content surface). The branch adds 8 loaders that read existing tables (`reference`, `reference_section`, `card`, `cardState`, `review`, `studyPlan`, `knowledgeNode`, `course`).

The project has a hard rule: "There are no Drizzle migrations. The schema is greenfield: a single `drizzle/0000_initial.sql` is regenerated from `libs/**/schema.ts` whenever schema changes." Any schema work surfaces as a CRITICAL finding here (it would require a `0000_initial.sql` regeneration step). None present.

## Observations (not findings)

### Index coverage of the loader read patterns

`libs/bc/study/schema.ts` already indexes the columns the palette ilike-scans:

- `referenceSection.code` -- indexed (per `referenceSection` schema)
- `referenceSection.title` -- not indexed (no btree on title)
- `referenceSection.contentMd` -- NOT indexed (and not amenable to btree)
- `card.front`, `card.back` -- not indexed
- `knowledgeNode.title`, `knowledgeNode.contentMd` -- not indexed
- `course.title`, `course.description` -- not indexed
- `studyPlan.title` -- not indexed

ilike scans against non-indexed text columns are sequential. Postgres can use a trigram GIN index (`pg_trgm` + `gin_trgm_ops`) to accelerate ilike. The schema currently has no trigram indexes.

This is the same point as perf Pf1; the fix there (skip body on short needles, or add trigram indexes) is a schema decision when (3) is picked. Document here for completeness; no action this PR (greenfield schema rule + the in-memory commitment of the WP).

### `reference.kind` is a single value for both `14 CFR` and `49 CFR`

`REFERENCE_KINDS.CFR = 'cfr'` -- one value covers both titles. The `documentSlug` carries the title (`14cfr91`, `49cfr175`). Correctness C1 calls out the loader misuse; no schema change needed -- the existing data shape supports the discrimination.

### `study.knowledge_node.id` as the natural key

`knowledgeNode.id` is the slug (per `seeders/knowledge.ts` convention). Other tables use prefix_ULID. The mixed convention is documented in ADR 011 -- intentional. No finding.

## No fixes required from this review

`issues_found: 0` -- but the perf review's body-scan finding (Pf1) interlocks with potential schema work, so a future "add trigram indexes" PR will surface as a CRITICAL schema review (regenerates `0000_initial.sql`). Note for the next reviewer of that work.
