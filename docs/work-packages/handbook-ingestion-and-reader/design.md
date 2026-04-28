---
title: 'Design: Handbook Ingestion and Reader'
product: study
feature: handbook-ingestion-and-reader
type: design
status: unread
review_status: pending
---

# Design: Handbook Ingestion and Reader

Rationale behind the choices in [spec.md](./spec.md). Alternatives are described where a decision was close.

## Scope anchor: PHAK first, three handbooks before close

ADR 016 phase 0 names PHAK as the first ingestion target, with AFH and AvWX as fast-followers. This WP ships in that order and does **not** declare done until all three are ingested, seeded, and renderable. The reason is that one handbook proves nothing about edge cases. PHAK alone tests the chapter/section grammar and the PDF-outline path; AvWX adds the heavy-table-and-chart case; AFH adds the figure-dense maneuvers content. Three handbooks across these axes catch the "the pipeline only works on the one we built it on" failure mode.

Out-of-scope handbooks (IFH, IPH, helicopter, glider, balloon) ship in follow-up content sweeps once the pipeline is stable. No additional engineering should be needed -- new content + a new `<doc>.yaml` config + a re-run of the seed.

## Storage rationale -- why a top-level `handbooks/`

Three lifecycles in this repo, distinguished by who owns the content and how it changes:

| Lifecycle      | Examples                                          | Mutation cadence                | Authoring tool                    |
| -------------- | ------------------------------------------------- | ------------------------------- | --------------------------------- |
| Authored       | `course/knowledge/`, `docs/`, app code, schemas   | Continuous, by the team         | VS Code, the codebase             |
| Ingested       | `handbooks/<doc>/<edition>/` (this WP)            | Per FAA edition (years)         | A pipeline; commit the output     |
| User-generated | DB rows; learner notes, plans, sessions, reviews   | Continuous, by users at runtime | The app                            |

Authored content evolves in the repo. Ingested content is a snapshot of an external source. Mixing them in `course/knowledge/` would imply that the team writes handbook chapters; the team does not. A new top-level reflects the lifecycle separation.

`course/handbooks/` was rejected because `course/` is information-architecture organized (L01-L05). Handbooks aren't authored by the team, aren't part of any layer, and have a different review pattern (FAA edition diff, not human edits). `content/handbooks/` was rejected because the name is generic and there's no other content under `content/`; introducing the directory for one feature is premature.

## Schema rationale

### Why four new tables, not three

`reference` and `handbook_section` are the obvious two: a reference is the document, a section is the unit of citation. `handbook_figure` is a separate table because:

1. Figures are queryable independently. "Show me every figure in PHAK Ch 12" is a real query the reader runs to render the chapter overview.
2. Figures have their own metadata (caption, asset path, dimensions) that doesn't belong inline on the section.
3. A section can carry many figures; storing them as a JSONB array would re-introduce the freeform-array problem.

`handbook_read_state` is a separate table because read-state is per-(user, section) and the section table is per-edition. The `handbook_section_id` FK encodes the edition transitively, so we don't carry an `edition` column on the read-state row. Composite PK on `(user_id, handbook_section_id)` enforces "at most one row per user per section."

### Why `handbook_section.code` and not just `(chapter, section, subsection)` columns

Three reasons:

1. **One column for unique constraints.** `(reference_id, code)` UNIQUE is one constraint. The alternative -- `(reference_id, chapter, section, subsection)` -- needs to handle NULLs in `section` and `subsection` (chapter rows have no section), which Postgres treats as not-distinct and which complicates the URL grammar.
2. **Clean URLs.** `/handbooks/phak/12/3` maps directly to `code='12.3'`. URL parsing is one split on `/`, then concatenate with dots.
3. **Citation strings.** `source_locator` has a stable shape that includes the code (`PHAK Ch 12 §3`); deriving it from a single column is cleaner than reassembling from three.

`code` is composed deterministically by the seed from chapter/section/subsection ordinals; the validator enforces the regex. Authoring never touches it.

### Why `superseded_by_id` on `reference` and not a separate `edition_chain` table

A linear chain of editions (25A -> 25B -> 25C) is captured well by a self-FK. Branching (different translations, parallel revisions) does not happen in FAA handbook practice. If it ever does, `edition_chain(reference_id, prereq_id, kind)` can land additively without touching existing rows.

### Why a CHECK on `handbook_section.parent_id` consistency

`level='chapter'` requires `parent_id IS NULL`; everything else requires `parent_id IS NOT NULL`. Drizzle expresses this as a CHECK using `sql.raw()`:

```sql
("level" = 'chapter' AND "parent_id" IS NULL)
OR ("level" <> 'chapter' AND "parent_id" IS NOT NULL)
```

Saner than relying on the seed alone to keep the tree consistent. If a future direct insert ever bypasses the seed, the check catches it.

### Why GIN index on `knowledge_node.references`

The reverse query "nodes that cite this section" walks the JSONB array looking for entries with matching `kind` and `reference_id`. At 30 nodes a sequential scan is fine; at 500+ it isn't. A GIN index on the column with `jsonb_path_ops` lets the query plan with `references @> '[{"kind":"handbook","reference_id":"ref_..."}]'::jsonb` and prune candidates fast. The locator-level filter (chapter, section) happens in memory afterward.

The index is created in this WP even though the slow path won't materialize until later. Adding it now means no migration when scale arrives.

### Why no FK from `knowledge_node.references` JSONB to `reference.id`

JSONB column FKs aren't a thing in Postgres. Validation lives in the seed (`bun run db build` resolves every structured citation's `reference_id` and warns on misses). The runtime resolver returns `null` for unresolvable references; the UI degrades gracefully.

## Pipeline rationale

### Why Python and not TypeScript

PyMuPDF (`fitz`) is the canonical layout-aware PDF text extractor. Equivalent JS libraries (pdf.js, pdf2json) lose layout fidelity on multi-column FAA handbooks. The pipeline runs locally, on demand, and writes markdown files; it does not run in production. The cost of a Python toolchain is paid by the author who runs the pipeline (Joshua, today). Every other developer just sees the committed markdown.

The Bun-as-dispatcher pattern (`bun run sources extract handbooks <doc>` shells out to `python -m ingest`) keeps the dev entry point uniform and lets the script be invoked the same way as any other monorepo task.

Alternatives considered:

- **pdfminer.six.** Older, slower, less robust on complex layouts. PyMuPDF wins on every benchmark.
- **Apache Tika.** JVM dependency, large; loses layout details.
- **A LLM-based extractor.** Non-deterministic; not appropriate for a content pipeline that must be reproducible.

### Why per-section markdown and not per-chapter

The unit of citation is the section. `handbook_section` rows are per-section. The reader URL is per-section. Authoring per-section markdown maps 1:1 to the data model and the URL surface. Per-chapter markdown would require the reader to splice on render and the seed to slice on write.

A chapter-overview markdown still exists (`<chapter>/index.md`) for the chapter-page lead text. It's a `level='chapter'` row whose `content_md` is the lead.

### Why edition-locked output, not a single tree

A new FAA edition is not an edit; it's a new document. PHAK 8083-25C is a different work from 8083-25B at every level: figure numbering, section ordering, citations. Old citations must keep resolving to the old text. Storing both editions side-by-side under `handbooks/phak/8083-25B/` and `handbooks/phak/8083-25C/` makes this trivial. The reader resolves "latest" via `superseded_by_id IS NULL`; explicit edition pinning resolves to the named subtree.

The repo grows linearly with editions. PHAK ships every ~5 years and changes ~30% of figures per edition; AvWX is closer to ~10 years per edition. Even at 8 handbooks * 3 editions over the next decade, the repo total stays in the tens-of-MBs of markdown plus a few hundred MBs of figures. Comfortable on default git; LFS if it ever grows past 500MB.

### Why fitz outline first, fall back to manual

The PDF outline is a tree the FAA already maintains. When it parses cleanly, the chapter/section/subsection structure falls out for free. The pipeline aborts loudly when the outline is bad; the per-handbook YAML config can carry a manual outline override (`outline_override: { 1: "Introduction", 2: "Aircraft Structure", ... }`) for handbooks where the FAA's outline is mangled.

This is the same pattern airboss already uses for unreliable upstream metadata: assume good, fail loud, override locally.

## Reader rationale

### Why a top-level `(app)/handbooks/...` group, not a nested `/study/handbooks`

The `apps/study/` app already mounts every learner surface (`/glossary`, `/references`, `/help`, `/knowledge`, `/calibration`, `/dashboard`, `/memory`, `/plans`, `/reps`, `/sessions`) directly under `(app)/`. There is no `/study/...` path group. Introducing one for handbooks would invent a new convention for a single feature.

`/handbooks/*` slots in next to `/glossary` and `/references`, the surfaces it most resembles -- a reference shape that other surfaces link into. Treating it as another peer matches the existing route grammar.

If a future `apps/firc/` ships its own handbooks UI (per ADR 016 and `MULTI_PRODUCT_ARCHITECTURE.md`), each app mounts `/handbooks` at its own host. The route constant in `routes.ts` stays a single string; the host disambiguates. Same as `/glossary` today (study has its own; hangar has its own).

### Why client-side phase navigation but server-loaded section content

The section page loads its body once; the user reads. The TOC is the only intra-page navigation, and it's a vertical scroll within a long-but-finite article. A SvelteKit page load with progressive scroll reveal is the simplest model and matches every other reader surface (Wikipedia, MDN, FAA's own PDFs).

The section page does **not** prefetch adjacent sections; that's a follow-up. Adjacent navigation in v1 is "click the section in the TOC" or "use the up arrow to the chapter." Acceptable for a feature whose primary use is sustained reading, not flipping.

### Why a heartbeat at all instead of just `last_read_at` on open

`last_read_at` is a single point. Two distinct user behaviors -- "open and close in 2 seconds" vs "open and read for 30 minutes" -- look identical from a single-timestamp perspective. The heartbeat captures the actual time-on-page, which is the load-bearing signal for the suggestion heuristic and (later) for "you've spent 4 hours on PHAK Ch 12; should the dashboard credit that?"

Heartbeat traffic at 15s intervals, gated by `visibilityState`, is one POST every 15 seconds per active reader -- ~240 per hour, trivial for one user, manageable at any reasonable scale.

### Why a non-blocking suggestion, never auto-mark

ADR 016: "the user controls transitions; the system suggests but never auto-marks." Mirrors the [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md) principle 10 ("the system is the learner's"). The system has no way to know whether a learner actually read with comprehension; auto-flipping a section to `read` because they had it open for 90 seconds would mark sections as read that the learner skimmed. The "Mark read?" prompt makes the choice deliberate.

### Why three states + comprehended boolean and not just two states

Two states (`unread / read`) loses the in-progress middle. Three states maps to the actual reader behavior: started but not finished is a real state the dashboard cares about ("12 chapters in progress, 3 done").

The `comprehended` boolean is orthogonal to status. A learner can mark `read` even if they didn't get it; the boolean lets them flag that fact without rolling status back. Coverage counts use `status='read'`; a "to revisit" lens uses `status='read' AND comprehended=false`. Same row, two queries.

### Why the citing-nodes panel surfaces mastery

A handbook section's value to the learner is partly "what does it say" (the body) and partly "what does the rest of the system want me to know about this?" (the nodes that cite it). Showing mastery on the citing-nodes panel turns the handbook into a soft progress dashboard: "I've read PHAK Ch 12 §3, and the three nodes that cite it are all mastered" feels like progress made; "PHAK Ch 12 §3 is read but two of its nodes show insufficient_data" surfaces the learning-not-yet-tested gap.

This is why the panel exists on chapter pages too: the chapter aggregates the mastery rollup across every section's citing nodes.

## Citation upgrade rationale

### Why the discriminated union shape, not a parallel `node_citation` table

A discriminated union on the existing JSONB array is additive: legacy entries survive, new entries carry more structure, the resolver narrows by `kind`. No table migration, no double-write window.

A separate `node_citation(node_id, citation_id)` table is the eventual destination per ADR 016 phase 1. This WP doesn't ship that because:

- **Tables before content is premature.** We don't know what the table needs to look like until we have nodes citing references in the wild.
- **The cert-syllabus WP owns the table.** It's the migration target, not this WP's deliverable.
- **The structured-on-array shape is good enough for the reader.** The reverse query has a GIN index; the resolver is pure. We can re-platform the storage without touching the UI.

### Why ship the resolver but not the migration

The resolver is what the UI needs. Migrating existing freeform strings is a content change that benefits from being run alongside the cert-syllabus authoring (the syllabus leaves typically know more about what citations belong on each node than the node author wrote freehand).

### Why every kind is in `REFERENCE_KINDS` even though only `handbook` resolves in v1

Every kind needs to be a valid value the schema accepts now so authors can write them without the build script rejecting their work. The resolver's per-kind logic lands in the cert-syllabus WP; in v1 the resolver returns `null` for non-handbook kinds and the UI shows the freeform `note` instead.

## Constants split rationale

`REFERENCE_KINDS` is a peer to `REFERENCE_SOURCE_TYPES` (in `libs/constants/src/reference-tags.ts`). Both enumerate roughly the same vocabulary. Why not one?

- `REFERENCE_SOURCE_TYPES` is the **5-axis tag** for the existing reference-system-core / extraction-pipeline work. It tags reference rows for filtering and faceted search. It carries display labels like "14 CFR".
- `REFERENCE_KINDS` is the **storage discriminator** on the new `reference` table and on every structured citation. It controls which `Citation` shape is valid.

The tag system and the storage table are two separate features in flight at the same time. They overlap. The cert-syllabus WP is the natural place to collapse them once both lifecycles are visible. Until then, two constants cost less than a premature unification.

## Heartbeat shape

Client-side, in the section page:

```typescript
// apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte
let totalSecondsVisible = $state(serverTotalSecondsVisible);
let visibleSince = $state<number | null>(null);

$effect(() => {
  function tick() {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (visibleSince == null) visibleSince = now;
    const delta = Math.min(
      Math.round((now - visibleSince) / 1000),
      HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4,
    );
    if (delta > 0) {
      totalSecondsVisible += delta;
      void fetch(api.handbookHeartbeat(sectionId), {
        method: 'POST',
        body: JSON.stringify({ delta }),
      });
      visibleSince = now;
    }
  }

  const interval = setInterval(tick, HANDBOOK_HEARTBEAT_INTERVAL_SEC * 1000);
  document.addEventListener('visibilitychange', tick);
  return () => {
    clearInterval(interval);
    document.removeEventListener('visibilitychange', tick);
  };
});
```

Server-side: a `+server.ts` POST endpoint that increments `total_seconds_visible` and updates `last_read_at`. Idempotent because `delta` is a delta, not a stamp.

A `Page Visibility API` gate avoids charging time to a backgrounded tab. Cap on `delta` (4x the interval) absorbs sleep/wake without spiking the counter; if the laptop slept for 10 hours, the next heartbeat reports at most 60s.

## API surface (BC)

`libs/bc/study/src/handbooks.ts`:

| Function                                | Signature                                                                                            | Notes                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `listReferences`                        | `(db, opts?: { kind?: ReferenceKind; includeSuperseded?: boolean }) -> ReferenceRow[]`               | Powers `/handbooks` index. Default excludes superseded.                                                     |
| `getReferenceByDocument`                | `(db, documentSlug: string, edition?: string) -> ReferenceRow \| null`                               | Edition default = latest non-superseded.                                                                    |
| `listHandbookChapters`                  | `(db, referenceId: string) -> HandbookSectionRow[]`                                                  | `level='chapter'`, ordered by ordinal.                                                                      |
| `listChapterSections`                   | `(db, chapterId: string) -> HandbookSectionRow[]`                                                    | Direct children only; ordered by ordinal.                                                                   |
| `getHandbookSection`                    | `(db, referenceId: string, code: string) -> { section: HandbookSectionRow; figures: HandbookFigureRow[]; toc: HandbookSectionRow[] } \| null` | TOC = sibling sections of the same chapter.                  |
| `getNodesCitingSection`                 | `(db, referenceId: string, locator: { chapter: number; section?: number }) -> NodeCitationSummary[]` | NodeCitationSummary = `{ node, mastery, locator }`. Uses GIN index.                                         |
| `getReadState`                          | `(db, userId: string, sectionId: string) -> HandbookReadStateRow \| null`                            |                                                                                                              |
| `setReadStatus`                         | `(db, userId: string, sectionId: string, status: HandbookReadStatus) -> HandbookReadStateRow`        | User-driven. Upserts.                                                                                       |
| `setComprehended`                       | `(db, userId: string, sectionId: string, comprehended: boolean) -> HandbookReadStateRow`             | Upserts. Disallows true while status === 'unread' (BC layer).                                                |
| `recordHeartbeat`                       | `(db, userId: string, sectionId: string, delta: number) -> HandbookReadStateRow`                     | Adds delta to `total_seconds_visible`, updates `last_read_at`. Caps delta at `4x interval`. First write also bumps status from `unread -> reading`. |
| `setNotes`                              | `(db, userId: string, sectionId: string, notesMd: string) -> HandbookReadStateRow`                   | Length-bounded.                                                                                              |
| `markAsReread`                          | `(db, userId: string, sectionId: string) -> HandbookReadStateRow`                                    | Resets `status` to `unread`, clears `comprehended`. Notes survive.                                          |
| `getHandbookProgress`                   | `(db, userId: string, referenceId: string) -> { totalSections: number; readCount: number; readingCount: number; comprehendedFalseCount: number }` | Powers handbook + chapter overview percentages. |
| `resolveCitationUrl`                    | `(citation: Citation, references: ReferenceRow[]) -> string \| null`                                 | Pure function. Used by node detail UI to render citations as links.                                         |

Build-script-only (not exported from BC barrel):

| Function                       | Signature                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `upsertReference`              | `(db, ref: NewReferenceRow) -> string`                                          |
| `upsertHandbookSection`        | `(db, section: NewHandbookSectionRow) -> string`                                |
| `replaceFiguresForSection`     | `(db, sectionId: string, figures: NewHandbookFigureRow[]) -> void`              |
| `attachSupersededByLatest`     | `(db, documentSlug: string, latestId: string) -> void`                          |

Errors (throwing classes, match existing BC style):

- `ReferenceNotFoundError`
- `HandbookSectionNotFoundError`
- `HandbookValidationError`

## Component structure

| Component                                | Location                                                  | Props                                                                  | Purpose                                                                              |
| ---------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `HandbookCard.svelte`                    | `libs/ui/handbooks/`                                      | `{ reference, progress }`                                              | Index-page card for a handbook; edition badge + progress bar.                        |
| `HandbookChapterListItem.svelte`         | `libs/ui/handbooks/`                                      | `{ section, progress, citingNodeCount }`                               | Chapter overview list row with read state + count of citing nodes.                   |
| `HandbookSectionListItem.svelte`         | `libs/ui/handbooks/`                                      | `{ section, readStatus, hasFigures, hasTables }`                       | Section row inside a chapter overview.                                               |
| `HandbookSectionToc.svelte`              | `libs/ui/handbooks/`                                      | `{ chapterSections, activeSectionId }`                                 | Sticky table-of-contents column.                                                     |
| `HandbookEditionBadge.svelte`            | `libs/ui/handbooks/`                                      | `{ edition, supersededById }`                                          | Edition pill + "newer edition available" affordance when superseded.                 |
| `HandbookReadProgressControl.svelte`     | `libs/ui/handbooks/`                                      | `{ status, comprehended, suggestion: 'idle' \| 'prompt' }`             | Segmented control + "didn't get it" toggle + suggestion prompt.                      |
| `HandbookSectionNotes.svelte`            | `libs/ui/handbooks/`                                      | `{ notesMd, sectionId }`                                                | Markdown textarea autosaving on blur and on debounced typing.                        |
| `HandbookCitingNodesPanel.svelte`        | `libs/ui/handbooks/`                                      | `{ nodes }`                                                             | "Knowledge nodes that cite this section" list with mastery indicators.               |

All consumed by route components under `apps/study/src/routes/(app)/handbooks/...`.

## Data flow

```text
+page.server.ts       BC                     DB                            Pipeline
-------------         --                     --                            --------
load(section)  --->   getHandbookSection  -> SELECT section + figures
                      getReadState        -> SELECT handbook_read_state
                      getNodesCitingSection -> SELECT knowledge_node WHERE references @> ...
                                                                                           ^
                                                                                           |
                                                                              upserts via seed (one-time)

POST /heartbeat ----> recordHeartbeat    -> UPDATE handbook_read_state
POST /status ------>  setReadStatus      -> UPSERT
POST /comprehended -> setComprehended    -> UPSERT
POST /notes -------->  setNotes          -> UPSERT
POST /reread ------->  markAsReread      -> UPSERT
```

The `+page.server.ts` for the section route returns the section, figures, TOC, read state, and citing-nodes panel data in one shot. Form actions (`status`, `comprehended`, `notes`, `reread`) and the heartbeat endpoint are co-located.

## Key decisions

### Decision 1: Section is the unit of citation, not paragraph

**Question:** what is the smallest citable unit? Section (FAA's `12.3`) or paragraph (a hand-numbered block within `12.3`)?

**Chosen:** section.

**Why:** the FAA already cites at the section level in the ACS and PTS. Pilot brain references a "PHAK Ch 12 §3" mental model, not "PHAK Ch 12 §3 ¶4." Paragraph-level citation is a level of granularity that nobody asks for in practice; it adds storage cost (~5x rows) without payoff.

**Future:** if a learning-engine signal ever wants paragraph granularity (highlight rendering, fine-grained "you reread this paragraph 3 times" telemetry), we can land it as `handbook_paragraph` later without touching the section table.

### Decision 2: Heartbeat sums into the same row, no separate event log

**Question:** record each heartbeat as an event row in a `handbook_read_event` table (raw event log), or sum directly into `handbook_read_state.total_seconds_visible`?

**Chosen:** sum directly.

**Why:**

- Storage. One reader streaming 4 heartbeats a minute over a 1-hour reading session = 240 events. Across all sections and all users this scales fast.
- The reader UI doesn't need event-level history; it needs aggregate time and the latest timestamp.
- `recordHeartbeat` becomes a single `INSERT ... ON CONFLICT DO UPDATE SET total_seconds_visible = total_seconds_visible + ?, last_read_at = now()`.
- A future analytics surface that wants per-event detail can carry it on a separate ingest path; the aggregate row is the load-bearing fact.

### Decision 3: `handbooks/` is committed; figures are committed; PDFs are gitignored

**Question:** the PDF source itself -- is it in the repo?

**Chosen:** no. The PDF is fetched by the pipeline; only the extracted markdown + figures + manifest are committed.

**Why:**

- A typical FAA handbook PDF is 50-200MB. Committing every edition adds gigabytes over a decade.
- The pipeline is reproducible from a URL + a checksum. The manifest records the source URL and a SHA-256; anyone can re-fetch.
- Markdown + figures sum to ~5-15% of the source size. Manageable in git for the foreseeable future.

`tools/handbook-ingest/.gitignore`:

```text
*.pdf
```

`handbooks/.gitignore`:

```text
*.pdf
```

A `manifest.json` per edition records `{ source_url, source_checksum, fetched_at }` so a fresh clone can re-fetch and verify.

### Decision 4: Render markdown server-side via the existing references pipeline

**Question:** the markdown body uses the same wiki-link grammar (`[[GLOSSARY::id]]`) as `course/knowledge/`. Render it the same way?

**Chosen:** yes. The section render path goes through `@ab/aviation` references resolution + Shiki + the existing markdown pipeline, server-side. Cross-section links inside a handbook resolve via a small post-processor that maps `Chapter 12, Section 3` mentions to their `handbook_section.id` URL.

**Why:** consistency. A section's markdown should render exactly like a knowledge node's `## Reveal` body. Authors who learn one rendering grammar use it everywhere.

**Cost:** the server-side render runs on every section visit. We do not cache the rendered HTML in v1; the markdown is small (a few KB) and the Shiki + references resolver path is fast. If profile data later shows the render is hot, cache the rendered HTML in `handbook_section.rendered_html` (or in a separate cache table) keyed by `content_hash`.

### Decision 5: Read-state row created lazily on first heartbeat or status flip

**Question:** create a row at the moment a user opens a section, or lazily when state changes?

**Chosen:** lazily, via the heartbeat endpoint and the status / comprehended endpoints. The first heartbeat upserts the row with `status='reading'` and `total_seconds_visible=delta`. A user who navigates to a section and bounces in < 5 seconds (under the heartbeat threshold) leaves no row.

**Why:** "the user opened a page once for half a second" is not interesting state. The dashboard cares about sections the user actually engaged with. Lazy creation keeps the table sparse and aligns with how the suggestion heuristic interprets `total_seconds_visible`.

## Alternatives considered

| Alternative                                                                  | Why not                                                                                                          |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Render PDFs inline (no extraction)                                            | No structured data. No reverse query. No edition-aware citation. No mobile readability. No diff in PRs.          |
| Markdown-only, no DB                                                          | Cross-cutting queries (which nodes cite this section, what's the read progress on PHAK) require parsing every file on every page load. Not viable past v1. |
| `handbook_read_event` table with per-event rows                               | See Decision 2 -- aggregate row is sufficient.                                                                   |
| One `(handbook, edition, chapter, section, subsection)` composite-key table  | Postgres NULL-distinct semantics make composite keys with optional levels awkward. Single `code` column is cleaner. |
| `course/handbooks/` storage location                                          | Mixes lifecycles inside `course/`. See "Storage rationale".                                                      |
| Build-time PDF re-extraction                                                  | Drops Python toolchain into every build host; loses PR-reviewable edition diffs.                                 |
| Cron-scheduled FAA URL polling                                                | Solves a problem nobody has -- FAA does not publish on a schedule we subscribe to.                              |
| One unified `REFERENCE_KINDS` constant replacing `REFERENCE_SOURCE_TYPES`     | Two systems in flight at once; collapsing them needs either WP to wait for the other. Cert-syllabus WP can do it once both are stable. |
| Auto-mark sections read on scroll-end                                         | Violates Learning Philosophy principle 10 ("the system is the learner's"). Suggestion only.                      |

## Observability

- Pipeline runs emit a JSON summary line per handbook (chapters, sections, figures, tables, errors, warnings). The manifest carries the same data persistently.
- Seed runs report counts written / skipped / unchanged.
- Read-state queries are indexed; a slow-query log entry would surface a missing index.
- BC includes a `getHandbookProgress(userId, referenceId)` function the dashboard can call later for a "% read" tile.

## Security + permissions

- Reading a handbook section is auth-required (it lives under `(app)`); the content itself is public-domain FAA material, but airboss treats every learner surface as auth-required for consistency.
- Read-state rows are per-user and never exposed cross-user.
- Notes are private to the user.
- The pipeline runs locally and does not need a service account; it talks to the FAA over HTTPS, writes to the local filesystem, and commits the result. No production runtime privileges required.
- The seed runs in the dev workflow and is gated by the existing `scripts/db/seed-guard.ts` production check.
