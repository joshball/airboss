---
title: "Out of Scope: WP-NTSB-ALJ -- NTSB administrative law judge rulings"
product: course
feature: wp-ntsb-alj
type: out-of-scope
status: unread
---

# Out of Scope: WP-NTSB-ALJ -- NTSB administrative law judge rulings

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md), plus the parent ratification block in [library-completeness §4.A](../library-completeness/spec.md) that scoped this WP, and ADR 019 §1.2 (the NTSB corpus URI grammar).

## Summary

| Item                             | Status       | Trigger to revisit                                                                                       |
| -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| Cross-reference UI (stage 5)     | Deferred     | When citation surfaces consume `primary_cfr` / `enforcement_order` metadata (cross-link feature work)    |
| Automated new-ruling ingestion   | Deferred     | When the curated 20-50-case backlog is exhausted and the next batch is wider than manual curation scales |
| Umbrella `ntsb` card as fallback | Rejected     | Never -- see detail below                                                                                |
| NTSB factual accident reports    | Follow-on WP | When NTSB factual / probable-cause reports become pedagogically required (accident-analysis content)     |

## Cross-reference UI (stage 5)

Status: Deferred

What was deferred:
Surfacing the cross-reference metadata captured on each ALJ ruling -- `primary_cfr` (the CFR section adjudicated, e.g. `14 CFR §91.13`) and `enforcement_order` (the FAA order being challenged, e.g. `FAA-2017-0123`) -- as live citation chips / cited-by panels in the reader and study surfaces. Phase 5 of [spec.md](./spec.md) ("Cross-reference enrichment") captures the metadata; this WP does not wire it through the citation-rendering pipeline.

Why:
Per [spec.md](./spec.md) Phase 5: "Stage 5 (cross-linking) concern; can defer." Cross-linking is a platform-wide concern that spans every corpus (CFR sections cited from ACs, handbooks, interpretations, ALJ rulings); building a per-corpus path for ALJ alone would fragment the rendering layer. The metadata is captured at ingest so the future cross-link feature has data to consume; the UI lands once the cross-link surface is designed across corpora.

Trigger to revisit:
When citation surfaces (cited-by panels, citation-chip resolvers in the flightbag reader, study card backside cross-refs) begin consuming structured cross-reference metadata across corpora. The signal is a cross-link feature WP that names ALJ as one of its inputs, or a citation surface asking "show me every ALJ ruling that cites this CFR section."

Implementation pattern when triggered:
Mirror the citation-chip / cited-by pattern documented in [docs/ingestion-pipeline/reference-citations-pattern.md](../../ingestion-pipeline/reference-citations-pattern.md). The `primary_cfr` and `enforcement_order` fields live on the per-ruling metadata jsonb (per ADR 019 §1.2 metadata pattern, and the section / document metadata split documented in library-completeness §4.A); the resolver registry already routes by corpus, so the consumer reads structured metadata via the per-kind Zod schema rather than touching the seeder.

References:

- [spec.md](./spec.md) -- Out of scope line 1 + Phase 5 narrative
- [library-completeness/spec.md](../library-completeness/spec.md) §4.A ratification (NTSB ALJ own WP)
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2 (NTSB URI provisioning)
- [docs/ingestion-pipeline/reference-citations-pattern.md](../../ingestion-pipeline/reference-citations-pattern.md) (the consumer-side pattern when the trigger fires)

## Automated new-ruling ingestion

Status: Deferred

What was deferred:
A scraper / scheduled-job pipeline that pulls fresh ALJ rulings from the NTSB Office of Administrative Law Judges archive automatically. Phase 1 of [spec.md](./spec.md) explicitly chose option (a) manual curation over option (b) automated scrape: "Recommendation: (a) for v1. Maybe 20-50 of the most pedagogically valuable rulings."

Why:
Per [spec.md](./spec.md) Phase 1: the NTSB-OALJ archive is "engineering-heavy and the archive is incomplete." The pedagogically valuable subset (the rulings cited in CFI training and AC 91-79-style accident analysis) is small and stable; a manual curation pass picks the ~20-50 high-leverage cases for less effort than building and maintaining a fragile scraper against an incomplete source. The ratified scope (library-completeness §4.A) names the corpus, not the ingestion mode.

Trigger to revisit:
When the manually curated 20-50-case backlog is exhausted AND the next batch of useful rulings is wider than manual curation scales (concrete signal: a content-side ask for "every ALJ ruling on a topic" rather than the curated high-leverage list). Also reconsider if NTSB-OALJ ships a bulk-download or API surface that closes the incompleteness gap.

Implementation pattern when triggered:
The existing AC pipeline is the closest analog per library-completeness §4.A (single PDF per item; HTML index + per-decision PDF extractor). Build `libs/sources/src/ntsb-alj/` with its own locator (docket-style IDs like `EA-5567`, `WD-1234`, not slash-style FAA numbers) following the per-corpus locator pattern in [libs/sources](../../../libs/sources). Reuse the section-tree adapter shipped in WP-NTSB-ALJ Phase 3; only the source-acquisition layer is new.

References:

- [spec.md](./spec.md) -- Out of scope line 2 + Phase 1 ratification
- [library-completeness/spec.md](../library-completeness/spec.md) §4.A and the §4.A ratification row
- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) -- "manual curation per Phase 1" note in the NTSB ALJ status row

## Umbrella `ntsb` card as fallback

Status: Rejected

What was rejected:
Replacing or retiring the existing `course/references/ntsb.yaml` umbrella card now that per-ruling cards exist. The umbrella stays.

Why:
Per [spec.md](./spec.md) Out of scope line 3: "The umbrella `ntsb` card (stays as citation fallback)." The umbrella exists to give legacy citations and any future not-yet-curated rulings a valid resolution target. Removing the umbrella once per-ruling rows exist would break every existing citation that doesn't pin a specific case (the umbrella row's primary purpose per its own header comment in `course/references/ntsb.yaml`). The per-ruling rows are additive; the umbrella stays in place by design.

Trigger to revisit:
Never. The umbrella is the citation-fallback for unspecified-case NTSB references and the landing for legacy citations without docket IDs. Retiring it would require auditing every NTSB citation in the corpus and either pinning each to a specific case or accepting the citation breakage; both are out of proportion to any cleanup benefit. If a future content sweep narrows every NTSB citation to a specific case, surface that as its own decision, not a quiet retirement of this row.

References:

- [spec.md](./spec.md) -- Out of scope line 3 + slug + identifier section ("The umbrella `airboss-ref:ntsb` ... stays for citations that don't pin a specific case")
- `course/references/ntsb.yaml` -- umbrella row + header comment describing its fallback role
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2 (NTSB corpus URI grammar; per-report IDs are separate from the umbrella)

## NTSB factual accident reports

Status: Follow-on WP

What was postponed:
Ingesting NTSB factual accident reports (and the related recommendations / probable-cause docs). These are a different corpus from ALJ rulings -- per-report PDFs with their own structure (factual report, analysis, conclusions, probable cause, recommendations), keyed by NTSB-ID (`SE-19045`-style), not by case docket.

Why:
Per [spec.md](./spec.md) Out of scope line 4: "NTSB factual accident reports (separate, larger WP -- different data model)." The library-completeness spec note explicitly carves out NTSB as having multiple data models: "NTSB has its own data model (accident reports, recommendations, factual reports)." ALJ rulings are legal opinions adjudicating enforcement actions; factual reports are post-accident investigations. Same parent agency, different document shape, different citation patterns, different pedagogical use (CFI legal training vs accident analysis). Folding both into one WP would conflate the schemas and the manifest-validation discriminator.

Trigger that fires the follow-on:
When accident-analysis content (e.g. CFI training that walks accident chains, decision-rep scenarios derived from real accidents) becomes a planned content effort and needs primary-source citations into factual reports. Adjacent signal: the existing umbrella `airboss-ref:ntsb` is being pressed into service for specific-report citations, indicating the corpus is wanted.

Implementation pattern when triggered:
Author a WP-NTSB-REPORTS following the same WP-spec shape as wp-ntsb-alj (Phases 1-6: source discovery, schema + config, extractor, seeder + dispatcher, cross-reference enrichment, YAML cards + verify + tests + docs). Use a new manifest discriminator `kind: 'ntsb-report'` distinct from `kind: 'ntsb-alj'`. URI grammar: `airboss-ref:ntsb/<NTSB-ID>` per ADR 019 §1.2 (already provisioned). Mirror the per-corpus locator pattern (separate `libs/sources/src/ntsb-report/`) so the manifest validator, section-tree adapter, and resolver stay aligned with the per-corpus discipline used by WP-NTSB-ALJ.

References:

- [spec.md](./spec.md) -- Out of scope line 4
- [library-completeness/spec.md](../library-completeness/spec.md) -- NTSB row in the catalog table + the "NTSB has its own data model" note
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §1.2 (NTSB per-report URI provisioning)
- `course/references/ntsb.yaml` -- header comment forecasting per-report rows landing via a later phase
