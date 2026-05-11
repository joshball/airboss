---
id: wp-flightbag-rich-reader
title: 'Spec: WP-FLIGHTBAG-RICH-READER -- annotations, card drafts, inline composers, per-section panels'
product: flightbag
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on:
  - wp-notes-primitive
  - wp-flightbag-reader-ux
unblocks: []
tags:
  - reader
  - rich-reader
  - annotations
  - card-drafts
  - selection
---

# WP-FLIGHTBAG-RICH-READER: select to highlight, draft, compose, or annotate

The reader becomes interactive. Select text, choose what to do with it, never leave the page.

The interactions:

- **Highlight** a passage (yellow / blue / green / pink, semantic colors).
- **Card draft** -- queue the passage for later card creation.
- **Card now** -- open an inline composer in a right-column side-panel (NOT a modal), pre-filled with the selection, source link attached.
- **Note** -- open an inline note composer in the same right-column side-panel, with auto-detected context defaults.
- **Copy with citation** -- copy the text + an `airboss-ref:` URI for paste-elsewhere.

Per-section "Notes on this section (N)" panel renders in the right column when no composer is open. `/memory/drafts` is the queue inbox for card drafts.

## Why this WP exists

The flightbag UX review (2026-05-11) identified the rich-reader subsystem as the biggest pedagogy unlock: turn the reader from a reference into a place where the user thinks. Two prerequisite WPs (`wp-notes-primitive` and `wp-flightbag-reader-ux`) handle the substrate; this WP wires the interactive layer.

The interaction model -- select-to-action with an inline composer next to the text -- is specifically what the user asked for: "Do this NEXT to the text so they can access the entire thing (instead of a modal). And allow them to just do it now."

## Anchors

- [docs/work/reviews/2026-05-11/flightbag-desktop-ux.md](../../work/reviews/2026-05-11/flightbag-desktop-ux.md) -- triggering review. "Plan: select-to-action" and "Plan: notes + note viewer" are source specs.
- [wp-notes-primitive](../wp-notes-primitive/spec.md) -- DEPENDS-ON. Provides `<NoteComposer>`, `<NotesList>`, `<NoteCard>`, `<NoteContextPicker>`, `<NoteContextChips>`, `createNote` BC.
- [wp-flightbag-reader-ux](../wp-flightbag-reader-ux/spec.md) -- DEPENDS-ON. Provides the persistent-rail layout (`[edition]/+layout.svelte`) that the right-column composer mounts into, and the reader pref tokens that style the composer consistently with the body.
- [study.cards](../../../libs/bc/study/src/schema.ts) -- card-draft promotion target (existing table).
- `apps/study/src/routes/(app)/memory/new/+page.svelte` -- reused form action for inline card composer.
- [Hypothes.is anchor algorithm](https://github.com/hypothesis/h/blob/main/docs/) -- inspiration for the anchor-text + offset matching pattern.

## In Scope

### 1. Schema additions

**`study.reference_section_annotation`** -- one row per highlight, note-anchor, or card-draft-anchor:

```typescript
export const referenceSectionAnnotation = studySchema.table(
  'reference_section_annotation',
  {
    id: text('id').primaryKey(),                  // ann_<ULID>
    userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),
    referenceSectionId: text('reference_section_id').notNull().references(() => referenceSection.id, { onDelete: 'cascade' }),

    /** 'highlight' | 'note_anchor' | 'card_draft_anchor' */
    kind: text('kind').notNull(),

    /** Highlight color when kind='highlight'; null for the other kinds. */
    color: text('color'),

    /** Plain-text excerpt as it appeared at annotation time (re-anchor fallback). */
    anchorText: text('anchor_text').notNull(),
    /** UTF-16 offset in the section's plain-text projection at annotation time. */
    anchorStart: integer('anchor_start').notNull(),
    anchorEnd: integer('anchor_end').notNull(),

    /** Optional contextual prefix/suffix snippets used by the re-anchor matcher. */
    prefixContext: text('prefix_context').notNull().default(''),
    suffixContext: text('suffix_context').notNull().default(''),

    /** Forward link to the resulting note / card-draft (when kind='note_anchor' / 'card_draft_anchor'). */
    noteId: text('note_id').references(() => note.id, { onDelete: 'cascade' }),
    cardDraftId: text('card_draft_id').references(() => cardDraft.id, { onDelete: 'cascade' }),

    ...timestamps(),
  },
  (t) => ({
    userSectionIdx: index('reference_section_annotation_user_section_idx').on(t.userId, t.referenceSectionId),
    sectionIdx: index('reference_section_annotation_section_idx').on(t.referenceSectionId),
    userKindIdx: index('reference_section_annotation_user_kind_idx').on(t.userId, t.kind),
    kindCheck: check('reference_section_annotation_kind_check', sql.raw(`"kind" IN (${inList(ANNOTATION_KIND_VALUES)})`)),
    colorCheck: check('reference_section_annotation_color_check', sql.raw(`"color" IS NULL OR "color" IN (${inList(HIGHLIGHT_COLOR_VALUES)})`)),
  }),
);
```

**`study.card_draft`** -- queued card prefill, awaiting the user to author or discard:

```typescript
export const cardDraft = studySchema.table(
  'card_draft',
  {
    id: text('id').primaryKey(),                  // draft_<ULID>
    userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),

    /** Pre-filled card fields. User edits before promotion. */
    front: text('front').notNull().default(''),
    back: text('back').notNull().default(''),
    domain: text('domain'),
    cardType: text('card_type').notNull().default(CARD_TYPES.BASIC),
    kind: text('kind').notNull().default(CARD_KINDS.RECALL),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

    /** Optional context FKs (mirror note schema). */
    referenceSectionId: text('reference_section_id').references(() => referenceSection.id, { onDelete: 'set null' }),
    knowledgeNodeId: text('knowledge_node_id'),
    courseId: text('course_id').references(() => course.id, { onDelete: 'set null' }),
    goalId: text('goal_id').references(() => goal.id, { onDelete: 'set null' }),

    /** When promoted, the resulting card row id is stamped here for audit + UI flash. */
    promotedToCardId: text('promoted_to_card_id'),
    promotedAt: timestamp('promoted_at', { withTimezone: true }),

    ...timestamps(),
  },
  (t) => ({
    userOpenIdx: index('card_draft_user_open_idx').on(t.userId, t.createdAt).where(sql`promoted_at IS NULL`),
    userIdx: index('card_draft_user_idx').on(t.userId, t.createdAt),
  }),
);
```

**Constants** (`libs/constants/src/annotations.ts`, new):

```typescript
export const ANNOTATION_KINDS = {
  HIGHLIGHT: 'highlight',
  NOTE_ANCHOR: 'note_anchor',
  CARD_DRAFT_ANCHOR: 'card_draft_anchor',
} as const;
export const ANNOTATION_KIND_VALUES = Object.values(ANNOTATION_KINDS);

export const HIGHLIGHT_COLORS = {
  YELLOW: 'yellow',
  BLUE: 'blue',
  GREEN: 'green',
  PINK: 'pink',
} as const;
export const HIGHLIGHT_COLOR_VALUES = Object.values(HIGHLIGHT_COLORS);

/**
 * Optional semantic mapping. Surface in the highlight-color picker tooltips.
 * The user's color choice is stored as the primitive color; semantics are UI-side only.
 */
export const HIGHLIGHT_COLOR_MEANINGS = {
  yellow: 'memorize',
  blue: 'context',
  green: 'reference / cross-link',
  pink: 'question / disagree',
} as const;
```

### 2. Anchor matching (libs/utils/src/text-anchors.ts)

```typescript
export interface TextAnchor {
  text: string;        // anchor_text
  start: number;       // anchor_start (UTF-16 offset)
  end: number;
  prefix: string;      // prefix_context (last N chars before)
  suffix: string;      // suffix_context (first N chars after)
}

export function captureAnchor(plainText: string, range: { start: number; end: number }, contextChars = 32): TextAnchor;
export function reanchor(plainText: string, anchor: TextAnchor): { start: number; end: number } | null;
```

`reanchor` strategy:

1. If `plainText.slice(anchor.start, anchor.end) === anchor.text`, return as-is.
2. Else search for `anchor.text` near the original offset (±200 chars), pick the best match by Levenshtein distance to the prefix/suffix context.
3. Else search the whole `plainText` for `anchor.text`, pick the closest by start offset.
4. Else return null (annotation rendered as "orphaned" -- shown in a side-panel, not painted on the body).

Tested with: identical text, body re-extracted with whitespace changes, body re-extracted with figure injection between sentences, deleted source paragraph (orphan case), duplicate-anchor disambiguation by context.

Performance: `anchor.text` capped at 1000 chars (longer is suspicious anyway); single-section bodies typically <50KB; matching is O(n) per annotation.

### 3. BC: `libs/bc/study/src/annotations.ts`

```typescript
// Highlights
createHighlight(userId, sectionId, anchor: TextAnchor, color: HighlightColor): Promise<AnnotationRow>
listHighlightsForSection(userId, sectionId): Promise<AnnotationRow[]>
updateHighlightColor(annotationId, userId, color: HighlightColor): Promise<void>
deleteAnnotation(annotationId, userId): Promise<void>

// Note-anchors (called by the inline note composer when an anchor is captured)
createNoteWithAnchor(userId, sectionId, anchor: TextAnchor, noteInput: CreateNoteInput): Promise<{ note: NoteRow; annotation: AnnotationRow }>

// Card drafts
createCardDraft(userId, input: CreateCardDraftInput, anchor?: TextAnchor): Promise<{ draft: CardDraftRow; annotation: AnnotationRow | null }>
listOpenCardDrafts(userId, opts: ListOpts): Promise<CardDraftRow[]>
updateCardDraft(draftId, userId, patch: UpdateCardDraftInput): Promise<CardDraftRow>
discardCardDraft(draftId, userId): Promise<void>
promoteDraftToCard(draftId, userId): Promise<{ cardId: string }>     // creates a study.card row, stamps promoted_at, returns the new card id

// Cross-cutting
listAnnotationsForUser(userId, opts: ListOpts): Promise<AnnotationRow[]>
```

`promoteDraftToCard` reuses the existing `createCard` BC; the draft row is preserved with `promoted_at` stamped (audit trail; UI hides promoted drafts from the inbox).

### 4. UI: `<SelectionToolbar>` in `libs/library/`

Listens for `selectionchange` on a host element. When the selection is non-empty AND lives inside a `[data-annotatable-body]`:

1. Compute the selection's bounding rect.
2. Position a floating toolbar above the selection (or below if there's no room above).
3. Render 5 buttons: 🟡 Highlight (with color picker on hover), ⏳ Card later, ✨ Card now, 📝 Note, 📋 Copy.
4. On click: capture the anchor, dispatch the action, dismiss the toolbar.

Toolbar uses Floating UI's positioning math (already a dep -- check). Dismisses on outside-click, escape key, or selection collapse.

Anchor capture uses `Range.toString()` for the text and a recursive walk to compute UTF-16 offsets in the section's plain-text projection. Plain-text projection cached per-section in a `WeakMap` on `<RenderedSection>` (keyed by the body element).

### 5. UI: `<AnnotationLayer>` in `libs/library/`

Mounts inside `<RenderedSection>` (after the `<article class="body">`). Reads the section's annotations from a prop (loaded server-side). For each highlight, paints a `<mark>` overlay positioned over the matched text range (using the same plain-text->DOM walk as the toolbar).

Highlights painted as transparent colored overlays (`background: oklch(0.9 0.1 80 / 0.4)` for yellow, etc.). Hover -> tooltip with author / created date / "Edit color" / "Remove" actions. Click -> if note-anchored, opens the note in the right-column composer; if card-draft-anchored, opens the draft in the inline composer.

Orphaned annotations (`reanchor` returned null) render as "orphan" cards in the right-column panel, NOT painted on the body. User can delete or attempt to re-anchor manually.

### 6. UI: three-column layout when composer is open

`<ReaderLayout>` extended with optional `composer` snippet. When set, the layout grid becomes `18rem minmax(0, 1fr) 22rem` (rail | body | composer). When unset, today's two-column shape.

Composer state managed via a Svelte 5 `$state` shared object scoped to the layout. Toolbar action -> sets `$composerState = { kind: 'card-now' | 'note', anchor, prefill, sourceSectionId }`. Composer renders, body stays scrollable, selection stays painted via the `<AnnotationLayer>`.

Closing the composer (✗ button or `Esc`) clears `$composerState`; without an explicit save, a "discard draft?" prompt appears if the body is non-empty.

On viewports < 80rem, the composer overlays as a right-side sheet (slide-in from the right, ~22rem wide, with a backdrop). Body-scroll preserved; the user can drag the sheet edge to resize.

### 7. UI: inline card composer

`<InlineCardComposer>` in `libs/library/`. Props: `prefill: { front, back, sourceCitation }`, `onsave`, `oncancel`. Renders the same fields as `/memory/new`'s form: front, back, domain, card-type, kind, tags. Submit calls the existing `/memory/new` form action via `enhance` -- no navigation; on success, the composer flashes "Saved" and the prefill resets for the next card (mirrors the existing `/memory/new` "save and add another" rhythm).

Source-citation pre-filled in the back field as a markdown footnote: `\n\n— Source: [PHAK §4.2](airboss-ref:handbooks/phak/8083-25C/4/2)`. User can edit/remove.

### 8. UI: inline note composer

Reuses `<NoteComposer>` from `libs/ui/components/notes/` (shipped by `wp-notes-primitive`). The wrapper component in `libs/library/InlineNoteComposer.svelte` adds:

- Auto-detected context: prefills `referenceSectionId` (current page), `referenceId` (parent doc).
- Quoted-excerpt prefill from the selection.
- On save: calls `createNoteWithAnchor` so the annotation row gets created alongside the note, linking back to the painted highlight.

### 9. UI: per-section notes panel

`<SectionNotesPanel>` in `libs/library/`. Mounts in the layout's right column when `$composerState` is null. Renders `<NotesList notes={sectionNotes} showContextChips={false} />` (chips redundant since they're all section-scoped). "+ Note" button opens the inline note composer with the section pre-filled.

Loaded server-side via `listNotesForSection(userId, sectionId)` -- adds one query to the section page-server loader.

### 10. `/memory/drafts` route in study

`apps/study/src/routes/(app)/memory/drafts/+page.svelte`. Lists open card drafts (`promoted_at IS NULL`). Each row: front preview, back preview, source link (jump to the highlighted passage in flightbag), context chips, actions: **Edit + promote** (opens `/memory/new?draft=draft_<id>` -- the existing form pre-fills from the draft, promotion happens on submit), **Promote as-is** (one-click create card from the prefill, no review), **Discard** (deletes the draft + the associated annotation).

Empty state: "Drafts you queue from the flightbag show up here." Link to flightbag.

Add to study app nav next to "+ Card."

### 11. Selection -> "Copy with citation"

Toolbar action "📋 Copy" places `${selection_text}\n\n— Source: ${section_title} (${section_code}) ${airboss-ref:URI}` on the clipboard via `navigator.clipboard.writeText`. Brief toast confirms.

### 12. Cross-cutting: annotation visibility filter in the reader

Header chip in the reader chrome: "Show: All / Highlights only / Notes only / Hidden." Persisted as `study.reading.annotation_filter` user pref. Affects only the `<AnnotationLayer>` paint and the right-column panel.

### 13. Cross-cutting: search-my-annotations

In the `/notes` viewer (shipped by `wp-notes-primitive`), add a "Highlights" tab next to "All / Follow-ups / By context." Lists every highlight + note-anchor with the anchor text + jump-to-source link. Cheap addition since the schema supports it.

## Out of Scope (explicit)

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md). Major exclusions:

- "Ask the AI about this passage" toolbar action -- adjacent, but separate; uses existing `api/page-explainer` route and lands as a follow-up.
- Instructor / shared annotations -- access model TBD.
- Annotation export (markdown / PDF bundle).
- Cross-section anchor search via pg_trgm GIN -- only added if the data demands it.
- Highlight reactions (emoji on a passage) -- not requested.
- Kindle-style "popular highlights" social layer -- not requested, requires sharing.

## Phases

### Phase 1: schema + BC + anchor matcher

`reference_section_annotation` + `card_draft` tables; constants; `text-anchors.ts` with full re-anchor test coverage; `annotations.ts` BC with full coverage.

**Done when**: I can `createHighlight` / `createNoteWithAnchor` / `createCardDraft` / `promoteDraftToCard` from a script and verify the rows + the anchor re-resolution against a re-extracted body.

### Phase 2: selection toolbar + highlight paint

`<SelectionToolbar>` with Highlight + Copy actions only. `<AnnotationLayer>` paints stored highlights on `<RenderedSection>` mount. Floating UI positioning. Toolbar dismisses correctly.

**Done when**: I can select text in any reader, hit Highlight, see it painted, refresh the page, see it persist. Color picker works. Hover shows actions. Delete works.

### Phase 3: card draft path

Toolbar adds "Card later" button. `/memory/drafts` route shipped. Promote flows wired (one-click and edit-then-promote). Annotation links draft to source.

**Done when**: highlight + Card later -> draft appears in `/memory/drafts` -> Edit + promote -> shows in `/memory/browse` as a real card with the source link in the back.

### Phase 4: inline card composer (three-column layout)

`<InlineCardComposer>` shipped. `<ReaderLayout>` extended with `composer` snippet + grid logic. Toolbar "Card now" opens the composer next to the body. Source-citation prefilled.

**Done when**: I can highlight a passage, click Card now, fill out the form in the right column without losing the source, save, and see the card in `/memory/browse`. The selection stays painted while I author. Esc dismisses with confirmation.

### Phase 5: inline note composer + per-section notes panel

`<InlineNoteComposer>` wraps `<NoteComposer>` with anchor capture. `<SectionNotesPanel>` mounts in the right column. "+ Note" buttons everywhere. Note-anchor highlights painted alongside regular highlights (subtle visual differentiation: dotted underline vs filled).

**Done when**: I can highlight a passage, click Note, author it in the right column, see it persist; the section's notes appear in the right column when no composer is open; clicking a note jumps to its source highlight.

### Phase 6: cross-cutting polish

Annotation visibility filter chip; "Highlights" tab in `/notes`; Copy-with-citation toast; orphan annotations panel; cheatsheet additions for the new keyboard shortcuts (`h` highlight, `n` note, `c` card-now, `d` card-later when toolbar is visible).

**Done when**: power-reader has every action keyboard-accessible; orphans are surfaced not lost; annotations are searchable.

## Risks

- **Anchor brittleness on body re-extraction.** Mitigated by the prefix/suffix context and the multi-strategy matcher. Tested against synthetic re-extraction permutations. Worst case: orphan render (visible, not lost).
- **Selection toolbar interaction with text-input cursor inside the body.** Markdown rendered to HTML doesn't include text inputs in the body, so the toolbar should always be safe. Audit just in case.
- **Three-column layout on intermediate viewports (60-80rem).** Body shrinks below comfortable measure. Mitigation: composer overlays as sheet below 80rem, two-column above.
- **Composer state leakage across navigation.** If user opens composer on §4.2, navigates to §4.3 via TOC, what happens? Decision: warn-on-navigate if composer body is non-empty (`beforeunload` / SvelteKit nav guard); auto-discard if empty.
- **Plain-text projection consistency between toolbar capture and AnnotationLayer paint.** Both must compute identically. Single helper in `libs/library/src/section-text.ts`; tested for parity.
- **Promoting a draft after the source body changed (re-extraction).** Card draft already has the source text snapshotted in the prefill; the *anchor* may be orphaned but the draft itself isn't lost.

## Success criteria

- I can select any passage in any reader and within 1 click capture it as a highlight, queue a draft, author a card, or write a note.
- The composer opens NEXT to the text, not on top of it; the body and selection stay visible.
- Notes attached to a section appear in the right column when nothing else is open.
- `/memory/drafts` is a useful inbox; promoting drafts is one click for the common case.
- Highlights, notes, and card drafts all survive a body re-extraction (anchor matcher works) OR surface as orphans (not silently lost).
- The whole system feels like Apple Books / Readwise / Notion, not like a custom one-off.
