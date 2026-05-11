---
title: 'Out of Scope: WP-CC -- FAA Chief Counsel legal interpretations'
product: course
feature: wp-cc
type: out-of-scope
status: unread
---

# Out of Scope: WP-CC -- FAA Chief Counsel legal interpretations

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out of scope" section of [spec.md](./spec.md) plus the v1-registry-only framing in the spec preamble. WP-CC v1 shipped a registry-only corpus (~17 most-cited interpretations + the existing NTSB Lobeiko Board order) through `seedInterpFromManifest`; the full pipeline (Phases 1-7 in the spec body) is deferred.

## Summary

| Item                                              | Status   | Trigger to revisit                                                                                |
| ------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Full pipeline (extractor + rendered bodies)       | Deferred | When citations / knowledge nodes need to deep-link into interpretation body sections              |
| Cross-reference UI surfacing                      | Deferred | When stage-5 citation system surfaces reverse-citation panels for non-handbook corpora            |
| Automated new-opinion ingestion (FAA AGC scraper) | Deferred | When the registry-only set is exhausted and on-demand additions become a recurring authoring need |
| Search UI inside the CC corpus                    | Deferred | When the flightbag search surface lands and can absorb a per-corpus search lens                   |

## Full pipeline (extractor + rendered bodies)

Status: Deferred

What was deferred:
The full Phases 1-7 build described in the spec body -- per-opinion PDF/HTML download, structured extraction (Background / Question Presented / Discussion / Conclusion as depth-1 sections), per-opinion body markdown derivatives, a dedicated render route, and the `libs/bc/study/src/seeders/cc.ts` adapter that lays down `reference_section` rows. The v1 ship landed only the registry (canonical short cites + the AGC interpretations index landing URL) via `seedInterpFromManifest` in `libs/sources/src/interp/`.

Why:
The v1 framing in the spec preamble: legal interpretations cite into specific CFR sections, and the highest-leverage v1 outcome is "citations resolve to a canonical short cite that points the reader at the FAA's authoritative landing page." Per-opinion section trees only earn their cost once a learner needs to deep-link into a specific paragraph of a specific interpretation -- and at v1 ship time, no surface required that.

Trigger to revisit:
When citations or knowledge nodes need to deep-link into a section of a specific Chief Counsel interpretation (e.g. `cite('cc', 'walker-2017', 'Discussion')` rendering a chip that opens the Discussion section in-app). Concretely: when a knowledge node or course step writes a CC locator beyond the document-level slug and the renderer needs section rows to resolve it.

Implementation pattern when triggered:
Phases 1-7 in [spec.md](./spec.md) describe the full build. Mirror the WP-AC pipeline (`libs/sources/src/ac/` -- config, ingest, seed-mapping registry) for the schema + download config; mirror the section-tree manifest shape used by handbooks for the per-opinion section tree. The seeder lives at `libs/bc/study/src/seeders/cc.ts`; dispatcher case added to `scripts/db/seed-references-from-manifest.ts` per WP-CFR / WP-AC precedent.

References:

- [spec.md](./spec.md) -- preamble note on v1 (registry-only) ship and the Phases 1-7 design that remains deferred
- [ADR 019 §1.2](../../decisions/019-airboss-ref-uri-scheme/decision.md) -- `cc` URI provisioning
- [WP-AC spec.md](../wp-ac/spec.md) -- mirror pipeline for source discovery + ingest + seeder

## Cross-reference UI surfacing

Status: Deferred

What was deferred:
The reverse-citation panel that, on the rendered CFR section page (e.g. `/library/cfr/14/61/§61.51`), surfaces "Chief Counsel interpretations of this section" with a list of CC opinions whose `primary_cfr` matches. Spec Phase 5 (cross-reference enrichment) captures the data shape; the UI to surface it is the deferred piece.

Why:
Per the [spec.md](./spec.md) "Out of scope" line: "Cross-reference UI surfacing (depends on stage 5 / citation system maturity)." The citation BC's `cc` resolver and reverse-lookup machinery are pre-stage-5 work; until reverse-citation panels exist for any non-handbook corpus, building a CC-only variant is premature.

Trigger to revisit:
When stage-5 of the citation system lands reverse-citation panels for non-handbook corpora. Concretely: when the same component that surfaces "AC X interprets this section" or "InFO Y references this section" is ready to be extended with a `cc` filter row, do it then in one pass rather than per corpus.

Implementation pattern when triggered:
Follow the handbook reverse-citation panel pattern (the existing one that surfaces handbook references on a CFR section page). Add a `cc` filter row that queries the citation BC for opinions whose `primary_cfr` matches the rendered section. The `primary_cfr: '14 CFR §61.51'` field captured in the per-opinion manifest (per spec Phase 5) is the join key.

References:

- [spec.md](./spec.md) -- "Out of scope" line 1
- Spec Phase 5 -- the `primary_cfr` capture that backs this resolution
- The handbook reverse-citation panel (closest shipped pattern)

## Automated new-opinion ingestion (FAA AGC scraper)

Status: Deferred

What was deferred:
The Phase 1 (b) option from the spec: scrape the FAA AGC interpretations search results page, parse the list, download opportunistically. WP-CC v1 took option (a) -- manual curation of the ~17 most-cited opinions in a YAML.

Why:
Per the [spec.md](./spec.md) "Out of scope" line: "Automated new-opinion ingestion (future)." The FAA's interpretations search page is searchable but not paginated for batch download (per the spec's "Estimated scope" paragraph). Scraping is engineering-heavy and only earns its cost when manual curation can no longer keep up with citation needs.

Trigger to revisit:
When the manually-curated registry is exhausted and on-demand additions become a recurring authoring task -- i.e. when more than a small handful of newly-cited interpretations land in a quarter and the manual add-one-row-to-YAML cost outweighs the scraper build cost. Concretely: when authoring or knowledge-node work surfaces an unindexed interpretation more than a few times in a row, surface the scraper for a decision.

Implementation pattern when triggered:
Author a `scripts/sources/scrape-cc.ts` (or equivalent under `scripts/sources/`) that walks the AGC search page, parses the result list, and emits/updates `scripts/sources/config/cc.yaml`. Mirror the existing `scripts/sources/` download orchestration (per WP-AC, the same pattern used for downloading registered AC PDFs). The scraper output joins the existing manual-curation YAML, not a parallel file.

References:

- [spec.md](./spec.md) -- "Out of scope" line 2; Phase 1 option (b)
- [spec.md](./spec.md) "Estimated scope" -- explains why the FAA index is not batch-friendly
- `scripts/sources/` -- the closest shipped download orchestration pattern

## Search UI inside the CC corpus

Status: Deferred

What was deferred:
A per-corpus search UI that lets a reader query the CC opinions registry / bodies by keyword, requestor name, CFR section interpreted, or year. The v1 ship surfaces the registry via citation resolution only -- there's no `/library/cc?q=...` style entry point.

Why:
Per the [spec.md](./spec.md) "Out of scope" line: "Search UI inside the corpus (future, possibly fold into flightbag)." Per-corpus search UIs are expensive to author one-off; the flightbag app surface is the natural home for cross-corpus search.

Trigger to revisit:
When the flightbag search surface lands and can absorb a per-corpus search lens. Concretely: when flightbag's search component supports adding a `corpus: cc` filter or scope, fold CC search in then rather than build a parallel surface.

Implementation pattern when triggered:
Mirror whichever per-corpus search pattern flightbag standardises on -- likely a scoped filter on its global search component, not a CC-specific page. If the trigger fires before flightbag lands the cross-corpus pattern, do not build a CC-specific page; revisit the prerequisite first.

References:

- [spec.md](./spec.md) -- "Out of scope" line 3
- `apps/flightbag/` -- the planned home for cross-corpus search (per CLAUDE.md "Monorepo" section)
