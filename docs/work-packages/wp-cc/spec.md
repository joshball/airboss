---
id: wp-cc
title: "Spec: WP-CC -- FAA Office of Chief Counsel legal interpretations"
product: course
category: content
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - chief-counsel
  - legal
legacy_fields:
  feature: wp-cc
  type: spec
  review_status: pending
---

# WP-CC: FAA Chief Counsel legal interpretations

> **v1 (registry-only) shipped 2026-05-03.** The `libs/sources/src/interp/` umbrella corpus now carries ~17 most-cited Chief Counsel interpretations + the existing NTSB Lobeiko Board order, end-to-end via `seedInterpFromManifest` (seed-all phase 5a). Citation chips and knowledge-node references that resolve to `airboss-ref:interp/chief-counsel/<author>-<year>` now have canonical short cites and link out to the FAA AGC interpretations index page. **Full pipeline (rendered bodies, extractor, dedicated render route, source discovery automation) remains deferred** -- see the spec body below for the original full design and the phased rollout that v1 sidesteps.

Build the corpus pipeline for FAA Office of Chief Counsel published legal interpretations. Per library-completeness §4.B ratification, this is the highest pedagogical leverage of the new-corpus candidates: legal interpretations are how the FAA clarifies ambiguous regulations, and they're frequently cited in CFI training, accident analysis, and regulatory enforcement contexts.

## Estimated scope

~100-200 published opinions. The full archive at <https://www.faa.gov/about/office_org/headquarters_offices/agc/practice_areas/regulations/interpretations> is searchable but not paginated for batch download. Batch ingestion needs scraping.

## Pipeline shape

Each interpretation is:

- 2-10 page legal opinion in PDF or HTML
- Structured: subject, date, requestor, summary, full text, signed by an Assistant Chief Counsel
- Cited by name (e.g. "Walker–2017", "Miller–2010")
- Often cross-references CFR sections it interprets

## Per-opinion structure

Whole-doc with internal headings. Per the user's "no whole-docs" direction:

- Document (depth 0): the opinion
- Section (depth 1): each top-level heading (Background, Question Presented, Discussion, Conclusion)

Plus structured metadata: requestor, date, primary CFR section interpreted (very useful for cross-linking later).

## Slug + identifier

`airboss-ref:cc/<requestor-slug>-<year>` per ADR 019 §1.2 already provisions. Example: `airboss-ref:cc/walker-2017`.

## Phases

### Phase 1: Source discovery

The FAA does not publish a clean machine-readable index of interpretations. Two options:

- (a) Manual curation: list the 50-100 most-cited interpretations in a YAML; add over time as new ones are needed. Pragmatic.
- (b) Scrape the FAA search results page, parse the list, download opportunistically. Engineering-heavy.

**Recommendation: (a) for v1**, (b) as future automation.

### Phase 2: Schema + download config

`scripts/sources/config/cc.yaml`:

```yaml
entries:
  - slug: walker-2017
    year: 2017
    requestor: Walker
    subject: Pilot logging requirements...
    url: https://...
  - slug: miller-2010
    ...
```

Schema discriminator `kind: 'cc'` in `manifest-validation.ts`.

### Phase 3: Extractor

PDF or HTML; both accepted. Section-tree from internal headings.

### Phase 4: Seeder + dispatcher

`libs/bc/study/src/seeders/cc.ts`. Dispatcher case in `seed-references-from-manifest.ts`.

### Phase 5: Cross-reference enrichment

Each CC interpretation primarily interprets a specific CFR section. Capture this in the manifest (`primary_cfr: "14 CFR §61.51"`) so the citation system can cross-link bidirectionally: opening §61.51 shows "Walker–2017 interprets this section" as a related citation.

This may be a stage-5 (cross-linking) concern rather than this WP. Flag for a follow-up if so.

### Phase 6: YAML cards

Author `course/references/cc-interpretations.yaml`.

### Phase 7: Verify + tests + docs

## Estimated effort

Bigger than SAFO/InFO because:

- Source discovery is harder (no clean index)
- Per-opinion content is denser (legal prose; care needed in section parsing)
- Cross-reference enrichment adds complexity

Probably 2-3x WP-CFR effort.

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchors

- [library-completeness §4.B](../library-completeness/spec.md)
- ADR 019 §1.2 (cc URI provisioning)
