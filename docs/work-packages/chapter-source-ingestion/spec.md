---
title: 'Spec: Chapter source ingestion'
product: platform
feature: chapter-source-ingestion
type: spec
status: unread
review_status: pending
---

# Spec: Chapter source ingestion

Extends the source download/cache architecture (post-ADR 021) to fetch chapter-level assets when the FAA publishes them, additive to the existing whole-doc PDFs. Three publisher classes: chapter PDFs (PHAK, AFH, IPH, helicopter, glider, balloon, instructors), section HTML (AIM only), whole-doc only (AVWX, IFH, AMT, seaplane). Whole-doc PDFs are kept; chapter assets are layered on top. Includes per-corpus YAML config migration so the AC/ACS/AIM/regs URL inventory lives in config, not code, and a generated `docs/sources/INVENTORY.md` that lists every cached document with its source URL.

## Why this WP exists

The handbook section-extraction pipeline currently feeds chapter plaintext to an LLM. Plaintext is sliced from the whole-doc PDF by page range, then truncated at `chapter_text_max_chars: 60000` (set in `tools/handbook-ingest/ingest/config/phak.yaml`). 11 of 17 PHAK chapters hit the cap on the most recent run. The back half of those chapters (turbines, fuel, oxygen, anti-ice in ch 7; airport ops surface markings; aeromedical second half; etc.) is silently dropped before the LLM sees it.

Verified empirically:

- `wc -c` on every chapter sidecar: 11 chapters at ~60100-60400 chars (capped).
- Last 300 chars of ch 7's sidecar end mid-sentence in engine cooling.
- Grepping ch 7 sidecar for `Turbine Engines | Fuel Systems | Oxygen Systems | Pressurized Aircraft | Chapter Summary`: zero hits.

Raising the cap is the cheap fix. The right fix is **chapter-scoped inputs**, because:

- PHAK ch 7 alone is 18 MB as its own PDF (whole PHAK is 77 MB). No cap needed at chapter scope.
- Per-chapter SHAs let us re-extract one chapter without re-validating the whole document.
- Authoritative chapter boundaries (the FAA decides where ch 7 ends, not our PDF outline parser).
- AIM section HTML (~360 KB each) eliminates the PDF extraction layer entirely for that publication.

This is a **correctness fix**, not an optimization. The current pipeline produces incomplete section trees on most PHAK chapters. The contract-v2 redesign (separate work) cannot validate against complete data until this lands.

## Anchors

- [ADR 021 -- Source cache flat naming](../../decisions/021-source-cache-flat-naming/decision.md). The flat-naming layout this WP extends. ADR 022 is a deliverable here.
- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md). The three-tier rule (cache / inline derivative / generated). Cache tier grows; derivative + generated tiers untouched.
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md). Errata is 1:N per handbook. Already handled; this WP does not touch errata.
- [docs/work-packages/section-extraction-prompt-strategy/design.md](../section-extraction-prompt-strategy/design.md). The prompt-strategy pipeline that consumes chapter plaintext; this WP changes its input source for chapter-PDF handbooks.
- Concurrent WP `section-extraction-contract-v2` (separate agent). Edits the contract templates and `chapter_plaintext.py` truncation logic. Coordination notes in §Coordination below.

## Empirical inventory (2026-04-29)

Verified by `curl` against faa.gov on 2026-04-29. Each handbook's URL convention is different. **No cleverness** -- per-handbook URL pattern config in YAML.

### Class A -- chapter PDFs available

Class A is split into two sub-classes by ancillary distribution:

- **A1** -- chapter PDFs only, no separately-distributed ancillaries (front, glossary, index). PHAK is the sole A1 handbook empirically (verified 2026-04-29).
- **A2** -- chapter PDFs plus ancillaries (front matter, glossary, index, sometimes others) as separate downloads on the index page. AFH and likely all other Class A handbooks fall here.

The YAML schema admits both: `chapter_pdfs.ancillary` is an optional list, empty for A1, populated for A2.

| Handbook | Edition | Sub-class | Chapter count | Chapter PDF pattern | Index page | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| PHAK | FAA-H-8083-25C | A1 | 17 | `/sites/faa.gov/files/<NN>_phak_ch<N>.pdf` | `/regulations_policies/handbooks_manuals/aviation/phak` | **Two-hop scrape required.** Index lists per-chapter HTML pages; each chapter page contains one `.pdf` link. Verified empirically: PHAK does NOT publish front/toc/glossary/index as separate PDFs. The whole-doc bundles them. |
| AFH | FAA-H-8083-3C | A2 | 18 | `/sites/faa.gov/files/.../airplane_handbook/<NN>_afh_ch<N>.pdf` | `/regulations_policies/handbooks_manuals/aviation/airplane_handbook` | Direct from index. Ancillaries: front (01), glossary (20), index (21). |
| IPH | FAA-H-8083-16B | A2 | TBD | `/sites/faa.gov/files/.../instrument_procedures_handbook/FAA-H-8083-16B_Chapter_<N>.pdf` | `/regulations_policies/handbooks_manuals/aviation/instrument_procedures_handbook` | Direct. Ancillary count to verify at impl time. |
| Helicopter | FAA-H-8083-21 | A2 | TBD | `/sites/faa.gov/files/.../helicopter_flying_handbook/hfh_ch<NN>.pdf` | `/regulations_policies/handbooks_manuals/aviation/helicopter_flying_handbook` | Publisher pads chapter ordinal in URL. Direct. |
| Glider | FAA-H-8083-13 | A2 | TBD | `/regulations_policies/handbooks_manuals/aviation/glider_handbook/gfh_chapter_<N>.pdf` | `/regulations_policies/handbooks_manuals/aviation/glider_handbook` | Direct. |
| Balloon | FAA-H-8083-11B | A2 | TBD | `/regulations_policies/handbooks_manuals/aviation/Balloon_Flying_Handbook_FAA-H-8083-11B/bfh_chapter_<N>.pdf` | `/regulations_policies/handbooks_manuals/aviation/Balloon_Flying_Handbook` | Direct. |
| Instructors | FAA-H-8083-9B | A2 | TBD | `/sites/faa.gov/files/.../aviation_instructors_handbook/<NN>_aih_chapter_<N>.pdf` | `/regulations_policies/handbooks_manuals/aviation/aviation_instructors_handbook` | File-ordinal prefix. Direct. |

**A1 vs A2 implementation note:** the only difference is whether the YAML's `ancillary[]` list is empty. The download path is identical otherwise.

### Class B -- section HTML (AIM only)

AIM is published continuously (no formal edition cycle). Three-tier publisher layout, verified 2026-04-29:

- **Chapter HTML stubs** (`/air_traffic/publications/atpubs/aim_html/chap_<N>.html`, 11 of them): TOC-only. JS-collapsible section list with links. **NOT cached** -- derivative info; regenerable from sections.
- **Section HTML** (`/air_traffic/publications/atpubs/aim_html/chap<N>_section_<S>.html`): the content unit. ~360 KB each. Semantic `<h4 class="paragraph-title" id="<C>-<S>-<P>">` per FAA paragraph. **Cached.**
- **Appendix HTML** (`/air_traffic/publications/atpubs/aim_html/appendix_<N>.html`, 5 of them): single-file, 29-166 KB. **No semantic headings** -- content lives under `<main class="main-content usa-content">` as `<p>` and `<table>`. Appendix 3+4 are tables (acronyms, codes). **Cached.**

AIM section count per chapter (probed 2026-04-29):

Counts re-verified empirically 2026-04-29 by curl against each `chap_<N>.html` TOC stub during the implementation manual-test pass. The original WP-authoring probe had read the AIM site's master nav dropdown (which lists every paragraph across the whole AIM) and miscounted per-chapter section files. These are the real per-chapter section counts.

| Chapter | Sections | Notes |
| --- | --- | --- |
| 0. General Information | 1 | "Explanation of Changes" -- cached as `chap00_section_01.html`, source URL `chap0_info_eoc.html` (publisher's irregular form for ch0). |
| 1. Air Navigation | 2 | |
| 2. Aeronautical Lighting | 3 | |
| 3. Airspace | 5 | |
| 4. Air Traffic Control | 7 | |
| 5. Air Traffic Procedures | 6 | |
| 6. Emergency Procedures | 5 | |
| 7. Safety of Flight | 7 | |
| 8. Medical Facts for Pilots | 1 | Empirically verified: ch8 has one section with 8 paragraphs (8-1-1 through 8-1-8 covering fitness, altitude effects, hyperventilation, CO poisoning, illusions, aerobatic flight, judgment). Publisher's chapter structure puts all medical content under one section. |
| 9. Aeronautical Charts | 1 | |
| 10. Helicopter Operations | 2 | |
| 11. Unmanned Aircraft Systems | 8 | |

Total AIM cache: 48 section files + 5 appendix files + 1 bundled PDF = 54 cached items. Section counts re-verified by the URL verifier (§9) on every download run; mismatch = hard error pointing at config with copy-pasteable replacement value.

YAML representation:

```yaml
chapter_html:
  section_url_pattern: https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap{C}_section_{S}.html
  section_filename_pattern: chap{CC}_section_{SS}.html
  chapter_count: 12   # 0 through 11
  sections_per_chapter: [1, 2, 3, 5, 7, 6, 5, 7, 1, 1, 2, 8]   # indexed 0..11
  # Chapter 0 has an irregular source URL (chap0_info_eoc.html, not chap0_section_1.html).
  # The downloader treats this as a special-case URL override.
  chapter_0_section_url_override: https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap0_info_eoc.html
```

### Class C -- whole-doc only

| Handbook | URL | Notes |
| --- | --- | --- |
| AVWX FAA-H-8083-28B | `/sites/faa.gov/files/FAA-H-8083-28B.pdf` | PDF has internal TOC links; could be split client-side if needed. Not split server-side. |
| IFH FAA-H-8083-15 | (whole-doc only) | No chapter splits offered. |
| AMT (3 vols) | several `faa-h-8083-*.pdf` | Whole-doc each. |
| Seaplane FAA-H-8083-23 | `/seaplane_handbook/faa-h-8083-23-{1,2,3,4}.pdf` | Split into 4 sub-PDFs that are NOT chapter-aligned; treat as 4 whole-docs. |

Class C handbooks keep the existing page-range slicing pipeline.

## In Scope

1. **YAML config consolidation.** Move the hardcoded URL inventories from [scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts) (`AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS`, `AIM_PDF_URL`) into per-corpus YAML files. **Single source of truth:** all source-corpus YAML lives at `scripts/sources/config/`, organized as:

   ```text
   scripts/sources/config/
     ac.yaml                    # 12 ACs
     acs.yaml                   # 5 ACSs
     aim.yaml                   # bundled PDF + section/appendix HTML
     regs.yaml                  # ECFR base + per-title list
     handbooks/
       phak.yaml                # whole-doc + chapter PDFs (two-hop, no ancillaries)
       afh.yaml                 # whole-doc + chapter PDFs (direct, with ancillaries)
       iph.yaml
       avwx.yaml                # whole-doc only (Class C)
       helicopter.yaml
       glider.yaml
       balloon.yaml
       instructors.yaml
       (etc.)
   ```

   Existing `tools/handbook-ingest/ingest/config/<slug>.yaml` files migrate to `scripts/sources/config/handbooks/<slug>.yaml`. The Python loader at `tools/handbook-ingest/ingest/config_loader.py` is updated to read from the new location. The TS downloader reads from the same files. Both tools share one source of truth per handbook.

2. **Per-handbook YAML extension.** Handbook configs grow chapter-aware fields. **Always grab whatever the publisher offers** -- no `download_mode` flag. Field shape:

   ```yaml
   # PHAK example (A1: two-hop scrape, no ancillaries)
   slug: phak
   edition: FAA-H-8083-25C
   whole_doc:
     url: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/faa-h-8083-25c.pdf
     filename: FAA-H-8083-25C.pdf      # cache-side; matches ADR 021
   chapter_pdfs:
     # Two-hop: scrape index page for per-chapter HTML pages by ordinal-prefix-match,
     # then GET each chapter page and extract its single .pdf link.
     index_url: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak
     # Anchor-href pattern. {N} is the chapter ordinal (1..chapter_count).
     # The scraper matches `<a href="*chapter-{N}-*">` -- whatever follows the
     # ordinal is ignored. PHAK uses inconsistent kebab slugs (chapter-7-aircraft-systems,
     # chapter-1-introduction-flying with no "to") so prefix-match is more resilient
     # than maintaining a slug list in YAML.
     chapter_page_pattern: chapter-{N}-
     chapter_count: 17
     ancillary: []   # PHAK does not publish front/toc/glossary/index as separate PDFs
   ```

   ```yaml
   # AFH example (A2: direct pattern, with ancillaries)
   slug: afh
   edition: FAA-H-8083-3C
   whole_doc:
     url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/00_afh_full.pdf
     filename: FAA-H-8083-3C.pdf
   chapter_pdfs:
     direct_pattern: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/{NN}_afh_ch{N}.pdf
     chapter_count: 18
     # AFH file ordinal: front=01, ch1=02, ch2=03, ..., chN = N+1.
     file_ordinal_offset: 1
     ancillary:
       - kind: front
         url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/01_afh_front.pdf
       - kind: glossary
         url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/20_afh_glossary.pdf
       - kind: index
         url: https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/airplane_handbook/21_afh_index.pdf
   ```

   ```yaml
   # AVWX example (Class C, whole-doc only)
   slug: avwx
   edition: FAA-H-8083-28B
   whole_doc:
     url: https://www.faa.gov/sites/faa.gov/files/FAA-H-8083-28B.pdf
     filename: FAA-H-8083-28B.pdf
   # no chapter_pdfs key -- publisher offers no chapter assets
   excluded_assets: []  # optional; URL-pattern strings to NOT fetch even if discovered
   ```

   **`excluded_assets`** (optional, every config): list of URL-substring patterns the downloader skips even if the publisher serves them. Used when the FAA publishes something at a chapter URL that we explicitly don't want (a stale "Errata Latest" version that's superseded, an addendum that's already covered by the errata pipeline, etc.). Documented field; rarely used.

   ```yaml
   # AIM (HTML; sections + appendices, no chapter stubs cached)
   slug: aim
   continuous_edition: true   # no formal edition cycle
   whole_doc:
     url: https://www.faa.gov/air_traffic/publications/media/aim.pdf
     filename: aim.pdf
   chapter_html:
     section_url_pattern: https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap{C}_section_{S}.html
     section_filename_pattern: chap{CC}_section_{SS}.html   # zero-padded on disk
     chapter_count: 12   # ch0 (General Information) through ch11 (UAS)
     # Hardcoded section count per chapter; the URL verifier checks reality matches this.
     # Index 0 = ch0 (General Information / Explanation of Changes), index 11 = ch11.
     sections_per_chapter: [1, 2, 3, 5, 7, 6, 5, 7, 1, 1, 2, 8]
     # ch0 has an irregular publisher URL (chap0_info_eoc.html, not chap0_section_1.html).
     chapter_0_section_url_override: https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap0_info_eoc.html
   appendix_html:
     url_pattern: https://www.faa.gov/air_traffic/publications/atpubs/aim_html/appendix_{N}.html
     filename_pattern: appendix_{NN}.html
     appendix_count: 5
   ```

3. **Cache layout extension.** ADR 021 layout grows for chapter-PDF handbooks and AIM HTML. **Whole-doc PDFs are kept** (additive, not replacement):

   ```text
   handbooks/<slug>/<edition>/<edition>.pdf                           # whole-doc (kept)
   handbooks/<slug>/<edition>/<edition>-ch<NN>.pdf                    # chapter PDFs, zero-padded
   handbooks/<slug>/<edition>/<edition>-front.pdf                     # ancillary
   handbooks/<slug>/<edition>/<edition>-toc.pdf
   handbooks/<slug>/<edition>/<edition>-glossary.pdf
   handbooks/<slug>/<edition>/<edition>-index.pdf
   handbooks/<slug>/<edition>/<edition>-appendix-<a>.pdf              # if publisher splits
   handbooks/<slug>/<edition>/<edition>-errata-<id>.pdf               # already exists
   handbooks/<slug>/<edition>/manifest.json

   aim/aim.pdf                                                         # bundled (kept)
   aim/chap<CC>_section_<SS>.html                                      # 48 section files (ch0 + ch1-ch11)
   aim/appendix_<NN>.html                                              # 5 appendix files
   aim/manifest.json
   ```

   **Zero-padding rule:** chapter ordinals always two-digit (`ch01`, `ch07`, `ch10`). Sorts correctly without custom comparator. Same for AIM `chap{CC}_section_{SS}.html` -> `chap07_section_03.html`. Source URLs use the publisher's form (whatever they ship); cache filenames use the padded form.

4. **Manifest schema extension.** Per-handbook cache manifest (`HandbookCacheManifest` from #327) grows a `chapters[]` array and an `ancillary[]` array. AIM corpus manifest grows `sections[]` (chapter+section pairs) and `appendices[]`. Schema in §F.

5. **Two-hop scrape for PHAK.** New module `scripts/sources/download/scrape.ts`. Steps: GET index page; find anchor links matching the configured `chapter_page_pattern`; for each chapter page, GET it and extract the single `.pdf` link. Resolved chapter URLs cached in the manifest under `chapters[].source_url` so subsequent runs don't re-scrape unless the index page's `Last-Modified` advances. **Hard fail on individual chapter 404** -- one missing chapter breaks the section-extraction pipeline; do not silently skip.

6. **TS download path extension.** [scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts) reads the per-handbook YAML and emits one `DownloadPlan` per asset (whole-doc + each chapter + each ancillary). Existing `DownloadPlan` shape is sufficient; no new fields needed beyond what ADR 021 introduced. The plan builder branches on `chapter_pdfs.direct_pattern` vs `chapter_pdfs.index_url` (two-hop).

7. **HTML download path for AIM.** TS-side. Net-new code in [scripts/sources/download/](../../../scripts/sources/download/) that fetches HTML files (Content-Type `text/html` instead of `application/pdf`), records ETag + Last-Modified per file, writes to `aim/<filename>.html`. Same atomic write, same retry logic, same manifest update path as PDFs. **TS owns network I/O; Python owns extraction** (BeautifulSoup, in a follow-up step under `tools/handbook-ingest/`).

8. **Python ingest update.** [tools/handbook-ingest/ingest/fetch.py](../../../tools/handbook-ingest/ingest/fetch.py) and [tools/handbook-ingest/ingest/chapter_plaintext.py](../../../tools/handbook-ingest/ingest/chapter_plaintext.py): when chapter PDFs exist in the cache for a handbook, read each chapter's PDF directly (no page-range slicing). Sidecar plaintext is the chapter PDF's full text. **The 60K truncation cap does not apply** to chapter-PDF mode -- the chapter PDF IS the unit of input. Whole-doc handbooks (AVWX, IFH, AMT, seaplane) keep the page-range slicing path; cap removal is a separate WP (`section-extraction-contract-v2`).

   AIM HTML extraction: a new module `tools/handbook-ingest/ingest/aim_html_extract.py` that uses BeautifulSoup to parse cached section + appendix HTML files into the section-tree shape the rest of the pipeline expects. Section h4 tags (`<h4 class="paragraph-title" id="C-S-P">`) become section locators directly.

9. **URL verifier.** New command `bun run sources verify-urls`. Walks every YAML config, HEAD-checks every URL (whole-doc, chapter PDFs, AIM section/appendix HTML), reports 404s with structured remediation: which YAML field, which index page to consult. For two-hop handbooks, also re-runs the index scrape and compares against the cached resolved URLs. **Not in CI** (network dependency); operator action. Section-count mismatch (publisher added/removed sections to AIM) is a hard error here with copy-pasteable remediation:

   ```text
   ERROR: AIM chapter 4 section count mismatch
     YAML: scripts/sources/config/aim.yaml chapter_html.sections_per_chapter[4] = 14
     actual: 15 sections found at https://www.faa.gov/.../chap_4.html
     suggested edit (replace the array literal):
       sections_per_chapter: [1, 2, 3, 5, 8, 6, 5, 7, 1, 1, 2, 8]
   ```

   Same shape for 404s: which file, which field, what to set it to.

10. **Inventory document.** New command `bun run sources inventory`. Walks every YAML config, every cache manifest, emits `docs/sources/INVENTORY.md`. Per-corpus tables: doc name, edition, source URL, cache filename, SHA-256 prefix, last fetched. Regenerable, idempotent, committed. Format in §F.

    **SHA-256 prefix length: 12 hex chars** (= 6 bytes = 48 bits). Matches git's full-prefix convention. Plenty for human disambiguation in an inventory doc; not for adversarial collision resistance (which the inventory doesn't need -- it's a human-readable index, not a security artifact).

11. **ADR 022 -- Chapter-aware source ingestion.** Records the chapter/section-aware extension to ADR 021, the YAML config-not-code migration, the three publisher classes (chapter PDF / section HTML / whole-doc), and the inventory doc as a deliverable. ADR 021 receives no edits (immutable-once-approved); ADR 022 references it as the layout it extends.

12. **Migration script cleanup.** If `scripts/migrate-cache-flat.ts` is still present in the tree at WP start (it should have been deleted in #327's commit B but per the brief it's still there), delete it in this WP's first commit. Verify no references first.

13. **Verification gate.** `bun run check` clean. `bun test` for changed files passes. End-to-end: fresh cache + `bun run sources download phak` produces whole-doc + 17 chapter PDFs + ancillaries with manifest entries. `bun run sources extract handbooks phak --strategy prompt` produces per-chapter sidecars derived from chapter PDFs (not page-sliced from whole-doc); none are at the 60K cap; ch 7's sidecar contains "Turbine Engines", "Fuel Systems", "Oxygen Systems", "Pressurized Aircraft", "Chapter Summary".

## Out of Scope (explicit)

- **Section-extraction contract changes.** `section-extraction-contract-v2` WP, separate agent. Don't touch the contract template, the prompt template, the parameters file, or the JSON contract. Coordination details in §Coordination.
- **The 60K truncation cap removal for whole-doc handbooks.** Specific to AVWX/IFH/AMT/seaplane (the Class C handbooks). Stays in YAML; the contract-v2 WP raises it. Chapter-PDF mode bypasses the cap entirely (no value to set), which is sufficient for this WP's correctness goal.
- **TOC strategy improvements.** The deterministic Python TOC parser has known issues (over-flattening, 668 warnings). Separate work.
- **Errata.** ADR 020 / `apply_errata.py` already handle errata. No expansion of errata scope here.
- **DB schema.** No `handbook_section`, `reference`, or related table changes. Cache layout is invisible to the DB tier.
- **Inline derivative tree.** Committed `<repo>/handbooks/`, `<repo>/aim/`, etc. unchanged. Per-section markdown / figure PNGs / table HTML / derivative manifests stay as they are.
- **Edition rollover automation.** When the FAA cuts a new edition (PHAK 25C -> 25D), an operator updates the YAML by hand. Optional `bun run sources upcoming-edition <slug>` helper is a nice-to-have, not in scope here.
- **Chapter PDFs for AC/ACS.** ACs and ACSs are short single-doc publications. No chapter splits exist or are useful. Whole-doc only.
- **Class C handbooks (AVWX, IFH, AMT, seaplane) -- chapter splitting.** Whole-doc only per publisher; client-side splitting deferred.

## Empirical pitfall verification (2026-04-29)

| Pitfall | Finding | Implication |
| --- | --- | --- |
| Front matter dup in chapter PDFs | NONE for PHAK ch7. Chapter PDF starts directly at "Chapter 7 / Aircraft Systems / Introduction". No cover, no copyright, no acknowledgments. | Verify per-handbook before bulk enable; risk register entry. Probably true for all FAA chapter PDFs because they're sliced from the whole-doc by the same template. |
| Pagination drift | NONE. PHAK ch7 chapter PDF page 1 displays "7-1", last page "7-42". Whole-doc PHAK uses the same `<chapter>-<page>` chapter-local locators. Citations resolve identically in both PDFs. | The locator scheme is `<chapter>-<page>`, NOT PDF page index. Already how the existing pipeline works. |
| Figure numbering | Consistent. `Figure 7-12` in both chapter and whole-doc PDFs. Cross-references like `Figure 6-48` from ch7 work fine (it's a reference to ch6, present in both PDFs). | Citation system unchanged. |
| AIM HTML structure | Three-tier: chapter stubs (TOC, JS-collapsible, NOT cached), section HTML (`<h4 class="paragraph-title" id="C-S-P">`, cached), single-file appendices (no headings, content in `<main class="main-content usa-content">`, cached). | Cache only sections + appendices. BeautifulSoup parser uses `<h4 id>` for paragraph anchors, `<main>` for appendix content. |
| AIM section files carry chapter title | NO. Section HTML has only `<h4>` paragraph titles, no `<h1>` chapter title. | Manifest records chapter+section+title at extraction. Filename ordering = chapter+section ordering. |

## Naming and storage decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Whole-doc kept when chapters available? | YES, additive | Per-user direction. Whole-doc is the cross-chapter fallback; chapter PDFs are scoped inputs. |
| Download mode flag? | NO. Always grab everything available | Per-user direction. YAML lists what publisher offers; downloader fetches all. |
| AIM bundled PDF kept? | YES, alongside HTML | Per-user direction. Completeness; HTML is preferred for ingestion, PDF is archival. |
| AIM chapter TOC stubs cached? | NO | Derivative info per ADR 018 three-tier rule; section files are self-describing. |
| AIM appendices in v1? | YES | 30% of AIM content; deferring creates a known issue; appendix shape is single-file (verified empirically), no extra code path needed. |
| URL discovery: hardcode vs scrape? | Hardcode in YAML; sharp 404 error; periodic verifier | Determinism beats resilience; scraping doubles failure surface; FAA URL rotation is rare and operator-handleable. |
| HTML extraction: TS or Python? | TS network I/O, Python extraction (BeautifulSoup) | Consistent with existing pipeline ownership: TS owns download cache, Python owns section-extraction. |
| Chapter ordinal padding | Zero-padded to 2 digits (`ch01`, `ch07`) | Sorts correctly; no custom comparator. |
| YAML config location | `scripts/sources/config/` (single source of truth, both tools read from here) | One source of truth per logical entity beats single-tool-ownership-per-dir. Both TS downloader and Python ingest tool read these files. The brief's "config not code" rule applies at the source-of-truth level, not the tool-ownership level. Existing `tools/handbook-ingest/ingest/config/<slug>.yaml` files migrate to `scripts/sources/config/handbooks/<slug>.yaml` as part of this WP; the Python loader is updated to read from the new location. |
| ADR 021 amend or supersede? | NEW ADR 022 references 021 | Immutable-once-approved. ADR 021's flat naming is unchanged; 022 extends. |

## Acceptance criteria

- Every YAML config (handbooks + AC/ACS/AIM/regs) parses without error.
- `bun run sources download phak` against a fresh cache produces:
  - 1 whole-doc PDF (`FAA-H-8083-25C.pdf`)
  - 17 chapter PDFs (`FAA-H-8083-25C-ch01.pdf` through `FAA-H-8083-25C-ch17.pdf`)
  - 4 ancillary PDFs (front, toc, glossary, index) -- count adjusted to whatever PHAK publishes
  - 1 manifest with `primary` + `chapters[]` + `ancillary[]` + `errata[]` populated
- `bun run sources download afh` and `bun run sources download iph` produce equivalent shapes.
- `bun run sources download avwx` produces the whole-doc PDF only -- no chapter entries in the manifest.
- `bun run sources download aim` produces:
  - 1 bundled PDF (`aim.pdf`)
  - 48 section HTML files (per `sections_per_chapter` empirical counts; `chap00_section_01.html` for ch0 General Information through `chap11_section_08.html` for ch11 last section)
  - 5 appendix HTML files (`appendix_01.html` through `appendix_05.html`)
  - 1 corpus manifest with `primary` + `sections[]` + `appendices[]`
- `bun run sources download <any>` re-run against the post-download cache makes zero PDF/HTML body downloads. HEAD requests expected.
- `bun run sources verify-urls` reports zero 404s and the AIM section count matches `sections_per_chapter`.
- `bun run sources inventory` produces `docs/sources/INVENTORY.md`. Contents: per-corpus tables with doc name, edition, source URL, cache filename, SHA-256 (first 12 chars), last fetched. File is committed; regenerable.
- `bun run sources extract handbooks phak --strategy prompt`:
  - Produces 17 chapter sidecars derived from chapter PDFs.
  - None at the 60K cap (the cap does not apply to chapter-PDF mode).
  - Ch 7 sidecar contains the literal strings: `Turbine Engines`, `Fuel Systems`, `Oxygen Systems`, `Pressurized Aircraft`, `Chapter Summary`.
- `bun run check` clean.
- `bun test` for changed files passes.
- `scripts/migrate-cache-flat.ts` is not in the tree at PR merge.
- ADR 022 exists; ADR 021 has zero changes.

## Manual test plan

Per project rule, every feature is hand-tested before ship.

1. Inspect AC/ACS/AIM/regs YAML migration: open each new `scripts/sources/config/*.yaml`, confirm the URL inventory matches what was previously hardcoded in `plans.ts`.
2. Wipe `~/Documents/airboss-handbook-cache/handbooks/phak/`, run `bun run sources download phak`, walk the resulting tree -- 17 chapter PDFs, 4 ancillaries, 1 whole-doc, 1 manifest. Manifest's `chapters[]` ordered 1..17. Each `chapter[].source_url` resolved via two-hop scrape.
3. Re-run the same command -- expect zero downloads, all HEAD-cache hits.
4. Delete `FAA-H-8083-25C-ch07.pdf` from cache. Re-run -- expect exactly one download (ch7), all others HEAD hits.
5. Repeat 2-4 for `afh` (direct, no two-hop), `iph`, `helicopter`, `glider`, `balloon`, `instructors`.
6. Run `bun run sources download avwx` -- whole-doc only, no chapter entries. `bun run sources extract handbooks avwx --strategy prompt` -- still uses page-range slicing (Class C path), confirms 60K cap still applies for whole-doc handbooks.
7. Run `bun run sources download aim`. Walk `aim/`: 48 section files (per `sections_per_chapter`) + 5 appendix files + 1 PDF. Manifest's `sections[]` indexed by chapter+section pair. `chap07_section_03.html` content includes a known paragraph (`7-3-1. Effect of Cold Temperature`).
8. Run `bun run sources verify-urls` -- zero 404s.
9. Run `bun run sources inventory` -- emits `docs/sources/INVENTORY.md`. Open it, verify entries are sorted, every URL is clickable, SHA-256 prefixes are present.
10. Run `bun run sources extract handbooks phak --strategy prompt`. Verify ch 7 sidecar is full (no 60K cap), contains all 5 expected literal strings.
11. Re-run `bun run sources inventory` -- output is byte-identical to (9) (idempotent regeneration check).

## Detailed punch list

This is the file:line audit for review.

**File reference convention.** A single-line link (`file.ts#L42`) points at one statement. A range link (`file.ts#L42-L51`) points at a block where the whole block is being changed or deleted.

### A. YAML config migration (TS-tool-owned)

| Action | Path | Notes |
| --- | --- | --- |
| Create | `scripts/sources/config/ac.yaml` | Move all 12 entries from `AC_TARGETS` array in [plans.ts](../../../scripts/sources/download/plans.ts). Each entry: `{ doc_id, edition, url, filename }`. |
| Create | `scripts/sources/config/acs.yaml` | Move 5 entries from `ACS_TARGETS`. |
| Create | `scripts/sources/config/aim.yaml` | Move `AIM_PDF_URL` + new chapter HTML config (per §1 example above). |
| Create | `scripts/sources/config/regs.yaml` | eCFR base URL + per-title list (14, 49) + filtered parts. |
| Create | `scripts/sources/config/handbooks-extras.yaml` | Move 8 entries from `HANDBOOKS_EXTRAS_TARGETS`. |
| Create | `scripts/sources/config/loader.ts` | Reads YAMLs at runtime via `yaml` package; type-safe via Zod schema. |
| Edit | [scripts/sources/download/plans.ts:51-88](../../../scripts/sources/download/plans.ts#L51-L88) | Delete `AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS` arrays. `mkAc`, `mkAcs`, `mkHbk` helpers also delete (replaced by loader). |
| Edit | [scripts/sources/download/plans.ts:22](../../../scripts/sources/download/plans.ts#L22) | Delete `AIM_PDF_URL` constant. AIM URL comes from `aim.yaml`. |

### B. Per-handbook YAML schema extension

| Action | Path | Notes |
| --- | --- | --- |
| Edit | [tools/handbook-ingest/ingest/config/phak.yaml](../../../tools/handbook-ingest/ingest/config/phak.yaml) | Add `whole_doc`, `chapter_pdfs` (two-hop variant). |
| Edit | `tools/handbook-ingest/ingest/config/afh.yaml` | Add `whole_doc`, `chapter_pdfs` (direct variant). |
| Create | `tools/handbook-ingest/ingest/config/iph.yaml` | First IPH config; `chapter_pdfs.direct_pattern`. |
| Edit | `tools/handbook-ingest/ingest/config/avwx.yaml` | Add `whole_doc` only; no `chapter_pdfs` key. |
| Edit | `tools/handbook-ingest/ingest/config/aim.yaml` | Already exists at the corpus level (per §A); this row is the same file. AIM has both TS-tool config (URL inventory) AND Python-tool config (extraction params). Two files: `scripts/sources/config/aim.yaml` (download) and `tools/handbook-ingest/ingest/config/aim.yaml` (extraction). |
| Edit | [tools/handbook-ingest/ingest/config_loader.py](../../../tools/handbook-ingest/ingest/config_loader.py) | Add `WholeDoc` and `ChapterPdfs` dataclasses to `HandbookConfig`. |

### C. TS download path

| Action | Path | Notes |
| --- | --- | --- |
| Edit | [scripts/sources/download/plans.ts:126-168](../../../scripts/sources/download/plans.ts#L126-L168) | `buildPlans`: read YAML inventory via loader; for each handbook config, emit one plan per asset (whole-doc + each chapter + each ancillary). |
| Create | `scripts/sources/download/scrape.ts` | Two-hop URL resolver. `resolveChapterUrls(indexUrl, pagePattern, chapterCount): Promise<string[]>`. Used by PHAK + instructors. |
| Create | `scripts/sources/download/html-fetch.ts` | HTML download path for AIM. Same retry/atomic-write/manifest semantics as PDF. |
| Edit | [scripts/sources/download/manifest.ts](../../../scripts/sources/download/manifest.ts) | Extend `HandbookCacheManifest` with `chapters[]` + `ancillary[]`. Extend AIM corpus manifest with `sections[]` + `appendices[]`. Schema in §F. |
| Edit | [scripts/sources/download/execute.ts](../../../scripts/sources/download/execute.ts) | Branch on plan type: PDF vs HTML download path. |

### D. Python ingest

| Action | Path | Notes |
| --- | --- | --- |
| Edit | [tools/handbook-ingest/ingest/fetch.py](../../../tools/handbook-ingest/ingest/fetch.py) | When `chapter_pdfs` key is present in config and chapter PDFs exist in cache, return per-chapter PDF paths instead of whole-doc + page ranges. |
| Edit | [tools/handbook-ingest/ingest/chapter_plaintext.py](../../../tools/handbook-ingest/ingest/chapter_plaintext.py) | When chapter PDF mode is active for a handbook, sidecar = full chapter PDF text extraction (no truncation cap). Preserve page-range slicing path for whole-doc handbooks. |
| Create | `tools/handbook-ingest/ingest/aim_html_extract.py` | BeautifulSoup parser. Section files: walk `<h4 class="paragraph-title" id="C-S-P">` for paragraph tree. Appendix files: extract `<main class="main-content usa-content">` content. |
| Edit | [tools/handbook-ingest/ingest/cli.py](../../../tools/handbook-ingest/ingest/cli.py) | Add chapter-mode branch to download messaging. **Minimize narration string edits** -- prefer adding new branches to existing strings over rewriting (per coordination with `section-extraction-contract-v2` agent). |

### E. New CLI commands

| Action | Path | Notes |
| --- | --- | --- |
| Create | `scripts/sources/verify-urls.ts` | HEAD-checks every configured URL. Reports 404s with structured remediation. Re-runs two-hop scrape and compares to manifest. AIM section-count check. |
| Create | `scripts/sources/inventory.ts` | Walks every config + every cache manifest. Emits `docs/sources/INVENTORY.md`. Format in §F. |
| Edit | [scripts/sources.ts](../../../scripts/sources.ts) | Register `verify-urls` and `inventory` subcommands in the dispatcher. |

### F. Schemas + inventory format

#### Per-handbook cache manifest (extended)

```typescript
interface HandbookCacheManifest {
  schema_version: number;
  doc: string;                       // 'phak'
  edition: string;                   // 'FAA-H-8083-25C'
  primary: HandbookCacheArtifact;    // whole-doc
  chapters: readonly ChapterArtifact[];
  ancillary: readonly AncillaryArtifact[];
  errata: readonly HandbookErrataArtifact[];
  generated_at: string;
}

interface HandbookCacheArtifact {
  filename: string;                  // 'FAA-H-8083-25C.pdf'
  source_url: string;
  sha256: string;
  fetched_at: string;
  content_length: number;
  etag: string | null;
  last_modified: string | null;
}

interface ChapterArtifact extends HandbookCacheArtifact {
  ordinal: number;                   // 1-indexed; 7 for ch7
  filename: string;                  // 'FAA-H-8083-25C-ch07.pdf' (zero-padded)
  // For two-hop handbooks, source_url is the resolved final PDF URL.
  // chapter_page_url is the intermediate HTML page URL (for audit); null for direct-pattern handbooks.
  chapter_page_url: string | null;   // PHAK: '/regulationspolicies/.../chapter-7-aircraft-systems'
}

interface AncillaryArtifact extends HandbookCacheArtifact {
  kind: 'front' | 'toc' | 'glossary' | 'index' | 'appendix';
  appendix_id: string | null;        // for kind='appendix': 'a', 'b', etc.
}
```

#### AIM corpus manifest (extended)

```typescript
interface AimCorpusManifest {
  schema_version: number;
  corpus: 'aim';
  primary: HandbookCacheArtifact;    // bundled aim.pdf
  sections: readonly AimSectionArtifact[];
  appendices: readonly AimAppendixArtifact[];
  generated_at: string;
}

interface AimSectionArtifact extends HandbookCacheArtifact {
  chapter: number;                   // 1-11
  section: number;                   // 1-N within chapter
  filename: string;                  // 'chap07_section_03.html'
}

interface AimAppendixArtifact extends HandbookCacheArtifact {
  ordinal: number;                   // 1-5
  filename: string;                  // 'appendix_03.html'
}
```

#### Per-corpus manifest (AC/ACS/regs) -- unchanged from #327

The flat-corpora manifests stay as-is. Only AIM grows new fields.

#### Inventory document format

`docs/sources/INVENTORY.md`:

```markdown
# Source inventory

Generated by `bun run sources inventory` from YAML config + cache manifests.

Last regenerated: 2026-04-29T17:30:00Z

## Handbooks

### PHAK -- Pilot's Handbook of Aeronautical Knowledge

Edition: FAA-H-8083-25C
Index: https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak

| Asset | Source URL | Cache filename | SHA-256 (12) | Fetched |
| --- | --- | --- | --- | --- |
| Whole-doc | https://www.faa.gov/.../faa-h-8083-25c.pdf | FAA-H-8083-25C.pdf | 247929cace0a | 2026-04-27 |
| Chapter 1 | https://www.faa.gov/sites/.../03_phak_ch1.pdf | FAA-H-8083-25C-ch01.pdf | a4f8d9b0c1e2 | 2026-04-29 |
| ... | ... | ... | ... | ... |
| Errata: MOSAIC | https://www.faa.gov/.../PHAK_Addendum_MOSAIC.pdf | FAA-H-8083-25C-errata-mosaic.pdf | b77c3e... | 2026-04-28 |

### AFH -- Airplane Flying Handbook
...
## Advisory Circulars
...
## ACS -- Airman Certification Standards
...
## AIM -- Aeronautical Information Manual

### Chapter HTML

| Chapter | Section | Source URL | Cache filename | Fetched |
| --- | --- | --- | --- | --- |
| 1 | 1 | https://www.faa.gov/.../chap1_section_1.html | chap01_section_01.html | 2026-04-29 |
| ... |

### Appendices
...
## Regulations (CFR via eCFR)
...
```

Idempotent: same input = same output bytes. No timestamps in section bodies (only one timestamp at the top).

### G. Risk register

| Risk | Mitigation |
| --- | --- |
| FAA renames a handbook URL between WP merge and operator's next download | URL verifier surfaces it; operator updates YAML; download retries. Hard fail at download time with structured error pointing at YAML field. |
| Two-hop scrape: index page anchor text changes | Hard fail. Verifier catches it on the next run. YAML pattern is the contract; FAA changes break the build, not silently. |
| AIM publisher adds/removes a section between runs | Hard fail at download time (`sections_per_chapter` mismatch). Operator updates YAML, re-runs. |
| Front matter dup IS present in some handbook (only PHAK verified empirically) | Probe each handbook on first chapter download; if first-page text matches the whole-doc front matter, log and continue (chapter PDF is still authoritative for its content body). Probe goes in implementation; not a blocker. |
| Chapter PDF page numbering doesn't restart per chapter | Verified for PHAK; consistent. Probe per-handbook on first download. |
| Figure numbering inconsistency across publications | Verified for PHAK (chapter-prefixed). Probe per-handbook on first download. |
| Bundle download time grows from 1 file to ~80 per handbook | Acceptable. PHAK download is parallelized at the asset level; total wall-time roughly equal to whole-doc fetch. Bandwidth cost is similar bytes. |
| Operator misses a YAML edit when migrating from `plans.ts` arrays | Test: a parser-level test that loads each YAML and asserts entry count matches the previous hardcoded count (12 ACs, 5 ACSs, 8 handbook extras). Mismatch = test failure. |
| Concurrent edit conflict with `section-extraction-contract-v2` agent on `chapter_plaintext.py` and `cli.py` | Per coordination rules: minimize narration string edits, add new branches to existing strings, communicate via WP comments before merging if both agents are mid-PR. |

### H. Coordination

- **Concurrent WP `section-extraction-contract-v2`** (separate agent). They edit `tools/handbook-ingest/ingest/prompts/` (contract templates), `chapter_plaintext.py` (truncation logic + prompt template), and possibly the JSON contract schema. We edit `tools/handbook-ingest/ingest/fetch.py`, `paths.py`, `cli.py` (chapter-mode plumbing), and `chapter_plaintext.py` (chapter-mode branch). Conflict surface: `chapter_plaintext.py` and `cli.py`.

  **Boundary contract for `chapter_plaintext.py`** (prevents merge conflict by structure):

  ```python
  def build_chapter_plaintext(handbook_config: HandbookConfig, chapter_ordinal: int, ...) -> str:
      # CHAPTER-MODE BRANCH (this WP owns this block)
      if handbook_config.chapter_pdfs is not None and _chapter_pdf_in_cache(handbook_config, chapter_ordinal):
          return _build_from_chapter_pdf(handbook_config, chapter_ordinal, ...)
      # WHOLE-DOC PATH (contract-v2 owns the inside of this)
      return _build_from_whole_doc_with_page_ranges(handbook_config, chapter_ordinal, ...)
  ```

  Rules:

  - **Chapter-mode branch is one early-return at the top.** This WP adds it; contract-v2 ignores it.
  - **Contract-v2 owns the inside of `_build_from_whole_doc_with_page_ranges`** (truncation logic, prompt template, parameter file). This WP does not edit those internals.
  - If contract-v2 lands first, this WP rebases and adds the early-return on top of the new whole-doc-path internals.
  - If this WP lands first, contract-v2 modifies inside `_build_from_whole_doc_with_page_ranges` without touching the early-return.
  - **For `cli.py`:** add new narration branches by adding new strings; do not rewrite existing ones. If contract-v2 also touches a string we touch, the agent merging second resolves by preserving both branches.
  - If both PRs are open simultaneously, the agent merging second rebases and re-runs `bun run check` + `bun test` before merge.
- **`scripts/migrate-cache-flat.ts`** -- resolved 2026-04-29. The brief flagged it as "still in the tree" but `git ls-files` confirms it was never tracked on main; #327's commit B did delete it from git. The file existed in user-zero's local working tree only (the migration script was run, then never cleaned up locally). User deleted it manually. No action needed in this WP. References to the script in docs (ADR 021, source-cache-flat-naming spec, handbook-ingest-pipeline docs) describe its historical role and are correct as-is.

### I. Deletion checklist

When the implementation PR closes, these things must NOT exist anywhere in the repo:

- File: `scripts/migrate-cache-flat.ts` (if it survived #327)
- Symbols in `scripts/sources/download/plans.ts`: `AC_TARGETS`, `ACS_TARGETS`, `HANDBOOKS_EXTRAS_TARGETS`, `AIM_PDF_URL`, `mkAc`, `mkAcs`, `mkHbk`. Replaced by YAML loader.
- Hardcoded URL strings in `plans.ts` (other than the ECFR_BASE / ECFR_TITLES_URL operator endpoints, which stay in `regs.yaml`).
- Comment claiming "for compatibility with existing reader" -- already removed in #327, just verify.

## Spec PR vs implementation PR

Same pattern as #326 -> #327:

1. **This WP's spec PR** lands `docs/work-packages/chapter-source-ingestion/{spec.md, tasks.md, test-plan.md, design.md, review.md}` only. Docs PR. Reviewed and merged.
2. **Implementation PR** off latest main, branch `feat/chapter-source-ingestion`. Implements per the spec. Tests, docs sweep, ADR 022. Squash-merged.

The split keeps the spec reviewable in isolation and the implementation reviewable against the merged spec.
