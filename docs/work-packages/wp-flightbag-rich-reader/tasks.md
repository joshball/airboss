# wp-flightbag-rich-reader -- tasks

Phase-by-phase build order. Each task is one PR-sized chunk unless noted. **Depends on `wp-notes-primitive` and `wp-flightbag-reader-ux` shipping first.**

## Phase 1: schema + BC + anchor matcher

- [ ] **Schema**: add `study.reference_section_annotation` + `study.card_draft` tables to `libs/bc/study/src/schema.ts`. Regenerate `drizzle/0000_initial.sql`. Reseed. Ship as PR-1.
- [ ] **Constants**: ship `libs/constants/src/annotations.ts` with `ANNOTATION_KINDS`, `HIGHLIGHT_COLORS`, `HIGHLIGHT_COLOR_MEANINGS`. Audit-target constants. Ship in PR-1.
- [ ] **Anchor matcher**: ship `libs/utils/src/text-anchors.ts` with `captureAnchor` + `reanchor`. Full Vitest coverage including: identical text, whitespace-only changes, figure injection between sentences, deleted source paragraph (orphan), duplicate-anchor disambiguation. Ship as PR-2.
- [ ] **Plain-text projection**: ship `libs/library/src/section-text.ts` with the helper that produces a deterministic plain-text projection from a body element + `RenderedSection` props. Tests for parity between toolbar capture and AnnotationLayer paint. Ship in PR-2.
- [ ] **BC**: implement `libs/bc/study/src/annotations.ts` (server) with all create/update/delete/list functions for highlights, note-anchors, card drafts, plus `promoteDraftToCard`. Audit-log integration. Full Vitest coverage. Ship as PR-3.

## Phase 2: selection toolbar + highlight paint

- [ ] **`<SelectionToolbar>`**: ship in `libs/library/`. Listens for `selectionchange`, positions via Floating UI, renders Highlight + Copy actions only (other actions in later phases). Dismisses on outside-click / Esc / collapsed selection. Ship as PR-4.
- [ ] **Color picker on Highlight button**: hover/click reveals 4 swatches with semantic-meaning tooltips. Ship in PR-4.
- [ ] **`<AnnotationLayer>`**: ship in `libs/library/`. Mounts inside `<RenderedSection>`. Reads annotation list from prop, paints `<mark>` overlays via the plain-text->DOM walk. Hover -> tooltip with actions (edit color / remove). Ship as PR-5.
- [ ] **Section page-server loader**: extend handbook + AIM + CFR + ACS section loaders to fetch `listAnnotationsForSection(userId, sectionId)`; pass to `<AnnotationLayer>`. Ship in PR-5.
- [ ] **Reanchor on load**: every annotation runs through `reanchor`; orphans surfaced separately (don't paint). Ship in PR-5.
- [ ] **Copy with citation**: clipboard write + toast. Ship in PR-5.

## Phase 3: card draft path

- [ ] **Toolbar adds "Card later"**: button + handler that calls `createCardDraft(userId, prefill, anchor)`. Toast confirms. Ship as PR-6.
- [ ] **`/memory/drafts` route in study**: list of open drafts with edit/promote/discard. Ship as PR-7.
- [ ] **Edit-then-promote flow**: `/memory/new?draft=<id>` pre-fills the form from the draft; on submit, creates the card AND stamps the draft as promoted. Ship in PR-7.
- [ ] **One-click promote-as-is**: form action on `/memory/drafts` that calls `promoteDraftToCard` directly. Ship in PR-7.
- [ ] **Discard**: deletes the draft AND the linked annotation. Ship in PR-7.
- [ ] **Drafts inbox link in study app nav**: next to "+ Card." Ship in PR-7.

## Phase 4: inline card composer (three-column layout)

- [ ] **Extend `<ReaderLayout>`**: optional `composer` snippet. When set, grid becomes `18rem minmax(0, 1fr) 22rem`; below 80rem, composer overlays as right-side sheet. Ship as PR-8.
- [ ] **Shared composer state**: `$state` object scoped to the layout, injected via context API. Toolbar mutates; layout reads. Ship in PR-8.
- [ ] **`<InlineCardComposer>`**: ship in `libs/library/`. Reuses `/memory/new` form action via `enhance`. Source-citation pre-filled in back. Save flashes "Saved"; doesn't navigate. Ship as PR-9.
- [ ] **Toolbar adds "Card now"**: button -> sets `$composerState = { kind: 'card-now', anchor, prefill, sourceSectionId }`. Ship in PR-9.
- [ ] **Esc / outside-click handling**: explicit close confirms if body non-empty. Ship in PR-9.
- [ ] **Selection painting persists while composer open**: highlight overlay stays visible. Ship in PR-9.

## Phase 5: inline note composer + per-section notes panel

- [ ] **`<InlineNoteComposer>`**: wraps `<NoteComposer>` from `libs/ui/components/notes/`. Auto-detects context (`referenceSectionId`, `referenceId`). Quoted-excerpt prefill. On save: calls `createNoteWithAnchor`. Ship as PR-10.
- [ ] **Toolbar adds "Note"**: button -> sets `$composerState = { kind: 'note', anchor, prefill, sourceSectionId }`. Ship in PR-10.
- [ ] **`<SectionNotesPanel>`**: mounts in right column when `$composerState` is null. Renders `<NotesList notes={sectionNotes} showContextChips={false} />`. "+ Note" opens inline composer. Ship as PR-11.
- [ ] **Section page-server loader**: extend to fetch `listNotesForSection(userId, sectionId)`. Ship in PR-11.
- [ ] **Note-anchor highlight differentiation**: dotted underline vs filled-block for note-anchors. Click a note-anchor -> opens the note in the right-column composer. Ship in PR-11.

## Phase 6: cross-cutting polish

- [ ] **Annotation visibility filter chip**: in reader chrome. "Show: All / Highlights only / Notes only / Hidden." Persisted as `study.reading.annotation_filter` user pref. Ship as PR-12.
- [ ] **"Highlights" tab in `/notes`** (in study): list every highlight + note-anchor with anchor text + jump-to-source. Ship in PR-12.
- [ ] **Keyboard shortcuts when toolbar is visible**: `h` highlight, `n` note, `c` card-now, `d` card-later. Add to cheatsheet. Ship in PR-12.
- [ ] **Orphan annotations panel**: in reader right column when there are unmatched annotations. "We couldn't find this passage anymore -- delete or jump to source?" Ship in PR-12.

## Verification gates per PR

- `bun run check all` clean.
- New tests pass.
- Browser smoke (Chrome at minimum); browser-load verification for any phase touching the AnnotationLayer paint or SelectionToolbar (per CLAUDE.md browser-only rule -- happy-dom doesn't have real selection / Range APIs).
- e2e: select text, highlight, reload, confirm painted.
- e2e: select text, "Card now," fill form, save, confirm card in `/memory/browse`.
- e2e: select text, Note, author, save, confirm note in `/notes` AND in section panel.
- WP frontmatter contract enforced.
