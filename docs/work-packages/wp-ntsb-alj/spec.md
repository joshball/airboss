---
title: 'Spec: WP-NTSB-ALJ -- NTSB administrative law judge rulings'
product: study
feature: wp-ntsb-alj
type: spec
status: draft
review_status: pending
---

# WP-NTSB-ALJ: NTSB administrative law judge rulings

Build the corpus pipeline for NTSB administrative law judge (ALJ) rulings on FAA enforcement actions. Per library-completeness §4.A, these are the canonical record of how the NTSB interprets FAA regulations in adjudicative contexts.

## Estimated scope

~few hundred published rulings. The NTSB Office of Administrative Law Judges publishes orders, opinions, and remand decisions; archive is at the NTSB website but not all are public.

The current `course/references/ntsb.yaml` umbrella card stays as a citation fallback; this WP adds per-ruling rows on top.

## Pipeline shape

Each ruling is:

- Multi-page legal document (5-30 pages typical)
- Structured: case number, parties, hearing date, opinion text, holdings
- Cited by case number (e.g. "EA-5567", "WD-1234")
- References FAA orders being adjudicated

This is closer to NTSB accident reports than to FAA-published handbooks. **Different data model entirely.** Per library-completeness spec note "NTSB has its own data model (accident reports, recommendations, factual reports)".

## Per-ruling structure

Section-tree with legal-opinion shape:

- Document (depth 0): the ruling
- Section (depth 1): each major opinion section (Findings of Fact, Conclusions of Law, Order, etc.)

Plus structured metadata: case number, parties (FAA enforcement agent vs respondent), date, regulations adjudicated.

## Slug + identifier

`airboss-ref:ntsb-alj/<case-number>`. Example: `airboss-ref:ntsb-alj/ea-5567`.

The umbrella `airboss-ref:ntsb` (from `course/references/ntsb.yaml`) stays for citations that don't pin a specific case.

## Phases

### Phase 1: Source discovery

Two options matching CC:

- (a) Manual curation: list the most-cited rulings in YAML; add over time. Pragmatic.
- (b) Scrape NTSB-OALJ archive. Engineering-heavy and the archive is incomplete.

**Recommendation: (a) for v1.** Maybe 20-50 of the most pedagogically valuable rulings (the ones that show up in CFI training material and AC 91-79's-style accident analysis).

### Phase 2: Schema + config

`scripts/sources/config/ntsb-alj.yaml`. Schema discriminator `kind: 'ntsb-alj'`.

### Phase 3: Extractor

PDF or HTML. Section-tree from internal headings.

### Phase 4: Seeder + dispatcher

### Phase 5: Cross-reference enrichment

Each ALJ ruling adjudicates specific CFR sections and possibly cites the underlying enforcement order. Capture both:

- `primary_cfr: "14 CFR §91.13"` — the regulation adjudicated
- `enforcement_order: "FAA-2017-0123"` — the order being challenged

Stage 5 (cross-linking) concern; can defer.

### Phase 6: YAML cards + verify + tests + docs

## Estimated effort

Smaller than WP-CC because:

- Smaller initial corpus (manual curation of 20-50 high-leverage cases)
- Schema is simpler (no requestor/subject metadata needed; just case + parties)

But bigger than SAFO/InFO because rulings are longer prose and section parsing is non-trivial.

## Out of scope

- Cross-reference UI (stage 5)
- Automated new-ruling ingestion
- The umbrella `ntsb` card (stays as citation fallback)
- NTSB factual accident reports (separate, larger WP — different data model)

## Anchors

- [library-completeness §4.A](../library-completeness/spec.md)
- ADR 019 §1.2 (ntsb URI provisioning)
