---
title: 'Spec: Handbook Ingestion and Reader'
product: study
feature: handbook-ingestion-and-reader
type: spec
status: unread
review_status: pending
---

# Spec: Handbook Ingestion and Reader

The first phase of [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md): a Python ingestion pipeline that turns FAA-published handbook PDFs into per-section markdown plus assets, a `Reference` and `handbook_section` data model that anchors every citation, and a SvelteKit reader that lets a learner read PHAK / AFH / AvWX in-app, track per-section read state, and jump bidirectionally between knowledge nodes and the handbook chapters that back them.

Ships PHAK first; AFH and AvWX as fast-followers; the remaining FAA handbooks (IFH, IPH, helicopter, glider, balloon) on demand. AIM is deliberately deferred to its own work package because of its continuous-revision cycle.

## Why this WP exists

Per [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md) principle 8, references are first-class. A node that cites "PHAK Ch. 12" without letting the learner open PHAK Ch. 12 in-app is a half-feature: it tells the learner where the FAA's wording lives but not what it says. ADR 016 phase 0 lands the handbook reader before the citation table, the credential DAG, or any syllabus work because:

- **Standalone learner value.** User zero can read PHAK end-to-end inside airboss the day this ships, even before any cert dashboard exists.
- **Substrate for phase 1.** Phase 1 (citation table; structured locators on every node) needs the handbook structure to point at. Without sections in the DB, the structured-citation shape is theoretical.
- **Reverse navigation.** "Knowledge nodes that cite this section" is the surface that makes the graph and the handbooks feel like one product. It cannot exist before sections do.

ADR 016 phase 0 is the contract. This spec implements it.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, and the Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md), especially the **Handbook ingestion and reader** section and the **Migration plan** Phase 0 row.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), principle 8 (References are first-class) and the Handbook Integration section.
- [ADR 011 -- Knowledge graph + learning system](../../decisions/011-knowledge-graph-learning-system/decision.md). Knowledge nodes carry the `references` array this WP upgrades.
- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md). Where source PDFs and derivatives live.
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md). How full editions, errata sheets, and supersession are modeled.
- [HANDBOOK_INGESTION_STRATEGIES.md](../../platform/HANDBOOK_INGESTION_STRATEGIES.md). TOC vs LLM extraction strategies; empirical findings from the PHAK run.
- Existing constants this WP composes with: `CERT_APPLICABILITIES`, `KNOWLEDGE_EDGE_TYPES`, `CONTENT_SOURCES`, `REFERENCE_SOURCE_TYPES` (in `libs/constants/src/reference-tags.ts`). The new `REFERENCE_KINDS` constant in this WP is a peer to `REFERENCE_SOURCE_TYPES` (the latter is the 5-axis tagging axis; the former is the storage discriminator on the `reference` table).

## In Scope

1. **Ingestion pipeline (Python).** Fetch FAA PDFs, extract structure via PDF outline, per-section text via PyMuPDF (`fitz`), per-page images bound to figure captions, table detection -> HTML, normalize each section into markdown with frontmatter `(handbook, edition, chapter_number, section_number, section_title, faa_pages, source_url)`. Edition-locked output: a new edition produces a new tree under `<root>/<doc>/<edition>/`; old editions stay. Source PDF is cached locally outside the repo at `$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/source.pdf` per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md).
2. **Storage tree.** Top-level `handbooks/` directory holds inline derivatives only (per-section markdown + figure images + tables + manifest.json). Source PDFs live in the developer-local cache (default `~/Documents/airboss-handbook-cache/`, override via `AIRBOSS_HANDBOOK_CACHE`), not the repo. Layout follows the three-tier rule in [docs/platform/STORAGE.md](../../platform/STORAGE.md): the source PDF is cached + gitignored (LFS plumbing in `.gitattributes` is dormant for the future flip); markdown / figures / tables / manifest.json are inline derivatives; DB rows are generated artifacts that live in Postgres.
3. **DB schema.** New `study.reference`, `study.handbook_section`, `study.handbook_figure`, `study.handbook_read_state` tables. Drizzle ORM only; CHECK constraints mirror existing patterns; IDs use `prefix_ULID` via `@ab/utils createId()`.
4. **BC functions.** `libs/bc/study/src/handbooks.ts` -- list handbooks, list sections per handbook/chapter, get section by locator, list nodes that cite a section (reverse query over the `knowledge_node.references` JSONB), record + read read-state, render markdown to HTML through the existing references pipeline.
5. **Seed pipeline.** `bun run db seed handbooks` rebuilds the DB tables from the committed `handbooks/` tree. Idempotent, content-hashed, no rebuild on unchanged sections.
6. **Reader UI.** `(app)/handbooks/...` routes for index, handbook overview, chapter overview, and section page. Edition badge, "newer edition available" surface, sticky table of contents, figures inline, "Knowledge nodes that cite this section" panel with mastery indicators, read-progress control at the section foot.
7. **Read-progress model.** Per-(user, section) row with `unread | reading | read` plus a separate `comprehended` boolean ("read but didn't get it"), markdown notes, `total_seconds_visible` heartbeat, suggestion heuristic that prompts but never auto-flips state.
8. **Bidirectional citation upgrade (schema-only).** The existing `knowledge_node.references` JSONB array supports a discriminated-union shape that preserves freeform strings (legacy) and adds structured citations (`{ kind: 'handbook', reference_id, locator: { chapter, section, page_start } }` plus stubs for other reference kinds). A `resolveCitationUrl(citation)` resolver returns the URL for handbook citations and `null` for kinds not yet supported. **Migration of existing freeform strings is out of scope** -- that lives in the cert-syllabus WP.
9. **Constants.** New `REFERENCE_KINDS`, `HANDBOOK_READ_STATUSES`, `HANDBOOK_SECTION_LEVELS`, `HANDBOOK_*_ID_PREFIX`, plus thresholds for the read-suggestion heuristic. All in `libs/constants/src/`.
10. **Routes.** `HANDBOOKS`, `HANDBOOK`, `HANDBOOK_CHAPTER`, `HANDBOOK_SECTION` (and edition-pinned variants) added to `libs/constants/src/routes.ts`.
11. **Pareto handbooks.** PHAK (FAA-H-8083-25C) ingested end-to-end as the v1 ship gate. AFH (FAA-H-8083-3) and AvWX (FAA-H-8083-28) ingested before this WP closes; pipeline proves out on three handbooks before declaring stability.

## Out of Scope (explicit)

- **Commercial publisher content.** Jeppesen, ASA, Sporty's, King, Gleim. Out by license, not by interest.
- **Migration of existing node `references` arrays.** All existing freeform strings stay freeform until the cert-syllabus WP runs the migration pass. The schema accepts both shapes; resolution and UI prefer structured when present.
- **The `Citation` table.** ADR 016 phase 1. This WP delivers the `reference` and `handbook_section` tables; per-citation rows on a separate table land later.
- **Handbook lens / browse-by-handbook on the dashboard.** ADR 016 phase 8 (lens framework). The reader exists; the dashboard surface that ranks handbooks by coverage does not.
- **AIM ingestion.** AIM is published as a continuously revised document with frequent change pages; the parser must track changes per paragraph rather than per edition. Different pipeline, different cadence, separate WP.
- **Pilot/Controller Glossary, Advisory Circulars, NTSB reports, POH excerpts.** Each will get its own ingestion WP when needed. Their citations resolve through the same `reference` table; the parser shapes differ enough that lumping them in here would inflate scope without payoff.
- **Multi-tenant content sharing.** Notes and read-state are per-user and private. No "share my notes" surface in v1.
- **Handbook authoring inside airboss.** Hangar may eventually surface FAA edition diffs, but that is a hangar feature, not part of this WP.
- **Audio narration of sections.** Audio surface lives in the future `audio/` app; a handbook-section "listen" button is a downstream candidate, not v1.
- **Cross-handbook search.** A search box scoped to handbooks is a follow-up; v1 relies on the existing references / glossary search and the per-handbook table of contents.

## Architecture overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FAA PDF                                                            │
│   |                                                                 │
│   v                                                                 │
│  tools/handbook-ingest/  (Python; PyMuPDF / fitz)                   │
│    fetch -> outline -> per-section text -> figures -> tables ->     │
│    normalize -> per-section markdown + assets                       │
│   |                                                                 │
│   v                                                                 │
│  handbooks/<doc>/<edition>/                                         │
│    <chapter>/<section>.md       (frontmatter + markdown body)       │
│    figures/<figure-id>.png      (image assets)                      │
│    tables/<table-id>.html       (extracted HTML tables)             │
│    manifest.json                (chapter -> section index, hashes)  │
│   |                                                                 │
│   v                                                                 │
│  bun run db seed handbooks                                          │
│    upsert reference + handbook_section + handbook_figure rows       │
│   |                                                                 │
│   v                                                                 │
│  apps/study/  (app)/handbooks/...                                   │
│    /handbooks                          all handbooks index          │
│    /handbooks/[doc]                    chapters for a handbook      │
│    /handbooks/[doc]/[chapter]          chapter overview             │
│    /handbooks/[doc]/[chapter]/[section] readable section            │
└─────────────────────────────────────────────────────────────────────┘
```

The pipeline runs locally (Joshua, or a future content author). Re-ingestion happens when the FAA publishes a new edition or a correction. Output is committed; the seed reads what's committed.

## Data Model

All tables in the `study` Postgres schema namespace. IDs use `prefix_ULID` via `@ab/utils createId()`. Drizzle ORM. CHECK constraints follow the existing `inList(...)` pattern.

### study.reference

The first-class citation source. Edition-versioned. One row per (`document_slug`, `edition`).

| Column           | Type        | Constraints                                                                                        | Notes                                                                                                                |
| ---------------- | ----------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| id               | text        | PK                                                                                                 | `ref_` prefix.                                                                                                       |
| kind             | text        | NOT NULL, CHECK in `REFERENCE_KIND_VALUES`                                                         | handbook / cfr / ac / acs / pts / aim / pcg / ntsb / poh / other.                                                    |
| document_slug    | text        | NOT NULL                                                                                           | `phak`, `afh`, `avwx`, `ifh`, `iph`, `14cfr61`, `ac61-65`, etc. Stable across editions.                              |
| edition          | text        | NOT NULL                                                                                           | `FAA-H-8083-25C`, `2024-09`, revision date. Free-form per kind.                                                      |
| title            | text        | NOT NULL                                                                                           | Display name: "Pilot's Handbook of Aeronautical Knowledge".                                                          |
| publisher        | text        | NOT NULL, DEFAULT 'FAA'                                                                            | Manufacturer for POHs; 'FAA' for everything else in v1.                                                              |
| url              | text        | NULL                                                                                               | Official source URL when available.                                                                                  |
| superseded_by_id | text        | NULL, FK `study.reference.id` ON DELETE SET NULL                                                   | Set when a newer edition exists. Reader surfaces "newer edition available" when this points to a non-archived row.   |
| seed_origin      | text        | NULL                                                                                               | Standard project-wide dev-seed marker (matches every other seedable table). NULL on production rows.                 |
| created_at       | timestamptz | NOT NULL, DEFAULT now()                                                                            |                                                                                                                      |
| updated_at       | timestamptz | NOT NULL, DEFAULT now()                                                                            |                                                                                                                      |

Unique: `(document_slug, edition)`. Index: `(kind)`, `(document_slug, superseded_by_id)`.

### study.handbook_section

Per-section content row. One row per `<chapter>/<section>.md` file. Tree-shaped via `parent_id` (a chapter is a row at `level='chapter'` with `parent_id IS NULL`; sections and subsections nest underneath).

| Column          | Type        | Constraints                                                              | Notes                                                                                                       |
| --------------- | ----------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| id              | text        | PK                                                                       | `hbs_` prefix.                                                                                              |
| reference_id    | text        | NOT NULL, FK `study.reference.id` ON DELETE CASCADE                      | Edition-binding live here, not on the section.                                                              |
| parent_id       | text        | NULL, FK `study.handbook_section.id` ON DELETE CASCADE                   | NULL for chapter rows; the chapter for sections; the section for subsections.                               |
| level           | text        | NOT NULL, CHECK in `HANDBOOK_SECTION_LEVEL_VALUES`                       | chapter / section / subsection.                                                                             |
| ordinal         | integer     | NOT NULL                                                                 | Within-parent sort order.                                                                                   |
| code            | text        | NOT NULL                                                                 | Citation code: `12` for chapter 12, `12.3` for section 3, `12.3.2` for subsection.                          |
| title           | text        | NOT NULL                                                                 | Section title from the handbook.                                                                            |
| faa_page_start  | text        | NULL                                                                     | First FAA-printed page reference verbatim (e.g., `"12-7"`). Text because FAA pagination is hyphenated.      |
| faa_page_end    | text        | NULL                                                                     | Last FAA-printed page reference in the range. NULL when the section ends on `faa_page_start`.               |
| source_locator  | text        | NOT NULL                                                                 | Canonical citation string: "PHAK Ch 12 §3 (pp. 12-7..12-9)". Cached for display.                            |
| content_md      | text        | NOT NULL, DEFAULT ''                                                     | Section body markdown. Empty for chapter rows.                                                              |
| content_hash    | text        | NOT NULL                                                                 | SHA-256 of the source markdown file. Drives idempotent seed.                                                |
| has_figures     | boolean     | NOT NULL, DEFAULT false                                                  | True when the section's `handbook_figure` count is > 0. Cached for fast list rendering.                     |
| has_tables      | boolean     | NOT NULL, DEFAULT false                                                  | True when the markdown carries one or more extracted tables.                                                |
| seed_origin     | text        | NULL                                                                     | Dev-seed marker.                                                                                            |
| created_at      | timestamptz | NOT NULL, DEFAULT now()                                                  |                                                                                                             |
| updated_at      | timestamptz | NOT NULL, DEFAULT now()                                                  |                                                                                                             |

Unique: `(reference_id, code)`. Indexes: `(reference_id, parent_id, ordinal)` for tree walks; `(reference_id, level, ordinal)` for chapter listings.

### study.handbook_figure

Per-figure record. Bound to a section by FK; ordered by `ordinal` within the section.

| Column      | Type        | Constraints                                                  | Notes                                                                                                |
| ----------- | ----------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| id          | text        | PK                                                           | `hbf_` prefix.                                                                                       |
| section_id  | text        | NOT NULL, FK `study.handbook_section.id` ON DELETE CASCADE   |                                                                                                      |
| ordinal     | integer     | NOT NULL                                                     | Within-section order.                                                                                |
| caption     | text        | NOT NULL, DEFAULT ''                                         | "Figure 12-7. ..." text from the PDF.                                                                |
| asset_path  | text        | NOT NULL                                                     | Repo-relative path under `handbooks/<doc>/<edition>/figures/`.                                       |
| width       | integer     | NULL                                                         | In pixels.                                                                                           |
| height      | integer     | NULL                                                         |                                                                                                      |
| seed_origin | text        | NULL                                                         |                                                                                                      |
| created_at  | timestamptz | NOT NULL, DEFAULT now()                                      |                                                                                                      |

Index: `(section_id, ordinal)`.

### study.handbook_read_state

Per-(user, section) read tracking. Composite PK so a user has at most one row per section (across all editions; if they read PHAK 25B and now PHAK 25C is current, they get a fresh row for the 25C section because `handbook_section.id` differs).

| Column                  | Type        | Constraints                                                | Notes                                                                                            |
| ----------------------- | ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| user_id                 | text        | NOT NULL, FK `bauth_user.id` ON DELETE CASCADE             |                                                                                                  |
| handbook_section_id     | text        | NOT NULL, FK `study.handbook_section.id` ON DELETE CASCADE | Reference + edition reachable transitively via the section row.                                  |
| status                  | text        | NOT NULL, DEFAULT 'unread', CHECK in `HANDBOOK_READ_STATUS_VALUES` | unread / reading / read.                                                                  |
| comprehended            | boolean     | NOT NULL, DEFAULT false                                    | "Read but didn't get it" toggle. Counts as read for coverage; queryable for a "to revisit" lens. |
| last_read_at            | timestamptz | NULL                                                       | Most recent heartbeat.                                                                           |
| opened_count            | integer     | NOT NULL, DEFAULT 0                                        | Increments each distinct page open (debounced at the BC layer).                                  |
| total_seconds_visible   | integer     | NOT NULL, DEFAULT 0                                        | Sum of heartbeat-windowed seconds the section was on screen and visible.                         |
| notes_md                | text        | NOT NULL, DEFAULT ''                                       | User's private markdown notes scoped to this section.                                            |
| seed_origin             | text        | NULL                                                       |                                                                                                  |
| created_at              | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                  |
| updated_at              | timestamptz | NOT NULL, DEFAULT now()                                    |                                                                                                  |

Composite PK: `(user_id, handbook_section_id)`. Indexes: `(user_id, status)` for "unread sections in handbook X" queries; `(handbook_section_id)` for cross-user analytics (later).

### Bidirectional citation upgrade -- `knowledge_node.references` JSONB shape

The existing column stays a JSONB array. v1 entries are preserved. New entries can carry either the legacy freeform shape or a structured discriminated union. The build script writes whichever the author authored; the resolver handles both. No data migration in this WP.

```typescript
// libs/types/src/citation.ts (new)
export type LegacyCitation = {
  source: string;        // "PHAK Ch. 12 §3"
  detail: string;
  note: string;
};

export type StructuredCitation =
  | {
      kind: 'handbook';
      reference_id: string;             // ref_...
      locator: {
        chapter: number;                // 12
        section?: number;               // 3
        subsection?: number;            // optional
        page_start?: string;            // "12-7" -- FAA pagination is hyphenated
        page_end?: string;
      };
      note?: string;
    }
  | {
      kind: 'cfr';
      reference_id: string;
      locator: {
        title: number;                  // 14
        part: number;                   // 91
        section: string;                // "155" or "175(b)(2)"
      };
      note?: string;
    }
  | {
      kind: 'ac';
      reference_id: string;
      locator: { paragraph?: string };
      note?: string;
    }
  | {
      kind: 'acs' | 'pts';
      reference_id: string;
      locator: { area?: string; task?: string; element?: string };
      note?: string;
    }
  | {
      kind: 'aim';
      reference_id: string;
      locator: { paragraph?: string };  // "5-1-7"
      note?: string;
    }
  | {
      kind: 'pcg';
      reference_id: string;
      locator: { term?: string };
      note?: string;
    }
  | {
      kind: 'ntsb' | 'poh' | 'other';
      reference_id: string;
      locator: { detail?: string };
      note?: string;
    };

export type Citation = LegacyCitation | StructuredCitation;
```

The build script narrows on the presence of a `kind` field to decide which shape it parsed. v1 ships the `handbook` resolver only; every other kind returns `null` from `resolveCitationUrl(...)` so the UI can fall back to "no link available." The cert-syllabus WP fills out the rest.

## Behavior

### Ingestion -- `tools/handbook-ingest/` (Python)

Layout, dependencies, and CLI:

```text
tools/handbook-ingest/
  pyproject.toml          (PyMuPDF, beautifulsoup4, lxml, pillow, click, ruff)
  README.md
  ingest/
    __init__.py
    cli.py                (`bun run handbook-ingest <doc> --edition <e>` shells to `python -m ingest`)
    fetch.py              (download from FAA URL, checksum)
    outline.py            (PDF outline -> chapter/section/subsection tree)
    sections.py           (per-section text via fitz; layout-aware extraction)
    figures.py            (per-page image extraction; "Figure 12-7." caption binder)
    tables.py             (table detection -> HTML; merges cross-page tables)
    normalize.py          (write per-section markdown + frontmatter; emit manifest.json)
    config/
      phak.yaml           (PDF URL, edition tag, page-offset map, figure-prefix rules)
      afh.yaml
      avwx.yaml
```

CLI:

```text
bun run handbook-ingest phak --edition 8083-25C
bun run handbook-ingest phak --edition 8083-25C --chapter 12     # single-chapter rerun
bun run handbook-ingest phak --edition 8083-25C --dry-run        # validate only; no writes
bun run handbook-ingest phak --edition 8083-25C --force          # re-extract even if hashes match
```

(The `bun run handbook-ingest` script in the monorepo root `package.json` shells out to `python -m ingest` from `tools/handbook-ingest/`. Bun is the dispatcher; Python is the runtime. This keeps the developer entry point uniform.)

Output trees (per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) and [STORAGE.md](../../platform/STORAGE.md)):

In-repo (committed inline):

```text
handbooks/
  phak/
    8083-25C/
      manifest.json                      # {reference, source_url, source_sha256, chapters, sections, hashes, figures}
      00-front-matter.md
      01/
        index.md                         # chapter overview text + section list
        01-introduction-to-flying.md
        02-aircraft-structure.md
        ...
      12/
        index.md
        01-atmospheric-pressure.md
        ...
      figures/
        fig-12-7-pressure-altitude.png
        ...
      tables/
        tbl-12-3-density-altitude.html
        ...
  afh/
    8083-3C/
      manifest.json
      ...
  avwx/
    8083-28/
      manifest.json
      ...
```

Local cache (NOT in repo; default `~/Documents/airboss-handbook-cache/`, override via `AIRBOSS_HANDBOOK_CACHE`):

```text
$AIRBOSS_HANDBOOK_CACHE/
  handbooks/
    phak/8083-25C/source.pdf             # 74 MB FAA-fetched
    afh/8083-3C/source.pdf               # 261 MB FAA-fetched
    avwx/8083-28/source.pdf              # FAA-fetched
```

The cached `source.pdf` is canonical for re-extraction. The pipeline writes it once (downloaded from `source_url`) and re-uses it on subsequent runs. Re-extraction (improved cropping, table fix, etc.) reads from the cached bytes; no internet round-trip after the first pull. The audit trail lives in `manifest.json` via `(source_url, source_sha256, fetched_at)`. The text the reader renders is the per-section markdown, which *is* the canonical extracted text -- there is no separate plaintext blob alongside the markdown.

Section markdown shape:

```markdown
---
handbook: phak
edition: 8083-25C
chapter_number: 12
section_number: 3
section_title: "Atmospheric Pressure and Altitude"
faa_pages: "12-7..12-9"
source_url: "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak"
---

# Atmospheric Pressure and Altitude

Body markdown extracted from the PDF, with figures and tables linked
inline...

![Figure 12-7. Pressure altitude.](../figures/fig-12-7-pressure-altitude.png)
```

Validation gates inside the pipeline:

| Rule                                                            | Severity |
| --------------------------------------------------------------- | -------- |
| The PDF outline parsed cleanly into chapter/section/subsection. | error    |
| Every section's text is non-empty.                              | error    |
| Every figure caption that matches `Figure N-N.` binds to an image. | warning |
| Every cross-page table merged without a gap.                    | warning  |
| Every internal "see Chapter N" cross-reference resolves to a chapter that exists in this edition. | warning |

Errors fail the run; warnings print and continue. Manifest records counts of each.

### Seed -- `bun run db seed handbooks`

Reads `handbooks/<doc>/<edition>/manifest.json` and the section markdown files, upserts `reference`, `handbook_section`, `handbook_figure` rows. Idempotent: a section whose `content_hash` matches the DB row is skipped.

Pipeline (one `db.transaction` per `<doc>/<edition>`):

1. Insert or update the `reference` row for `(document_slug, edition)`. Look up any earlier edition row for the same `document_slug`; if found, point its `superseded_by_id` at the new row.
2. Walk the manifest tree top-down. For each chapter / section / subsection:
   - Compute the deterministic `code` (`12.3.2`).
   - Compute `source_locator` from `(reference, code, faa_pages)`.
   - Upsert the `handbook_section` row by `(reference_id, code)` unique key.
   - Compare `content_hash`; skip body upsert if unchanged. Keeps `updated_at` stable.
3. Per section, replace `handbook_figure` rows in a single `delete + insert` if the section's hash changed. Otherwise leave figures alone.
4. Emit a summary line per handbook: `phak 8083-25C: 18 chapters, 247 sections, 412 figures, 27 tables`.

Wired into `scripts/db/seed-all.ts` as a phase named `handbooks`. Runs after `users` and `knowledge` so the `knowledge_node` rows that need to resolve handbook references can later see them. The seed is also runnable in isolation: `bun run db seed handbooks`.

### Reader UI -- `(app)/handbooks/...`

Routes (Open Question 2; recommended):

| Route                                                | Purpose                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/handbooks`                                         | Index of all handbooks. One card per non-superseded reference.                                       |
| `/handbooks/[doc]`                                   | Per-handbook chapter list. Edition badge (latest by default).                                        |
| `/handbooks/[doc]/[chapter]`                         | Chapter overview: title, page range, list of sections, list of nodes that cite anything in chapter.  |
| `/handbooks/[doc]/[chapter]/[section]`               | Readable section. Markdown, figures, sticky TOC, citing-nodes panel, read-progress control.          |
| `/handbooks/[doc]/[chapter]/[section]?edition=8083-25B` | Explicit edition pinning. Default = latest non-superseded edition.                                |

URL grammar uses chapter/section codes from `handbook_section.code` so URLs are stable across editions even if titles drift.

Per-page behaviors:

- `/handbooks` -- one card per handbook (PHAK, AFH, AvWX in v1). Edition badge. Total chapters. % read for the current user (sections with `status='read'` divided by total sections under the handbook). Click -> handbook chapter list.
- `/handbooks/[doc]` -- chapter list with title, page range, section count, % read for the user, and a "newer edition available" banner if the loaded edition has a non-null `superseded_by_id`. The banner links to the latest edition with one click.
- `/handbooks/[doc]/[chapter]` -- section list with each section's read status badge (Unread / Reading / Read / Read but didn't get it), plus a "Knowledge nodes that cite this chapter" panel. Each node row shows title and dual-gate mastery (`mastered / not_mastered / insufficient_data`).
- `/handbooks/[doc]/[chapter]/[section]` -- the workhorse. Header with full citation string and edition badge. Markdown body rendered via the existing references resolver (so `[[GLOSSARY::id]]` wiki-links resolve against `@ab/aviation`; cross-section internal links resolve to handbook URLs). Sticky table of contents in the right column listing chapter sections, with the active one highlighted. Figures inline at their caption point. Tables rendered from the extracted HTML. At the foot: the citing-nodes panel, the read-progress control (Open Question 4), and the per-section notes editor (markdown textarea, autosaves on blur).

The section page is the only page that runs the heartbeat.

### Read-progress mechanics

- Initial state: `unread`.
- Opening a section's page: `opened_count` increments (debounced 5s server-side so a flicker doesn't double-count). Status flips from `unread -> reading` automatically the first time `opened_count` becomes 1; this is the **only** automatic transition. Subsequent flips require user input.
- Heartbeat: while the section page is visible (`document.visibilityState === 'visible'`), the client posts a heartbeat every `HANDBOOK_HEARTBEAT_INTERVAL_SEC` seconds. Each heartbeat updates `total_seconds_visible` (additive) and `last_read_at`. (Open Question 5 picks the interval; default = 15 seconds.)
- Suggestion heuristic: at the foot of the section, when (`opened_seconds_in_session >= HANDBOOK_SUGGEST_OPEN_SECONDS`) AND (`total_seconds_visible >= HANDBOOK_SUGGEST_TOTAL_SECONDS`) AND the user has scrolled to the bottom, render a non-blocking "Mark this section as read?" prompt. Clicking it sets `status='read'` and dismisses the prompt; ignoring it leaves state alone.
- "Read but didn't get it": separate toggle that sets `comprehended=false`. The user can mark a section read, then later toggle "didn't get it" -- it stays counted as read for coverage but appears in a "to revisit" filter on the chapter page.
- Re-read: an explicit action that resets `status='unread'` and clears `comprehended`. Notes survive. `last_read_at` is left untouched (the historical "I started this once" lives there).
- Notes: free-form markdown textarea. Autosaves on blur and on debounced typing pause. Always private to the user.

Defaults proposed for the heuristic (Open Question 5):

| Constant                          | Value         | Notes                                                                |
| --------------------------------- | ------------- | -------------------------------------------------------------------- |
| `HANDBOOK_HEARTBEAT_INTERVAL_SEC` | 15            | Throttled client heartbeat. Tradeoff between accuracy and load.      |
| `HANDBOOK_SUGGEST_OPEN_SECONDS`   | 60            | Minimum live time on the page in this session before prompting.      |
| `HANDBOOK_SUGGEST_TOTAL_SECONDS`  | 90            | Aggregate `total_seconds_visible` across visits before prompting.    |
| `HANDBOOK_SUGGEST_REQUIRES_SCROLL_END` | true     | Must reach scroll-bottom for the prompt to surface.                  |

### Bidirectional citation -- `resolveCitationUrl`

Pure function in `libs/bc/study/src/handbooks.ts`:

```typescript
export function resolveCitationUrl(
  citation: Citation,
  references: ReferenceRow[],
): string | null {
  if (!('kind' in citation)) return null;          // legacy freeform
  if (citation.kind !== 'handbook') return null;   // future kinds
  const ref = references.find((r) => r.id === citation.reference_id);
  if (!ref) return null;
  const { chapter, section } = citation.locator;
  if (section == null) return ROUTES.HANDBOOK_CHAPTER(ref.document_slug, chapter);
  return ROUTES.HANDBOOK_SECTION(ref.document_slug, chapter, section);
}
```

The reverse query -- "knowledge nodes that cite this section" -- is a `libs/bc/study/src/handbooks.ts` BC function that walks `knowledge_node.references` JSONB looking for entries with `kind='handbook'` and `reference_id` + locator matching the target section. v1 implementation: `WHERE references @> ?::jsonb` with a partial match on `kind` and `reference_id`, then in-memory filter by `locator.chapter` and `locator.section`. Indexed via a GIN index on `knowledge_node.references` (created in this WP). At 30 nodes the in-memory filter is trivial; at 500+ nodes the GIN index keeps the candidate list bounded.

## Constants

`libs/constants/src/study.ts` extensions:

```typescript
export const REFERENCE_KINDS = {
  HANDBOOK: 'handbook',
  CFR: 'cfr',
  AC: 'ac',
  ACS: 'acs',
  PTS: 'pts',
  AIM: 'aim',
  PCG: 'pcg',
  NTSB: 'ntsb',
  POH: 'poh',
  OTHER: 'other',
} as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[keyof typeof REFERENCE_KINDS];
export const REFERENCE_KIND_VALUES = Object.values(REFERENCE_KINDS);
export const REFERENCE_KIND_LABELS: Record<ReferenceKind, string> = { /* ... */ };

export const HANDBOOK_SECTION_LEVELS = {
  CHAPTER: 'chapter',
  SECTION: 'section',
  SUBSECTION: 'subsection',
} as const;
export type HandbookSectionLevel = (typeof HANDBOOK_SECTION_LEVELS)[keyof typeof HANDBOOK_SECTION_LEVELS];
export const HANDBOOK_SECTION_LEVEL_VALUES = Object.values(HANDBOOK_SECTION_LEVELS);

export const HANDBOOK_READ_STATUSES = {
  UNREAD: 'unread',
  READING: 'reading',
  READ: 'read',
} as const;
export type HandbookReadStatus = (typeof HANDBOOK_READ_STATUSES)[keyof typeof HANDBOOK_READ_STATUSES];
export const HANDBOOK_READ_STATUS_VALUES = Object.values(HANDBOOK_READ_STATUSES);
export const HANDBOOK_READ_STATUS_LABELS: Record<HandbookReadStatus, string> = {
  [HANDBOOK_READ_STATUSES.UNREAD]: 'Unread',
  [HANDBOOK_READ_STATUSES.READING]: 'Reading',
  [HANDBOOK_READ_STATUSES.READ]: 'Read',
};

export const REFERENCE_ID_PREFIX = 'ref';
export const HANDBOOK_SECTION_ID_PREFIX = 'hbs';
export const HANDBOOK_FIGURE_ID_PREFIX = 'hbf';

export const HANDBOOK_HEARTBEAT_INTERVAL_SEC = 15;
export const HANDBOOK_SUGGEST_OPEN_SECONDS = 60;
export const HANDBOOK_SUGGEST_TOTAL_SECONDS = 90;
export const HANDBOOK_SUGGEST_REQUIRES_SCROLL_END = true;
```

`REFERENCE_KINDS` is a peer to `REFERENCE_SOURCE_TYPES` (`libs/constants/src/reference-tags.ts`): the latter is the 5-axis tag for the existing reference / extraction system; the former is the storage discriminator that controls which `Citation` shape is valid. Both lists overlap deliberately. The cert-syllabus WP can collapse them to one if the duplication starts costing.

## Routes

`libs/constants/src/routes.ts` additions:

```typescript
HANDBOOKS: '/handbooks',
HANDBOOK: (doc: string) => `/handbooks/${encodeURIComponent(doc)}` as const,
HANDBOOK_CHAPTER: (doc: string, chapter: number | string) =>
  `/handbooks/${encodeURIComponent(doc)}/${encodeURIComponent(String(chapter))}` as const,
HANDBOOK_SECTION: (doc: string, chapter: number | string, section: number | string) =>
  `/handbooks/${encodeURIComponent(doc)}/${encodeURIComponent(String(chapter))}/${encodeURIComponent(String(section))}` as const,
HANDBOOK_SECTION_AT_EDITION: (doc: string, chapter: number | string, section: number | string, edition: string) =>
  `/handbooks/${encodeURIComponent(doc)}/${encodeURIComponent(String(chapter))}/${encodeURIComponent(String(section))}?${QUERY_PARAMS.EDITION}=${encodeURIComponent(edition)}` as const,
```

`QUERY_PARAMS.EDITION = 'edition'` is added at the same time. `NAV_LABELS.HANDBOOKS = 'Handbooks'` is the nav label.

## Validation

| Field / surface                                 | Rule                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `reference.document_slug`                       | NOT NULL, kebab-case, 3-32 chars.                                                                          |
| `reference.edition`                             | NOT NULL, 1-64 chars.                                                                                      |
| `reference.kind`                                | In `REFERENCE_KIND_VALUES`. CHECK on the column.                                                           |
| `reference (document_slug, edition)`            | Unique.                                                                                                    |
| `handbook_section.code`                         | Matches `^\d+(\.\d+){0,2}$`. Composed deterministically by the seed.                                       |
| `handbook_section.level`                        | In `HANDBOOK_SECTION_LEVEL_VALUES`. CHECK.                                                                  |
| `handbook_section.parent_id`                    | NULL when `level='chapter'`; non-NULL otherwise. Enforced by seed + DB trigger or check.                   |
| `handbook_section (reference_id, code)`         | Unique.                                                                                                    |
| `handbook_figure.asset_path`                    | NOT NULL; file must exist on disk at seed time (seed errors otherwise).                                    |
| `handbook_read_state.status`                    | In `HANDBOOK_READ_STATUS_VALUES`. CHECK.                                                                   |
| `handbook_read_state.total_seconds_visible`     | `>= 0`. CHECK.                                                                                             |
| `handbook_read_state.notes_md`                  | Bounded length 0..16384 chars (BC layer; UI advises against essays here).                                  |
| `Citation` (structured) on `knowledge_node.references` | Must have `kind` in `REFERENCE_KINDS`, `reference_id` resolves to a `reference` row, locator matches kind. Validated by `bun run db build`. |
| Heartbeat POST                                  | Rejects intervals < 5s (anti-flood). Caps the recorded delta at `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4`.     |
| Read-state status flip                          | UI permits any (`unread <-> reading <-> read`) transition. The system never automatically advances to `read`. |

## Edge cases

- **Section deleted in a new edition.** Old edition's `handbook_section` row stays. Citations that point at the old `(reference_id, code)` keep resolving. New edition has no row at that code. The reader never silently swaps; the URL `?edition=8083-25B` still works.
- **PDF outline missing or unreliable.** The pipeline aborts with an error listing every chapter the outline did not produce. Manual `outline.yaml` override per handbook lives in the handbook config. Joshua decides whether to ship a handbook whose outline needs hand-curation.
- **Figure caption present without a paired image.** Pipeline emits a warning per occurrence; the affected section markdown is still written without the inline figure. The reader renders the section without the image and notes "(figure missing)" inline.
- **User opens a section, never scrolls.** Heartbeat continues but the suggestion never triggers. Status remains `reading`. Acceptable.
- **Multiple sessions, partial reads.** Heartbeat sums into `total_seconds_visible`. Status stays `reading` until the user explicitly marks `read` or hits the heuristic.
- **User toggles "didn't get it" before marking read.** Setting `comprehended=false` while `status='unread'` is silently a no-op for coverage; the toggle becomes meaningful once `status` flips. UI keeps the toggle disabled until status reaches `reading` to avoid silent failures.
- **Network partition while heartbeat fires.** Client buffers up to N heartbeats (`HANDBOOK_HEARTBEAT_BUFFER = 12`, ~3 minutes at 15s) and replays on reconnect. Past the buffer cap, the oldest heartbeats are dropped.
- **Two browser tabs open on the same section.** Each tab heartbeats independently; the server sees both and adds. Acceptable inflation; user knows they had two tabs open.
- **Newer edition published between read and re-visit.** Reading 25B and 25C exists -> `superseded_by_id` is set on 25B. Reader shows the banner. The user's read-state for 25B sections persists; opening the same section in 25C creates a fresh row. A "carry my read-state forward" feature is deferred (open as a future ADR if real friction shows up).
- **Handbook exists but has zero ingested sections.** Reference row is present; chapter list renders an empty state with "ingestion incomplete; rerun `bun run handbook-ingest <doc>`."
- **A node's structured citation references a `reference_id` that no longer exists.** The reverse query skips the row; the resolver returns `null`. The build script warns at validation time. The detail UI on the node renders the freeform `note` if present, otherwise a faded "(citation broken)" tag.
- **Heartbeat throttle collision with browser background-tab throttling.** The `document.visibilityState !== 'visible'` gate already blocks heartbeats from background tabs, so the OS-level setInterval throttle is moot.

## Resolved decisions

The five questions below were originally posed as Open Questions for the user to resolve. All were resolved on 2026-04-26 in favor of the recommended option in each. The original alternatives + rationale are kept here as the design record. ADR 018 (storage policy) was authored alongside Decision 1 because the answer establishes a repo-wide rule, not just a WP-local choice.

### 1. Storage location -- top-level `handbooks/` (resolved)

**Resolved: top-level `handbooks/` for inline derivatives only. Source PDFs live in `$AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/source.pdf` (developer-local cache, default `~/Documents/airboss-handbook-cache/`) per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md). LFS plumbing in `.gitattributes` is dormant; `.gitignore` blocks PDFs from staging. Derivatives (markdown, figures, tables, manifest.json) are inline.**

| Option                | For                                                                                                                                    | Against                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `handbooks/`          | Versioned reference corpus with its own lifecycle (re-ingestion, edition bumps). Not authored by the team. Distinct from `course/`.    | Adds a top-level entry. New rule for everyone.                                                         |
| `course/handbooks/`   | Co-locates with other aviation content; `course/` is already the aviation-knowledge bucket.                                            | `course/` today is information-architecture layered (L01-L05); handbooks aren't authored work, they're imported. Mixing creates a different lifecycle inside `course/`. |
| `content/handbooks/`  | Generic name; could later host other reference corpora (POH excerpts, AC PDFs).                                                         | New top-level for one feature; `course/` already serves a similar role; `content/` is vague.            |

Top-level `handbooks/` reflects the lifecycle separation: ingested, edition-locked, gitignored binaries, committed markdown + figures. The directory structure is unique to this kind of artifact (per-edition subtree, manifest.json, figure assets). Co-locating with `course/` would invite confusion between authored and imported material.

### 2. Routes -- `/handbooks/*` (resolved)

**Resolved: top-level `/handbooks/*` under the existing `(app)` group, peer to `/glossary` and `/references`.**

The `apps/study/` app already mounts `/glossary`, `/references`, `/help`, `/knowledge`, `/calibration`, `/dashboard`, `/memory`, `/plans`, `/reps`, `/sessions`, `/session` directly under `(app)/`. There is no `/study/...` group. `/handbooks/*` slots in next to `/glossary` and `/references`, which it most resembles -- a reference-shaped surface that the rest of the app links into.

Alternate: `/study/handbooks/*` would imply a future per-app route group. None exists today; introducing one for this feature is premature. If the firc app ever ships handbooks too, both apps will mount their own `/handbooks` at their host (just like they do for `/glossary`). The constant in `routes.ts` stays a single string; the host disambiguates.

### 3. Build / runtime model -- committed markdown + DB seed (resolved)

**Resolved: ingestion produces committed markdown + assets; `bun run db seed handbooks` rebuilds the DB tables from that committed content. Source PDFs are cached locally (per ADR 018) so re-extraction does not require an FAA round-trip after the first pull.**

| Option                               | For                                                                                                                                         | Against                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Committed markdown + DB seed         | Reviewable in PRs (figure differences show in `git diff`). Re-ingestion is explicit -- author runs the pipeline, commits the diff. Fast seed. | Repo grows with figure binaries. Mitigated by: figures are PNG, deduplicated, average ~50KB; entire PHAK figure set is < 50MB; LFS only if it actually grows.   |
| Build-time regen on every `bun run build` | DB always matches the latest PDFs. No commit step.                                                                                          | Pulls Python toolchain into every build host (CI, every dev). Slow. Hard to review FAA edition diffs in code review.                                            |
| Scheduled cron refresh               | DB stays current with FAA URL changes.                                                                                                      | The FAA does not publish on a schedule we can subscribe to. Unnecessary infrastructure.                                                                          |

The committed-markdown model matches how `course/knowledge/` works today: authoring happens in markdown, the seed builds the DB. Reviewability of FAA edition diffs is the load-bearing argument -- a new PHAK edition is a content event, not a build event.

### 4. Read-progress UI shape (resolved)

**Resolved: segmented Unread / Reading / Read control at the section foot, plus a secondary "Read but didn't get it" toggle that only enables once `status >= reading`.**

| Option                                | For                                                                                                          | Against                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Segmented three-state + comprehended toggle | Mirrors the data model. Discoverable. The middle state ("Reading") legitimizes "I'm partway through."    | Two affordances. Slightly heavier than a single button.                                                       |
| Toggle "Mark read" + secondary "didn't get it" | Lighter. Read is the goal state.                                                                          | Loses the "Reading" middle state. If the user opens a section then leaves, the system can't distinguish from "never opened." |
| Star rating / thumbs                  | Familiar pattern.                                                                                            | Star ratings are quality judgments, not progress states. Fails the "what does this mean for the dashboard?" sniff test. |

The segmented control resolves intent at every state and gives the suggestion heuristic a clean target ("Mark read?" advances Reading -> Read). The "didn't get it" toggle is positioned beneath as a secondary-line affordance to keep the primary control simple.

### 5. Suggestion-heuristic thresholds (resolved)

**Resolved: accept the spec defaults.** `HANDBOOK_SUGGEST_OPEN_SECONDS = 60`, `HANDBOOK_SUGGEST_TOTAL_SECONDS = 90`, scroll-to-bottom required, heartbeat interval 15s.

These are starting numbers, not gospel. The real evidence comes from user zero's first month: if "Mark read?" prompts feel either too eager (he's still reading) or too late (he closed the tab already), the constants shift. They live in `libs/constants/src/study.ts` so a tuning pass is a one-file change.

## Migration considerations

- **Existing freeform `references` arrays survive untouched.** The build script accepts both shapes; the resolver only handles `kind='handbook'` in this WP. Every legacy entry continues to render as it does today (free text). The cert-syllabus WP runs the migration that converts freeform strings to structured citations once the syllabus tree is known.
- **No backfill of read-state history.** v1 starts every user at `unread` for every section. Historical "I've read this in another tool" is not imported.
- **Seed re-runnable.** Re-running `bun run db seed handbooks` against an unchanged `handbooks/` tree is a no-op (every section's `content_hash` matches). New editions land additively; re-ingestion of an existing edition is also a no-op when nothing changed.
- **drizzle-kit migration.** Schema additions ship as a single drizzle migration `0010_handbook_ingestion.sql` produced by `bunx drizzle-kit generate` after the schema files land. `bunx drizzle-kit push` for local dev; a follow-up migration commit after the PR review settles.

## Risks

| Risk                                                            | Mitigation                                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| FAA PDF outline is unreliable on some handbooks.                | Per-handbook config `outline.yaml` override; pipeline aborts with a clear error if no outline.   |
| Figure extraction picks up watermarks or page chrome.           | Per-handbook crop regions in config; visual review pass per handbook before committing.          |
| Repo size grows uncomfortably as more handbooks land.           | Figures compressed (PNG, palette-reduced where possible). Move binary blobs to git-LFS only if the repo crosses a measured threshold (proposed: > 500MB total). Defer. |
| Heartbeat traffic load.                                         | 15s interval, gated by `visibilityState`; back-off on sustained 5xx. v1 traffic is one user.     |
| Edition churn breaks node citations.                            | Citations bind to `reference_id` (edition-specific). Old edition's `reference_id` stays valid; old citations keep resolving. New citations point at the new edition. The cert-syllabus WP runs the bulk-migrate when a node author chooses to update. |
| Markdown output drifts from PDF semantics over time.            | `manifest.json` records SHA-256 of every section. A diff job compares the source PDF's extracted text to the committed markdown to surface drift. Ships in a follow-up. |

## References

- [Design](./design.md) -- rationale, alternatives considered, key decisions
- [Tasks](./tasks.md) -- phased implementation plan
- [Test plan](./test-plan.md) -- manual acceptance scenarios
- [User stories](./user-stories.md) -- learner-perspective narratives
- [ADR 016 decision](../../decisions/016-cert-syllabus-goal-model/decision.md)
- [ADR 016 context](../../decisions/016-cert-syllabus-goal-model/context.md)
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md)
- [ADR 011 decision](../../decisions/011-knowledge-graph-learning-system/decision.md)
- [Reference System Core spec](../reference-system-core/spec.md) -- the 5-axis reference taxonomy this WP composes with
- [Reference Extraction Pipeline spec](../reference-extraction-pipeline/spec.md) -- the verbatim-block pipeline (parallel; out of scope for this WP)
