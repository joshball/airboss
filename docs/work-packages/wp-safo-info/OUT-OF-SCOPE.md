---
title: 'Out of Scope: WP-SAFO-INFO'
product: course
feature: wp-safo-info
type: out-of-scope
status: unread
---

# Out of Scope: WP-SAFO-INFO

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                       | Status       | Trigger to revisit                                             |
| ------------------------------------------ | ------------ | -------------------------------------------------------------- |
| Auto-discovery via FAA RSS feeds           | Follow-on WP | When the static seed list goes stale or breadth becomes a goal |
| Historical SAFOs/InFOs older than ~5 years | Deferred     | When a course or scenario explicitly cites a pre-window doc    |
| Cross-references between SAFOs and ACs     | Follow-on WP | When citation-graph work begins across advisory corpora        |

## Auto-discovery of new SAFOs/InFOs via FAA RSS feeds

Status: Follow-on WP

What was deferred / rejected / postponed:
An ingestion job that watches FAA's SAFO and InFO publication feeds (RSS or equivalent), detects new entries, and enqueues a download + extract + seed cycle without hand-editing `course/references/safos.yaml` / `course/references/infos.yaml`. WP-SAFO-INFO ships a manual, YAML-driven pipeline: a human curates which SAFOs/InFOs are in scope, lists them in YAML, and the seeder ingests that list.

Why:
Rationale inferred from spec narrative. Phase 1 explicitly scopes the initial corpus to "top 5-10 most-cited per ATC/CFI training material. Don't try to ingest all 30-50 in v1." Auto-discovery is a different problem -- a watcher + queue + retry pipeline -- with different infra (job scheduling, FAA-feed parsing, deduplication, churn handling) that doesn't share code with the v1 manual pipeline. The spec calls it out as a separate WP to keep the v1 scope tractable.

Trigger to revisit (if Deferred):
When the static seed list goes stale (an authored course cites a SAFO/InFO published after v1 shipped), OR when breadth of the SAFO/InFO library becomes a stated product goal rather than the cited-by-training-material slice v1 covered.

Implementation pattern when triggered (if Deferred):
Follow the WP-spec template at `docs/work-packages/`. The implementation can lean on the manifest + seeder pipeline this WP built; the new surface area is the watcher (RSS / DRS polling), an enqueue path through `libs/hangar-jobs/`, and dedup against the existing `entries[]` keyed on SAFO/InFO number. Mirror existing job patterns in `libs/hangar-jobs/`.

References:

- [spec.md "Out of scope"](./spec.md) -- "Auto-discovery of new SAFOs/InFOs via FAA RSS feeds (separate WP)"
- [library-completeness §4.C, §4.D](../library-completeness/spec.md) -- DRS-first ratification, `canonical_url_override` field

## Historical SAFOs/InFOs older than ~5 years

Status: Deferred

What was deferred / rejected / postponed:
Ingestion of SAFOs and InFOs published more than approximately 5 years ago. v1's seed list (Phase 5 `course/references/safos.yaml` / `infos.yaml`) is constrained to currently active, recent docs. Historical bulletins that the FAA has superseded, retired, or that simply pre-date the v1 window are not part of the initial ingest.

Why:
Rationale inferred from spec narrative. v1 scopes itself to "~30-50 currently active SAFOs" and "~20-30 currently active InFOs" (see "Estimated scope" section of spec.md) and further narrows to top-5-10 cited (Phase 1). Older docs add corpus size without adding training-material citations, and the FAA's older bulletins may not have the same heading structure the Phase 2 extractor parses. Scope discipline: ship the cited slice first, expand when a real use case asks for breadth.

Trigger to revisit (if Deferred):
When a course module, scenario, or knowledge node explicitly cites a SAFO or InFO published outside the v1 ~5-year window. The trigger is a citation in authored content, not a hypothetical "completeness would be nice."

Implementation pattern when triggered (if Deferred):
Extend the YAML lists at `course/references/safos.yaml` / `course/references/infos.yaml` with the historical entry, and re-run the seeder. The Phase 2 extractor may need a fallback path for docs without modern heading structure (single-section under depth-0 wrapper, which the spec already accommodates -- "If a SAFO/InFO has no internal headings, it stays single-section under depth-0 wrapper").

References:

- [spec.md "Out of scope"](./spec.md) -- "Historical SAFOs/InFOs older than ~5 years"
- [spec.md "Estimated scope"](./spec.md) -- v1 corpus size bounds
- [spec.md Phase 1](./spec.md) -- "top 5-10 most-cited per ATC/CFI training material"

## Cross-references between SAFOs and ACs

Status: Follow-on WP

What was deferred / rejected / postponed:
A citation graph that links SAFOs to the Advisory Circulars they reference (and vice versa), surfaced through the same citation primitives used for CFR/AIM. The v1 pipeline ingests SAFO/InFO body content but does not extract or persist outgoing references from those bodies to other corpora.

Why:
Rationale inferred from spec note "citation work, separate concern." Citation extraction is a cross-cutting capability that spans every advisory corpus (ACs, SAFOs, InFOs, Chief Counsel letters, etc.), not a property of any single corpus. Folding it into WP-SAFO-INFO would build a SAFO-specific citation path that other corpora would then have to duplicate. The discipline is to land the corpus first, then build citations as a single capability that picks up every corpus at once.

Trigger to revisit (if Deferred):
When citation-graph work begins across advisory corpora. Likely triggered by a WP that authors the SAFO -> AC reference extractor as part of a broader citations pass (per the existing citations pattern doc at `docs/ingestion-pipeline/reference-citations-pattern.md`).

Implementation pattern when triggered (if Deferred):
Follow `docs/ingestion-pipeline/reference-citations-pattern.md` for the citation-picker / chip / cited-by surfaces. The SAFO body content is already markdown by the time this WP's Phase 2 extractor finishes; a citation pass would run a regex / parser over the markdown to detect `AC \d+-\d+` patterns (and SAFO/InFO numbers in reverse), persist edges, and surface them through the same UI as CFR/AIM citations.

References:

- [spec.md "Out of scope"](./spec.md) -- "Cross-references between SAFOs and ACs (citation work, separate concern)"
- [docs/ingestion-pipeline/reference-citations-pattern.md](../../ingestion-pipeline/reference-citations-pattern.md) -- citation primitives pattern
