---
title: 'content-citations'
status: deferred
size: large
depends_on: []
created: 2026-04-24
deferred_at: 2026-04-28
trigger: ADR 019 phase 10 expands beyond ACS (e.g. NTSB or Chief Counsel ingest lands), OR the cert-syllabus surface needs polymorphic citations across cards / reps / scenarios / nodes in one schema. With ADR 019 phases 1-9 shipped, the cross-content citation surface is now feasible; defer until a concrete consumer demands it. At that point, run /ball-wp-spec referencing ADR 019 §3 (inline syntax) and bc-citations.
---

# Content Citations

## One-sentence summary

One polymorphic citation table so any content surface (card, rep, scenario, knowledge node) can cite any reference (regulation node, AC, external ref) with a shared picker UI and two symmetric read paths.

## Why

SMI walkthrough item 1 asked for optional regulation references on cards. The locked decision is to go broad: this is not a card-specific feature, it is a platform-level connection fabric. Every content surface can cite references, and references can be asked "who cites you?" This closes a recurring "wasted opportunity for connections and coverage" comment and sets the foundation for coverage analytics, regulatory traceability, and cross-product learning graph queries.

Source items: `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 1.

## In scope

- One new `content_citations` table. Polymorphic on both source and target.
- A shared citation picker component, usable from the card editor, the rep editor, the scenario editor, and the knowledge-node editor.
- Read functions in both directions:
  - "Citations of X" (given a content item, list its references).
  - "X is cited by" (given a reference, list what cites it).
- Citation render on the content surface where it lives. Cards and scenarios show their citations inline. Knowledge-graph nodes expose a "cited by" list.

## Out of scope

- Auto-backfill that scans existing card bodies for `14 CFR X.Y` patterns and creates citations. Reason: users authored the existing cards and can cite manually; a regex pass will produce false matches and leaves us owning the error cases. Flag as a follow-up WP if coverage data shows we need it.
- Inline-in-body markdown citation syntax (e.g. `{cite: node-id}`). v1 uses explicit structured citations via the picker.
- Public citation discovery surfaces (e.g. a "most-cited regulations" leaderboard). Possible follow-up; not in scope.
- Bulk citation import/CSV.
- Citation moderation/approval. Authors own their citations.

## Product decisions the user needs to make

1. **Referential integrity**

   - Options:
     - (A) Soft polymorphism: `source_type` + `source_id` + `target_type` + `target_id` as plain text, with application-layer validation.
     - (B) One nullable FK column per possible source type and one per possible target type, with CHECK constraints ensuring exactly one set.
     - (C) Per-source-type tables (`card_citation`, `rep_citation`, etc.) sharing a target shape.
   - Recommendation: (A) soft polymorphism with application-layer validation. (B) blows up on every new source or target type. (C) prevents symmetric "cited by" queries across types. Accept the tradeoff: the app layer is responsible for refusing invalid `source_type`/`target_type` combinations and for validating the referenced row exists before insert. Add partial indexes per type for fast lookups.
   - Affects: schema, BC validation layer, migration strategy when a source goes away.

2. **Picker: shared or per-type**

   - Options: one shared picker component reused across all 4 authoring surfaces/per-type pickers with bespoke UX.
   - Recommendation: one shared picker. It takes a `targetTypes: TargetType[]` prop to constrain what can be cited (e.g. regulation-graph nodes only, vs. any reference). Card editor, rep editor, scenario editor, node editor all import the same component.
   - Affects: component library placement (likely `libs/ui/src/content-citations/`), design surface.

3. **Target types in v1**

   - Options:
     - (A) `regulation_node` only.
     - (B) `regulation_node`, `ac_reference`, `external_ref`.
     - (C) All three plus `knowledge_node` (internal graph).
   - Recommendation: (C). Knowledge nodes already exist in the graph and are the natural target for scenario and rep citations. External refs (arbitrary URLs with title) handle the long tail. AC references are a known structured source.
   - Affects: `target_type` enum + picker tabs.

4. **Source types in v1**

   - Options:
     - (A) `card` only, add more later.
     - (B) `card` and `scenario` at launch, add `rep` and `node` later.
     - (C) All four (`card`/`rep`/`scenario`/`node`) at launch.
   - Recommendation: (C). The table and picker are the hard parts; wiring four source-side editors is cheap relative to the investment. Shipping all four also avoids "why can a card cite but a scenario can't" confusion.
   - Affects: which editors get the picker wiring in this WP.

5. **Citation context (optional note)**

   - Options: free-text/structured (e.g. `why-cited` enum)/drop it.
   - Recommendation: optional free-text, max 500 chars. The field is used to disambiguate why the citation exists ("basis for the hard-deck answer" vs "context for the exception"). Structured citations before we know the patterns is premature.
   - Affects: schema + picker UI.

6. **Displaying citations on the content surface**

   - Options: inline beneath the content/collapsible panel/separate tab.
   - Recommendation: inline beneath the content on cards and scenarios. On reps and knowledge nodes, in a "References" section within the detail page. Each citation renders as a compact chip: `14 CFR 91.155(b) - VFR cloud clearance`.
   - Affects: each content surface's render.

## Data model

```typescript
// shared table in the study schema (or a new content schema if we want to migrate it later)
// table name: content_citations

{
  id: text primary key,                  // ccit_ prefix
  source_type: text not null,            // 'card' | 'rep' | 'scenario' | 'node'
  source_id: text not null,              // FK target determined by source_type (soft)
  target_type: text not null,            // 'regulation_node' | 'ac_reference' | 'external_ref' | 'knowledge_node'
  target_id: text not null,              // FK target determined by target_type (soft)
  citation_context: text,                // optional free-text note, <= 500 chars
  created_by: text not null references identity.user(id),
  created_at: timestamptz not null default now(),
  updated_at: timestamptz not null default now(),
}
```

Indexes (both directions need to be fast):

```sql
create index on content_citations (source_type, source_id);
create index on content_citations (target_type, target_id);
-- per-type partial indexes for hot paths, e.g.:
create index on content_citations (source_id) where source_type = 'card';
create index on content_citations (target_id) where target_type = 'regulation_node';
```

Constants in `libs/constants/src/study.ts` (or a new `libs/constants/src/citations.ts` if the set grows):

```typescript
export const CITATION_SOURCE_TYPES = {
  CARD: 'card',
  REP: 'rep',
  SCENARIO: 'scenario',
  NODE: 'node',
} as const;

export const CITATION_TARGET_TYPES = {
  REGULATION_NODE: 'regulation_node',
  AC_REFERENCE: 'ac_reference',
  EXTERNAL_REF: 'external_ref',
  KNOWLEDGE_NODE: 'knowledge_node',
} as const;
```

Read functions in `libs/bc/study` (or a new `libs/bc/citations`):

```typescript
getCitationsOf(sourceType, sourceId): Citation[]
getCitedBy(targetType, targetId): Citation[]
createCitation({ sourceType, sourceId, targetType, targetId, citationContext, userId }): Citation
deleteCitation(id, userId): void
```

Validation (application-layer, enforcing soft FK):

- `sourceType` must be a value in `CITATION_SOURCE_TYPES` and the referenced row must exist and be owned/edited-by `userId` (authoring permission gate).
- `targetType` must be a value in `CITATION_TARGET_TYPES` and the referenced row must exist.
- `(sourceType, sourceId, targetType, targetId)` is unique. Add a unique index.
- `citation_context` trimmed, <= 500 chars.

## UI sketch

Shared picker:

```text
[ Cite a reference                                ]
+---------------------------------------------+
| Tabs: Regulation | AC | External | Knowledge |
+---------------------------------------------+
| Search: [____________________________]       |
+---------------------------------------------+
| - 14 CFR 91.155 Basic VFR weather minimums   |
| - 14 CFR 91.157 Special VFR weather minimums |
| - ...                                         |
+---------------------------------------------+
| Note (optional): [__________________________]|
+---------------------------------------------+
| [ Cancel ]                      [ Add cite ] |
```

Card editor addition:

```text
Front: ...
Back: ...

Citations
  [+ Cite a reference]
  - 14 CFR 91.155(b)  "basis for the exception answer"  [ x ]
```

Reg-node/knowledge-node detail additions:

```text
Cited by (6)
- Card: VFR cloud clearance at night
- Scenario: Night XC approaching Class E ceiling
- ...
```

## Open questions (non-blocking)

- Whether to expose citation permalinks (e.g. a URL that points at a citation row directly). Probably not; citations live with their source content. Revisit if we grow a citations browse UI.
- Soft-delete vs hard-delete when a source content row is deleted. Default: hard-delete citations on source-row delete via application-layer cleanup (since soft FK can't cascade). Triggered in the delete BC function for each source type.
- Should the citation picker auto-suggest by scanning the content body for known regulation patterns as the user types? v1: no. Follow-up when we have data on how people actually author citations.

## Build sequencing notes

1. Schema migration + constants + unique index + per-type partial indexes.
2. BC functions (`createCitation`, `deleteCitation`, `getCitationsOf`, `getCitedBy`) with validation.
3. Shared picker component in `libs/ui`.
4. Wire picker + inline render into the card editor.
5. Wire into the scenario editor.
6. Wire into the rep editor.
7. Wire into the knowledge-node editor.
8. Render "Cited by" on regulation-node detail and knowledge-node detail. Render "Citations" on card detail (overlapping with `card-page-and-cross-references`; coordinate which WP lands the card-side render first).
9. Render citations on the public card page (`/cards/<id>`) once `card-page-and-cross-references` is merged.

## References

- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 1
- `docs/work/handoffs/20260424-session-state-smi-walkthrough.md` locked decision: polymorphic, one schema
- `docs/work-packages/card-page-and-cross-references/spec.md` public card page renders citations
- `course/knowledge/graph-index.md` knowledge-node taxonomy
- `docs/decisions/011-knowledge-graph-learning-system/decision.md` knowledge graph foundation
- `libs/constants/src/study.ts` existing content-source and domain constants
- `libs/constants/src/reference-tags.ts` existing reference-tagging constants (candidate ancestor for target types)
