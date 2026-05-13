# Whole-doc handbook promotion -- research

Pre-WP research notes for promoting the 5 remaining whole-doc-shape FAA handbooks to the section-tree shape used by PHAK, AFH, and AVWX. This doc captures per-handbook source availability, embedded outline state, and recommended extraction strategy. It is read-only research; no production code or ingest scripts were modified.

## Context

| Concept                     | Reference                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Cache layout                | [ADR 021](../../decisions/021-source-cache-flat-naming/decision.md)                                       |
| Storage policy              | [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md)                                 |
| Edition + errata policy     | [ADR 020](../../decisions/020-handbook-edition-and-amendment-policy.md)                                   |
| Chapter-source ingestion    | [ADR 022](../../decisions/022-chapter-source-ingestion/decision.md)                                       |
| Pipeline overview           | [docs/ingestion-pipeline/handbook-ingest-pipeline.md](../../ingestion-pipeline/handbook-ingest-pipeline.md) |
| Extraction strategies       | [docs/ingestion-pipeline/section-extraction-strategies.md](../../ingestion-pipeline/section-extraction-strategies.md) |
| Prompt flow (no-API-key)    | [docs/ingestion-pipeline/section-extraction-prompt-strategy.md](../../ingestion-pipeline/section-extraction-prompt-strategy.md) |
| Onboarding checklist        | [docs/ingestion-pipeline/handbook-onboarding-checklist.md](../../ingestion-pipeline/handbook-onboarding-checklist.md) |

The schema enforces three section levels (`chapter` / `section` / `subsection`); deeper PDF outlines must flatten. The current Class A handbooks live at `scripts/sources/config/handbooks/<slug>.yaml`; whole-doc Class C handbooks live as a row inside `scripts/sources/config/handbooks-extras.yaml` and are ingested by `libs/sources/src/handbooks-extras/ingest.ts` with `kind: 'whole-doc'` + `sections: []`.

## Recommendation summary

| Handbook                            | Embedded TOC?              | Chapter PDFs published?  | Class | Strategy                          | Effort | Blockers / notes                                    |
| ----------------------------------- | -------------------------- | ------------------------ | ----- | --------------------------------- | ------ | --------------------------------------------------- |
| RMH FAA-H-8083-2A                   | YES (166 entries, depth 4) | NO                       | C     | bookmark outline + toc            | small  | Embedded outline is rich; no TOC parser needed      |
| AIH FAA-H-8083-9                    | YES (551 entries, depth 5) | YES (`<NN>_aih_chapter_<N>.pdf`) | A2 | chapter PDFs + bookmark outline   | medium | Migrate from extras to `handbooks/` config          |
| IFH FAA-H-8083-15B                  | NO                         | NO                       | C     | toc parse (printed pp. ix-xv)     | medium | Hand-extracted TOC available; chapter 6/7 are split into Sections I/II |
| IPH FAA-H-8083-16B                  | NO (chapters only)         | YES (`FAA-H-8083-16B_Chapter_<N>.pdf` + Appendix_A/B + Glossary + TOC PDF) | A2 | chapter PDFs + separate-TOC parse | medium | Migrate to `handbooks/`; consume the separate `FAA-H-8083-16B_Table_of_Contents.pdf` for sections |
| Tips on Mountain Flying (MTN-2003)  | NO                         | NO                       | C     | hand-curated body_override -> manifest reshape | small  | 18-page scanned pamphlet; existing override already has `## Chapter` structure |

Sequencing (smallest first, most tooling reuse next):

1. **mtn-tips** -- one tiny doc, parse the existing override file into `sections[]`. Pure markdown-to-manifest mapping; no Python, no PDF, no LLM. Validates the "Class C body_override -> section-tree" path that may also be useful elsewhere later.
2. **RMH** -- richest embedded outline of the five, no chapter PDFs, no errata, no addenda. Single new `risk-management.yaml` under `handbooks/` with `outline_strategy: bookmark`, ingest it. First proof that a Class C whole-doc handbook can run the full chapter-aware pipeline.
3. **AIH** -- Class A2 with chapter PDFs and a 551-entry embedded outline. Stand up the YAML in the same shape AFH uses. Slightly bigger because chapter PDFs need downloader plumbing, but the outline does the work.
4. **IPH** -- Class A2 with chapter PDFs, but the embedded outline only carries chapter L1 entries (14 entries total). Real section structure must come from the separate `FAA-H-8083-16B_Table_of_Contents.pdf` (or the printed TOC at PDF pp. 12-16). YAML mirrors AFH, plus a TOC PDF anchor.
5. **IFH** -- Class C (no chapter PDFs), no embedded TOC at all. Either parse the printed TOC at PDF pp. ix-xv (with chapter 6/7 quirk), or use the prompt flow per chapter. IFH is the depth-3 stress test for the prompt-flow contract since the printed TOC has L4+ entries.

## RMH -- Risk Management Handbook (FAA-H-8083-2A)

| Field                | Value                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| doc_id               | `faa-h-8083-2`                                                                                         |
| Slug                 | `risk-management`                                                                                      |
| Edition              | `FAA-H-8083-2A` (2022)                                                                                 |
| Publisher index      | <https://www.faa.gov/regulationspolicies/handbooksmanuals/risk-management-handbook-faa-h-8083-2a> (note: no underscores in path) |
| Whole-doc PDF        | <https://www.faa.gov/sites/faa.gov/files/2022-06/risk_management_handbook_2A.pdf>                      |
| Per-chapter PDFs     | None                                                                                                   |
| Errata / addenda     | None on the FAA index                                                                                  |
| Cached PDF           | `~/Documents/airboss-handbook-cache/handbooks/faa-h-8083-2/faa-h-8083-2.pdf`                           |
| PDF page count       | 80                                                                                                     |
| Front-matter span    | PDF pp. 1-9 (cover, preface, intro, major enhancements, TOC)                                           |
| Chapter 1 starts at  | PDF p. 10 (printed page `1-1`)                                                                         |
| Embedded TOC         | YES, 166 entries, depths {1: 18, 2: 57, 3: 46, 4: 45}                                                  |
| Hand-extracted TOC   | `RiskMgmtHdbk-TOC.md` at repo root                                                                     |

### Embedded outline sample

L1 entries (18 total) cleanly cover preface, intro, major-enhancements, 8 chapters, an "Appendix Introduction" wrapper, 4 appendices A-D, glossary, and index. Sample first 12 entries:

```text
[1, 'Preface', 3]
[1, 'Introduction', 4]
[1, 'Major Enhancements', 5]
[1, 'Chapter 1:  Introduction to Risk Management', 10]
[2, 'Introduction', 10]
[2, 'Safety Management Systems in Aviation', 10]
[2, 'Accident Causality & Responsibility', 10]
[2, 'Risk Management Analysis Using the PAVE Checklist', 11]
[2, 'Chapter Summary', 12]
[1, 'Chapter 2:  Personal Minimums', 13]
[2, 'Introduction', 13]
[2, 'Personal Minimums', 13]
```

Depth-4 entries (45 of them) are the inner steps of multi-step procedures (e.g. "Step 1 -- Review Weather Flight Categories"). The schema caps at depth 3, so the ingest must flatten depth-4 -> depth-3 (existing AVWX/AFH behavior in `parse_outline` per the AVWX YAML comment about "Levels deeper than 3 (subsubsection) are dropped").

### Recommended strategy

`outline_strategy: bookmark`, `section_strategy: toc` (kept for symmetry; the bookmark tree is authoritative). Mirrors AVWX exactly. No prompt flow needed.

### Sequencing notes

Do RMH **second** (after mtn-tips). It is the smallest "real" handbook and validates the Class C migration path (handbooks-extras row -> `handbooks/<slug>.yaml`). Once RMH ships clean, AIH and IPH follow the same migration mechanics on a bigger scale.

### Migration shape

- Remove the `faa-h-8083-2` row from `scripts/sources/config/handbooks-extras.yaml`.
- Author `scripts/sources/config/handbooks/risk-management.yaml` modeled on `avwx.yaml` (Class C, bookmark outline, `whole_doc:` only).
- The downloader already writes `~/Documents/airboss-handbook-cache/handbooks/faa-h-8083-2/faa-h-8083-2.pdf` per ADR 021; the new YAML will point its `whole_doc.url` at the existing cache key.
- Remove the `risk-management` row from `handbooks/handbooks-extras-index.json`; the Class A handbooks register through `handbooks/handbooks-index.json` (or its equivalent) instead.
- Rebuild the inline derivative tree at `handbooks/risk-management/FAA-H-8083-2A/` -- replace the single `risk-management-8083-2A.md` body with the chapter directories + per-section markdowns + new `manifest.json` carrying `sections[]`.

## AIH -- Aviation Instructor's Handbook (FAA-H-8083-9)

| Field                | Value                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| doc_id               | `faa-h-8083-9`                                                                                                                   |
| Slug                 | `aviation-instructor`                                                                                                            |
| Edition              | FAA-H-8083-9 (2020). FAA's index page shows publication date 2020 with no revision letter.                                       |
| Publisher index      | <https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook>                              |
| Whole-doc PDF        | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook/aviation_instructors_handbook.pdf> |
| Per-chapter PDFs     | YES. Pattern: `<NN>_aih_chapter_<N>.pdf` for chapter 1..10. File-ordinal offset 2 (cover=00, ack=01, preface=02, ch1=03 ... ch10=12, appA=13, appB=14, appC=15, appD=16, glossary=17, index=18). |
| Errata / addenda     | None on the FAA index page                                                                                                        |
| Cached PDF           | `~/Documents/airboss-handbook-cache/handbooks/faa-h-8083-9/faa-h-8083-9.pdf`                                                      |
| PDF page count       | 228                                                                                                                              |
| Embedded TOC         | YES, 551 entries, depths {1: 18, 2: 155, 3: 246, 4: 129, 5: 3} -- richest outline of the five                                    |
| Hand-extracted TOC   | None needed (embedded outline carries everything)                                                                                |

### Source URL inventory (verified 2026-05-03)

- Whole-doc + per-segment PDFs (full list of `href`s on the index page):
  - `00_aih_cover.pdf`, `01_aih_acknowledgments.pdf`, `02_aih_preface.pdf`
  - `03_aih_chapter_1.pdf` ... `12_aih_chapter_10.pdf`
  - `13_aih_appendix_a.pdf`, `14_aih_appendix_b.pdf`, `15_aih_appendix_c.pdf`, `16_aih_appendix_d.pdf`
  - `17_aih_glossary.pdf`, `18_aih_index.pdf`
  - `aviation_instructors_handbook.pdf` (whole-doc)

### Embedded outline sample

L1 entries (18 total): Acknowledgments, Preface, 10 chapters, 4 appendices, Glossary, Index. Sample chapter-1 outline (51 entries from a single chapter):

```text
[1, 'Chapter 1: Risk Management and Single-Pilot Resource Management ', 5]
[2, 'Introduction ', 5]
[2, 'Defining Risk Management ', 6]
[3, 'Principles of Risk Management ', 7]
[4, 'Accept No Unnecessary Risk ', 7]
[4, 'Make Risk Decisions at the Appropriate Level ', 7]
[4, 'Accept Risk When Benefits Outweigh the Costs ', 7]
[4, 'Integrate Risk Management into Planning at All Levels ', 7]
...
[5, 'Internal Resources ', 28]
[5, 'External Resources ', 29]
[5, 'Workload Management ', 29]
```

3 depth-5 entries exist (Use of Resources subdivisions in chapter 1). Like RMH, the schema-driven flattener will collapse L4 and L5 -- worth a manual spot-check of those 132 entries before declaring done.

### Recommended strategy

Class A2: chapter PDFs + ancillaries. Author `scripts/sources/config/handbooks/aviation-instructor.yaml` mirroring `afh.yaml`:

- `chapter_pdfs.direct_pattern: https://.../aviation_instructors_handbook/{NN}_aih_chapter_{N}.pdf`
- `chapter_pdfs.chapter_count: 10`
- `chapter_pdfs.file_ordinal_offset: 2`
- `chapter_pdfs.ancillary` listing front (cover+ack+preface), 4 appendices, glossary, index
- `outline_strategy: bookmark` (the embedded outline is rich and clean)
- `section_strategy: toc`

### Sequencing notes

Do AIH **third**. It validates the Class A2 migration path (handbooks-extras row -> `handbooks/<slug>.yaml` plus per-chapter PDF download) at scale. The richer outline also exercises the L4/L5 -> L3 flattener.

## IFH -- Instrument Flying Handbook (FAA-H-8083-15B)

| Field                | Value                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| doc_id               | `faa-h-8083-15`                                                                                                                  |
| Slug                 | `ifh`                                                                                                                            |
| Edition              | `FAA-H-8083-15B` (2012)                                                                                                          |
| Publisher index      | None. The FAA aviation index lists IFH as a direct PDF link with three companion PDFs (errata, addendum, addendum B).            |
| Whole-doc PDF        | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf>                     |
| Per-chapter PDFs     | NO. Probed 6 plausible URL patterns; all 404                                                                                     |
| Errata               | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/ifh_errata.pdf> (12/21/2012, last revised 10/10/2014) |
| Addendum             | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/ifh_addendum.pdf> (4/10/2015)           |
| Addendum B           | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/ifh_addendum_b.pdf> (11/5/2019)         |
| Cached PDF           | `~/Documents/airboss-handbook-cache/handbooks/faa-h-8083-15/faa-h-8083-15.pdf`                                                   |
| PDF page count       | 371                                                                                                                              |
| Embedded TOC         | NO (`doc.get_toc()` returns 0 entries)                                                                                           |
| Printed TOC location | PDF pp. 12-18 (printed pages `ix..xv`)                                                                                           |
| Hand-extracted TOC   | `InstrumentFlyingHandbookToc.md` at repo root (668 lines)                                                                        |

### Structural quirks

- Chapters 6 and 7 each subdivide into "Section I" and "Section II" (analog vs glass-cockpit instrumentation), giving 13 chapter-level units across 11 numbered chapters. The hand-extracted TOC marks these as `Chapter 6, Section I` / `Chapter 6, Section II` / `Chapter 7, Section I` / `Chapter 7, Section II`. The schema's chapter level cannot represent this directly; either model the four as four chapters with their own ordinals (preserving the "6.I/6.II/7.I/7.II" split) or model the parent chapter once and demote sections to `section`. Need a decision before authoring the WP.
- The printed TOC has L4+ entries (e.g. `Pitch Control > Attitude Indicator > [actual instruments]` under `Straight-and-Level Flight`). Will flatten to L3.
- Chapter 1 starts at PDF p. 20 (printed page `1-1`). Front matter spans PDF pp. 1-19 (cover, notice, title, copyright, dedication, acknowledgments, preface, contents, list of figures).
- Three FAA-published amendment PDFs that map onto ADR 020's errata flow.

### TOC structural anchors

`grep -nE '^(Chapter|Appendix|Glossary|Index)' InstrumentFlyingHandbookToc.md`:

```text
Chapter 1, 2, 3, 4, 5
Chapter 6, Section I    Chapter 6, Section II
Chapter 7, Section I    Chapter 7, Section II
Chapter 8, 9, 10, 11
Appendix A    Clearance Shorthand
Appendix B    Instrument Training Lesson Guide
Glossary
Index
```

### Recommended strategy

The embedded outline is empty, so `bookmark` is unavailable. Two viable paths:

- **A. TOC parse** (`section_strategy: toc`). Configure `toc.page_start: 12`, `toc.page_end: 18`. PHAK uses this pattern. Risk: the printed TOC's L4 indentation does not represent real document hierarchy reliably (per `section-extraction-strategies.md` Pattern A: "TOC over-flattens, LLM nests correctly"); we'd ship a flat tree.
- **B. Prompt flow** (`section_strategy: prompt`). Slice the whole-doc PDF into 13 chapter-sized chunks (one per Section I / Section II split), feed each to the per-chapter prompt template, capture the JSON. Mirrors AVWX -- IFH is Class C just like AVWX. Set `prompt.chapter_text_max_chars` after measuring with `tools/handbook-ingest/measure_chapter_sizes.py`.

Recommendation: **start with B (prompt flow)**, with the hand-extracted TOC at `InstrumentFlyingHandbookToc.md` serving as a reviewer/sanity check via `--strategy compare`. IFH is the right depth-3 stress test for the prompt-flow contract because the printed TOC carries L4+ depth and the "Chapter 6, Section I/II" split forces a structural decision.

### Errata sequencing

Once the section tree lands, run the ADR 020 errata path for the three companion PDFs (ifh_errata, ifh_addendum, ifh_addendum_b) as separate amendments. Author the parser archetype after the Section I/II decision so the errata patches anchor on the right chapter shape. Capture the parser-archetype choice in the WP, do not defer.

### Sequencing notes

Do IFH **fifth** (last). It is the only one of the five with no embedded outline AND no chapter PDFs AND a non-trivial structural quirk. Run it after the easier handbooks have shaken out the migration mechanics.

## IPH -- Instrument Procedures Handbook (FAA-H-8083-16B)

| Field                | Value                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| doc_id               | `faa-h-8083-16`                                                                                                                  |
| Slug                 | `iph`                                                                                                                            |
| Edition              | `FAA-H-8083-16B` (Sept. 2017)                                                                                                    |
| Publisher index      | <https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook>                             |
| Whole-doc PDF        | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/FAA-H-8083-16B.pdf> |
| Per-chapter PDFs     | YES. 7 chapters: `FAA-H-8083-16B_Chapter_1.pdf` ... `FAA-H-8083-16B_Chapter_7.pdf` (sizes 9.8 MB / 5.7 MB / 3.2 MB / 12.1 MB / 6.6 MB / 1.6 MB / 1.0 MB) |
| Ancillaries          | Front_Cover, Front_Page, Summary_of_Changes (`FAA-H-8083-16B-3_Summary_of_Changes.pdf`), Table_of_Contents (`FAA-H-8083-16B_Table_of_Contents.pdf`, 5 pp.), Appendix_A, Appendix_B, Glossary -- all directly linked |
| Errata               | None on the FAA index                                                                                                            |
| Cached PDF           | `~/Documents/airboss-handbook-cache/handbooks/faa-h-8083-16/faa-h-8083-16.pdf`                                                   |
| PDF page count       | 312                                                                                                                              |
| Embedded TOC         | Partial (14 entries, depth 1 only -- chapters and appendices, no sections). Sample: `Chapter 1 - Departure Procedures` page 17, etc. |
| Printed TOC location | Whole-doc PDF pp. 12-16, OR the standalone `FAA-H-8083-16B_Table_of_Contents.pdf` (5 pages, identical content)                   |
| Hand-extracted TOC   | None needed (the standalone TOC PDF is parseable directly)                                                                       |

### Structural shape

- 7 chapters: Departure Procedures (1), En Route Operations (2), Arrivals (3), Approaches (4 -- by far the largest, 92 pages and 12 MB), Improvement Plans (5), Airborne Navigation Databases (6), Helicopter Instrument Procedures (7).
- 2 appendices: Emergency Procedures (A), Acronyms (B).
- Glossary present.

### Standalone TOC PDF check

Downloaded `FAA-H-8083-16B_Table_of_Contents.pdf` (5 pages); each page has ~80 blank lines preceding visible text but the visible text is fully usable. Section depth visible (e.g. for chapter 1: `Surface Movement Safety` -> `Airport Sketches and Diagrams` -> `Airport/Facility Directory (A/FD) section ...`). Chapter-1 sample:

```text
Chapter 1
Departure Procedures ............................................................. 1-1
Introduction ............................................................................... 1-1
Surface Movement Safety ...................................................... 1-2
Airport Sketches and Diagrams ....................................... 1-2
Airport/Facility Directory (A/FD) section of the Chart
    Supplement (CS) ............................................................... 1-2
...
```

Two potential parse shapes apply (per `section-extraction-strategies.md`'s `pattern: dotted_leader` vs `right_column`). Empirical leaning: dotted-leader.

### Per-chapter PDF check

Pulled `FAA-H-8083-16B_Chapter_4.pdf`: 92 pages, 0 embedded outline entries. So per-chapter outlines must come from either (a) the standalone TOC PDF or (b) chapter-body content scanning + LLM. Option (a) is simpler.

### Recommended strategy

Class A2: chapter PDFs + ancillaries. Author `scripts/sources/config/handbooks/iph.yaml` mirroring `afh.yaml`:

- `chapter_pdfs.direct_pattern: https://.../instrument_procedures_handbook/FAA-H-8083-16B_Chapter_{N}.pdf` (no zero-padding; `{N}` only).
- `chapter_pdfs.chapter_count: 7`
- `chapter_pdfs.file_ordinal_offset: 0` (the IPH naming uses chapter ordinal directly, no `{NN}` prefix in the filename).
- `chapter_pdfs.ancillary`: front (Front_Cover + Front_Page combined; or treat each separately), summary_of_changes, toc, appendix_a, appendix_b, glossary.
- `outline_strategy: content` (the chapter PDFs have no embedded outline; chapter-N derivative comes from the chapter PDF directly).
- `section_strategy: toc` with `toc.page_start` / `toc.page_end` pointing at the printed TOC pages in the whole-doc PDF (12-16), OR a new "external TOC PDF" pointer that targets the standalone `FAA-H-8083-16B_Table_of_Contents.pdf`.

The downloader's chapter-aware ancillary list already supports separately-distributed ancillaries (per AFH's pattern). Either approach works; pinning the printed TOC inside the whole-doc PDF keeps the parser surface flat (no new "external TOC PDF" config field needed).

### IPH chapter-pdfs URL pattern note

AFH's pattern uses zero-padded `{NN}` for the file-ordinal. IPH uses `Chapter_{N}` with no padding. The existing schema (`scripts/sources/config/schemas.ts`) supports `file_ordinal_offset` -- IPH wants offset `0` and the ordinal-only template `Chapter_{N}.pdf`, so the existing `direct_pattern` substitution should work as-is. Spot-check during WP authoring.

### Sequencing notes

Do IPH **fourth**. It builds on AIH's Class A2 migration mechanics with one extra step (consume the standalone TOC PDF for section depth). The "Approaches" chapter is the longest single chapter across all five handbooks, useful for measuring `prompt.chapter_text_max_chars` if we ever flip to prompt strategy.

## Tips on Mountain Flying (MTN-2003)

| Field                | Value                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| doc_id               | `faa-mtn-tips`                                                                                                     |
| Slug                 | `tips-mountain-flying`                                                                                             |
| Edition              | `MTN-2003` (locator slug `mtn-2003`; actual publication is dated 1999 / FAA-P-8740-60 / AFS-803)                  |
| Publisher index      | None. Listed on the master FAA aviation page as a direct PDF link                                                  |
| Whole-doc PDF        | <https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/tips_on_mountain_flying.pdf> |
| Per-chapter PDFs     | None                                                                                                               |
| Errata               | None                                                                                                               |
| Cached PDF           | `~/Documents/airboss-handbook-cache/handbooks/faa-mtn-tips/faa-mtn-tips.pdf`                                       |
| PDF page count       | 18                                                                                                                 |
| Embedded TOC         | NO                                                                                                                 |
| Printed TOC          | None (no TOC page in the document)                                                                                 |
| Hand-curated body    | `scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md` (already in place; OCR was unusable)            |

### Quirk: pre-existing body_override

The OCR output of this 1999 scanned pamphlet was unusable, so the existing pipeline reads a hand-curated markdown body via the `body_override` field in `handbooks-extras.yaml`. That file already carries `## Chapter`-style structure:

```text
## Foreword
## Preface
## Introduction
## Weather Requirements
## Weather Factors
## Density Altitude
## Planning A Cross-country Flight
## Operations During A Cross-country Flight
## Emergency Procedures
## The Pilots Operating Handbook
## Summary
## References
```

That's 12 H2 blocks (3 front-matter + 8 thematic chapters + 1 summary). Each H2 has multiple H3 subsections (e.g. `### Density Altitude`, `### Winds Aloft Reports`, etc.). The H2/H3 nesting maps cleanly onto chapter / section in the manifest.

### Recommended strategy

`hand-curated`. Concretely: extend the `handbooks-extras` ingest (or write a small new path used only by overrides) to:

1. Parse the body override's H2 + H3 structure into `sections[]` entries with `level: 'chapter' | 'section'`.
2. Split the body file into per-chapter and per-section markdowns under `handbooks/tips-mountain-flying/MTN-2003/<NN>-<chapter-slug>/...`.
3. Emit a `manifest.json` with non-empty `sections[]` and `kind: 'handbook'` (or `kind: 'whole-doc'` retained but with structured sections -- the WP needs to decide).

No Python, no PDF parse, no LLM. The parser is small and reusable for any future override-driven Class C handbook.

### Sequencing notes

Do mtn-tips **first**. It is the smallest doc, the structure is already authored by hand, and the new code path is a markdown parser plus a manifest writer. It exercises one part of the promotion question (manifest shape, derivative tree layout, registry/library reseed) without any of the PDF/outline complexity. If the markdown-override -> section-tree path proves clean, it can also handle any future scanned-pamphlet content where OCR fails.

## Cross-cutting findings

### URL patterns are unstable across handbooks

Five docs, five different URL shapes:

- RMH: `/sites/faa.gov/files/2022-06/risk_management_handbook_2A.pdf` (date-prefixed bucket)
- AIH: `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook/aviation_instructors_handbook.pdf`
- IFH: `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/FAA-H-8083-15B.pdf`
- IPH: `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook/FAA-H-8083-16B.pdf`
- mtn-tips: `/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/tips_on_mountain_flying.pdf`

Each whole-doc URL is already correct in `handbooks-extras.yaml` and verified-by-HEAD per the existing comments. No new URL discovery needed.

### Index-page URLs are also inconsistent

- RMH: `/regulationspolicies/handbooksmanuals/risk-management-handbook-faa-h-8083-2a` (no underscores anywhere -- uncommon shape)
- AIH: `/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook` (underscored, `aviation/` segment)
- IPH: `/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook` (underscored, `aviation/` segment)
- IFH and mtn-tips: no companion index page; only direct PDF links from the master `/regulations_policies/handbooks_manuals/aviation` index

### Class boundaries

After this WP lands, the inventory becomes:

- Class A1 (chapter PDFs only): PHAK
- Class A2 (chapter PDFs + ancillaries): AFH, AIH, IPH, helicopter, glider, balloon (and any sibling handbooks already at A2)
- Class C (whole-doc only): AVWX, RMH, IFH, mtn-tips

The whole-doc Class C set shrinks to AVWX + RMH + IFH + mtn-tips. AIH and IPH migrate from `handbooks-extras.yaml` to `handbooks/<slug>.yaml`. RMH and mtn-tips also migrate out of `handbooks-extras.yaml` (RMH because it deserves a real `<slug>.yaml`; mtn-tips because the override-driven section-tree path is cleaner expressed there too).

The `handbooks-extras` corpus row count drops from 5 today to 0 after this WP (assuming AMT stays deferred). At that point the entire `handbooks-extras` ingest module is dead -- worth flagging in the WP whether the module retires or becomes the canonical home for any future "whole-doc with no chapter PDFs" handbook the FAA publishes (seaplane, AMT). Hold the decision in the WP scope, do not silently drop.

### Schema-level depth flattening is the recurring risk

RMH (depth 4), AIH (depth 5), IFH printed TOC (depth 4+), and the prompt-flow contract all rely on the existing AVWX/AFH flattening behavior to collapse to chapter/section/subsection. The contract-v3 `section-extraction-strategies.md` already describes this for the prompt path; the bookmark/TOC paths flatten in `tools/handbook-ingest/ingest/parse_outline` (or equivalent) per the AVWX YAML comment ("Levels deeper than 3 (subsubsection) are dropped"). Spot-check the dropped entries during AIH ingest -- 132 L4 + 3 L5 entries are at risk of being silently lost, which is a known-issue we must not let slip past.

### "Chapter, Section I / Section II" is unique to IFH

None of the other four handbooks use this shape. The schema can model it as either four chapter-level units (6.I, 6.II, 7.I, 7.II) or as a chapter + first-level section. Decision belongs in the WP authoring step, not deferred.

### Embedded outline quality is bimodal

- Rich (RMH, AIH): authored cleanly by FAA editors; bookmark strategy works.
- Empty or chapter-only (IFH, IPH, mtn-tips): the FAA's authoring toolchain did not emit section-level bookmarks. Force back to printed TOC parse, separate TOC PDF, prompt flow, or hand curation.

There is no half-state -- a single check (`fitz.open(...).get_toc()` length) sorts each handbook into "outline is the answer" vs "outline is useless".

## Open questions for WP authoring

- **IFH chapter 6/7 split.** Model "Section I / Section II" as four chapters (preserving 6.I/6.II/7.I/7.II semantics in `code`) or as a chapter + first-level section? Recommend the former to keep `chapter` codes integer-prefixed and reserve `section` for true sub-divisions; needs a decision before authoring.
- **`handbooks-extras` corpus retirement.** After this WP, `handbooks-extras.yaml` is empty (excluding the deferred AMT rows). Do we retire the corpus + ingest module, or keep it warm as the "Class C" landing pad for any future whole-doc-only FAA handbook? Recommend retirement -- the `handbooks/<slug>.yaml` shape is general enough to support Class C (AVWX proves it). One-line answer.
- **mtn-tips registry parity.** It is "FAA-P-8740-60", not an FAA-H handbook. The current ingest already synthesizes `doc_id: faa-mtn-tips` and `edition: '2003'` for it. Does it stay in handbooks (treated as a handbook by all consumers) or migrate to a new "pamphlets" corpus? Recommend keeping it under handbooks for downstream simplicity unless there's a category mismatch that surfaces in /library or the citations resolver.
- **IFH errata + addenda.** Three FAA-published amendment PDFs (`ifh_errata.pdf`, `ifh_addendum.pdf`, `ifh_addendum_b.pdf`). ADR 020 covers the policy; the WP needs to decide which parser archetype each one maps onto (`additive-paragraph` like AFH MOSAIC, or `bullet-edits` like PHAK MOSAIC, or a new shape). Capture the answer at WP-spec time, do not defer past the section-tree promotion.
- **AIH revision letter.** FAA's master index lists AIH as 2020 with no revision letter; the cached manifest stores `faa_edition: null`. Is it the original 2020 release with no revision yet, or has FAA quietly published an amendment? Recommend a one-shot HEAD against the FAA index page during WP authoring to confirm.

## Source files referenced

- `scripts/sources/config/handbooks/avwx.yaml`
- `scripts/sources/config/handbooks/phak.yaml`
- `scripts/sources/config/handbooks/afh.yaml`
- `scripts/sources/config/handbooks-extras.yaml`
- `scripts/sources/config/handbooks-extras-overrides/faa-mtn-tips.md`
- `scripts/sources/config/schemas.ts`
- `libs/sources/src/handbooks-extras/ingest.ts`
- `libs/sources/src/handbooks/derivative-reader.ts`
- `tools/handbook-ingest/ingest/outline.py`
- `handbooks/handbooks-extras-index.json`
- `handbooks/risk-management/FAA-H-8083-2A/manifest.json` (current whole-doc shape)
- `handbooks/aviation-instructor/FAA-H-8083-9/manifest.json`
- `handbooks/ifh/FAA-H-8083-15B/manifest.json`
- `handbooks/iph/FAA-H-8083-16B/manifest.json`
- `handbooks/tips-mountain-flying/MTN-2003/manifest.json`
- `handbooks/avwx/FAA-H-8083-28B/manifest.json` (Class C section-tree precedent)
- `handbooks/phak/FAA-H-8083-25C/manifest.json` (Class A1 precedent)
- `RiskMgmtHdbk-TOC.md` (repo root, working artifact)
- `InstrumentFlyingHandbookToc.md` (repo root, working artifact)
- `AviationWeatherHandbook.md` (repo root, working artifact -- AVWX TOC for shape reference)
