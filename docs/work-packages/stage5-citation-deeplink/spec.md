---
id: stage5-citation-deeplink
title: "Spec: Stage-5 citation deep-linking"
product: study
category: feature
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - citations
  - deeplink
legacy_fields:
  feature: stage5-citation-deeplink
  type: spec
  review_status: pending
---

# Spec: Stage-5 citation deep-linking

Cross-link citation chips on cards / reps / scenarios / knowledge nodes deep-link to the right section in the flightbag reader for every seeded corpus. Closes stage 5 ("Resolve & cite") of the source ingestion pipeline.

## Background

Stage 5 of the pipeline (per [docs/ingestion-pipeline/pipeline.md](../../ingestion-pipeline/pipeline.md)) is "given a citation locator, return rendered prose with provenance, and deep-link the user from any study surface to the right section."

PR #562 shipped the audit + corpus mapping plumbing (`auditCitations`, `corpusForSourceType`). This WP is the user-visible payoff: chips on study content actually navigate to the right flightbag URL.

## The blocker we're fixing

Today the citation picker's "find a CFR section" / "find an AC chapter" tabs return zero results. Cause: [searchRegulationNodes / searchAcReferences](../../../libs/bc/study/src/citations/search.ts) query `hangar.reference` filtered by `tags.sourceType`. `hangar.reference` is empty in dev (verified `count = 0`). The real reference data lives in `study.reference` + `study.reference_section`, populated by [WP-SUB](../library-substrate/spec.md) and the per-corpus seeders (handbooks, CFR, AC, ACS, AIM, NTSB, SAFO, InFO, Chief Counsel).

`hangar.reference` was the pre-pivot glossary mirror; for citation purposes it is dead. We retire its use, not dual-write.

[verifyTargetExists in citations.ts](../../../libs/bc/study/src/citations/citations.ts) has the same problem and gets repointed in lockstep.

## Data Model

### Citation target type (decision: collapse to one polymorphic kind)

Today's `CITATION_TARGET_TYPES` (from `@ab/constants`):

| Today             | Where it points        |
| ----------------- | ---------------------- |
| `regulation_node` | `hangar.reference`     |
| `ac_reference`    | `hangar.reference`     |
| `knowledge_node`  | `study.knowledge_node` |
| `external_ref`    | URL string             |

The split between `regulation_node` and `ac_reference` is a labelling artefact -- both pointed at the same table differentiated only by `tags.sourceType`. With the move to `study.reference` (where `kind` covers handbook / cfr / ac / acs / pts / aim / pcg / ntsb / poh / safo / info / other), keeping per-kind target types means the enum grows for every new corpus.

We collapse to one polymorphic kind:

| New                 | Where it points              | Notes                                                                                                                                                          |
| ------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reference_section` | `study.reference_section.id` | All corpus-backed citations -- replaces regulation_node + ac_reference and folds in handbook / aim / acs sections that the old enum couldn't represent at all. |
| `knowledge_node`    | `study.knowledge_node.id`    | Unchanged.                                                                                                                                                     |
| `external_ref`      | `<url><delim><title>` string | Unchanged.                                                                                                                                                     |

Migration: existing rows with `target_type = 'regulation_node'` or `'ac_reference'` get rewritten to `target_type = 'reference_section'` with `target_id` repointed at the matching `study.reference_section.id`. In practice dev has zero such rows so the migration is a no-op SQL that runs anyway for correctness.

The previous values stay in the CHECK constraint **for one release** so the upgrade is non-locking, then a second migration drops them. (We don't ship "deprecation comments" -- per project rule no legacy survives a session.)

### `study.reference_section.airboss_ref` column

Add `airboss_ref text` to `study.reference_section` (NOT NULL), populated at seed time. CHECK constraint: `airboss_ref ~ '^airboss-ref:'`. Stored once at seed; read directly by `resolveCitationTargets`. Storage cost is trivial (~50 chars × <100k rows). Computation-on-the-fly was rejected because:

- Each corpus has a different URI shape (handbooks: dotted-code `12.3.2` -> slashed; AIM: dashed `5-2-1`; CFR: paragraph chains; AC: `section-N`; ACS: `area-{a}/task-{t}`).
- The URI is the canonical citation identifier; storing it makes audit + render + dead-link detection symmetric.
- URI scheme drift is handled by a one-shot reseed, not by 4 separate computation paths.

`study.reference` does NOT get an `airboss_ref` column. References are document-level; citations always land on a section row. Whole-document references (ACs that haven't been promoted, NTSB ALJ rulings) already seed a depth-0 `reference_section` row with `level = 'circular'` / `'document'` / `'publication'` -- those rows carry the URI.

### `CitationPicker` search index

No new columns. `study.reference_section` already has `referenceId`, `code`, `title`, `level`, and the parent `study.reference.kind` reachable via FK. Search ilike's against `(reference_section.code, reference_section.title, reference.title, reference.documentSlug)`.

If/when the corpus grows past ~50k sections, we add a generated `search_text` tsvector column. Out of scope for this WP -- captured in [Open question 4](#open-questions).

## Behavior

### Picker (find a section to cite)

The picker exposes one section-search tab plus the existing knowledge-node and external-ref tabs:

```text
[ Section ]   [ Knowledge node ]   [ External link ]
```

The single Section tab covers every corpus. The user types into a search box; the BC searches across `study.reference_section` joined to `study.reference`. Result rows render as:

```text
14 CFR §91.103 -- Preflight action                  [CFR]
PHAK Ch 12 §12.3 -- Wing loading and maneuverability [Handbook]
AC 61-65J §3 -- Knowledge tests                     [AC]
AIM 5-2-1 -- General                                [AIM]
ACS PPL Airplane I.A.K1 -- Risk management          [ACS]
```

The `[CFR]` / `[Handbook]` / etc. badge is `SOURCE_TYPE_LABELS[reference.kind]` (already in `@ab/constants`). The user picks one row; the picker submits `target_type = 'reference_section', target_id = <reference_section.id>`.

### Chip render (deep-link from study to flightbag)

[CitationChips.svelte](../../../libs/ui/src/components/CitationChips.svelte) renders citation rows as anchor tags. Today only `external_ref` items get an `<a href>`; this WP populates `href` for `reference_section` items via the new helper.

Chip click behaviour:

| Target type         | href source                                | target attr          |
| ------------------- | ------------------------------------------ | -------------------- |
| `reference_section` | `urlForReferenceSection(row)` (new helper) | `_self`              |
| `knowledge_node`    | `ROUTES.KNOWLEDGE_NODE(node.id)`           | `_self`              |
| `external_ref`      | user-supplied URL                          | `_blank` (unchanged) |

`target="_blank"` stays on external refs only. Internal links open in the same tab so the user keeps their study session in browser history.

### `resolveCitationTargets` enrichment

[resolveCitationTargets](../../../libs/bc/study/src/citations/citations.ts) batches per-target-type reads and sets `target.label`, `target.detail`, `target.href`. After this WP:

- `reference_section`: joins `study.reference_section` + `study.reference`. `label` = `reference.title + ' ' + reference_section.code` (e.g. `"14 CFR §91.103"`). `detail` = `SOURCE_TYPE_LABELS[reference.kind]` (e.g. `"14 CFR"`). `href` = `reference_section.airboss_ref` -> `urlForReference(uri)` (the existing dispatcher in `@ab/sources`).
- `knowledge_node`: unchanged label + detail. `href` = `ROUTES.KNOWLEDGE_NODE(node.id)`.
- `external_ref`: unchanged.

### `composePublicCardCitations` policy update

[composePublicCardCitations](../../../libs/bc/study/src/cards-public.ts) today filters out internal targets on the public card page (its rule: "external links only on the public page"). Internal flightbag deep-links are also safe to expose publicly because the flightbag reader is public. Update the policy to:

- Allow `reference_section` href (flightbag is public).
- Allow `knowledge_node` href (knowledge node detail pages are public via `/knowledge/{id}`).
- Continue allowing `external_ref` href.

The policy comment in cards-public.ts gets a one-line update reflecting the new rule.

### Citation audit re-verification

After the picker repoint lands and real citation rows exist, run `bun run sources audit-citations` and treat any findings as a punch list to close before the WP ships. Likely findings:

- Any pre-existing `regulation_node` / `ac_reference` rows that didn't migrate cleanly (dev should have zero, but verify).
- AIM resolver (see [Open questions](#open-questions)) -- if AIM's `getLiveUrl` is still the bootstrap default, the audit will surface it as a coverage gap.

## Validation

| Field                                 | Rule                                                                                      |                    |                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ | --------------- |
| `content_citations.target_type`       | One of `'reference_section' \                                                             | 'knowledge_node' \ | 'external_ref'` |
| `content_citations.target_id`         | When `target_type = 'reference_section'`, must exist in `study.reference_section.id`      |                    |                 |
|                                       | When `target_type = 'knowledge_node'`, must exist in `study.knowledge_node.id`            |                    |                 |
|                                       | When `target_type = 'external_ref'`, `<url><delim><title>` form, URL is http(s)           |                    |                 |
| `study.reference_section.airboss_ref` | NOT NULL, matches `^airboss-ref:`. Set by seeders. Existing rows backfilled in migration. |                    |                 |
| Picker section search query           | Trimmed, ilike-escaped, capped at `MAX_SEARCH_LIMIT` results (existing behaviour)         |                    |                 |

## Edge Cases

| Case                                                                                        | Behavior                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `airboss_ref` parses but the locator has no flightbag route yet                             | `urlForReference` returns `ROUTES.FLIGHTBAG_HOME` (existing fallback). Chip still navigates somewhere useful.      |
| Section row is hard-deleted after citation creation                                         | Audit surfaces a `dead_target` finding. Chip render: `target.detail` shows "(missing)" suffix. Existing behaviour. |
| User cites a whole-document reference (depth-0 `circular` / `document` / `publication` row) | URI points at the document landing route; chip navigates there. No special-casing.                                 |
| Picker search returns zero matches                                                          | Existing "no results" affordance.                                                                                  |
| Citation context exceeds `CITATION_CONTEXT_MAX_LENGTH`                                      | Existing CitationValidationError -- unchanged.                                                                     |
| Knowledge_node citation, knowledge node has no detail page yet                              | Always has -- `/knowledge/{id}` is the canonical route. No edge case in practice.                                  |

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Open questions

1. **AIM resolver real vs default no-op.** Research said AIM is seeded but I haven't confirmed [aim/resolver.ts](../../../libs/sources/src/aim/resolver.ts) `getLiveUrl` returns a real URL vs the bootstrap default. **Resolution: tasks include a verification step before the WP ships. If it's a default no-op, surface as a separate small follow-on WP and gate this WP's "shipped" status on it.**
2. **`citation_audit` scheduled job: enable=true after this ships?** Job ships `enabled = false`. **Resolution: flip to `enabled = true` as the last task of this WP, after real citations exist and the audit passes clean once.**
3. **Should `urlForReferenceSection` return URL with origin, or path only?** `urlForReference` returns path only today (callers prefix origin via `siblingOrigin` for cross-app links). Citation chips render in study but link to flightbag (different app). **Resolution: helper returns path; the chip render layer prefixes the flightbag origin via `siblingOrigin`. Pattern matches the existing CitationChip in `libs/library/`.**
4. **Tsvector column on `reference_section`?** Section search ilike performance is acceptable up to ~50k rows. Beyond that we need a tsvector. Current corpus is well under. **Resolution: out of scope for this WP. Capture as a follow-on triggered by a per-query latency threshold (e.g. p95 > 200ms). Add to IDEAS.md.**
5. **Knowledge-node citation deep-link target.** Knowledge nodes have detail pages at `/knowledge/{id}` in study (not flightbag). **Resolution: link to `/knowledge/{id}` (in-app, study-side). Add to chip render via `ROUTES.KNOWLEDGE_NODE(id)`.**

All five resolved here in spec; nothing punted to "future consideration."

## Loose ends captured (do not let these slip)

This list mirrors the user's brief and exists in spec form so nothing falls between the cracks. Each item maps to a task group in [tasks.md](tasks.md).

- [x] Picker repoint to `study.reference` + `study.reference_section` -- task group 2.
- [x] `urlForReferenceSection` helper in `@ab/sources` -- task group 3.
- [x] Wire helper into `resolveCitationTargets` -- task group 4.
- [x] CitationChips.svelte renders `<a href>` for in-app deep links -- task group 5.
- [x] CitationTargetType enum collapse -- task group 1 (data model first).
- [x] AIM resolver verification -- pre-flight task.
- [x] Cross-link audit re-verification post-merge -- task group 7.
- [x] composePublicCardCitations policy update -- task group 5.
- [x] citation_audit scheduled job enable flip -- task group 7.
- [x] knowledge_node citation deep-link target -- task group 5 (chip render).
- [x] airboss_ref column on study.reference_section -- task group 1 (data model).

## Acceptance criteria

The WP is shipped when:

1. The citation picker's section tab returns real results from `study.reference_section` for every seeded corpus (handbooks, CFR, AC, ACS, AIM, NTSB, SAFO, InFO, Chief Counsel).
2. Creating a citation against a section row succeeds and persists.
3. The chip render shows a clickable `<a>` for `reference_section` and `knowledge_node` targets.
4. Clicking a `reference_section` chip on a card detail page navigates to the matching flightbag URL.
5. `bun run sources audit-citations` runs clean against dev DB after a representative set of citations is created.
6. `bun run check` clean.
7. Test plan ([test-plan.md](test-plan.md)) all scenarios pass.
8. The user has flipped `review_status: done`.
