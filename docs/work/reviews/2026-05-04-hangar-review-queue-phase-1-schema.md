---
feature: hangar-review-queue
category: schema
date: 2026-05-04
branch: worktree-agent-ae8eb8cb532bdfcc4
phase: 1
issues_found: 6
critical: 0
major: 1
minor: 4
nit: 1
---

# Phase 1 schema review -- hangar-review-queue

## Summary

Eight new tables added to the existing `hangar` schema with consistent ID prefixes, sensible FKs, partial indexes for hot paths, and CHECK constraints sourced from `@ab/constants`. Spec data model is fully covered. The biggest gap is that `cachedStatus` jsonb has no DB-level constraint on its enum-shaped fields (frontmatterStatus / reviewStatus); the schema relies on BC writers for validation. One redundant index, one missing FK on the FTS index, and a couple of naming + comment nits.

## Issues

### MAJOR: cachedStatus enum values not constrained at DB level

- **Table**: `hangar.review_item`
- **Column**: `cached_status` (jsonb)
- **Problem**: `frontmatterStatus` and `reviewStatus` inside `cachedStatus` carry literal-set semantics (`'unread'|'reading'|'done'` and `'pending'|'done'`) but no CHECK guards them. A bug in the loader could write `'inprogress'` and the DB would happily store it, breaking bucket queries that filter on the values. The schema comment at line 723-726 acknowledges "CHECK on a deeply nested jsonb path is fragile" but doesn't propose a mitigation.
- **Rule**: CLAUDE.md "All literals from constants" + project convention of CHECK guards everywhere CHECKs are sourced from `@ab/constants` (already used for `kindId`, `outcome`, `taskType`, `productArea`).
- **Fix**: Two options:
  1. Add JSON-path CHECKs: `CHECK (cached_status->>'frontmatterStatus' IS NULL OR cached_status->>'frontmatterStatus' IN ('unread','reading','done'))` plus the same for `reviewStatus`. Drizzle's `check()` + `sql.raw()` handles this fine. Keep the constants source-of-truth via `inList()`.
  2. Lift the two enum fields out of `cachedStatus` into top-level columns on `review_item` (`frontmatter_status text`, `review_status text`) with normal CHECKs, and let `cached_status` carry only the unstructured `otherFields` map. Cleaner long-term; matches how the spec talks about them ("frontmatter is authoritative" -- treat them as first-class).

Recommend option 2: it makes the bucket filter SQL simpler (no `->>` casting), enables proper indexes per-field, and matches the spec's two-status mental model.

### MINOR: redundant index on `review_item.boardId`

- **Table**: `hangar.review_item`
- **Index**: `hangar_review_item_board_idx` on `(boardId)` partial WHERE deletedAt IS NULL
- **Problem**: `hangar_review_item_ref_unique_idx` is a unique index on `(boardId, kindId, ref)` partial WHERE deletedAt IS NULL. Postgres can use the leading column of a multi-column index for `WHERE boardId = ...` queries, so the dedicated `boardId` index is redundant for selectivity (both are partial-on-deleted-at). Drop `hangar_review_item_board_idx`.
- **Rule**: Convention from `hangar.reference`/`hangar.source` chunk-6 schema review (drop redundant single-column indexes when a leading-column composite covers them).
- **Fix**: Remove `itemBoardIdx` from the `(t)` block of `hangarReviewItem`. The unique index covers the `WHERE boardId = ?` predicate.

### MINOR: `docs_search_index` rows have no FK to anything

- **Table**: `hangar.docs_search_index`
- **Problem**: This table mirrors filesystem state -- the `path` PK has no relational meaning. That's fine for the FTS index. But the table also lacks any reference to `review_item` even though the loader populates both from the same scan. The two won't share an integrity constraint, which is OK, but the schema comment should call out the relationship explicitly so the next reader doesn't try to wire a FK.
- **Rule**: ADR-19-style "explain orphan tables in the comment" pattern.
- **Fix**: Extend the existing block comment above `hangarDocsSearchIndex` with one sentence: "No FK to `review_item`: the FTS index is filesystem-keyed (path PK), and a single docs file can produce zero or many `review_item` rows depending on which discovery rules it matches. Both tables are populated from one loader pass and pruned independently."

### MINOR: `review_kind.id` carries the discriminator AND a label, but `defaultColumnMapping` from spec is missing

- **Table**: `hangar.review_kind`
- **Column**: missing
- **Problem**: spec.md line 167 lists the schema as `review_kind` -> `id, label, defaultColumnMapping (jsonb), discoveryRule (jsonb)`. The current schema has `id`, `label`, `discoveryRule` but no `defaultColumnMapping`. The Phase 1 BC doesn't reference it either, so functionally there's nothing using this column today, but the spec calls it out and Phase 4 (board) may want it.
- **Rule**: spec compliance.
- **Fix**: Either (a) add `defaultColumnMapping: jsonb('default_column_mapping').$type<Record<string, string> | null>()` to the table, leave it null until Phase 4 needs it, document the shape in the table comment; or (b) explicitly drop it from the spec via the build plan's "Spec gaps" with a one-line decision in to-dispatcher.md. Recommend (a) -- adding a nullable column is cheaper than a schema round-trip later, and the column matches the spec's data model.

### MINOR: `review_step.note` and `review_session.notes` -- inconsistent pluralization

- **Tables**: `hangar.review_session.notes` (plural) vs `hangar.review_step.note` (singular)
- **Problem**: Both are free-text textarea content scoped to a single record. Naming should match. The DB columns are `notes` and `note` respectively.
- **Rule**: project naming convention -- columns serving the same purpose use the same name across tables.
- **Fix**: Rename `hangar.review_session.notes` -> `note` (singular). Cheaper now (no consumer code yet) than after Phase 5. Update the schema column + the BC `finishSession` signature + the test that currently passes `'notes here'`.

### NIT: column ordering inside `review_item` mixes loader-written and user-written fields

- **Table**: `hangar.review_item`
- **Problem**: The column declaration order is `id, boardId, kindId, ref, title, cachedStatus, cachedAt, pinnedColumnId, sortOrder, deletedAt, ...timestamps()`. Conceptually: identity (id, boardId, kindId, ref) -> denormalized (title, cachedStatus, cachedAt) -> board state (pinnedColumnId, sortOrder) -> lifecycle (deletedAt + timestamps). That's already mostly the order, but `pinnedColumnId` reads more naturally adjacent to `boardId` (both wire the row to the board structure).
- **Rule**: nit -- column ordering for readability.
- **Fix**: Move `pinnedColumnId` immediately after `boardId`. Optional -- skip if you'd rather not churn the schema snapshot.
