---
title: 'Library completeness -- visibility gap, corpus catalog, new-corpora proposals'
product: study
feature: library-completeness
type: spec
status: unread
review_status: pending
---

# Library completeness

A discussion document. The user ratifies each numbered point before any implementation. Six sections, each ending with explicit ratification points.

## TL;DR

- The `/library` page lists ~60 reference cards (handbooks + ACS + AC + AIM + CFR + NTSB + POH + other), but only the 9 ingested handbooks render as "Read in-app." Every other reference card is a dead link to faa.gov.
- Cause: the loader's `isReadable` probe is `EXISTS handbook_section WHERE level <> 'chapter'`. Only `seed-handbooks.ts` produces those rows, and it only walks `handbooks/`. AIM (744 entries on disk), CFR-14 (7,218), CFR-49 (~30), AC (9), ACS (5) all have manifests but nothing seeds them into a queryable shape.
- Recommended fix: **Option C** -- add a corpus-agnostic `library_visibility` table that any seed can populate, decoupling library readability from the handbook-specific schema. (Trade-offs in §1.)
- The user wants to add: airplane-track handbooks (covered by gap 5 + this WP), the FAA *Tips on Mountain Flying* pamphlet, NTSB ALJ rulings, FAA Chief Counsel legal interpretations, SAFOs, InFOs, FAA Order 8900.1, and the full AC catalog. Each gets its own follow-on WP (§4).

## Glossary (so we're not arguing about words)

| Layer                  | Where it lives                            | Populated by                          |
| ---------------------- | ----------------------------------------- | ------------------------------------- |
| **Cache**              | `~/Documents/airboss-handbook-cache/`     | `bun run sources fetch <corpus>`      |
| **Inline derivatives** | `handbooks/`, `aim/`, `regulations/`, `ac/`, `acs/` | `bun run sources register <corpus>`   |
| **Sources registry**   | runtime `@ab/sources` corpus resolvers    | `import 'libs/sources/src/<c>/index.ts'` |
| **Study DB -- reference**       | `study.reference` rows                    | `seed-handbooks.ts` + `seed-references.ts` (YAMLs in `course/references/`) |
| **Study DB -- handbook_section** | `study.handbook_section` rows             | `seed-handbooks.ts` only             |
| **Library readability** | derived: "has any non-chapter `handbook_section` row" | `getReadableReferenceIds()` at `libs/bc/study/src/handbooks.ts:501` |

The "registered into the runtime registry" number quoted in the broad-extraction findings (9,823) is the **sources registry**, not the **library page**. The library page only sees what the **study DB** holds. They are different surfaces; conflating them is what made the gap invisible until now.

## 1. The visibility gap

### What's actually wrong

The `/library` loader (`apps/study/src/routes/(app)/library/+page.server.ts:38`) does:

1. `listReferences()` -> every `study.reference` row (currently 9 handbooks + ~50 non-handbook YAML rows = ~60 cards).
2. `getReadableReferenceIds(...)` -> a single `SELECT DISTINCT reference_id FROM handbook_section WHERE level <> 'chapter'`.
3. Sets `isReadable=true` only for IDs in that set.

`seed-handbooks.ts` is the only thing that produces `handbook_section` rows, and at line 79 it walks `HANDBOOKS_DIR = repo/handbooks` -- nothing else. So:

- Handbook references that are seeded via `seed-handbooks.ts` -> `isReadable=true`. (9 docs after PR #384.)
- Every other reference (ACS, AC, AIM, CFR, NTSB, POH, "noningested handbooks", other) -> `isReadable=false`. The card shows but only links to the external URL. No in-app reading, no progress, no citations resolve to internal anchors.

This isn't a bug in any one file. The schema and the seed pipeline encode "readable in-app" as a synonym for "is a handbook," which it isn't anymore.

### Three ways out

**Option A -- extend `seed-handbooks.ts` to walk every corpus.**

- Add walks for `aim/`, `regulations/cfr-*/`, `ac/`, `acs/`, and the handbooks-extras (already handled by PR #384). Each walk produces `handbook_section` rows where `level` maps to whatever the corpus's hierarchy is (`section`/`subsection` for AIM, `part`/`section`/`paragraph` for CFR, etc.).
- Pros: zero schema change. Library page works immediately.
- Cons: pollutes a "handbook" table with non-handbook rows. The `code` shape check (`^[0-9]+(\.[0-9]+){0,2}$`) at schema.ts:1343 rejects CFR-style codes (`91.103(b)(1)(i)`) and AC paragraph codes outright. Either we relax the constraint (loses validation power for handbooks) or per-corpus reformatters squeeze codes into 3-level dotted form (lossy). The level enum (`chapter|section|subsection`) doesn't fit `part|subpart|section|paragraph` either.

**Option B -- per-corpus tables and a polymorphic readability probe.**

- Add `aim_section`, `cfr_section`, `ac_section`, `acs_element` tables. Generalize `getReadableReferenceIds` to UNION across them.
- Pros: each corpus's structure is honestly modeled. Citation resolvers can lean on real columns.
- Cons: every new corpus is N tables + a `getReadableReferenceIds` change + a Drizzle schema migration. Adds an N-way coupling between library page and storage shape. Drift risk grows linearly with corpora.

**Option C -- corpus-agnostic visibility table (recommended).**

- Add `study.library_entry` (or similar): `(reference_id, locator, kind, title, parent_locator, ordinal, content_hash, ...)`. Each corpus's seed populates it from its manifest. The library probe becomes `EXISTS library_entry WHERE reference_id = ?`.
- Per-corpus content tables (`handbook_section`, future `aim_section`, etc.) stay as they are for content/resolver concerns; `library_entry` is a thin "is this thing browseable" projection.
- Pros: library page decoupled from corpus-specific shape. Adding a corpus = one seed + N rows in `library_entry`. No schema change after the initial table.
- Cons: introduces a small projection layer that has to stay in sync with the underlying content. Mitigated by populating it in the same transaction as the content, and by `content_hash` idempotence (same pattern `handbook_section` already uses).

**Recommendation: Option C.** It is the only one of the three that doesn't make adding a new corpus harder over time. The work to introduce it is bounded (one new table + one migration + a small refactor of the loader probe + populate it from the existing handbook seed), and it lets us defer per-corpus content tables until we actually need in-app reading for a given corpus.

A short follow-up consideration: Option C can be staged. Phase 1 of the implementation WP populates `library_entry` for handbooks only (zero behavior change, just refactors the probe). Phase 2 onward adds AIM, CFR, etc., each as small follow-on PRs.

> **Ratify (1.A):** Pick Option **A**, **B**, or **C**. Default recommendation = **C**.
> **Ratify (1.B):** Confirm the staged rollout (handbooks-first, then per-corpus) over a big-bang seed of every corpus at once.

## 2. Corpus catalog

Every reference cohort, surveyed against the actual filesystem + the YAML registry today (2026-04-30, post `5a972b3a`). "Library-visible?" = `isReadable` would be `true` for at least one row in the cohort.

| Corpus                     | Cache | Inline derivs                              | `study.reference` rows                          | `handbook_section` seeded? | Library-visible? | Action                                                       |
| -------------------------- | ----- | ------------------------------------------ | ----------------------------------------------- | -------------------------- | ---------------- | ------------------------------------------------------------ |
| PHAK FAA-H-8083-25C        | yes   | yes (manifest + 850 sections)              | yes (seed-handbooks)                            | yes (850)                  | yes              | none                                                         |
| AFH FAA-H-8083-3C          | yes   | yes (manifest + 531 sections)              | yes (seed-handbooks)                            | yes (531)                  | yes              | gap 6 cleanup (AFH errata duplicate-applied; survey §6)      |
| AVWX FAA-H-8083-28B        | yes   | yes (manifest + 480 sections)              | yes (seed-handbooks)                            | yes (480)                  | yes              | none                                                         |
| Risk Mgmt FAA-H-8083-2A    | yes   | yes (manifest + whole-doc, post #384)      | yes (seed-handbooks; needs verification)        | depends on PR #384 seed    | depends          | confirm seed actually ran for the 6 extras post #384         |
| Aviation Instructor FAA-H-8083-9 | yes | yes (whole-doc post #384)                  | yes (post-#384 seed)                            | depends                    | depends          | same as above                                                |
| IFH FAA-H-8083-15B         | yes   | yes (whole-doc post #384)                  | yes (post-#384 seed)                            | depends                    | depends          | same as above                                                |
| IPH FAA-H-8083-16B         | yes   | yes (whole-doc post #384)                  | yes (post-#384 seed)                            | depends                    | depends          | same as above                                                |
| AMT-G FAA-H-8083-30B       | yes   | yes (whole-doc post #384)                  | yes (post-#384 seed)                            | depends                    | depends          | same as above; airplane-track only? user to confirm scope    |
| AMT-P FAA-H-8083-32B       | yes   | yes (whole-doc post #384)                  | yes (post-#384 seed)                            | depends                    | depends          | same as above                                                |
| AIH (handbooks-noningested) | no   | no                                         | yes (YAML row only)                             | no                         | NO               | ingest via handbooks-extras pipeline OR drop                 |
| AIM 2026-04                | yes   | yes (manifest + 744 entries)               | yes (`aim` slug from aim-pcg.yaml)              | NO                         | NO               | seed via Option C / extend pipeline                          |
| PCG (Pilot/Controller Gloss) | bundled with AIM | yes (in AIM manifest)              | yes (`pcg` slug)                                | NO                         | NO               | same as AIM                                                  |
| CFR Title 14 (2026-04-22)  | yes   | manifest + 7,218 entries (.md gitignored)  | yes (11 part-level YAML rows: 14, 23, 61, 68, 71, 73, 91, 135, 141, etc.) | NO  | NO  | seed via Option C; high-density UI question (§3)             |
| CFR Title 49 (2026-04-24)  | yes   | manifest (parts 830 + 1552, post PR #382)  | yes (49cfr830, 49cfr1552 YAML rows)             | NO                         | NO               | seed via Option C                                            |
| AC (12 cached / 17 YAML)   | 12    | manifest + 9 doc.md (3 ingestion gaps)     | yes (17 YAML rows)                              | NO                         | NO               | seed via Option C; resolve gaps 3+4 from broad survey        |
| ACS (5 cached / 7 YAML)    | 5     | manifest + 5 element trees (1 wired, 4 gap 2) | yes (7 YAML rows)                            | NO                         | NO               | resolve gap 2 from broad survey, then seed via Option C      |
| NTSB (umbrella)            | no    | no                                         | yes (1 row, umbrella only)                      | no                         | NO               | umbrella card; per-report ingestion is a separate WP (§4.A)  |
| POH-AFM (umbrella)         | no    | no                                         | yes (1 row)                                     | no                         | NO               | umbrella card; per-aircraft is out of scope                  |
| Other publications (8)     | no    | no                                         | yes (8 YAML rows, e.g., AOPA ASI, Order 8260-3) | no                         | NO               | each needs its own decision: ingest, link-only, or drop      |

Verification trail:

- `find handbooks/ aim/ regulations/ ac/ acs/ -name manifest.json` -- 21 manifests on disk.
- `~/Documents/airboss-handbook-cache/{handbooks,regulations,aim,ac,acs}` -- all present.
- `course/references/*.yaml` -- 8 files, 60 reference rows total (counted by `grep -E '^  - slug:'`).
- `seed-handbooks.ts:79` walks `handbooks/` only (verified).
- `getReadableReferenceIds()` at `libs/bc/study/src/handbooks.ts:501` reads `handbook_section` only (verified).

> **Ratify (2.A):** Confirm the catalog is right. Anything to add/remove?
> **Ratify (2.B):** Confirm post-#384 seeding for handbooks-extras is actually wired. (If `bun run db seed handbooks` doesn't produce `study.handbook_section` rows for IFH/IPH/AMT-G/AMT-P/risk-mgmt/instructor, that's a separate small fix before this WP starts.)
> **Ratify (2.C):** Decide what to do about the "Other publications" cohort (AOPA ASI, FAA Order 8260-3, Jeppesen plates, generic ACS/PTS, etc.). Most of these are link-only today; some could become real ingested corpora.

## 3. CFR / AIM density

Once Option C is in, CFR-14 alone adds 7,218 visible entries. AIM adds 744. The current `/library` page treats every reference as one card; a 7k-entry CFR title would either need to be one card (the whole title) or 7k cards (every section). Neither is right.

The library page already groups by aviation topic (`subjects`) on the client. Three live design questions for high-density corpora:

1. **What is "a card" for CFR?** Options:
    - One card per CFR title (14, 49). Drill into the title to browse parts/subparts/sections. Today's pattern; cleanest.
    - One card per CFR part (Part 61, Part 91, ...). The 11 YAML rows already encode this. Familiar to pilots; matches how content cites it.
    - Mixed: title-level cards on the library page, part-level cards inside a "CFR" sub-browse view.
2. **Search vs browse for CFR?** A 7k-section corpus does not browse well. Recommend search-only inside CFR (string match across section titles + numbers), with the sub-section tree visible only when drilled into a section.
3. **AIM is small (744). Tree-browse is fine.** Keep AIM as a single card; the chapter/section tree expands inline.

Recommendation: **part-level cards for CFR-14 (the existing YAML grain), title-level for CFR-49 (just two small parts), AIM as one card with chapter tree.** This matches how citations reference CFR (`14 CFR 91.103`) and keeps the library page browsable without a 7k-card list.

> **Ratify (3.A):** Pick a CFR card grain (title vs part vs mixed). Default = part-level for CFR-14, title for CFR-49.
> **Ratify (3.B):** Confirm search-only inside a CFR drill-down (vs full tree browse).
> **Ratify (3.C):** Confirm AIM stays as one card with chapter tree expansion.

## 4. New corpora

Each is a separate WP, sequenced after this one. Per ADR 019, the URI scheme already covers all of them; this is purely an ingestion + content question.

URL verification ran on 2026-04-30. `[200]` = curl HEAD success. `[?]` = couldn't HEAD-check (FAA blocks bots on some pages); URL is plausible but the user should ratify before any agent commits to it.

### 4.A NTSB administrative law judge rulings

- Source URL: `https://www.ntsb.gov/legal/alj/Pages/default.aspx` `[200]` (verified 2026-04-30).
- Shape: ALJ initial decisions + Board orders. Per-decision, no fixed page count. Mostly PDFs linked from a SharePoint-style index. Estimated scale: a few hundred decisions over the public archive; growth slow (maybe 20-50/year).
- Pipeline recommendation: **new HTML scraper + per-decision PDF extractor**. The existing AC pipeline is the closest analog (single PDF per item) but doc IDs are NTSB docket-style (`SE-19045`), not slash-style FAA numbers. New `libs/sources/src/ntsb-alj/` with its own locator + ingest.
- Citation URI: ADR 019 §1.2 already provisions `interp/ntsb/<case-name>` (Board orders) and `ntsb/<docket>` (accident reports). ALJ initial decisions are different from both -- recommend `ntsb/alj/<docket>`.
- Pre-existing in airboss: ADR 019 mentions NTSB Board orders explicitly; ALJ decisions are not in the schema yet but use the same locator pattern.

### 4.B FAA Chief Counsel legal interpretations

- Source URL: `https://www.faa.gov/about/office_org/headquarters_offices/agc/practice_areas/regulations/interpretations` `[200]` (verified 2026-04-30).
- Shape: per-letter PDFs (interpretation letters), several hundred total in the public archive, growth rate ~30-50/year. Each letter has a recipient name + date + topic; archive is browseable by year and by recipient.
- Pipeline recommendation: **new HTML scraper + per-letter PDF extractor**, following the AC pattern. The locator is per-letter (`<recipient-lastname>-<year>`), edition is the letter date, source URL is the per-letter PDF.
- Citation URI: ADR 019 §1.2 already defines `interp/chief-counsel/<recipient>-<year>`. Reuse it.
- Highest leverage of the new corpora: Chief Counsel letters drive a lot of operational detail not visible in the regs themselves. Pilots regularly cite them (e.g. Mangiamele on flight training compensation, Walker on light-sport). Strong pedagogical value.

### 4.C SAFOs (Safety Alerts For Operators)

- Source URL: TBD. Tried `https://www.faa.gov/safo` (000), `/about/initiatives/safo` (404), `/aircraft/safety/programs/airline_operators/airline_safety/safo` (404), and others. The current canonical landing appears to be inside DRS (`https://drs.faa.gov` -- 200) but a stable per-SAFO URL pattern needs ratification.
- Shape: short PDFs (1-3 pages), one per alert. Numbered (`SAFO 23004`). ~10-30/year. Total catalog ~150-200.
- Pipeline recommendation: same as AC pipeline. Single PDF per item. New `libs/sources/src/safo/`.
- Citation URI: ADR 019 §1.2 line 182 already defines `airboss-ref:safo/<num>?at=<year>`. Reuse it.

> **Ratify (4.C.URL):** User to confirm canonical SAFO landing URL before this WP starts. Fallback: scrape via DRS.

### 4.D InFOs (Information For Operators)

- Source URL: TBD. Same situation as SAFOs (DRS is the dependable backstop).
- Shape: same as SAFO -- numbered PDFs, slightly higher volume.
- Pipeline: identical to SAFO.
- Citation URI: ADR 019 §1.2 line 182 reserves `info` (alongside `safo`). Reuse.

> **Ratify (4.D.URL):** User to confirm canonical InFO landing URL.

### 4.E FAA Order 8900.1 (Flight Standards Information Management System / FSIMS)

- Source URL: `https://drs.faa.gov/browse/excelExternalWindow/8900.1` `[200]` (verified 2026-04-30). Public DRS is the canonical archive; the legacy `fsims.avs.faa.gov` host is internal-only and HEAD-blocks.
- Shape: very large hierarchical document. Volumes -> Chapters -> Sections -> Tasks. Total ~10,000+ pages of inspector guidance. Updated continuously.
- Pipeline recommendation: **deferred** until we decide whether 8900.1 is in-scope for any product surface. It is enormous and most of it is air-carrier inspector guidance, not pilot-facing. Recommend a tiny carve-out for the volumes that touch flight instruction (Vol 5: Airman Certification) and defer the rest.
- Citation URI: ADR 019 §1.2 line 124 already provisions `orders/faa/8900-1/vol-5/ch-1`. Reuse it.

### 4.F Tips on Mountain Flying pamphlet

- Source URL: `https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/tips_on_mountain_flying.pdf` `[200]` (verified 2026-04-30).
- Shape: single short PDF (40 pages). One-off.
- Pipeline recommendation: **reuse the AC pipeline** (single-PDF-per-doc). Add as a `kind: handbook` row with a custom slug (`tips-mountain-flying`) or as a new `kind: pamphlet` if the user wants to distinguish handbooks from informational pamphlets.
- Citation URI: doesn't fit any existing corpus cleanly. Either treat as `handbooks/<slug>` (closest existing) or add a `pamphlets` corpus to ADR 019. Recommend **handbooks/** for now (small, single-doc).
- Smallest WP of the bunch; could be done in a single afternoon.

### 4.G Full AC catalog

- Source URL: `https://www.faa.gov/regulations_policies/advisory_circulars/` `[200]`. The FAA publishes a complete catalog (~200 active ACs).
- Shape: per-AC PDF; pipeline already exists.
- Pipeline recommendation: **extend the existing AC ingestion config** (`scripts/sources/config/ac/`?) with the full catalog list. Each AC is a one-line config addition + one PDF download + one ingest run. This is mostly a content-curation question, not an engineering one.
- Question for the user: completionist (all ~200 active ACs) or curated-by-relevance (~40-50 that map to current syllabus content)? Recommend **curated-by-relevance** to start; expand opportunistically.

> **Ratify (4.A-G):** For each, choose: do it now / write the WP and schedule it / defer with a specific trigger / drop.
> **Ratify (4.H):** Decide ordering. Recommended sequence below in §6.

## 5. "Other interesting" candidates

Not promised to anyone, surfacing as an explicit menu so the user picks rather than deferring forever:

- **FAA Safety Briefing magazine archives** -- `https://www.faa.gov/newsroom/faa-safety-briefing-magazine` `[200]`. Bi-monthly magazine, ~30 issues in the public archive. Pilot-facing, high pedagogical value. AC-style pipeline (per-issue PDF).
- **GA Joint Steering Committee (GA-JSC) safety bulletins** -- public archive exists; URL not verified. Topic-specific (loss of control, fuel mgmt, etc.). ~5-10 bulletins/year.
- **14 CFR Part 67 medical certification** -- already in CFR-14 once we ingest it; no new corpus needed, just surface it once §3 lands.
- **CAP-coordinated content (e.g. WINGS program docs)** -- mostly outside FAA proper but cited heavily in CFI lesson plans.
- **FAA-approved approach plates / sectionals (Jeppesen / FAA)** -- already an `other-publications.yaml` umbrella row; could become real if the user wants in-app chart browsing. Significant scope.

> **Ratify (5):** Pick which (if any) of these become follow-on WPs. Default: only Safety Briefing magazine; rest deferred.

## 6. Recommended sequence

Discrete WPs that ship independently. Each is small enough to ship in a session or two; each leaves the system better than it found it.

1. **WP-V (this WP, after ratification).** Pick option A/B/C for the visibility gap. Author the implementation WP (`docs/work-packages/library-visibility-gap/`).
2. **WP-VS (Visibility Step 1).** Refactor: introduce `study.library_entry` (or chosen mechanism), populate it from `seed-handbooks.ts`, switch `getReadableReferenceIds` to read it. Zero behavior change, but unlocks every following WP.
3. **WP-EX-Verify.** Confirm post-#384 handbooks-extras seeding actually produces `handbook_section` rows for the 6 extras. Small PR if not. (May already work; needs a 5-minute check.)
4. **WP-MTN.** Tips on Mountain Flying pamphlet -- single PDF, AC-style pipeline. Smallest possible win.
5. **WP-AIM.** AIM seed: walk the existing `aim/<edition>/manifest.json`, populate `library_entry` (or chosen mechanism). 744 entries unlocked.
6. **WP-CFR-V.** CFR-14 + CFR-49 seed: same idea, plus the §3 UI question (part-level cards). 7,218 + ~30 entries unlocked.
7. **WP-AC-V.** AC catalog visibility: seed the 9 already-extracted ACs into `library_entry`. (Resolving gaps 3+4 from the broad survey is a separate prior fix; deferred per survey recommendation.)
8. **WP-ACS-V.** Same for ACS. Depends on resolving gap 2 (ACS edition slug mapping) from the broad survey first.
9. **WP-CC.** Chief Counsel interpretations -- new corpus, ADR 019 already provisions the URI. Highest pedagogical leverage of the §4 candidates.
10. **WP-NTSB-ALJ.** NTSB ALJ rulings -- new corpus.
11. **WP-SAFO + WP-INFO.** SAFOs and InFOs -- combined or sequential; pipelines are identical.
12. **WP-AC-FULL.** Expand the AC config from 12 -> ~50 curated-relevance ACs. Content-only WP; pipeline already exists.
13. **WP-O8900-V5.** FAA Order 8900.1 Volume 5 carve-out (Airman Certification). Defer the rest of 8900.1 indefinitely.
14. **WP-SAFETY-BRIEF.** Safety Briefing magazine archive (if §5 ratified yes).

Stop conditions: any WP can be deferred or dropped at any point. The hard order is 1 -> 2 (foundation), then 4-8 (existing manifests, easy wins), then 9-14 (new corpora, more work).

> **Ratify (6):** Confirm the sequence, or reorder. Default is as listed.

## Open questions

These don't block the WP but should be captured so they don't fall through the cracks:

- Should the library page distinguish "ingested + readable in-app" from "umbrella (link-only)"? Today it shows both as cards; only the "Read in-app" affordance differs. Risk: users tap the umbrella POH card expecting content, get bounced to the FAA. Maybe a card-state indicator (`Read · Browse · External link only`).
- Where do per-aircraft POHs land? Currently one umbrella row. The user has not asked for this, but it's the elephant in the corpus catalog.
- Once `library_entry` exists, the `/library` page can reasonably support search-across-corpora. Worth its own WP later.

## Verification trail

- `bun run check`: clean (this is a docs-only WP).
- Every URL referenced has a `[200]` or `[?]` + verification date.
- Every catalog row was checked via `find` / `ls` / YAML grep against the actual repo + cache state on `5a972b3a`.
- No code changed.
