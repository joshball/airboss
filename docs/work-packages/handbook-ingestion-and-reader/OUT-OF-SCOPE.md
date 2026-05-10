---
title: 'Out of Scope: Handbook Ingestion and Reader'
product: course
feature: handbook-ingestion-and-reader
type: out-of-scope
status: unread
---

# Out of Scope: Handbook Ingestion and Reader

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of Scope (explicit)" section of [spec.md](./spec.md). Several follow-on items are already in flight as separate WPs (the AIM ingestion WP at [reference-aim-ingestion/](../reference-aim-ingestion/) shipped via PR #252; the Pilot/Controller Glossary, Advisory Circulars, NTSB, and POH ingestions ship via the same per-corpus WP pattern). Others (commercial publisher content, multi-tenant note sharing, hangar-side handbook authoring) are scope-rejections, not pending tasks.

## Summary

| Item                                                            | Status       | Trigger to revisit                                                                                |
| --------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------- |
| Commercial publisher content (Jeppesen, ASA, Sporty's, King)    | Rejected     | Never -- see detail below                                                                         |
| Migration of existing node `references` arrays                  | Follow-on WP | When the cert-syllabus WP runs the bulk migration pass                                            |
| The `Citation` table (per-citation rows)                        | Follow-on WP | When ADR 016 phase 1 lands -- cert-syllabus WP delivers the table                                 |
| Handbook lens / browse-by-handbook on the dashboard             | Follow-on WP | When ADR 016 phase 8 (lens framework) lands                                                       |
| AIM ingestion                                                   | Follow-on WP | Already shipped via [reference-aim-ingestion/](../reference-aim-ingestion/) (PR #252)             |
| Pilot/Controller Glossary, Advisory Circulars, NTSB, POH ingest | Follow-on WP | When a learner / lesson author needs citations into one of these corpora                          |
| Multi-tenant content sharing (share my notes)                   | Rejected     | Never -- see detail below                                                                         |
| Handbook authoring inside airboss                               | Rejected     | Never -- see detail below                                                                         |
| Audio narration of sections                                     | Deferred     | When the future `audio/` app surface is in flight AND a "listen" button has product justification |
| Cross-handbook search                                           | Deferred     | When per-handbook ToC + the existing references / glossary search prove insufficient in real use  |

## Commercial publisher content (Jeppesen, ASA, Sporty's, King, Gleim)

Status: Rejected

What was rejected:
Ingestion of commercial training publishers' handbook-equivalent material (Jeppesen Pilot Manual, ASA's Oral Exam Guides, Sporty's training content, King Schools written tutorials, Gleim test prep). Out by license, not by interest.

Why:
Per [spec.md](./spec.md) Out of Scope: licensing. The FAA handbooks are public-domain federal works; commercial publishers retain copyright on their material and ingestion would require a per-publisher licensing agreement. A re-decision would have to clear: a licensed agreement (commercial or educational) AND a learner request that the existing FAA-only corpus can't satisfy.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Commercial publisher content"

## Migration of existing node `references` arrays

Status: Follow-on WP

What was postponed:
A migration pass that converts the existing freeform `references` strings on knowledge nodes (e.g., `"PHAK Ch. 12 §3"`) to structured `Citation` discriminated-union entries. This WP ships the schema (both shapes accepted) and the resolver (handles structured handbook citations); the data migration is separate.

Why:
Per [spec.md](./spec.md) Out of Scope and the design rationale "Why ship the resolver but not the migration": the cert-syllabus WP is the natural home for the migration because the syllabus authoring usually knows more about which citations belong on which node than the original node author wrote freehand. Bundling the migration into this WP would conflate "ship the reader" with "rewrite every existing citation."

Trigger that fires the follow-on:
The cert-syllabus WP runs the bulk migration pass. Until then, every legacy freeform string continues to render as it does today (free text); structured citations resolve via `resolveCitationUrl` when present.

Implementation pattern when triggered:
A bulk pass over `course/knowledge/**/*.yaml` files that walks each node's `references` array, classifies each entry by source (handbook / CFR / AC / ACS / PTS / AIM / PCG / NTSB / POH / other), looks up the matching `reference` row, builds the structured `StructuredCitation` shape, and rewrites the YAML in-place. The build script accepts both shapes throughout, so the migration can run incrementally per node-cluster.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Migration of existing node `references` arrays"
- [design.md](./design.md) "Why ship the resolver but not the migration"
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 1

## The `Citation` table (per-citation rows)

Status: Follow-on WP

What was postponed:
A `node_citation(node_id, citation_id)` table that stores citations as first-class rows rather than as JSONB array entries on `knowledge_node.references`. This WP ships the JSONB-array shape with structured discriminated-union entries; the per-row table is the eventual ADR 016 phase 1 destination.

Why:
Per [spec.md](./spec.md) Out of Scope and the design rationale "Why the discriminated union shape, not a parallel `node_citation` table": "Tables before content is premature. We don't know what the table needs to look like until we have nodes citing references in the wild." The structured-on-array shape is good enough for the reader; the GIN index keeps reverse queries bounded; the resolver is pure. Re-platforming storage later does not touch the UI.

Trigger that fires the follow-on:
The cert-syllabus WP lands ADR 016 phase 1 and delivers the `node_citation` table along with whatever surfaces (citation editor, citation browser, citation diff tool) justify per-row storage.

Implementation pattern when triggered:
Add the `node_citation` table per ADR 016 phase 1. Migrate every structured citation in `knowledge_node.references` JSONB to a `node_citation` row. Keep the JSONB column in place for the legacy freeform shape until that migration completes too. Then drop the column.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "The `Citation` table"
- [design.md](./design.md) "Why the discriminated union shape, not a parallel `node_citation` table"
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 1

## Handbook lens / browse-by-handbook on the dashboard

Status: Follow-on WP

What was postponed:
A dashboard surface that ranks handbooks by coverage (e.g., "you've read 60% of PHAK and 12% of AFH; here's what's next"). The reader exists in this WP; the dashboard surface that aggregates progress across handbooks does not.

Why:
Per [spec.md](./spec.md) Out of Scope: ADR 016 phase 8 is the lens framework. Handbook lens is one lens among many; building it before the framework forces single-feature scaffolding that the framework will redo.

Trigger that fires the follow-on:
ADR 016 phase 8 lands the lens framework. The handbook lens then ships as a thin lens definition over the existing `handbook_read_state` rows.

Implementation pattern when triggered:
Define a lens that aggregates `getHandbookProgress(userId, referenceId)` results across all references with `superseded_by_id IS NULL`. Surface as a tile on `/dashboard` with a per-handbook progress bar, sorted by coverage descending or by recency.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Handbook lens / browse-by-handbook on the dashboard"
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../decisions/016-cert-syllabus-goal-model/decision.md) phase 8

## AIM ingestion

Status: Follow-on WP

What was postponed:
Ingestion of the FAA Aeronautical Information Manual. AIM publishes as a continuously revised document with frequent change pages; the parser must track changes per paragraph rather than per edition. Different pipeline, different cadence, separate WP.

Why:
Per [spec.md](./spec.md) Out of Scope: the per-paragraph change cadence is fundamentally different from the per-edition handbook model. Bundling AIM into this WP would require generalizing the pipeline to handle two cadences before either is proven.

Trigger that fires the follow-on:
**Already shipped.** The follow-on WP is [reference-aim-ingestion/](../reference-aim-ingestion/) and merged via PR #252. AIM is now a registry-resolvable corpus; lessons can cite `airboss-ref:aim/5-1-7?at=2026-09` and the validator resolves it.

Implementation pattern when triggered:
See [reference-aim-ingestion/spec.md](../reference-aim-ingestion/spec.md) for the shipped pattern: per-edition manifest, year-month edition slugs, paragraph-level granularity, FAA doc-level live URL (no deep-link).

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "AIM ingestion"
- [reference-aim-ingestion/spec.md](../reference-aim-ingestion/spec.md) (the shipped follow-on)

## Pilot/Controller Glossary, Advisory Circulars, NTSB reports, POH excerpts

Status: Follow-on WP

What was postponed:
Per-corpus ingestion for the Pilot/Controller Glossary (PCG), Advisory Circulars (AC), NTSB reports, and POH (Pilot's Operating Handbook) excerpts. Each carries citations the platform consumes; each parser shape differs enough that lumping them into the handbook pipeline would inflate scope.

Why:
Per [spec.md](./spec.md) Out of Scope: each corpus has its own structural quirks (PCG is alphabetical entries, AC is letter-numbered with paragraph IDs, NTSB is per-incident reports with ICAO codes, POH is per-aircraft and per-revision). One pipeline stretched to cover all of them under-serves each. Each ships its own WP when needed.

Trigger that fires the follow-on:
A learner or lesson author needs citations into the corpus AND no existing reference shape can carry the citation. The first one to land is whichever earns content first (PCG is the most likely candidate given its tight coupling to AIM).

Implementation pattern when triggered:
Mirror the [reference-aim-ingestion/](../reference-aim-ingestion/) pattern: per-corpus directory under `libs/sources/src/<corpus>/`, locator parser, citation formatter, URL builder, derivative reader, resolver, ingest CLI, side-effect registration, smoke test. Per-edition `manifest.json` derivative tree under `<corpus>/<edition>/` (or whatever per-corpus storage shape ADR 018 governs).

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Pilot/Controller Glossary, Advisory Circulars, NTSB reports, POH excerpts"
- [reference-aim-ingestion/](../reference-aim-ingestion/) (the structural template)

## Multi-tenant content sharing (share my notes)

Status: Rejected

What was rejected:
A "share my notes" surface that lets one learner expose their per-section notes to another learner (or to a study group). Notes and read-state stay per-user and private in v1.

Why:
Per [spec.md](./spec.md) Out of Scope and the security rationale: airboss is a single-learner platform today (Joshua). Multi-tenant note sharing introduces auth boundaries, content moderation, and privacy questions that don't have product traction. A re-decision would have to clear: a multi-user product surface (study groups, instructor cohorts, FIRC-class peer review) AND a privacy model that protects individual notes from unintended exposure.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Multi-tenant content sharing"
- [spec.md](./spec.md) Security + permissions section ("Notes are private to the user")

## Handbook authoring inside airboss

Status: Rejected

What was rejected:
A hangar-side surface that lets an author edit FAA handbook content (e.g., to apply errata, write a school-specific overlay, or ship a "PHAK-with-our-annotations" variant). The handbook reader exists; the handbook editor does not.

Why:
Per [spec.md](./spec.md) Out of Scope: "Hangar may eventually surface FAA edition diffs, but that is a hangar feature, not part of this WP." The FAA handbooks are reference material -- airboss ingests the canonical bytes, presents them, and lets the learner read. Editing them inside airboss conflates "consume the FAA's word" with "author our own pedagogy" (the latter is what `course/knowledge/` is for). A re-decision would have to clear: a hangar product surface for school-specific overlays AND a clear separation between "FAA-canonical text" and "our annotations."

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Handbook authoring inside airboss"
- [docs/decisions/020-handbook-edition-and-amendment-policy.md](../../decisions/020-handbook-edition-and-amendment-policy.md) (errata policy lives in the ingestion config, not in an editor)

## Audio narration of sections

Status: Deferred

What was deferred:
A "listen" button on the section page that streams an audio reading of the section body. The audio surface itself lives in the future `audio/` app per [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md); a handbook-section "listen" button is a downstream candidate, not v1.

Why:
Per [spec.md](./spec.md) Out of Scope: the audio surface app is not yet scaffolded. Building a one-off TTS button on the handbook reader before the audio app exists would create a single-feature audio path that the audio app would later have to retrofit (or replace).

Trigger to revisit:
The `audio/` app is in flight (per [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) future-surface list) AND a product justification surfaces for "listen to PHAK Ch 12 in the car." The latter is a real pilot pre-flight study pattern; the former gates the implementation.

Implementation pattern when triggered:
Add a "listen" affordance on the section header that hands off to the `audio/` app's TTS pipeline. The handbook reader provides the markdown body; the audio app handles synthesis, playback, and progress tracking. Possibly a `/handbooks/[doc]/[chapter]/[section]/listen` deep-link that the audio app resolves.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Audio narration of sections"
- [docs/platform/MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md) audio surface row

## Cross-handbook search

Status: Deferred

What was deferred:
A search box scoped to handbooks that lets a learner type "stall recovery" and see hits across PHAK, AFH, and AvWX in one ranked list. v1 relies on the existing references / glossary search and the per-handbook table of contents.

Why:
Per [spec.md](./spec.md) Out of Scope: the existing surfaces are likely sufficient for one-user search patterns. Building a dedicated cross-handbook search before usage data shows where the existing surfaces fail risks over-investing in a feature whose ranking + UX tradeoffs are theoretical.

Trigger to revisit:
Real usage shows that the per-handbook ToC + the existing references / glossary search are insufficient. Concrete signal: Joshua (or another learner) reports "I knew the topic was in one of the handbooks but I had to grep three of them to find it."

Implementation pattern when triggered:
Add a search route at `/handbooks/search?q=...` that queries `handbook_section.content_md` (or a derived FTS column) across all non-superseded references. Likely uses Postgres full-text search (`tsvector` + GIN index on the FTS column). Ranking by reference recency + section depth + match count. UI is a single ranked list with handbook + chapter + section badges per result.

References:

- [spec.md](./spec.md) Out of Scope (explicit) -- "Cross-handbook search"
