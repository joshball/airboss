---
id: wp-mtn-section-tree
title: WP-MTN -- promote Tips on Mountain Flying to section-tree
product: course
category: content
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - mtn
  - handbook
  - section-tree
legacy_fields:
  feature: wp-mtn-section-tree
  type: spec
  review_status: done
  shipped: 2026-05-03
---

# WP-MTN-section-tree -- Tips on Mountain Flying

Sequence position 1 in [whole-doc-promotion/research.md](../whole-doc-promotion/research.md). The smallest of the five whole-doc handbooks gets promoted to a section-tree manifest by parsing the existing hand-curated body override (`scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md`) into chapter / section rows. Pure markdown-to-manifest mapping: no Python, no PDF re-extraction, no LLM.

## Goal

`/library` shows the Tips on Mountain Flying card with a chapter drill-down (12 chapters with subsections) instead of a single flat body. The reference id `airboss-ref:handbooks/tips-mountain-flying/mtn-2003` keeps resolving (whole-doc URL still readable as the chapter overview), AND new ids resolve at chapter / section depth (`.../tips-mountain-flying/mtn-2003/3`, `.../mtn-2003/3/2`).

## Source

- Hand-curated override: `scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md` (12 `##` chapter headings, ~24 `###` section headings, ~3,500 lines of prose).
- Cache PDF: `~/Documents/airboss-handbook-cache/handbooks/faa-mtn-tips/faa-mtn-tips.pdf` (18 pages, OCR unusable -- the override exists because of this).
- YAML row: `scripts/sources/config/handbooks-extras.yaml` entry `doc_id: faa-mtn-tips` carrying `body_override` pointer + `subjects: [performance, weather, emergencies]` + `primary_cert: null`.
- DB row: 1 `study.reference` row already seeded as whole-doc by the post-WP-SUB seeder (`document_slug: tips-mountain-flying`, `edition: mtn-2003`, `kind: handbook`).

## Decisions (taken at WP author time)

### D1. Manifest shape: existing `kind: 'handbook'` (section-tree)

mtn-tips becomes a Class C section-tree handbook in the same shape as AVWX. The depth-3 schema (`chapter` / `section` / `subsection`) is reused unchanged; mtn-tips only populates depth 1 and 2 (no `### ###` -> subsection in the override). No new schema discriminator. The existing `sectionTreeManifestSchema` from `libs/bc/study/src/manifest-validation.ts` validates the new manifest verbatim.

Rejected: a new "section-tree-from-override" schema. The existing one already works; differentiating buys nothing.

### D2. Stay in `handbooks-extras` corpus, do NOT migrate to `handbooks/<slug>.yaml`

The `body_override` mechanism is the cleanest path. The handbooks/ YAML config (`avwx.yaml`, `phak.yaml`, `afh.yaml`) drives the **Python** ingest pipeline (`tools/handbook-ingest/`); that pipeline exists to extract markdown from PDFs. mtn-tips bypasses the PDF entirely (OCR is unusable, hence the override). Moving the row to `handbooks/<slug>.yaml` would require either (a) extending the Python pipeline to honour `body_override` (a feature with one consumer), or (b) leaving mtn-tips in a "config row exists but Python pipeline does nothing" state -- a stub.

Instead, the existing TS ingest at `libs/sources/src/handbooks-extras/ingest.ts` -- which already reads `body_override` -- gains a section-tree branch. When the override markdown contains `##` headings, the ingest parses them into a chapter / section tree, splits the body into per-chapter (and per-section) markdown files, and emits a `kind: 'handbook'` manifest. When it does not (the other 4 handbooks-extras rows), the existing whole-doc behaviour is preserved.

This keeps the change small (one TS module + tests, no Python) and the corpus stable. The `handbooks-extras` retirement question (raised in the research doc's "Cross-cutting findings") is for the four bigger WPs (RMH/AIH/IFH/IPH); mtn-tips contributes nothing to that retirement either way -- the override-driven section-tree path is reusable later if any future scanned-pamphlet handbook lands.

### D3. Section detection: H1 = doc title, H2 = chapter, H3 = section

The override markdown's heading hierarchy maps directly:

| Heading        | Manifest level | Code shape | Notes                                                     |
| -------------- | -------------- | ---------- | --------------------------------------------------------- |
| `#` (line 1)  | document title | -          | Used as `manifest.title`. One per file (validated).       |
| `##`          | chapter        | `N`        | 1-indexed by appearance order; e.g. `1`, `2`, ..., `12`. |
| `###`         | section        | `N.M`      | 1-indexed within parent chapter.                          |
| `####` and below | not allowed | -        | Override has none today; reject if encountered to keep the parser strict. |

Chapter / section ordinals are derived from appearance order (1-indexed). `parent_code` for chapters is `null`; for sections it's the chapter's code (e.g. `"3"`). FAA-printed page numbers are unavailable for this 1999 pamphlet (no page numbers on the source PDF body); `faa_page_start` and `faa_page_end` are `null` (the section-tree schema explicitly allows nullable). `source_locator` is `"MTN-2003 Ch.{code}"`.

Chapters with no subsections (Foreword, Preface, Density Altitude is split into sections, etc.) carry their body in a `00-<chapter-slug>.md` overview file. Chapters with subsections carry the prose between `##` and the first `###` in the same `00-<chapter-slug>.md` overview, plus per-section markdowns.

### D4. Derivative tree shape

Per the rename-generic-content-files WP convention: per-chapter directories with self-describing filenames (no `index.md` or `document.md`). The pre-existing single-body file (`tips-mountain-flying-MTN-2003.md`) is replaced.

```text
handbooks/tips-mountain-flying/MTN-2003/
  manifest.json                                 (kind: 'handbook' section-tree)
  01-foreword/
    00-foreword.md                              (chapter overview body)
  02-preface/
    00-preface.md
  03-introduction/
    00-introduction.md                          (lead-in prose between ## and first ###)
    01-safety-window.md                         (### Safety Window)
    02-what-is-mountain-flying.md
    03-pilot-requirements.md
    04-aircraft-requirements.md
  04-weather-requirements/
    00-weather-requirements.md
    01-ceiling-requirements.md
    02-visibility-requirements.md
    03-winds.md
    04-ifr-and-night-mountain-flights.md
  ... (8 more chapters)
```

The chapter directory name is `<NN>-<chapter-slug>` (zero-padded). The chapter overview filename is `00-<chapter-slug>.md` (matches AVWX convention). Per-section filenames are `<NN>-<section-slug>.md`. Slug = lowercase, ASCII, hyphen-separated, stripped of punctuation -- same shape PHAK/AFH/AVWX use.

### D5. Subjects and primary_cert flow through unchanged

The YAML row already carries `subjects: [performance, weather, emergencies]` + `primary_cert: null`. The TS ingest copies these into the produced manifest verbatim (existing behaviour). The seeder picks them up via `seedSectionTreeManifest` (same as AVWX).

### D6. Derivative cleanup is in scope

The pre-existing `handbooks/tips-mountain-flying/MTN-2003/tips-mountain-flying-MTN-2003.md` whole-doc file is removed during the migration. The seeder is idempotent; old `reference_section` rows for the whole-doc shape (depth 0, level `'document'`) are replaced by the new chapter / section rows on the next `db reset --force && db seed`.

## Out of scope

- Other whole-doc handbooks (RMH, AIH, IFH, IPH) -- separate WPs per the research doc sequencing. This WP touches only the mtn-tips entry and only the TS ingest path.
- Retiring the `handbooks-extras` corpus -- decision deferred to the larger handbook WPs (RMH ships first, sets the migration pattern). After all five whole-doc handbooks promote, that question can be answered with concrete data.
- The `handbooks-extras` `--whole-doc` ingest path stays. Four other rows still depend on it; rip-and-replace is for the per-handbook promotion WPs that retire those rows.
- Citation-resolution changes. The `handbooks` resolver already short-circuits to `manifest.body_path` for whole-doc references and falls back to `manifestSectionForLocator` for sectioned references; both paths work without modification.
- New hangar admin UI, no new study reader UI -- the existing `/library/handbook/{slug}/{edition}/{chapter}/...` route already renders any section-tree handbook.

## Non-goals

- No new schema field; no new manifest discriminator.
- No Python work.
- No PDF re-extraction.
- No new YAML config; no migration to `handbooks/<slug>.yaml`.

## Dependencies

- `libs/bc/study/src/manifest-validation.ts` `sectionTreeManifestSchema` (unchanged; pre-existing).
- `libs/bc/study/src/seeders/section-tree.ts` (unchanged; already dispatches on `kind: 'handbook'`).
- `scripts/db/seed-references-from-manifest.ts` (unchanged; dispatcher already routes to `seedSectionTreeManifest`).
- `libs/sources/src/handbooks/resolver.ts` HANDBOOK_DOC_EDITIONS (unchanged; mtn-tips already registered).
- `libs/sources/src/handbooks-extras/ingest.ts` (extends -- the section-tree branch lands here).

## Risks and mitigations

- **Manifest schema mismatch.** The `sectionTreeManifestSchema` requires non-null subjects (1-3) and either present-or-null `primary_cert`. The YAML already carries these; the ingest passes them through. Test: round-trip the produced manifest through `sectionTreeManifestSchema.safeParse` in the unit suite.
- **Body override shape regression.** The four other handbooks-extras rows have no `body_override`, OR (none today, but possible) a flat one without `##` headings. The new branch must trigger only when `body_override` is set AND the parser sees at least one `##` heading; otherwise fall through to existing whole-doc behaviour. Test: a fixture with `body_override` carrying only prose (no headings) seeds as whole-doc unchanged.
- **Idempotent re-run.** Running `bun run sources register handbooks-extras` twice on the same input must produce byte-equal manifest + body files (`writeIfChanged` guards the write). Test: running twice in a row asserts no `mtime` bump.
- **Old whole-doc file lingering.** The pre-existing `tips-mountain-flying-MTN-2003.md` would otherwise sit alongside the new per-chapter markdowns, confusing the reader. The ingest removes the old single-body file when promoting to section-tree (when the same handbook last produced whole-doc output). Test: stale file is cleaned up.

## Acceptance

After `bun run db reset --force && bun run db seed`:

- `study.reference` has one row for `(document_slug='tips-mountain-flying', edition='mtn-2003')` with `kind='handbook'`, `subjects=[performance, weather, emergencies]`, `primary_cert=null`.
- `study.reference_section` has > 1 row for that reference (1 chapter row per chapter + section rows where they exist). Chapter rows have empty `content_md` (overview lives on the `00-<chapter-slug>.md` body which is the chapter overview row); section rows carry their body. (Whichever shape AVWX uses for chapter-overview content is what we use here -- consistent with the existing pattern.)
- `getReadableReferenceIds([mtn-tips-id])` returns the id (chapter rows or sections carry `content_md <> ''`).
- `/library` shows the mtn-tips card with a "Read in-app" badge and chapter drill-down.
- `find handbooks/tips-mountain-flying -name '*.md'` returns per-chapter (and per-section) files, no single flat body.
- The single `handbooks/tips-mountain-flying/MTN-2003/manifest.json` carries `kind: 'handbook'` + non-empty `sections[]`.
- `bun run check` passes (0 errors, 0 warnings).
- `bun test libs/sources/src/handbooks-extras/` and `bun test libs/bc/study/src/seeders/` are green.

## References

- [research.md (whole-doc-promotion)](../whole-doc-promotion/research.md) -- this WP's parent research; mtn-tips section is the deliverable
- [AVWX YAML](../../../scripts/sources/config/handbooks/avwx.yaml) -- Class C section-tree precedent (PDF-driven)
- [handbooks-extras ingest](../../../libs/sources/src/handbooks-extras/ingest.ts) -- the module being extended
- [section-tree seeder](../../../libs/bc/study/src/seeders/section-tree.ts) -- consumes the produced manifest
- [manifest-validation](../../../libs/bc/study/src/manifest-validation.ts) -- the `sectionTreeManifestSchema` mtn-tips validates against
- [REFERENCES.md](../../platform/REFERENCES.md) -- mtn-tips row flips to "✅ readable, section-tree" on merge
