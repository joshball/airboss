---
id: wp-safo-info
title: "Spec: WP-SAFO-INFO -- pipelines for FAA Safety Alerts For Operators + Information For Operators"
product: course
category: content
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - safo
  - info
  - advisory
legacy_fields:
  feature: wp-safo-info
  type: spec
  review_status: pending
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# WP-SAFO-INFO: combined pipeline for SAFOs and InFOs

Build the source-config + downloader + extractor + section-tree seeder for two FAA corpora that share an identical pipeline shape: SAFOs (Safety Alerts For Operators) and InFOs (Information For Operators).

Combined into one WP because the publishing pattern, doc shape, and ingestion strategy are identical; the only differences are the URL and the corpus slug.

## Estimated scope

- **SAFOs**: ~30-50 currently active SAFOs the FAA publishes
- **InFOs**: ~20-30 currently active InFOs

Per [library-completeness/spec.md §4.C/4.D](../library-completeness/spec.md), DRS-first (FAA Document Reading System / Dynamic Regulatory System) per ratification, with `canonical_url_override` field for stable URLs.

## Pipeline shape

Each SAFO/InFO is:

- 1-3 page document
- Single PDF
- No chapters, no sections — flat body
- Structured frontmatter: SAFO/InFO number, date, subject, target audience

This is **not** section-tree. It's whole-doc. But per the user's "no whole-docs" direction (2026-05-03), even short docs become section-tree where there's any structure at all (headings).

**Likely shape:**

- Document (depth 0): SAFO 23001 / InFO 23001
- Section (depth 1): each top-level heading inside the doc (Discussion, Recommended Actions, Background, etc.)

If a SAFO/InFO has no internal headings, it stays single-section under depth-0 wrapper. That's still section-tree shape (`reference_section` rows exist with content_md), just a flat tree.

## Corpora distinct or combined?

Two paths:

- (a) `kind: 'safo'` + `kind: 'info'` discriminators, two separate seeders (cleanest separation)
- (b) Single `kind: 'fsdo-bulletin'` discriminator with a `bulletin_type: 'safo' | 'info'` field; one seeder

**Recommendation: (a)**. They're separate FAA programs with separate URL spaces; pretending they're one corpus complicates citation URIs.

## Phases

### Phase 1: Source config

Create:

- `scripts/sources/config/safo.yaml` — list of SAFOs with URL pattern
- `scripts/sources/config/info.yaml` — same for InFOs
- Schemas in `scripts/sources/config/schemas.ts`
- Loader functions

Initial corpus: top 5-10 most-cited per ATC/CFI training material. Don't try to ingest all 30-50 in v1.

### Phase 2: Downloader + extractor

Per-doc:

- Download the PDF
- Extract via pdftotext
- Parse heading structure (any `H1`-equivalent in the body)
- Emit a manifest with `kind: 'safo'` (or 'info')

### Phase 3: Schema discriminators + seeders

In `libs/bc/study/src/manifest-validation.ts`:

```ts
export const safoManifestSchema = baseManifestSchema.extend({
  kind: z.literal('safo'),
  number: z.string(),  // "23001"
  publication_date: z.string(),
  subject: z.string(),
  audience: z.string().optional(),
  body_path: z.string().refine(noGenericFilenames, ...),
  // section-tree of internal headings
  sections: z.array(safoSectionSchema),
});
```

Mirror for InFO.

Two seeder files: `libs/bc/study/src/seeders/safo.ts`, `libs/bc/study/src/seeders/info.ts`. Both walk `entries[]` similar to the AIM/CFR adapters.

### Phase 4: Dispatcher

Add two cases to `scripts/db/seed-references-from-manifest.ts`. Add `'safo'` and `'info'` to `CORPUS_DIRS`.

### Phase 5: YAML cards

Author `course/references/safos.yaml` and `course/references/infos.yaml` with one row per SAFO/InFO ingested.

### Phase 6: Verify + tests

`bun run db reset --force && bun run db seed`. /library shows new SAFO/InFO cards as readable.

### Phase 7: Doc updates

REFERENCES.md, status.md.

## Estimated effort

Bigger than WP-AC-V or WP-ACS-V because two distinct corpora + their downloaders need to be built. Roughly: 2x the WP-AC effort, since each new corpus is a full pipeline.

## Out of scope

- Auto-discovery of new SAFOs/InFOs via FAA RSS feeds (separate WP)
- Historical SAFOs/InFOs older than ~5 years
- Cross-references between SAFOs and ACs (citation work, separate concern)

## Anchors

- [library-completeness §4.C, §4.D](../library-completeness/spec.md)
- [PR #491 WP-CFR](https://github.com/joshball/airboss/pull/491) — section-tree adapter pattern (closest precedent)
- [PR #501 WP-ACS-V](https://github.com/joshball/airboss/pull/501) — `SINGLE_DOC_KEY_BY_CHILD` dispatcher pattern (per-publication-as-its-own-reference)
