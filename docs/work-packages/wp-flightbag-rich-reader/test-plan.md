# wp-flightbag-rich-reader -- test plan

Manual walkthrough the user runs before flipping `human_review_status: signed-off`. Phase-1 schema is invisible; walks start at Phase 2.

## Setup

- Confirm `wp-notes-primitive` and `wp-flightbag-reader-ux` are signed off.
- Reseed dev DB: `bun run db reset`.
- Sign in as Abby.
- Open flightbag PHAK §4.2 (or any handbook section with body content).

## Walk -- Phase 2: highlights

### Create a highlight

1. Select a sentence in the body. Confirm `<SelectionToolbar>` floats above the selection within ~100ms.
2. Click the Highlight button. Color picker appears.
3. Pick yellow. Selection paints with translucent yellow background. Toolbar dismisses.
4. Reload the page. Highlight persists.

### Color semantics

1. Select a different passage. Highlight as blue (context).
2. Select another. Highlight as green (cross-link).
3. Select another. Highlight as pink (question).
4. Confirm tooltips on each color show the semantic meaning.

### Edit / remove

1. Hover an existing highlight. Tooltip appears with "Edit color" + "Remove" actions.
2. Edit color from yellow to green. Confirm immediate visual change.
3. Remove. Confirm the highlight disappears AND the row is deleted (check `/notes` -> "Highlights" tab in Phase 6).

### Copy with citation

1. Select a passage. Toolbar shows.
2. Click Copy. Toast: "Copied with citation."
3. Paste into a markdown editor. Confirm the format: `${text}\n\n— Source: ${section_title} (${section_code}) ${airboss-ref:URI}`.

### Re-anchor on body re-extraction

1. Manually edit `course/handbooks/phak/.../sections.json` to inject a paragraph break in a known location.
2. Re-extract that section: `bun scripts/sources/<re-extract>`. Reseed DB.
3. Reload the section. Confirm:
   - Highlights painted in unchanged passages still appear.
   - Highlights spanning the injected break re-anchor (the matcher finds the new offset).
   - Highlights on a deleted passage surface in the orphan panel (Phase 6) -- not painted, but not lost.

## Walk -- Phase 3: card drafts

### Save a passage as a draft

1. Select text. Toolbar shows.
2. Click "Card later." Toast: "Draft queued."
3. Navigate to `/memory/drafts` in study.
4. Confirm the draft appears with: front empty (or auto-derived from selection), back containing the source citation, source link.

### Promote as-is

1. From `/memory/drafts`, click "Promote as-is" on a draft.
2. Confirm: card appears in `/memory/browse`; draft disappears from inbox; `card_draft.promoted_at` set.

### Edit + promote

1. From `/memory/drafts`, click "Edit + promote." Lands on `/memory/new?draft=<id>` with form pre-filled.
2. Edit front + back. Submit.
3. Confirm card created; draft promoted (gone from inbox).

### Discard

1. From `/memory/drafts`, click Discard. Confirm dialog. Confirm.
2. Draft gone. Annotation row also deleted (verify in DB or via the Highlights tab in Phase 6).

## Walk -- Phase 4: inline card composer

### Open composer next to text

1. Select a passage. Toolbar shows.
2. Click "Card now." Right column appears with the card form (NOT a modal; body stays scrollable to the left).
3. Confirm: layout is three-column (rail | body | composer), all 22rem composer column.
4. Selection stays painted in the body.
5. Form pre-filled: back contains the source citation in markdown.

### Author and save

1. Type the front (question).
2. Edit the back if needed.
3. Pick a domain.
4. Click Save. Composer flashes "Saved." Form clears for next card. Composer stays open.
5. Open another card from the same composer (no need to close).
6. Click ✗. Confirm composer dismisses. If the form has unsaved content, a "Discard?" prompt appears.

### Esc closes

1. Open composer with content. Press Esc. Confirm dialog appears.
2. Press Esc again or click "Discard" -> closes.
3. Press "Keep" -> composer stays.

### Narrow viewport (<80rem)

1. Resize. Composer becomes a right-side sheet that slides in over the body.
2. Body still scrollable; sheet has its own scroll.
3. Drag the sheet edge to resize.

## Walk -- Phase 5: inline note composer + per-section panel

### Author a note from a passage

1. Select a passage. Toolbar shows. Click "Note."
2. Right column opens with `<NoteComposer>`. Quoted excerpt pre-filled with the selection. Context picker shows: `referenceId` = current reference, `referenceSectionId` = current section (both pre-selected).
3. Type a body. Optionally add a goal / course / knowledge-node context.
4. Save. Composer flashes "Saved." Closes.
5. Selection now painted with a dotted underline (note-anchor differentiation).

### Per-section notes panel

1. With composer closed, the right column shows `<SectionNotesPanel>` listing the notes you just created on this section.
2. Click a note. Composer reopens with the note loaded for editing.
3. Edit, save. Confirm change persists.

### Cross-section visibility

1. Navigate to `/notes` in study. Confirm the note appears in the "All" tab.
2. Filter by section. Confirm it appears.
3. Click "jump to source" -> back to flightbag at the note-anchor.

### Note-anchor edge case: orphan after re-extract

1. Re-extract the section that contains a note-anchor (manually edit `sections.json` to delete the anchored passage).
2. Reseed.
3. Reload the section. Confirm:
   - The note still exists in `/notes`.
   - The orphan annotations panel surfaces it: "We couldn't find this passage anymore."
   - "Jump to note" link still works (opens the note detail).

## Walk -- Phase 6: cross-cutting polish

### Visibility filter

1. Open the reader. Click the "Show:" chip in the header.
2. Pick "Highlights only." Confirm note-anchors hidden.
3. Pick "Hidden." Confirm all annotations hidden (body still readable).
4. Pick "All." Everything back.
5. Reload. Filter persists.

### Highlights tab in `/notes`

1. Navigate to `/notes` in study.
2. Click "Highlights" tab. List of every highlight + note-anchor with anchor text + jump-to-source.
3. Filter by reference / section. Confirm subset.

### Keyboard shortcuts

1. With selection toolbar visible, press `h`. Confirm Highlight action fires.
2. Press `n`, `c`, `d` for Note / Card-now / Card-later.
3. Open cheatsheet (`?`). Confirm new shortcuts documented.

### Orphan panel

1. With orphan annotations from earlier walks: confirm the panel renders, lists each orphan with delete + jump-to-source actions.

## Surfaced gaps to verify before signoff

- [ ] Highlights paint correctly across multi-paragraph selections.
- [ ] Highlights survive markdown re-render (frontmatter changes, figure injection).
- [ ] Composer Esc + outside-click handling is consistent (no surprise data loss).
- [ ] Three-column layout doesn't break the rail's sticky positioning.
- [ ] Mobile viewport (<60rem): composer overlays full-screen as a sheet; rail collapses.
- [ ] Reanchor performance: a section with 50 highlights re-anchors in < 200ms.
- [ ] No console errors during any walk.
- [ ] Audit log shows entries for every annotation create / update / delete and every card draft create / promote / discard.
- [ ] Note-anchor click correctly resolves to the originating note.
- [ ] WP frontmatter intact.
