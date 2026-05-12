---
id: library-completeness
title: Library completeness -- visibility gap, corpus catalog, new-corpora proposals
product: study
category: feature
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-05-01
owner: agent
depends_on: []
unblocks: []
tags:
  - library
  - corpus
legacy_fields:
  feature: library-completeness
  type: spec
  review_status: done
  revised: 2026-05-01
  revision_history:
    - v1 (2026-04-30) -- initial spec (recommended a `library_entry` projection table).
    - v2 (2026-05-01) -- §1 replaced with the substrate rename approach after [review.md](review.md). §§2-5 kept verbatim; §6 simplified -- downstream corpus WPs no longer carry a projection-population step.
---

# Library completeness

A discussion document. The user ratifies each numbered point before any implementation. Six sections, each ending with explicit ratification points.

> **Snapshot status: see [status.md](status.md)** for the current per-WP status, the manifest-vs-card gap detail (which the spec's snapshot didn't fully address), and the sequenced near-term path to "all-FAA-references-readable" (post-2026-05-03 session).

This is **v2**. v1 recommended Option C (`library_entry` projection table). [review.md](review.md) argued -- correctly -- that Option C ships a workaround instead of fixing the root cause. v2 replaces §1 with a substrate rename + relax + generalize approach. §§2-5 are unchanged; §6 folds WP-V + WP-VS into a single substrate WP.

## TL;DR

- The `/library` page lists ~60 reference cards (handbooks + ACS + AC + AIM + CFR + NTSB + POH + other), but only the 9 ingested handbooks render as "Read in-app." Every other reference card is a dead link to faa.gov.
- Cause: the loader's `isReadable` probe is `EXISTS handbook_section WHERE level <> 'chapter'`. Only `seed-handbooks.ts` produces those rows, and it only walks `handbooks/`. AIM (744 entries on disk), CFR-14 (7,218), CFR-49 (~30), AC (9), ACS (5) all have manifests but nothing seeds them into a queryable shape. The deeper cause: the only structured-content table in the schema is named after the first corpus we ingested (`handbook_section`) and carries handbook-shaped CHECK constraints. The visibility gap is a symptom of that misnaming.
- Recommended fix: **rename `handbook_section` -> `reference_section`, drop the handbook-shaped CHECK constraints, declare per-kind hierarchy on `reference.section_schema` jsonb, store per-kind extras in `metadata` jsonb on both tables (Zod-validated at write time), and generalize the seeder to walk every corpus's manifests.** One substrate WP, ~10 callers updated, no projection layer. After it lands, every §4 corpus is purely additive. (Trade-offs vs the v1 Option C alternative in §1.)
- The user wants to add: airplane-track handbooks (covered by gap 5 + this WP), the FAA *Tips on Mountain Flying* pamphlet, NTSB ALJ rulings, FAA Chief Counsel legal interpretations, SAFOs, InFOs, FAA Order 8900.1, and the full AC catalog. Each gets its own follow-on WP (§4).

## Glossary (so we're not arguing about words)

> Layers as they exist today (pre-WP-SUB, snapshot of `5a972b3a`). Post-substrate, `handbook_section` becomes `reference_section` and the readability probe becomes content-based; see §1. The glossary is intentionally a frozen snapshot so future readers can diff against the substrate.

| Layer                            | Where it lives                                        | Populated by                                                               |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| **Cache**                        | `~/Documents/airboss-handbook-cache/`                 | `bun run sources fetch <corpus>`                                           |
| **Inline derivatives**           | `handbooks/`, `aim/`, `regulations/`, `ac/`, `acs/`   | `bun run sources register <corpus>`                                        |
| **Sources registry**             | runtime `@ab/sources` corpus resolvers                | `import 'libs/sources/src/<c>/index.ts'`                                   |
| **Study DB -- reference**        | `study.reference` rows                                | `seed-handbooks.ts` + `seed-references.ts` (YAMLs in `course/references/`) |
| **Study DB -- handbook_section** | `study.handbook_section` rows                         | `seed-handbooks.ts` only                                                   |
| **Library readability**          | derived: "has any non-chapter `handbook_section` row" | `getReadableReferenceIds()` at `libs/bc/study/src/handbooks.ts:501`        |

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

Underneath the loader-probe symptom is a **naming + constraint problem**: `study.handbook_section` is the only structured-content table in the schema, and it carries handbook-shaped constraints (`level IN ('chapter','section','subsection')`, `code ~ '^[0-9]+(\\.[0-9]+){0,2}$'`). It also has a handbook-shaped name. The schema, seed pipeline, and probe all encode "readable in-app" as a synonym for "is a handbook." The fix is to stop encoding that.

### What's actually fine

Look at what `handbook_section` stores (schema.ts:1291-1376):

```text
reference_id, parent_id, ordinal, level, code, title, content_md, content_hash,
faa_page_start, faa_page_end, has_figures, has_tables, ...
```

That's a **generic content-tree row**. Every corpus needs exactly this shape: a reference, a parent, an ordinal, a level label, a citation code, a title, optional markdown body, a content hash for idempotent re-seed, source page references. The substrate is correct; only the name and a few CHECK constraints are wrong.

### The fix: rename + relax + generalize

One substrate WP, then §6's sequence runs on top of it nearly unchanged.

1. **Rename tables**:
    - `handbook_section` -> `reference_section`
    - `handbook_figure` -> `reference_figure`
    - `handbook_section_errata` -> `reference_section_errata`
    - Constants module: `HANDBOOK_SECTION_*` -> `REFERENCE_SECTION_*`. Kind enum stays `REFERENCE_KINDS` (already correct).

2. **Drop the handbook-shaped DB CHECK constraints**:
    - Remove `level IN ('chapter','section','subsection')`.
    - Remove the `code ~ '^[0-9]+(\\.[0-9]+){0,2}$'` regex.
    - Add `depth int NOT NULL` (0 = top-level child of the reference, ++ per nesting). Depth is positional; it does **not** map 1:1 to `level` semantically (CFR is asymmetric -- depth 1 inside Part 91 is a Subpart, depth 1 inside Part 1 is a Section).
    - Validation moves to ingest-time Zod per kind. The DB is no longer the last line of defense for shape; it doesn't know how to be, since shape varies per kind.

3. **Add per-kind hierarchy declaration on `reference`**:
    - New column: `section_schema jsonb`. Shape: `{ levels: string[], strict_sequence?: boolean }`.
    - `levels` is the **set** of legal `level` values for sections under this reference, not a fixed sequence. Validators check `every section.level IN reference.section_schema.levels`.
    - `strict_sequence: true` (sectioned handbooks) additionally enforces "at depth N, level must be levels[N]." Off by default. CFR/AIM use the loose form because their hierarchies are asymmetric.
    - Whole-doc handbooks (post-#384 risk-mgmt, instructor, IFH, IPH, AMT-G, AMT-P) declare `{ levels: ['document'], strict_sequence: true }` -- one row per document at depth 0 with the body in `content_md`. No tree, no figures.

4. **Two manifest shapes from day one** (the (2.B) finding promoted into substrate scope). The generalized seeder accepts both shapes natively, not as a special case bolted on after:
    - **Section-tree manifest** (PHAK / AFH / AVWX): `kind: handbook`, `subjects: [...]`, `sections: [...]`, `figures: [...]`. Today's `handbookManifestSchema`. Produces N `reference_section` rows in a chapter/section/subsection tree.
    - **Whole-doc manifest** (handbooks-extras post-#384): `kind: whole-doc`, no `subjects`, no `sections`, no `figures` array. Produces **one** `reference_section` row at depth 0, level `document`, with `content_md` holding the entire body.
    - The Zod validator branches on the manifest's `kind` field (the manifest's own `kind`, not REFERENCE_KIND), not on the corpus directory. A corpus directory holds a mix -- `handbooks/` contains both shapes today (PHAK/AFH/AVWX section-tree + 6 whole-doc extras).
    - **Acceptance criterion**: after WP-SUB merges, `bun run db seed` produces `reference_section` rows for all 9 handbooks (3 sectioned + 6 whole-doc). This absorbs WP-EX-Verify -- no separate WP.

5. **Add `metadata jsonb` on both tables**:
    - `reference.metadata` -- per-document extras (CFR title number, NTSB docket, AC cancels-list at the document level).
    - `reference_section.metadata` -- per-section extras (CFR effective date, authority note, cross-refs; AC paragraph cancellations). Existing handbook-specific columns like `faa_page_start/end` stay as columns since they already exist; new corpus extras land in `metadata`.
    - Both validated by per-kind Zod schemas at ingest, seed, and module load. **No DB-level shape constraint on the jsonb.**
    - For most corpora one of the two will be empty. Empty jsonb is free; cramming per-section data into the document row is awful.

6. **Rewrite the readability probe**:
    - New `getReadableReferenceIds()`: `EXISTS reference_section WHERE reference_id = ? AND content_md IS NOT NULL AND content_md <> ''`.
    - Delete the `level <> 'chapter'` magic. The probe answers "is there body content to render," without naming any level.

7. **Generalize the seeder**:
    - `seed-handbooks.ts` becomes `seed-references-from-manifest.ts` (or keeps the handbooks name for one cycle and gains a corpus parameter -- low-stakes).
    - Walks every `*/manifest.json` under `handbooks/`, `aim/`, `regulations/`, `ac/`, `acs/`. Per-corpus quirks live in tiny adapter modules (one per corpus), not in the seed core.
    - Branches on each manifest's own `kind` field (`handbook` -> section-tree path; `whole-doc` -> single-row path). See step 4.

8. **Move external-URL formatting onto resolvers**:
    - Retire the `kind` switch in `externalUrlForReference()` at `libs/constants/src/study.ts:1496`.
    - Each `CorpusResolver` already has a `formatCitation()` slot at `libs/sources/src/registry/corpus-resolver.ts:38`. Add `externalUrlFor(reference)` to the same protocol. Consolidates per-kind URL knowledge in one place per corpus.

What this is **not**:

- Not a new `library_entry` projection table.
- Not per-corpus content tables.
- Not a polymorphic schema with discriminator routing.
- Not a deferred "we'll generalize later" comment.

### Scope

Pre-launch, no production data, single-developer environment. The schema file is the source of truth; we squash and re-seed rather than migrate. That removes the usual rename-migration choreography and turns this into a straight-edit substrate change.

- Rename touches ~10 callers (per the grep audit in [review.md](review.md)).
- Schema edits are direct: rename three tables and the constants module, drop the two handbook-shaped CHECK constraints, add `section_schema` + `metadata` jsonb on `reference`, add `metadata` jsonb + `depth int` on `reference_section`. One commit.
- Probe rewrite is ~5 lines.
- Seeder generalization is the only real engineering, bounded by manifest count (5 corpora today).
- URL switch retirement is mechanical.

### Schema after the substrate WP

#### `reference` (one row per document)

| Column                 | Type        | Notes                                                                                                                                                                                                                                            |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id                     | text PK     | `ref_ULID`                                                                                                                                                                                                                                       |
| kind                   | text        | Member of `REFERENCE_KINDS` (handbook, cfr, ac, acs, aim, pcg, ntsb, interp, safo, info, order, pamphlet, poh, other). **Drop the DB CHECK.** Zod-validated at ingest is the single source of truth; adding a corpus shouldn't need a migration. |
| document_slug          | text        | `phak`, `14cfr91`, `ac-91-79b`, `aim-2026-04`                                                                                                                                                                                                    |
| edition                | text        | `FAA-H-8083-25C`, `2026-04-22`, `2024-letter-mangiamele`                                                                                                                                                                                         |
| title                  | text        | Display title                                                                                                                                                                                                                                    |
| publisher              | text        | `FAA`, `NTSB`, `AOPA`, ... display metadata only                                                                                                                                                                                                 |
| subjects               | text[]      | Aviation topics (existing)                                                                                                                                                                                                                       |
| primary_cert           | text NULL   | **Existing post-PR #386** (Wave 1 of library-by-cert). CHECK against `CERT_APPLICABILITY_VALUES`. NULL = cert-agnostic. WP-SUB preserves this column unchanged.                                                                                  |
| section_schema         | jsonb       | `{ levels: string[], strict_sequence?: boolean }`. Per-kind level vocabulary.                                                                                                                                                                    |
| superseded_by_id       | text FK     | Self-ref for edition chains (existing)                                                                                                                                                                                                           |
| metadata               | jsonb       | Per-kind-typed extras. Empty for kinds that don't need them.                                                                                                                                                                                     |
| seed_origin            | text NULL   | Dev-seed marker (existing). NULL on production rows; tagged on dev-seeded rows so reset paths can target only what they own.                                                                                                                     |
| created_at, updated_at | timestamptz | Existing                                                                                                                                                                                                                                         |

#### `reference_section` (hierarchical content)

| Column                       | Type        | Notes                                                                     |
| ---------------------------- | ----------- | ------------------------------------------------------------------------- |
| id                           | text PK     | `refsec_ULID`                                                             |
| reference_id                 | text FK     | -> `reference.id` ON DELETE CASCADE                                       |
| parent_id                    | text FK     | -> `reference_section.id` (null for top-level)                            |
| ordinal                      | int         | Position among siblings                                                   |
| depth                        | int         | 0 for top-level, ++ per nesting. Positional, not semantic.                |
| level                        | text        | This row's level label. Validated at ingest. **No DB CHECK.**             |
| code                         | text        | Citation locator. Validated at ingest by per-kind regex. **No DB regex.** |
| title                        | text        | Section heading                                                           |
| content_md                   | text NULL   | Markdown body. NULL/empty for pure container rows.                        |
| content_hash                 | text        | For idempotent re-seeding (existing pattern)                              |
| faa_page_start, faa_page_end | int NULL    | Existing handbook-specific columns; kept since they're already there.     |
| has_figures, has_tables      | bool        | Existing                                                                  |
| metadata                     | jsonb       | Per-kind-typed per-section extras. Empty for kinds that don't need them.  |
| created_at, updated_at       | timestamptz | Existing                                                                  |

`level` examples: `chapter`, `section`, `subsection` (handbook); `subpart`, `section`, `paragraph`, `subparagraph`, `clause` (CFR); `chapter`, `section`, `paragraph` (AIM); `task`, `element` (ACS).

`code` examples: `5-2-1` (AIM), `91.103(b)(1)(i)` (CFR), `1.1.2` (handbook subsection).

Indexes:

- `(reference_id, parent_id, ordinal)` -- TOC walk.
- `(reference_id) WHERE content_md IS NOT NULL` -- partial index for the readability probe.
- `(reference_id, code)` -- citation resolution (`14 CFR 91.103` -> section row).

`reference_figure` and `reference_section_errata` are pure renames, FKs unchanged except for the parent rename.

### Symmetric vs asymmetric hierarchies

This drove the `section_schema` design and is worth being explicit about:

- **Handbook** -- symmetric: depth 0 = chapter, depth 1 = section, depth 2 = subsection. Always. -> `section_schema = { levels: ['chapter','section','subsection'], strict_sequence: true }`.
- **CFR Part** -- asymmetric: some Parts have Subparts, some are flat. -> `section_schema = { levels: ['subpart','section','paragraph','subparagraph','clause'] }`. No `strict_sequence`.
- **AIM** -- asymmetric: PCG glossary entries are flat; chapter/section/paragraph trees go deeper. -> `section_schema = { levels: ['chapter','section','paragraph'] }`.
- **Chief Counsel letter** -- flat: -> `section_schema = { levels: [] }` and either zero `reference_section` rows (use `reference.metadata` to hold the body) or one row carrying the letter body. Resolver decides.

The renderer asks both questions: `reference.kind` (which dispatcher) and `reference_section.level` (which slot within that dispatcher). Substrate stays uniform; presentation per kind is opinionated.

### Styling story

Two layers, composed:

1. **Generic CSS by `level`**: `.ref-section[data-level="chapter"]`, `.ref-section[data-level="paragraph"]`, etc. Handles ~80% of cases across all corpora.
2. **Per-kind renderer override**: a dispatcher routes on `reference.kind` (`<HandbookSectionRenderer>`, `<CfrSectionRenderer>`, `<AimSectionRenderer>`). Each applies its corpus-specific stylesheet (CFR's hanging-paragraph format + authority-note pill + cross-ref chips; handbook's plainer rendering) and reads its `metadata` jsonb through a Zod schema.

Strongly typed at the kind boundary, generic at the section level.

### Fail-fast gates

Bad metadata cannot accumulate because every write path validates:

1. **Ingest time.** Corpus ingest builds `reference` + `reference_section[]`, validates the whole tree against the kind's Zod schema (level membership, code regex, metadata shape). Aborts on first violation. Nothing reaches the DB.
2. **Seed time.** `seed-references-from-manifest.ts` re-validates as it reads `manifest.json`. Catches drift between an old manifest and a newer schema.
3. **Module load (build / startup).** Every corpus resolver self-checks its own `section_schema` is well-formed and Zod schemas parse. App fails to boot if any resolver is broken; no silent degradation.
4. **Render time (dev only).** Assert metadata matches schema. Production strips this for perf; dev catches drift introduced by hand-editing rows or partial migrations.

Three of the four gates are at write time. The DB never trusts what it's storing -- per-kind validators do.

### Why not extend the handbook seeder, or add per-corpus tables?

Two earlier ideas considered and rejected; the rejection logic is still worth recording.

**Extend `seed-handbooks.ts` to walk every corpus** would pollute a handbook-shaped table with non-handbook rows. The `code` regex (`^[0-9]+(\.[0-9]+){0,2}$`) rejects CFR-style codes (`91.103(b)(1)(i)`) and AC paragraph codes outright; the `level` enum (`chapter|section|subsection`) doesn't fit `subpart|section|paragraph`. Either we relax constraints (giving up validation power) or we squeeze codes into 3-level dotted form (lossy). The substrate rename does the relaxation honestly, with per-kind validation moved to ingest-time Zod -- which is where it belongs.

**Add per-corpus tables** (`aim_section`, `cfr_section`, `ac_section`, `acs_element`) and UNION across them in the readability probe. Every new corpus then needs a table + a probe change + a schema migration. Linear coupling between library-page logic and storage shape; drift risk grows with corpus count. The substrate rename gives us one table that fits every corpus because the only thing that varies is per-kind metadata, which lives in jsonb.

### Alternative considered: a `library_entry` projection table

v1 of this spec recommended adding `study.library_entry` -- a thin projection of "which references have browseable content," populated by every corpus seed alongside whatever per-corpus content tables eventually appear. The readability probe would become `EXISTS library_entry`.

[review.md](review.md) flagged three problems:

1. **It accepts that future corpora will get their own content tables** (v1's wording: "Per-corpus content tables stay as they are"). That's the slow road back to per-corpus tables. We end up with N content tables plus a projection layer -- the worst of both.
2. **The projection has to stay in sync with the real content.** Every corpus seed has to remember to write to two places. That's the kind of small sync layer that drifts six months later when someone adds a backfill script and forgets the projection.
3. **It ratifies the lie that handbooks are special.** `handbook_section` keeps its name and its handbook-shaped CHECK constraints. Every future reader of the schema asks the same question we're asking now: "wait, why is there a handbook table?"

The substrate rename closes the gap by fixing the cause once. The `library_entry` projection closes the gap by routing around the cause and committing to maintain the workaround forever.

> **Ratify (1.A):** Pick the **substrate rename** (recommended) or the **`library_entry` projection** (v1's approach, kept as the documented alternative). Default = **substrate rename**.
> **Ratify (1.B):** Confirm the staged rollout: substrate WP lands first (zero behavior change beyond the rename + handbook re-seed); each §6 corpus WP follows opportunistically. The staging is identical regardless of which 1.A wins.

## 2. Corpus catalog

> Snapshot of `5a972b3a` (pre-WP-SUB). Column 5 (`handbook_section` seeded?) describes today's schema; post-substrate the same question becomes "`reference_section` seeded with `content_md`?". The catalog rows are deliberately preserved as historical truth.

Every reference cohort, surveyed against the actual filesystem + the YAML registry today (2026-04-30, post `5a972b3a`). "Library-visible?" = `isReadable` would be `true` for at least one row in the cohort.

| Corpus                           | Cache            | Inline derivs                                 | `study.reference` rows                          | `handbook_section` seeded? | Library-visible? | Action                                                      |
| -------------------------------- | ---------------- | --------------------------------------------- | ----------------------------------------------- | -------------------------- | ---------------- | ----------------------------------------------------------- |
| PHAK FAA-H-8083-25C              | yes              | yes (manifest + 850 sections)                 | yes (seed-handbooks)                            | yes (850)                  | yes              | none                                                        |
| AFH FAA-H-8083-3C                | yes              | yes (manifest + 531 sections)                 | yes (seed-handbooks)                            | yes (531)                  | yes              | gap 6 cleanup (AFH errata duplicate-applied; survey §6)     |
| AVWX FAA-H-8083-28B              | yes              | yes (manifest + 480 sections)                 | yes (seed-handbooks)                            | yes (480)                  | yes              | none                                                        |
| Risk Mgmt FAA-H-8083-2A          | yes              | yes (manifest + whole-doc, post #384)         | yes (seed-handbooks; needs verification)        | depends on PR #384 seed    | depends          | confirm seed actually ran for the 6 extras post #384        |
| Aviation Instructor FAA-H-8083-9 | yes              | yes (whole-doc post #384)                     | yes (post-#384 seed)                            | depends                    | depends          | same as above                                               |
| IFH FAA-H-8083-15B               | yes              | yes (whole-doc post #384)                     | yes (post-#384 seed)                            | depends                    | depends          | same as above                                               |
| IPH FAA-H-8083-16B               | yes              | yes (whole-doc post #384)                     | yes (post-#384 seed)                            | depends                    | depends          | same as above                                               |
| AMT-G FAA-H-8083-30B             | yes              | yes (whole-doc post #384)                     | yes (post-#384 seed)                            | depends                    | depends          | same as above; airplane-track only? user to confirm scope   |
| AMT-P FAA-H-8083-32B             | yes              | yes (whole-doc post #384)                     | yes (post-#384 seed)                            | depends                    | depends          | same as above                                               |
| AIH (handbooks-noningested)      | no               | no                                            | yes (YAML row only)                             | no                         | NO               | ingest via handbooks-extras pipeline OR drop                |
| AIM 2026-04                      | yes              | yes (manifest + 744 entries)                  | yes (`aim` slug from aim-pcg.yaml)              | NO                         | NO               | seed via generalized seeder                                 |
| PCG (Pilot/Controller Gloss)     | bundled with AIM | yes (in AIM manifest)                         | yes (`pcg` slug)                                | NO                         | NO               | same as AIM                                                 |
| CFR Title 14 (2026-04-22)        | yes              | manifest + 7,218 entries (.md gitignored)     | yes (11 part-level YAML rows)                   | NO                         | NO               | seed via generalized seeder; UI question §3                 |
| CFR Title 49 (2026-04-24)        | yes              | manifest (parts 830 + 1552, post PR #382)     | yes (49cfr830, 49cfr1552 YAML rows)             | NO                         | NO               | seed via generalized seeder                                 |
| AC (12 cached / 17 YAML)         | 12               | manifest + 9 doc.md (3 ingestion gaps)        | yes (17 YAML rows)                              | NO                         | NO               | seed via generalized seeder; gaps 3+4 first                 |
| ACS (5 cached / 7 YAML)          | 5                | manifest + 5 element trees (1 wired, 4 gap 2) | yes (7 YAML rows)                               | NO                         | NO               | resolve gap 2 first, then seed                              |
| NTSB (umbrella)                  | no               | no                                            | yes (1 row, umbrella only)                      | no                         | NO               | umbrella card; per-report ingestion is a separate WP (§4.A) |
| POH-AFM (umbrella)               | no               | no                                            | yes (1 row)                                     | no                         | NO               | umbrella card; per-aircraft is out of scope                 |
| Other publications (8)           | no               | no                                            | yes (8 YAML rows, e.g., AOPA ASI, Order 8260-3) | no                         | NO               | each needs its own decision: ingest, link-only, or drop     |

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

Once `reference_section` carries CFR rows (post-WP-SUB), CFR-14 alone adds 7,218 visible entries. AIM adds 744. The current `/library` page treats every reference as one card; a 7k-entry CFR title would either need to be one card (the whole title) or 7k cards (every section). Neither is right.

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

> **Ratify (4.C.URL):** *Resolved 2026-05-01.* DRS-first ingestion. Per-doc config carries a `canonical_url_override` field; populate it later if/when a stable FAA topic-page URL is found. Stops blocking on FAA URL churn.

### 4.D InFOs (Information For Operators)

- Source URL: TBD. Same situation as SAFOs (DRS is the dependable backstop).
- Shape: same as SAFO -- numbered PDFs, slightly higher volume.
- Pipeline: identical to SAFO.
- Citation URI: ADR 019 §1.2 line 182 reserves `info` (alongside `safo`). Reuse.

> **Ratify (4.D.URL):** *Resolved 2026-05-01.* Same as 4.C: DRS-first, `canonical_url_override` field for retrofitting later.

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

## Out of scope

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md). The deferred items below (§"Ratifications (2026-05-01)" and §"Recommended sequence") are extracted into OUT-OF-SCOPE.md with structured trigger / pattern / reference fields. The discussion narrative below remains intact as historical record.

## Ratifications (2026-05-01)

User ran the spec walkthrough on 2026-05-01 and accepted every recommended default. The full block:

| Point             | Ratified                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1.A**           | Substrate rename. (`library_entry` projection rejected as a workaround.)                                                                                                                                                                                                                                                                                               |
| **1.B**           | Staged rollout: WP-SUB first; corpus WPs follow opportunistically.                                                                                                                                                                                                                                                                                                     |
| **2.A**           | Catalog stands as written.                                                                                                                                                                                                                                                                                                                                             |
| **2.B**           | Seed check run as part of PR #388 -- `bun run db seed handbooks` aborts on a ZodError because `kind: whole-doc` manifests don't match `handbookManifestSchema`. The 6 handbooks-extras are NOT seeding into `handbook_section` today. **Implication folded into WP-SUB scope** (§1 step 4: two manifest shapes from day one). WP-EX-Verify is no longer a separate WP. |
| **2.C**           | "Other publications" stay link-only umbrella cards. Order 8260-3 noted as watch-list, no commitment.                                                                                                                                                                                                                                                                   |
| **3.A**           | Part-level cards for CFR-14; title-level for CFR-49.                                                                                                                                                                                                                                                                                                                   |
| **3.B**           | Search-first inside CFR drill-down. Tree available, search is the entry point.                                                                                                                                                                                                                                                                                         |
| **3.C**           | AIM as one card with chapter-tree expansion.                                                                                                                                                                                                                                                                                                                           |
| **4.A**           | NTSB ALJ -- own WP.                                                                                                                                                                                                                                                                                                                                                    |
| **4.B**           | Chief Counsel -- own WP, sequenced first among the new corpora (highest pedagogical leverage).                                                                                                                                                                                                                                                                         |
| **4.C** + **4.D** | SAFOs and InFOs -- own WPs (or one combined). **DRS-first**, with a `canonical_url_override` field on per-doc config for retrofitting a stable URL when one is found. Stops blocking on the FAA's topic-page churn.                                                                                                                                                    |
| **4.E**           | FAA Order 8900.1 -- deferred. Trigger to revisit: "we ship CFI training content that benefits from Vol 5."                                                                                                                                                                                                                                                             |
| **4.F**           | Tips on Mountain Flying -- early. Single-PDF, AC-style pipeline; smallest possible win.                                                                                                                                                                                                                                                                                |
| **4.G**           | AC catalog expansion -- WP, curated to ~50 ACs (not the full ~200).                                                                                                                                                                                                                                                                                                    |
| **5**             | Safety Briefing magazine archive opted in as a follow-on WP. Other candidates (GA-JSC, Part 67, CAP/WINGS, plates) dropped or deferred.                                                                                                                                                                                                                                |
| **6**             | Sequence as written, with WP-EX-Verify folded into WP-SUB per the (2.B) finding.                                                                                                                                                                                                                                                                                       |

The next document is the WP-SUB implementation plan, drafted against this ratified block.

## 6. Recommended sequence

Discrete WPs that ship independently. Each is small enough to ship in a session or two; each leaves the system better than it found it.

> **Note:** Wave 1 of `library-by-cert` (PR #386) shipped between v1 and v2 of this spec and added `reference.primary_cert` (NULL = cert-agnostic; CHECK against `CERT_APPLICABILITY_VALUES`). WP-SUB preserves this column unchanged.

1. **WP-SUB (substrate).** ✅ **Shipped 2026-05-01** via PR #393 (plan) + PR #396 (implementation -- 33 files; landed 23 minutes ahead of its own plan PR). Substrate rename complete: `handbook_section` -> `reference_section` (+ figure, errata), handbook-shaped CHECK constraints dropped, `section_schema` + `metadata` jsonb + `depth` added, `getReadableReferenceIds()` rewritten against `content_md`, seeder generalized to accept both section-tree and whole-doc manifests via `scripts/db/seed-references-from-manifest.ts` dispatch into [`section-tree.ts`](../../libs/bc/study/src/seeders/section-tree.ts) + [`whole-doc.ts`](../../libs/bc/study/src/seeders/whole-doc.ts). Acceptance criterion met: all 9 handbooks seed (3 sectioned + 6 whole-doc). `reference.primary_cert` from PR #386 preserved. (Absorbed v1's WP-V + WP-VS + the formerly-separate WP-EX-Verify.)
2. **WP-MTN.** Tips on Mountain Flying pamphlet -- single PDF, AC-style pipeline. Smallest possible win.
3. **WP-AIM.** AIM seed: walk `aim/<edition>/manifest.json`, populate `reference_section` via the generalized seeder. 744 entries unlocked.
4. **WP-CFR-V.** CFR-14 + CFR-49 seed: same idea, plus the §3 UI question (part-level cards). 7,218 + ~30 entries unlocked.
5. **WP-AC-V.** AC catalog visibility: seed the 9 already-extracted ACs. (Resolving gaps 3+4 from the broad survey is a separate prior fix; deferred per survey recommendation.)
6. **WP-ACS-V.** Same for ACS. Depends on resolving gap 2 (ACS edition slug mapping) from the broad survey first.
7. **WP-CC.** Chief Counsel interpretations -- new corpus, ADR 019 already provisions the URI. Highest pedagogical leverage of the §4 candidates.
8. **WP-NTSB-ALJ.** NTSB ALJ rulings -- new corpus.
9. **WP-SAFO + WP-INFO.** SAFOs and InFOs -- combined or sequential; pipelines are identical. DRS-first per §4.C/4.D ratification, with `canonical_url_override` field on the per-doc config so a stable URL can be retrofitted without re-ratification.
10. **WP-AC-FULL.** Expand the AC config from 12 -> ~50 curated-relevance ACs. Content-only WP; pipeline already exists.
11. **WP-O8900-V5.** FAA Order 8900.1 Volume 5 carve-out (Airman Certification). Deferred per §4.E ratification; trigger to revisit = "we ship CFI training content that benefits from Vol 5."
12. **WP-SAFETY-BRIEF.** Safety Briefing magazine archive (per §5 ratification).

Stop conditions: any WP can be deferred or dropped at any point. The hard order is 1 (foundation), then 2-6 (existing manifests, easy wins), then 7-12 (new corpora, more work). The former WP-EX-Verify is now an acceptance criterion of WP-SUB, not a separate sequenced item.

### Smells worth fixing along the way

These don't block the substrate WP, but they're the same flavor of problem and shouldn't be lost:

1. **`course/references/handbooks-noningested.yaml` is mostly redundant after WP-SUB.** Once WP-SUB's two-shape seeder lands, four of its five rows (AIH, IFH, IPH, risk-mgmt) seed from the handbooks-extras whole-doc manifests. The fifth -- `afh` at edition `FAA-H-8083-3B` (prior edition; `3C` is ingested) -- has no cache and only exists so historical citations to 3B resolve until a content audit promotes them to 3C. Resolution: delete `handbooks-noningested.yaml` once every row has a structured-content equivalent. The 3B-prior-edition row stays until it's ingested (low priority) or content is audited and re-pointed at 3C. The `migrate-references-to-structured.ts` bridge goes with the YAML when the YAML goes.

    **Audit 2026-05-02 (Phase G smell #1 review):** the cleanup is more involved than "delete 4 YAML rows." Slug + edition pairs do not match cleanly across the two seeders:

| YAML noningested         | handbooks-extras                 |
| ------------------------ | -------------------------------- |
| `aih` + `FAA-H-8083-9B`  | `aviation-instructor` + `8083-9` |
| `ifh` + `FAA-H-8083-15B` | `ifh` + `8083-15B`               |
| `iph` + `FAA-H-8083-16B` | `iph` + `8083-16B`               |
| `faa-h-8083-2` + `2A`    | `risk-management` + `8083-2A`    |

    Different `(slug, edition)` pairs land as different `reference` rows. Today on main there are likely 8 rows for these 4 handbooks. The migrator at [`scripts/db/migrate-references-to-structured.ts:139-148`](../../scripts/db/migrate-references-to-structured.ts#L139-L148) hardcodes the noningested slug+edition pairs (`aih + FAA-H-8083-9B`, `iph + FAA-H-8083-16B`, etc.) for citation -> authored-row matching. Deleting noningested rows would make those lookups upsert synthetic rows -- the exact failure mode the YAML's own comment documents.

    **Resolution path:** retire the `migrate-references-to-structured.ts` bridge first (it's a documented one-shot migration script), then delete `handbooks-noningested.yaml` rows that have handbooks-extras equivalents, then cross-update knowledge nodes whose `source` strings reference the legacy slugs. **Trigger to revisit:** the migrator's last consumer is gone (verify via `bun scripts/db/migrate-references-to-structured.ts --dry-run` showing zero rows touched), OR a content audit re-points knowledge-node `source` strings to the new slugs.

    Status: **deferred** -- not fixed in this PR; risk of silent breakage on in-progress citation migrations. Captured here so the cleanup survives across sessions.
2. **17 corpus modules each have identical 3-line `index.ts` registration boilerplate.** A registry that auto-discovers corpora from a manifest would erase ~50 lines and make adding a corpus a single-file change. Low priority; nice cleanup.
3. **Phase-numbered reviewer IDs (`PHASE_3_REVIEWER_ID` ... `PHASE_9_REVIEWER_ID`)** encode ingest order rather than identity. Replace with stable per-corpus reviewer IDs derived from corpus slug. Trivial.
4. **`externalUrlForReference()` switch in constants** (`libs/constants/src/study.ts:1496`) duplicates what the resolver registry is for. Folded into WP-SUB step 7.
5. **Library page conflates "ingested + readable" with "umbrella + link-only."** Open Question #1 below. Worth its own small UX WP after the substrate is honest -- a card-state indicator (`Read · Browse · External link only`).

> **Ratify (6):** Confirm the sequence, or reorder. Default is as listed.

## Open questions

These don't block the WP but should be captured so they don't fall through the cracks:

- Should the library page distinguish "ingested + readable in-app" from "umbrella (link-only)"? Today it shows both as cards; only the "Read in-app" affordance differs. Risk: users tap the umbrella POH card expecting content, get bounced to the FAA. Maybe a card-state indicator (`Read · Browse · External link only`). Picked up as a smell #5 above.
- Where do per-aircraft POHs land? Currently one umbrella row. The user has not asked for this, but it's the elephant in the corpus catalog.
- Once `reference_section` is the substrate, the `/library` page can reasonably support search-across-corpora. Worth its own WP later.

## Verification trail

- `bun run check`: clean (this is a docs-only WP).
- Every URL referenced has a `[200]` or `[?]` + verification date.
- Every catalog row was checked via `find` / `ls` / YAML grep against the actual repo + cache state on `5a972b3a`.
- No code changed.
