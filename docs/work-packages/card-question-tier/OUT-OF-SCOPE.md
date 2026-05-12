---
id: card-question-tier
title: 'Out of Scope: Card Question-Tier + Provenance'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks: []
tags:
  - cards
  - schema
  - out-of-scope
legacy_fields:
  feature: card-question-tier
  type: out-of-scope
---

# Out of Scope: Card Question-Tier + Provenance

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope. Phases 2 and 3 in [tasks.md](./tasks.md) are deferred follow-on phases of THIS WP, not exclusions; the items below are different concerns that this WP intentionally does not take on.

## Summary

| Item                                                                              | Status        | Trigger to revisit                                                                                            |
| --------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| UI surfaces (filter chips, side-by-side panel, ACS lens, badges)                  | Follow-on WPs | After Phase 1 ships AND backfill (Phase 2) is far enough along that the surfaces have data to render          |
| Bulk backfill of the existing ~245 course cards                                   | Phase 2       | After Phase 1 ships AND a session is allocated specifically for the backfill review                           |
| Removing or renaming the existing `tags[]` column                                 | Rejected      | Never -- tags stay as the free-form augmentation channel; promoted concepts simply move out of it             |
| A fourth `question_tier` value (`cfi-only` separate from `cfi-essential`)         | Rejected      | Never -- the FAA-coverage signal lives in the *presence* of a `faa-written` sibling card on the same node     |
| `source_authority.kind` values beyond CFR / AC / AIM / PHAK / AFH / OTHER         | Deferred      | When a recurring `other` source pattern emerges (e.g. POH citations become common); promote in a follow-on PR |
| Cross-referencing `source_authority` cite strings to the references registry      | Deferred      | When the citation-chip surface (Phase 3) ships; the chip needs a structured anchor, not a free string         |
| `question_tier` per-user override (a learner says "this card is FAA-only for ME") | Deferred      | When user-zero asks for personal tier overrides distinct from the canonical card-author tier                  |
| Inferring `question_tier` automatically from card text                            | Rejected      | Never -- the FAA-vs-CFI distinction is judgement, not pattern-matching; bad inference is worse than NULL      |
| Migrating personal (sourceType=personal) cards to use the new fields              | Deferred      | When the personal-card authoring UI (`/memory/new`) gets the new fields exposed in a follow-on WP             |
| Schema-level FK from `acs_codes[]` element to a future `acs_element` table        | Deferred      | When ACS task elements are loaded into a queryable table (today they live as YAML); FK stays loose until then |
| Versioned ACS codes (PA.I.C.K2a vs ACS 6c vs ACS 7)                               | Deferred      | When the platform ships multi-version ACS support across the syllabi system; cards reference the current ACS  |

## Per-item rationale

### UI surfaces

The user explicitly framed the schema as the foundation for filter chips, side-by-side FAA-vs-CFI panels, ACS coverage lenses, and source-authority badges. Each of those is a Phase 3 follow-on WP authored in its own directory once the schema lands and Phase 2 backfills enough cards that the surfaces have data to render. Building them now would mean building UI on a schema that has 6 cards populated and 245 NULL -- the surface would be a placeholder, not a feature.

**Revisit trigger:** Phase 1 ships AND Phase 2 backfill covers a useful slice (e.g. all weather nodes, or all PPL-cert ACS codes).

### Bulk backfill

Backfill of the existing ~245 cards is documented as Phase 2 in [tasks.md](./tasks.md). It's not in this PR because: (a) it's a separate concern (data, not schema), (b) it benefits from a dedicated session for per-node review, and (c) the seeder change can land independently and the backfill catches up incrementally.

**Revisit trigger:** Phase 1 ships AND a dedicated backfill session is scheduled.

### Tags column removal

The free-form `tags[]` channel keeps working. Promoting concepts out of it (ACS codes, source-authority encodings) does not delete the column or constrain its content. Tags continue to absorb topical labels, workflow flags, and cross-cutting attributes that don't earn promotion to typed columns.

**Revisit trigger:** None. The tags column is a load-bearing extensibility surface.

### Fourth question_tier value

The user's framing was three values: FAA-written, CFI-essential, both. A fourth value `cfi-only` (= CFI says it matters AND the FAA does not test it) was considered and rejected: the FAA-coverage signal lives in the *presence or absence* of a sibling `faa-written` card on the same node, not in a negative attribute on the CFI card. Keeping the enum at three keeps the side-by-side panel logic simple ("if a `faa-written` and a `cfi-essential` card share a node and overlap on `acs_codes`, pair them"); a fourth value would force a redundant authoring decision.

**Revisit trigger:** None. The three-value enum is the deliberate shape.

### source_authority kind extensions

Today: CFR / AC / AIM / PHAK / AFH / OTHER. The `other` escape hatch absorbs the long tail (FAA-S-ACS-* documents, manufacturer POH/AFM, third-party sources). When a recurring `other` source pattern emerges (POH citations become common, or a third-party source like FAA Safety Briefing recurs), promoting it to its own kind is a one-line constants addition + a CHECK regeneration.

**Revisit trigger:** A query like `SELECT cite, COUNT(*) FROM (SELECT jsonb_array_elements(source_authority) AS sa FROM study.card) WHERE (sa->>'kind') = 'other' GROUP BY cite ORDER BY count DESC` shows a single citation pattern with 10+ occurrences.

### Citation-anchor cross-referencing

The `source_authority.cite` field today is a free string (`14 CFR 91.155`, `AIM 7-1-21`, `PHAK Ch 11`). Phase 3's citation-chip surface needs a structured anchor (an `airboss-ref` URI that resolves to the references registry) so the chip can deep-link into the flightbag reference reader. That cross-reference layer is its own concern -- the registry resolver already exists, but mounting it onto card source_authority is a Phase 3 surface task, not a Phase 1 schema task.

**Revisit trigger:** The citation-chip Phase 3 WP is authored.

### Per-user question_tier overrides

A learner might want to flag a card as "FAA-only for me" even when the canonical tier is `both`. Today the field is card-level; a per-user override would require a `study.card_user_pref` table with `(user_id, card_id, question_tier_override)`. That's plausible but premature -- no learner has asked for it.

**Revisit trigger:** User-zero or another learner asks for personal tier overrides distinct from the canonical card-author tier.

### Auto-inferring question_tier

Pattern-matching card text to "looks like a FAA-written question" vs "looks like CFI essential" is unreliable and the cost of a wrong inference is high (the learner trusts the tag and learns the wrong thing). Phase 2's backfill explicitly leaves `question_tier` NULL for this reason; hand-classification is the only safe path.

**Revisit trigger:** None. Auto-inference is rejected on safety grounds.

### Personal cards (sourceType=personal)

Personal cards authored via the `/memory/new` form do not flow through the yaml-cards seeder; they're created directly via the BC. Exposing the new fields in the personal-card authoring UI is a separate concern (the form needs new inputs, the validation needs to surface, the card detail page needs to render the values) and lives in a follow-on UI WP.

**Revisit trigger:** Phase 3's personal-card authoring UI WP is scheduled.

### Schema-level FK from acs_codes element to a future acs_element table

ACS task elements today live as YAML in `course/syllabi/<slug>/areas/*.yaml`. They're not loaded into a queryable table; the syllabus seeder reads the YAML directly. A future `acs_element` table could exist, and `acs_codes[]` elements could be constrained as FK references. Today the FK stays loose: the regex constrains shape, but a `acs_codes: ['PA.I.C.K99']` (a code that doesn't exist in the syllabus) would pass the schema and be caught only by a separate validator.

**Revisit trigger:** The syllabi system gets a queryable `acs_element` table, OR a "validate acs_codes against the loaded syllabi" check earns its own slot in `bun run check`.

### Versioned ACS codes

The seeded ACS today is `ppl-airplane-acs-6c` (FAA ACS 6C, dated 2023-11). The codes (`PA.I.C.K2a`) are version-stable across recent revisions, but a future ACS version could renumber elements. The `acs_codes[]` column today carries un-versioned codes and assumes "the current ACS" implicitly.

**Revisit trigger:** The platform ships multi-version ACS support across the syllabi system; at that point cards may need to carry `acs_version` alongside `acs_codes[]` (or `acs_codes[]` becomes `[{ version, code }]`).
