---
title: 'Out of Scope: Stage-5 citation deep-linking'
product: study
feature: stage5-citation-deeplink
type: out-of-scope
status: unread
---

# Out of Scope: Stage-5 citation deep-linking

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                     | Status       | Trigger to revisit                                                           |
| -------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| Tsvector / full-text search index on `reference_section` | Deferred     | When section-search p95 latency exceeds 200ms OR corpus passes ~50k rows     |
| Citation audit dashboard surface                         | Deferred     | When audit findings need triage from non-CLI users / a recurring review flow |
| Cross-corpus citation suggestions / autocomplete         | Rejected     | Never -- see detail below                                                    |
| Bulk citation import                                     | Deferred     | When a batch-citation workflow (e.g. course authoring) needs it              |
| Inline citation syntax in card bodies                    | Rejected     | Never -- see detail below                                                    |
| Auto-backfill of existing card bodies                    | Rejected     | Never -- see detail below                                                    |
| Public citation-discovery surfaces                       | Rejected     | Never -- see detail below                                                    |
| Section-level read-status sync (flightbag <-> study)     | Follow-on WP | When the flightbag reader exposes a per-section progress signal              |

## Tsvector / full-text search index on `reference_section`

Status: Deferred

What was deferred:
A generated `search_text` tsvector column on `study.reference_section` plus a GIN index, replacing the current 4-column ilike join in `searchReferenceSections` ([libs/bc/study/src/citations/search.ts](../../../libs/bc/study/src/citations/search.ts)).

Why:
Ilike on `(reference_section.code, reference_section.title, reference.title, reference.documentSlug)` is acceptable performance under ~50k sections; the seeded corpus today is well under that. Adding a tsvector column + index before the latency budget is breached is premature optimization (also flagged in open question 4 of the spec and the risk section of tasks.md).

Trigger to revisit:
Section search p95 latency exceeds 200ms in real usage, OR the seeded corpus grows past ~50k `reference_section` rows.

Implementation pattern when triggered:
Add a generated `search_text` tsvector column on `study.reference_section` populated from `(code || ' ' || title || ' ' || reference.title || ' ' || reference.document_slug)`. Index it with `GIN`. Rewrite `searchReferenceSections` to use `to_tsquery` instead of ilike. Drizzle schema edit at `libs/bc/study/src/schema.ts`; regenerate `drizzle/0000_initial.sql` per the no-Drizzle-migrations rule.

References:

- [spec.md "Out of Scope"](./spec.md)
- [spec.md "Open question 4 -- Tsvector column"](./spec.md#open-questions)
- [tasks.md "Risks + how we close them" -- section search performance](./tasks.md)
- [design.md decision table -- Tsvector for section search](./design.md)

## Citation audit dashboard surface

Status: Deferred

What was deferred:
A UI surface (e.g. a hangar admin page) that displays `bun run sources audit-citations` findings -- dead targets, missing resolvers, coverage gaps -- and lets a human triage them.

Why:
The audit ships as a CLI plus a scheduled job. CLI + scheduled output is sufficient while Joshua is the only operator and citation volume is low. Building a dashboard before there is a non-CLI consumer is gold-plating.

Trigger to revisit:
When audit findings need triage from a non-CLI user (e.g. a content author working in the hangar app), OR when the scheduled job runs frequently enough that a "since last green run" view becomes useful.

Implementation pattern when triggered:
Spawn a follow-on WP. Read the audit JSON output (already structured -- `audit-citations --json` per tasks step 7) into a hangar admin page that lists findings grouped by type. Mirror the hangar job-status surface shape.

References:

- [spec.md "Out of Scope"](./spec.md)

## Cross-corpus citation suggestions / autocomplete

Status: Rejected

What was rejected:
"Smart" citation suggestions: semantic search, related-section autocomplete, or any UI affordance beyond the ilike-matched result list from the picker.

Why:
The picker is an authoring tool; the author is supposed to know what they're citing. Adding semantic suggestions creates a different feature (citation discovery) layered on top of authoring, with its own UX surface, ranking model, and failure modes. A re-decision would require an authoring workflow that demonstrably suffers from the lack of suggestions -- which is not the case today (Joshua authors citations by typing the section number he already knows).

References:

- [spec.md "Out of Scope"](./spec.md)

## Bulk citation import

Status: Deferred

What was deferred:
Any flow that ingests citations en masse (CSV upload, JSON batch endpoint, programmatic seed). Per-citation creation via the picker only.

Why:
No consumer needs batch import today. The picker is fast enough for one-at-a-time authoring. Building a batch flow without a customer commits us to a validation surface that nothing exercises.

Trigger to revisit:
When a course / content authoring flow naturally produces a batch of citations (e.g. importing a question bank where each question already cites a section, or migrating an external citation corpus).

Implementation pattern when triggered:
Server-only endpoint or CLI script that accepts an array of `{ source_card_id, target_type, target_id, context? }` rows, validates each through the existing `verifyTargetExists` ([libs/bc/study/src/citations/citations.ts](../../../libs/bc/study/src/citations/citations.ts)), and inserts in a single transaction. Reuse the validation already running on the picker submission path.

References:

- [spec.md "Out of Scope"](./spec.md)

## Inline citation syntax in card bodies

Status: Rejected

What was rejected:
A `[[ref:cfr-14/91/103]]` or similar inline citation syntax embedded in card front / back markdown that auto-renders as a citation chip at display time.

Why:
Citations are a structured relationship (a row in `study.content_citation`), not a markdown affordance. Mixing them into the prose layer would couple two distinct concerns (text content + citation graph), make audit / dead-link detection harder (markdown parsing replaces SQL), and re-introduce the failure modes the structured table was designed to prevent. A re-decision would require a clear authoring win that the picker doesn't already provide.

References:

- [spec.md "Out of Scope"](./spec.md)

## Auto-backfill of existing card bodies

Status: Rejected

What was rejected:
A regex / NLP pass over existing card front / back text that detects citation-shaped strings (e.g. "§91.103", "AC 61-65J") and proposes or auto-creates `study.content_citation` rows.

Why:
Auto-detection produces false positives (any "§" or "AC " match is a candidate); proposed citations would need human review before insertion; and the volume of existing cards doesn't justify the tooling. Card authors create citations via the picker as they write -- the workflow expectation is forward-looking, not retroactive. A re-decision would require either much higher card volume or an authored corpus where pre-existing citations live in unstructured form.

References:

- [spec.md "Out of Scope"](./spec.md)

## Public citation-discovery surfaces

Status: Rejected

What was rejected:
"Most-cited sections" leaderboards, citation-driven content recommendations, or any public-facing surface that exposes the citation graph for browsing.

Why:
airboss is private / all-rights-reserved hosted by Joshua (see global memory: "License + hosting"). There is no public audience to discover citations across. The citation graph exists to deep-link from study content to the flightbag reader, not to be browsed as an entity itself.

References:

- [spec.md "Out of Scope"](./spec.md)
- Global memory: License + hosting

## Section-level read-status sync (flightbag <-> study)

Status: Follow-on WP

What was deferred:
A bidirectional signal between the flightbag reader and study citations: when a user reads a section in flightbag, the citation chips pointing at that section in study can show a "read" state (or vice versa).

Why:
The flightbag reader does not expose a per-section progress signal today. Building the sync without the producer side would be a one-way design exercise.

Trigger to revisit:
When the flightbag reader ships per-section read tracking (e.g. as part of a reader-UX follow-on similar to the existing flightbag-reader-ux Phase 3+4 work).

Implementation pattern when triggered:
Spawn a follow-on WP. The producer side likely writes to a new `study.reference_section_progress` table keyed by `(user_id, section_id)`. The consumer side reads it in `resolveCitationTargets` (joining by `target_id`) and threads a `readState` flag through `CitationChipItem` for render.

References:

- [spec.md "Out of Scope"](./spec.md)
- [docs/work-packages/flightbag-reader-ux/](../flightbag-reader-ux/) (precedent for flightbag reader work)
