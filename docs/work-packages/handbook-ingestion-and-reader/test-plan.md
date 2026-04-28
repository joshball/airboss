---
title: 'Test Plan: Handbook Ingestion and Reader'
product: study
feature: handbook-ingestion-and-reader
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Handbook Ingestion and Reader

Manual acceptance tests for [spec.md](./spec.md). Prefix `HBK-`.

## Setup

- Study app running at `localhost:9600`
- Logged in as `abby@airboss.test` (the canonical dev test learner)
- PostgreSQL running with the `study` schema migrated (drizzle migration 0010 applied)
- `handbooks/` tree present locally with PHAK 8083-25C, AvWX 8083-28, AFH 8083-3C ingested + committed
- `bun run db seed handbooks` has been run; row counts in DB match `manifest.json`
- Knowledge graph has at least three nodes whose `references` array contains a structured handbook citation pointing into PHAK 8083-25C
- `bun run check` passes on the branch

---

## Pipeline

### HBK-1: `bun run sources extract handbooks --help` lists supported handbooks

1. Run `bun run sources extract handbooks --help`.
2. **Expected:** CLI usage summary lists every supported handbook config (`phak`, `afh`, `avwx`) and the flags (`--edition`, `--chapter`, `--dry-run`, `--force`).

### HBK-2: Pipeline rejects unknown handbook id

1. Run `bun run sources extract handbooks mystery --edition 2099`.
2. **Expected:** Error: "no config for handbook 'mystery' under tools/handbook-ingest/ingest/config/". Exit non-zero. No files written.

### HBK-3: Dry-run validates without writing

1. Run `bun run sources extract handbooks phak --edition 8083-25C --dry-run`.
2. **Expected:** Pipeline runs through fetch + outline + sections + figures + tables. Reports a summary line per chapter. No files written under `handbooks/phak/8083-25C/`. Exit 0.

### HBK-4: Full ingestion writes the expected tree

1. Remove a single chapter from `handbooks/phak/8083-25C/` (e.g., `12/`) to simulate a regression.
2. Run `bun run sources extract handbooks phak --edition 8083-25C`.
3. **Expected:** Chapter 12 directory recreated. Section markdown files present with frontmatter. Figures present in `handbooks/phak/8083-25C/figures/`. Tables present in `tables/`. `manifest.json` updated.
4. Diff vs main: the regenerated tree matches what was committed (no spurious churn).

### HBK-5: Idempotent re-run -- no DB writes

1. Confirm `handbooks/phak/8083-25C/` is current.
2. Run `bun run db seed handbooks` twice in a row.
3. **Expected:** Second run reports "0 sections updated" / "0 figures replaced." Row `updated_at` timestamps unchanged on the second run.

### HBK-6: New edition supersedes the old

1. Manually create a synthetic `handbooks/phak/8083-25D/` tree (copy 25C's tree under a new edition string in frontmatter + manifest).
2. Run `bun run db seed handbooks`.
3. **Expected:** `study.reference` has rows for both `(phak, 8083-25C)` and `(phak, 8083-25D)`. The 25C row's `superseded_by_id` points at the 25D row. The 25D row's `superseded_by_id` is NULL.

### HBK-7: Outline failure aborts cleanly

1. Configure the PHAK config with an intentionally wrong PDF URL (returns a non-PDF body).
2. Run `bun run sources extract handbooks phak --edition 8083-25C`.
3. **Expected:** Pipeline aborts with a clear error referencing the fetched body and the expected mime/format. Exit non-zero. No partial tree written.

---

## Schema

### HBK-8: `study.reference` row shape

1. Inspect any reference row via `psql`: `SELECT id, kind, document_slug, edition, title, publisher, url, superseded_by_id FROM study.reference;`.
2. **Expected:** `id` has `ref_` prefix. PHAK row has `kind='handbook'`, `document_slug='phak'`, `edition='8083-25C'`, `title='Pilot's Handbook of Aeronautical Knowledge'`, `publisher='FAA'`, `url` populated, `superseded_by_id` NULL (or set if HBK-6 ran).

### HBK-9: `handbook_section` tree structure

1. Pick PHAK Chapter 12. Query: `SELECT id, parent_id, level, ordinal, code, title FROM study.handbook_section WHERE reference_id = ? AND code LIKE '12%' ORDER BY code;`.
2. **Expected:** One row at `level='chapter', code='12', parent_id=NULL`. Multiple rows at `level='section'` with `parent_id` pointing at the chapter row, `code='12.1', '12.2', ...`. Subsection rows (if any) at `level='subsection', code='12.3.2', ...` parent-pointing at the section row.

### HBK-10: Figure rows reference real files

1. Query `SELECT asset_path FROM study.handbook_figure WHERE section_id = ? LIMIT 5;` for a section with figures.
2. **Expected:** Every `asset_path` resolves to a file on disk under `handbooks/phak/8083-25C/figures/`.

### HBK-11: GIN index exists on `knowledge_node.references`

1. Run `\di+ study.knowledge_node*` in psql.
2. **Expected:** A GIN index on `references` using `jsonb_path_ops` is listed.

### HBK-12: `parent_id` consistency CHECK enforced

1. Attempt a manual `INSERT INTO study.handbook_section (..., level, parent_id) VALUES (..., 'chapter', 'hbs_some_id')` (a chapter row with non-null parent).
2. **Expected:** Postgres rejects with the CHECK violation message. Same for `level='section', parent_id=NULL`.

---

## BC

### HBK-13: `listReferences` excludes superseded by default

1. After HBK-6 (both 25C and 25D exist).
2. Call `listReferences(db)`.
3. **Expected:** Returns only the 25D row. 25C is excluded because `superseded_by_id` is non-NULL.
4. Call `listReferences(db, { includeSuperseded: true })`.
5. **Expected:** Returns both rows.

### HBK-14: `getReferenceByDocument` resolves latest by default

1. Call `getReferenceByDocument(db, 'phak')`.
2. **Expected:** Returns the latest non-superseded edition (25D after HBK-6, otherwise 25C).
3. Call `getReferenceByDocument(db, 'phak', '8083-25C')`.
4. **Expected:** Returns the 25C row even though it's superseded.

### HBK-15: `getNodesCitingSection` -- direct hit

1. Pick a knowledge node whose `references` JSONB contains a structured citation `{ kind: 'handbook', reference_id: <PHAK 25C id>, locator: { chapter: 12, section: 3 } }`.
2. Call `getNodesCitingSection(db, <PHAK 25C id>, { chapter: 12, section: 3 })`.
3. **Expected:** The node appears in the result with its mastery summary attached.

### HBK-16: `getNodesCitingSection` -- chapter-only

1. Same fixture as HBK-15.
2. Call `getNodesCitingSection(db, <PHAK 25C id>, { chapter: 12 })`.
3. **Expected:** The node still matches (chapter-only locator widens the match).

### HBK-17: `getNodesCitingSection` -- legacy citations skipped

1. Take a node whose references array contains a legacy `{ source: "PHAK Ch 12 §3" }` entry but no structured citation.
2. Call `getNodesCitingSection(db, <PHAK 25C id>, { chapter: 12, section: 3 })`.
3. **Expected:** The node does not appear. Legacy entries are not interpreted by the resolver.

### HBK-18: `resolveCitationUrl` -- handbook returns route

1. Call `resolveCitationUrl({ kind: 'handbook', reference_id: <PHAK 25C id>, locator: { chapter: 12, section: 3 } }, allReferences)`.
2. **Expected:** Returns `/handbooks/phak/12/3`.

### HBK-19: `resolveCitationUrl` -- non-handbook returns null

1. Call `resolveCitationUrl({ kind: 'cfr', reference_id: 'ref_...', locator: { title: 14, part: 91, section: '155' } }, allReferences)`.
2. **Expected:** Returns `null` (cfr resolver lands in the cert-syllabus WP).

### HBK-20: `recordHeartbeat` -- first write upserts row at status `reading`

1. Confirm there's no `handbook_read_state` row for `(abby, sectionA)`.
2. Call `recordHeartbeat(db, abbyId, sectionAId, 15)`.
3. Inspect the row: `SELECT status, total_seconds_visible, last_read_at FROM study.handbook_read_state WHERE user_id = ? AND handbook_section_id = ?;`.
4. **Expected:** Row exists. `status='reading'`. `total_seconds_visible=15`. `last_read_at` set.

### HBK-21: `recordHeartbeat` -- delta cap

1. Call `recordHeartbeat(db, abbyId, sectionAId, 10000)` (insanely large delta).
2. **Expected:** Row's `total_seconds_visible` increased by `HANDBOOK_HEARTBEAT_INTERVAL_SEC * 4` (60 by default), not 10000.

### HBK-22: `setComprehended(true)` rejected when status is unread

1. Confirm sectionB has no read-state row for abby.
2. Call `setComprehended(db, abbyId, sectionBId, true)`.
3. **Expected:** Throws `HandbookValidationError`. No row created.

### HBK-23: `markAsReread` resets status, keeps notes

1. For sectionA, set `status='read'`, `comprehended=false`, `notes_md='my own annotations'`.
2. Call `markAsReread(db, abbyId, sectionAId)`.
3. **Expected:** Row now has `status='unread'`, `comprehended=false`, `notes_md='my own annotations'` (notes survive). `last_read_at` unchanged.

---

## UI -- index + handbook + chapter

### HBK-24: `/handbooks` lists every handbook

1. Navigate to `/handbooks`.
2. **Expected:** Cards for PHAK, AFH, AvWX. Each shows edition badge, total chapters, % read for abby.

### HBK-25: Superseded edition does not appear on index

1. After HBK-6 (PHAK 25C superseded by 25D).
2. Visit `/handbooks`.
3. **Expected:** PHAK card shows the 25D edition only. 25C is not listed as a separate handbook card.

### HBK-26: `/handbooks/phak` chapter list

1. Click PHAK from the index.
2. **Expected:** URL is `/handbooks/phak`. Page lists every chapter with title, page range, section count, % read for abby.

### HBK-27: `?edition=` query param pins an edition

1. After HBK-6: visit `/handbooks/phak?edition=8083-25C`.
2. **Expected:** Page renders the 25C chapter list. Edition badge shows 25C. A "newer edition available" banner is visible and links to `/handbooks/phak` (which resolves to 25D).

### HBK-28: `/handbooks/phak/12` chapter overview

1. Click Chapter 12 from the PHAK chapter list.
2. **Expected:** URL is `/handbooks/phak/12`. Page shows chapter title + page range, lead-text from `index.md`, section list (12.1, 12.2, 12.3, ...) with read-state badges. Citing-nodes panel lists nodes whose references match the chapter; each node shows mastery indicator.

### HBK-29: Empty handbook surfaces a clear empty state

1. Manually delete every section under `handbooks/phak/8083-25C/12/` (without removing the chapter row from manifest), re-seed.
2. Visit `/handbooks/phak/12`.
3. **Expected:** Chapter loads but section list shows "ingestion incomplete" with a hint to rerun the pipeline. No 500.

---

## UI -- section reader

### HBK-30: `/handbooks/phak/12/3` renders section markdown

1. Click §3 ("Atmospheric Pressure and Altitude") from the chapter overview.
2. **Expected:** URL is `/handbooks/phak/12/3`. Page shows:
   - Header with full citation string and edition badge
   - Sticky table of contents (right column on desktop)
   - Markdown body fully rendered (paragraphs, headings, inline references resolved against `@ab/aviation`)
   - Figures inline at their caption position with full captions visible
   - Tables rendered as HTML
   - Citing-nodes panel at the foot
   - Read-progress segmented control + "didn't get it" toggle + notes editor

### HBK-31: TOC click scrolls to subsection

1. On `/handbooks/phak/12/3`, click a TOC entry.
2. **Expected:** Page scrolls to the corresponding subsection heading. Active TOC entry is visually distinguished.

### HBK-32: Read-progress segmented control changes status

1. With abby's status for §3 = unread (or reading).
2. Click "Read" on the segmented control.
3. **Expected:** Status updates immediately. Refreshing the page shows status is still "Read." Database row reflects `status='read'`.

### HBK-33: "Didn't get it" toggle disabled when unread

1. Reset abby's status for §3 to unread.
2. Inspect the "Read but didn't get it" toggle.
3. **Expected:** Toggle is disabled (greyed out). A tooltip explains it activates after status is `reading` or `read`.

### HBK-34: "Didn't get it" toggle works when read

1. Set status to `read`. Click the "Didn't get it" toggle.
2. **Expected:** Toggle is on. DB row has `comprehended=false` (note inversion: the toggle being ON means "did NOT comprehend"). Status remains `read`.

### HBK-35: Re-read resets status, preserves notes

1. With status `read`, comprehended `false` (didn't get it), notes containing "my notes here."
2. Click "Re-read this section" button.
3. **Expected:** Status flips to `unread`. Comprehended cleared. Notes still contain "my notes here."

### HBK-36: Notes autosave on blur

1. Type "key takeaway: pressure altitude is..." into the notes editor. Click outside the editor.
2. Refresh the page.
3. **Expected:** Notes persisted. Autosave indicator appeared briefly during the save.

### HBK-37: Notes length cap surfaces a friendly message

1. Paste 17000+ characters into the notes editor.
2. **Expected:** Save is blocked. UI shows "Notes capped at 16,384 characters." Existing notes remain untouched.

---

## UI -- read-progress heuristic

### HBK-38: Heartbeat fires while page is visible

1. Open `/handbooks/phak/12/3` in a foreground tab.
2. Open DevTools network panel and watch for POSTs to the heartbeat endpoint.
3. **Expected:** A POST every `HANDBOOK_HEARTBEAT_INTERVAL_SEC` (15s default) seconds while the tab is visible. Each POST has body `{ delta: 15 }` (approximately).

### HBK-39: Heartbeat pauses while page is backgrounded

1. With the section page in the foreground, switch to another tab.
2. **Expected:** No further heartbeats fire while the section page is in the background. On returning to the section tab, the heartbeat resumes; the resumed delta should not include the time spent backgrounded.

### HBK-40: Suggestion prompt fires when thresholds met

1. Reset abby's read-state for §3 (delete the row).
2. Navigate to `/handbooks/phak/12/3`. Wait long enough for `HANDBOOK_SUGGEST_TOTAL_SECONDS` to accumulate (mocking the heartbeat is fine for the test). Scroll all the way to the bottom of the section.
3. **Expected:** A non-blocking "Mark this section as read?" prompt surfaces near the foot. Clicking it sets status to `read` and dismisses the prompt.

### HBK-41: Suggestion prompt does not appear if scroll-to-bottom is not reached

1. Same setup as HBK-40 but never scroll to the bottom.
2. **Expected:** Even after thresholds are met, the prompt does not appear.

### HBK-42: Status never auto-flips to `read`

1. Run a session for hours on a section with the prompt ignored.
2. **Expected:** Status stays at `reading`. The system never advances to `read` without the user clicking the segmented control or the suggestion prompt.

### HBK-43: Heartbeat replays buffered events on reconnect

1. Open `/handbooks/phak/12/3` in a tab. Throttle the network to "offline" in DevTools.
2. Wait several heartbeat intervals (90+ seconds).
3. Re-enable the network.
4. **Expected:** Buffered heartbeats POST in sequence. `total_seconds_visible` reflects the offline period (within the buffer cap of `HANDBOOK_HEARTBEAT_BUFFER` heartbeats).

---

## Bidirectional citation

### HBK-44: Node detail renders structured handbook citation as link

1. Navigate to a knowledge node with a structured handbook citation pointing at PHAK 12 §3.
2. **Expected:** In the references panel, the citation renders as a clickable link with text "PHAK Ch 12 §3 (pp. 12-7..12-9)" or equivalent, pointing at `/handbooks/phak/12/3`. Clicking goes to the section page.

### HBK-45: Node detail renders legacy freeform citation as text

1. Navigate to a knowledge node whose references contain only legacy entries.
2. **Expected:** The citation renders as plain text. No link.

### HBK-46: Section page citing-nodes panel back-links to nodes

1. From `/handbooks/phak/12/3`, click a node in the citing-nodes panel.
2. **Expected:** Navigate to that node's detail page. The references panel on that node shows the same handbook citation linked back to the section. Round-trip works.

### HBK-47: Citing-nodes panel hides nodes with broken `reference_id`

1. Manually corrupt one node's structured citation to point at a `reference_id` that no longer exists.
2. Re-run the load on `/handbooks/phak/12/3`.
3. **Expected:** The corrupted node does not appear in the citing-nodes panel. The build script (next `bun run db build`) emits a warning identifying the broken citation.

---

## Integration

### HBK-48: Three handbooks all visible end-to-end

1. After PHAK + AFH + AvWX are all ingested + seeded.
2. Visit `/handbooks`.
3. **Expected:** All three appear. Click each, drill to a chapter and a section. All three render their markdown without errors.

### HBK-49: Manifest matches DB

1. After a clean seed, parse `handbooks/phak/8083-25C/manifest.json`. Count chapters, sections, figures.
2. Run `SELECT COUNT(*) FROM study.handbook_section WHERE reference_id = ? AND level = 'section';` (and similar for chapter, subsection, figure).
3. **Expected:** Counts match the manifest exactly.

### HBK-50: Existing tools unaffected

1. Visit `/glossary`, `/references`, `/help`, `/knowledge`, `/dashboard`, `/memory/review`, `/reps`, `/sessions/<some>`.
2. **Expected:** Every existing surface still works. No regression in load times. No broken citations.

### HBK-51: `bun run db build` validates structured citations

1. Author a node with a structured handbook citation pointing at a real reference + section.
2. Run `bun run db build`.
3. **Expected:** Build succeeds. Citation reported as resolved.
4. Author a second node with a structured citation pointing at a non-existent `reference_id`.
5. Run `bun run db build`.
6. **Expected:** Build emits a warning identifying the bad reference. Build does not fail (warnings, not errors, in v1).

### HBK-52: drizzle migration applies cleanly to a fresh DB

1. Drop the `study` schema, run all migrations.
2. **Expected:** Schema includes the new tables and indexes; previous tables intact. No conflicts.
