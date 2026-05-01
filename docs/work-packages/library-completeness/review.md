---
title: 'Library completeness -- substrate review'
product: study
feature: library-completeness
type: review
status: unread
review_status: done
reviewer: opus-4-7
reviewed: 2026-05-01
target: docs/work-packages/library-completeness/spec.md
---

# Library completeness -- substrate review

A review of [spec.md](spec.md) and the wider ingestion + library presentation system, prompted by the user's question: "Are we getting too complicated? Too many exceptions. Why do we have a `handbook` table at all?"

The short answer: the spec's catalog (§2), URL audit (§4), and sequence (§6) are good and should stand. The recommendation in §1 (Option C: add a `library_entry` projection table) is wrong. It papers over the root cause instead of fixing it. There's a smaller, cheaper, and more honest fix.

## TL;DR

- The system has one structural problem, not several. The table named `handbook_section` is the only place structured corpus content lives. Everything else (CFR, AIM, AC, ACS, …) is metadata-only because there is no generic table to put their nodes in. The `level` enum, the `code` regex, the readability probe, the `LIBRARY_STATES.in-app` semantic, and the dual-seeding YAML carveout all assume "handbook = structured corpus."
- **Option C ships a workaround, not a fix.** It adds a parallel `library_entry` projection that has to stay in sync with the real content. Future corpora still need somewhere to put their nodes; we will end up adding `aim_section`, `cfr_section`, etc. anyway -- or hosting them in `handbook_section` despite the name. We've replaced one lie ("readable means handbook") with two ("library_entry agrees with content tables that don't exist for most corpora").
- **Recommended instead: rename `handbook_section` -> `reference_section`**, drop the handbook-shaped CHECK constraints, declare per-kind hierarchy vocabulary on the `reference` row, store per-row level + per-kind-typed `metadata` jsonb on both tables, generalize the seeder. One migration, ~10 callers updated, no new projection layer. After it lands, every §4 corpus is purely additive.
- The agent's other findings (catalog correctness, ~10 invisible cohorts, 8 new-corpora WPs, URL verification) are accurate and should be preserved verbatim. Only §1's recommendation changes.

## Alignment with the agent's recommendation

The agent (working without seeing this review) recommended Option C plus the staged rollout. Pulling those apart:

| Part of their recommendation                                    | Verdict           | Why                                                                                                                              |
| --------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Visibility gap: Option C (`library_entry` projection)           | **Disagree**      | Treats the symptom (loader probe is handbook-only) instead of the cause (the only structured-content table is misnamed handbook). See "Why Option C is the wrong fix" below.                  |
| Option A rejected (pollutes handbook schema)                    | **Agree**         | Right rejection, but the real lesson is "the schema shouldn't be handbook-shaped at all," not "stop putting non-handbooks in it." |
| Option B rejected (per-corpus tables, N-way coupling)           | **Agree**         | Adds a table per corpus and a UNION per probe. Linear coupling, exactly as they describe.                                        |
| Catalog of ~10 invisible cohorts (§2)                           | **Agree**         | Matches the survey. Counts and gaps are right.                                                                                   |
| 8 new-corpora WPs (§4.A-G plus §5 Safety Briefing)              | **Agree**         | Scope is right. Sequencing in §6 also right.                                                                                     |
| URL audit (404 on SAFO/InFO; DRS as Order 8900.1 mirror; 200s)  | **Agree**         | Verified independently. The SAFO/InFO ratification flags should stay.                                                            |
| Staged rollout (handbooks first, then per-corpus)               | **Agree (kept)**  | The staging is correct regardless of which mechanism wins. Rename + per-corpus seeder lands the same way: substrate first, corpora opportunistically.                                  |

So: keep ~85% of the spec, replace §1's mechanism.

## Why Option C is the wrong fix

The spec frames the choice as "where do we record library readability?" That's the wrong question. The real question is "why is there only one structured-content table, and why is it named after the first corpus we ingested?"

**What Option C actually does:**

- Adds `study.library_entry` -- a projection of "which references have browseable content."
- Each corpus's seed populates it.
- The loader probe becomes `EXISTS library_entry`.
- Per-corpus content tables (`handbook_section`, future `aim_section`, ...) "stay as they are."

**Three problems with that:**

1. **It accepts that future corpora will get their own tables.** The spec says (§1, Option C, Cons): "Per-corpus content tables (`handbook_section`, future `aim_section`, etc.) stay as they are." That's the slow road to Option B. We'll end up with N tables anyway, plus a projection layer. Worst of both.
2. **The projection layer has to stay in sync with the real content.** Mitigated, sure, by populating it in the same transaction. But every corpus seed now has to remember to write to *two* places. That's the kind of "small sync layer" that drifts six months later when someone adds a backfill script and forgets the projection.
3. **It ratifies the lie that handbooks are special.** `handbook_section` keeps its name and its handbook-shaped constraints. Every future reader of the schema asks the same question we're asking now: "wait, why is there a handbook table?"

The agent is right that Options A and B are worse. They missed the option that doesn't appear in the spec: rename the table.

## The actual root cause

`study.handbook_section` is structurally fine. Look at what it stores:

```text
reference_id, parent_id, ordinal, level, code, title, content_md, content_hash,
faa_page_start, faa_page_end, ...
```

That is a generic content-tree row. Every corpus needs exactly this shape:

- A reference it belongs to.
- A parent (or null if root).
- An ordinal among siblings.
- A label for its level in the hierarchy.
- A citation code (`91.103(b)(1)`, `5-2-1`, `1.1.2`, ...).
- A title.
- Markdown body (or null for pure container nodes).
- A content hash for idempotent re-seeding.
- Source page references.

The only things actually handbook-specific are:

| Constraint                                    | Where                                            | Problem                                                            |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `level IN ('chapter','section','subsection')` | [schema.ts:1341](../../../libs/bc/study/src/schema.ts#L1341) | CFR has 5-6 levels; AIM has 4; ACS has task/element. Doesn't fit. |
| `code ~ '^[0-9]+(\.[0-9]+){0,2}$'`            | [schema.ts:1343](../../../libs/bc/study/src/schema.ts#L1343) | Rejects `91.103(b)(1)(i)` and any AC paragraph code outright.     |
| Table named `handbook_section`                | schema.ts                                        | The name lies. It's a reference-content node table.               |
| `handbook_figure`, `handbook_section_errata`  | schema.ts                                        | FK into `handbook_section`. Trivially renamed with the parent.    |
| `getReadableReferenceIds()` queries it        | [handbooks.ts:501](../../../libs/bc/study/src/handbooks.ts#L501) | Probe is `level <> 'chapter'` -- handbook-shape leaking.          |
| `seed-handbooks.ts` walks `handbooks/` only   | [seed-handbooks.ts:79](../../../scripts/db/seed-handbooks.ts#L79) | Hard-coded to one source tree.                                    |
| `LIBRARY_STATES.in-app` derived from above    | [study.ts:1539](../../../libs/constants/src/study.ts#L1539) | UI label says "in-app"; implementation says "has handbook rows."  |

Fix the seven rows above and the visibility gap closes for free, with no projection table, no sync layer, no Option B/C decision to revisit.

## Recommended approach: rename + relax + generalize

One substrate WP, then the spec's §6 sequence runs on top of it nearly unchanged.

### Substrate WP (replaces spec §1's WP-V + WP-VS)

Single PR or small chain of PRs:

1. **Rename tables**:
   - `handbook_section` -> `reference_section`
   - `handbook_figure` -> `reference_figure`
   - `handbook_section_errata` -> `reference_section_errata`
   - Constants module rename: `HANDBOOK_SECTION_*` -> `REFERENCE_SECTION_*`.
2. **Drop the handbook-shaped DB constraints**:
   - Remove the `level` CHECK enum (column stays, name stays -- just no CHECK).
   - Remove the `code` regex CHECK.
   - Add `depth int NOT NULL` for cheap ordering/filtering (0 = top-level child of the reference, ++ per nesting). Depth is positional only; it does **not** map 1:1 to level (CFR is asymmetric -- depth 1 in Part 91 is a Subpart, depth 1 in Part 1 is a Section).
3. **Add per-kind hierarchy declaration on `reference`**:
   - New column: `section_schema jsonb`. Shape: `{ levels: string[], strict_sequence?: boolean }`.
   - `levels` is the **set** of legal `level` values for sections under this reference -- not a fixed sequence. Validators check `every section.level IN reference.section_schema.levels`.
   - `strict_sequence: true` (handbooks) additionally enforces "at depth N, level must be levels[N]." Off by default. CFR/AIM use the loose form because their hierarchies are asymmetric.
4. **Add `metadata jsonb` on both tables**:
   - `reference.metadata` -- per-document extras (CFR title number, NTSB docket, AC cancels-list at the document level).
   - `reference_section.metadata` -- per-section extras (CFR effective date, authority note, cross-refs; AC paragraph cancellations; handbook FAA pages -- or keep `faa_page_start/end` as columns since they already exist; low-stakes call).
   - Both validated by per-kind Zod schemas at ingest, seed, and module load. **No DB-level shape constraint.**
   - For most corpora one of the two will be empty. That's fine. The cost of an empty jsonb column is zero; the cost of cramming per-section data into the document row is awful.
5. **Rewrite `getReadableReferenceIds()`**:
   - New probe: `EXISTS reference_section WHERE reference_id = ? AND content_md IS NOT NULL AND content_md <> ''`.
   - Delete the `level <> 'chapter'` magic. The probe answers "is there body content to render" without naming any level.
6. **Generalize the seeder**:
   - `seed-handbooks.ts` becomes `seed-references-from-manifest.ts` (or keeps the handbooks name for one cycle and gains a corpus parameter).
   - Walks every `*/manifest.json` under `handbooks/`, `aim/`, `regulations/`, `ac/`, `acs/`. Per-corpus quirks live in tiny adapter modules (one per corpus), not in the seed core.
7. **Move URL formatting onto resolvers**:
   - Retire the `kind` switch in [study.ts:1496](../../../libs/constants/src/study.ts#L1496).
   - Each `CorpusResolver` already has a `formatCitation()` slot at [corpus-resolver.ts:38](../../../libs/sources/src/registry/corpus-resolver.ts#L38). Add `externalUrlFor(reference)` to the same protocol.

What this is **not**:

- Not a new `library_entry` table.
- Not a per-corpus content table.
- Not a polymorphic schema with discriminator routing.
- Not a deferred "we'll generalize later" comment.

Estimated scope: rename touches ~10 callers (per the audit). Constraint drops are two ALTER statements. New `section_schema` and `metadata` columns are additive ALTERs. Probe rewrite is ~5 lines. Seeder generalization is the only real work, bounded by the manifest count (5 corpora today). URL switch retirement is mechanical.

### Schema after the substrate WP

Two tables, plus the figure/errata children:

#### `reference` (one row per document)

| Column                 | Type        | Notes                                                                          |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| id                     | text PK     | `ref_ULID`                                                                     |
| kind                   | text        | TS const-array union; Zod-validated at ingest. **No DB CHECK.** See below.     |
| document_slug          | text        | `phak`, `14cfr91`, `ac-91-79b`, `aim-2026-04`                                  |
| edition                | text        | `FAA-H-8083-25C`, `2026-04-22`, `2024-letter-mangiamele`                       |
| title                  | text        | Display title                                                                  |
| publisher              | text        | `FAA`, `NTSB`, `AOPA`, ... Free text; display metadata only.                   |
| subjects               | text[]      | Aviation topics (existing)                                                     |
| section_schema         | jsonb       | `{ levels: string[], strict_sequence?: boolean }`. Per-kind level vocabulary.  |
| superseded_by_id       | text FK     | Self-ref for edition chains (existing)                                         |
| metadata               | jsonb       | Per-kind-typed extras. Empty for kinds that don't need them.                   |
| created_at, updated_at | timestamptz | (existing)                                                                     |

`kind` values: `handbook`, `cfr`, `ac`, `acs`, `aim`, `pcg`, `ntsb`, `interp`, `safo`, `info`, `order`, `pamphlet`, `poh`, `other`. Adding a corpus shouldn't need a migration -- hence the union lives in TS, not in a DB CHECK.

#### `reference_section` (hierarchical content)

| Column                 | Type        | Notes                                                                          |
| ---------------------- | ----------- | ------------------------------------------------------------------------------ |
| id                     | text PK     | `refsec_ULID`                                                                  |
| reference_id           | text FK     | -> `reference.id` ON DELETE CASCADE                                            |
| parent_id              | text FK     | -> `reference_section.id` (null for top-level)                                 |
| ordinal                | int         | Position among siblings                                                        |
| depth                  | int         | 0 for top-level, ++ per nesting. Positional, not semantic.                     |
| level                  | text        | This row's level label. Validated at ingest. **No DB CHECK.** See below.       |
| code                   | text        | Citation locator. Validated at ingest by per-kind regex. **No DB regex.**      |
| title                  | text        | Section heading                                                                |
| content_md             | text NULL   | Markdown body. NULL/empty for pure container rows.                             |
| content_hash           | text        | For idempotent re-seeding (existing pattern)                                   |
| metadata               | jsonb       | Per-kind-typed per-section extras. Empty for kinds that don't need them.       |
| created_at, updated_at | timestamptz |                                                                                |

`level` examples: `chapter`, `section`, `subsection` (handbook); `subpart`, `section`, `paragraph`, `subparagraph`, `clause` (CFR); `chapter`, `section`, `paragraph` (AIM); `task`, `element` (ACS). Validated against `reference.section_schema.levels` at ingest.

`code` examples: `5-2-1` (AIM), `91.103(b)(1)(i)` (CFR), `1.1.2` (handbook subsection).

Indexes:

- `(reference_id, parent_id, ordinal)` -- drives the TOC walk.
- `(reference_id) WHERE content_md IS NOT NULL` -- drives the readability probe.
- `(reference_id, code)` -- drives citation resolution (`14 CFR 91.103` -> section row).

#### `reference_figure`

Pure rename of `handbook_figure`. FKs `reference_section.id`.

#### `reference_section_errata`

Pure rename of `handbook_section_errata`. FKs `reference_section.id`.

### Symmetric vs asymmetric hierarchies

Worth being explicit because this drove the `section_schema` design:

- **Handbook** is symmetric: depth 0 = chapter, depth 1 = section, depth 2 = subsection. Always. -> `section_schema = { levels: ['chapter','section','subsection'], strict_sequence: true }`.
- **CFR Part** is asymmetric: some Parts have Subparts, some are flat. Depth 1 in Part 91 is a Subpart; depth 1 in Part 1 is a Section. -> `section_schema = { levels: ['subpart','section','paragraph','subparagraph','clause'] }`. No `strict_sequence`.
- **AIM** is asymmetric: PCG entries are flat at depth 0; chapter/section/paragraph trees go deeper. -> `section_schema = { levels: ['chapter','section','paragraph'] }`.
- **Chief Counsel letter** is flat: -> `section_schema = { levels: [] }` and zero `reference_section` rows (or one row with the letter body, depending on how the resolver decides to model it).

The renderer asks both questions: `reference.kind` (which dispatcher) and `reference_section.level` (which slot within that dispatcher). Substrate stays uniform; presentation per kind is opinionated.

### Styling story

Two layers, composed:

1. **Generic CSS by `level`.** `.ref-section[data-level="chapter"]`, `.ref-section[data-level="paragraph"]`, etc. Handles ~80% of cases across all corpora.
2. **Per-kind renderer override.** A dispatcher routes on `reference.kind`: `<HandbookSectionRenderer>`, `<CfrSectionRenderer>`, `<AimSectionRenderer>`. Each applies its corpus-specific stylesheet (CFR's hanging-paragraph format, authority-note pill, cross-ref chips; handbook's plainer rendering) and reads its `metadata` jsonb through a Zod schema.

Strongly typed at the kind boundary, generic at the section level. CFR `section` and handbook `section` are different beasts; the renderer reflects that without the substrate caring.

### Fail-fast gates

Bad metadata cannot accumulate because every write path validates:

1. **Ingest time.** Corpus ingest builds `reference` + `reference_section[]`, validates the whole tree against the kind's Zod schema (level membership, code regex, metadata shape). Aborts on first violation. Nothing reaches the DB.
2. **Seed time.** `seed-references-from-manifest.ts` re-validates as it reads `manifest.json`. Catches drift between an old manifest and a newer schema.
3. **Module load (build / startup).** Every corpus resolver self-checks: `section_schema` is well-formed, Zod schemas parse. App fails to boot if any resolver is broken. No silent degradation.
4. **Render time (dev only).** Assert metadata matches schema. Production strips this for perf; dev catches drift introduced by hand-editing rows or partial migrations.

Three of the four gates are at write time. The DB never trusts what it's storing -- the per-kind validators do.

### Then the spec's §6 sequence applies, lightly edited

| Original spec WP | Status under this plan                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WP-V (this WP)   | **Replaced** by the substrate WP above. Same role: foundation that unblocks the rest.                                                                                   |
| WP-VS            | **Folded** into the substrate WP -- it was a refactor on top of Option C; now it's just the substrate landing.                                                          |
| WP-EX-Verify     | **Keep.** Confirm post-#384 handbooks-extras seeding actually produces nodes.                                                                                           |
| WP-MTN           | **Keep.** Mountain Flying pamphlet, single-PDF AC-style pipeline. Smallest possible win.                                                                                |
| WP-AIM           | **Keep, simpler.** AIM seed via the generalized seeder. No new table, no projection update.                                                                             |
| WP-CFR-V         | **Keep.** Same simplification. The §3 UI question (CFR card grain) is unchanged and still needs ratification.                                                           |
| WP-AC-V          | **Keep.** Seed already-extracted ACs into `reference_node`. Resolve gaps 3+4 first.                                                                                     |
| WP-ACS-V         | **Keep.** Same. Resolve gap 2 first.                                                                                                                                    |
| WP-CC            | **Keep.** Chief Counsel letters. Highest pedagogical leverage of the new corpora; agent and I agree.                                                                    |
| WP-NTSB-ALJ      | **Keep.**                                                                                                                                                               |
| WP-SAFO + WP-INFO | **Keep**, contingent on the URL ratification flags the agent surfaced.                                                                                                 |
| WP-AC-FULL       | **Keep.** Curated ~50 ACs > completionist 200. Agent's recommendation is right.                                                                                         |
| WP-O8900-V5      | **Keep.** Vol 5 carve-out only.                                                                                                                                         |
| WP-SAFETY-BRIEF  | **Keep** if §5 ratifies yes.                                                                                                                                            |

## Other smells worth fixing along the way

These don't block the substrate WP, but they're the same flavor of problem and should be tracked:

1. **`handbooks-noningested.yaml` exists only because the seed pipeline was handbook-only.** Once the generalized seeder lands and the 6 handbooks-extras are confirmed seeding (WP-EX-Verify), this file's job is done. Delete it; delete the `migrate-references-to-structured.ts` bridge with it. No other corpus needs the YAML-as-fallback pattern.
2. **17 corpus modules each have identical 3-line `index.ts` registration boilerplate** (e.g. [ac/index.ts:13-16](../../../libs/sources/src/ac/index.ts#L13-L16)). A registry that auto-discovers corpora from a manifest would erase ~50 lines and make adding a corpus a single-file change. Low priority; nice cleanup.
3. **Phase-numbered reviewer IDs (`PHASE_3_REVIEWER_ID` … `PHASE_9_REVIEWER_ID`)** encode ingest order rather than identity. Replace with stable per-corpus reviewer IDs derived from corpus slug. Trivial.
4. **`externalUrlForReference()` switch in constants** ([study.ts:1496](../../../libs/constants/src/study.ts#L1496)) duplicates what the resolver registry is for. Folded into the substrate WP above (step 5).
5. **Library page conflates "ingested + readable" with "umbrella + link-only"** -- the spec's Open Question #1 is right, this should become a card-state indicator (`Read · Browse · External link only`). Worth its own small UX WP after the substrate is honest.

## What stays from the spec verbatim

- §2 Corpus catalog: accurate, no changes.
- §3 CFR / AIM density: orthogonal to substrate, still a real product question. Keep ratification points 3.A/3.B/3.C.
- §4 New corpora: scope and pipelines are right. Keep all ratification points including the SAFO/InFO URL flags.
- §5 Other interesting: keep the menu. Default (only Safety Briefing) is right.
- §6 Sequence: keep, with WP-V/WP-VS replaced by the substrate WP described above.
- Open Questions: keep all three.

## Recommendation

1. **Replace §1 of [spec.md](spec.md)** with the substrate WP described above. Drop Option C. The agent's framing of A/B/C missed the option that fixes the cause instead of the symptom.
2. **Keep everything else in the spec.** The catalog, URL audit, new-corpora list, and sequence are the result of real legwork and should not be rewritten.
3. **Author the substrate WP** at `docs/work-packages/reference-substrate/` (or fold it into `library-completeness/` as a sibling spec). Either works; sibling spec is cheaper.
4. **Run WP-EX-Verify alongside the substrate WP** -- it's a 5-minute check that should not block but should not be forgotten either.
5. **Defer the §1 ratification (Option A/B/C) until the substrate option is on the table.** The user should pick between Option C (projection) and the rename approach, not between A/B/C alone.

> **Ratify (review.1):** Choose between spec §1 Option C (`library_entry` projection) and the substrate rename described above. Default recommendation = **substrate rename**.
> **Ratify (review.2):** Confirm the rest of the spec (catalog, §3 UI questions, §4 new corpora, §5 menu, §6 sequence) survives unchanged regardless of which §1 option wins.

## Verification trail

- Read [spec.md](spec.md) in full.
- Surveyed schema, ingestion modules, seeders, library loader, YAML registry, citation resolvers, and constants. File:line references throughout.
- Confirmed `handbook_section` is the only structured-content table. Confirmed `getReadableReferenceIds()` is handbook-only.
- Confirmed agent's URL audit (200s on Mountain Flying, NTSB ALJ, Chief Counsel, FAA Orders/Notices, Safety Briefing, AC catalog; 404s on SAFO/InFO canonical landings; DRS as Order 8900.1 mirror).
- No code changed. This is a docs-only review.
