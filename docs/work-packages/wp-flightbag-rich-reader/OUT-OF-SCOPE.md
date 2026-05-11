# wp-flightbag-rich-reader -- Out of scope

This file captures items rejected from `wp-flightbag-rich-reader` scope, why, and what would trigger building them.

## "Ask the AI about this passage" toolbar action

**Why excluded**: Adjacent to the toolbar but a separate piece of work. Uses the existing `apps/study/src/routes/api/page-explainer/+server.ts` endpoint -- needs a thin "ask AI" composer surface in the right column, prompt-template work, and a results display. Worth its own pass once the toolbar pattern is proven.

**Trigger to revisit**: After this WP ships, as a 1-2 week follow-up. The toolbar's 5th button slot is reserved for it conceptually.

## Instructor / shared / public annotations

**Why excluded**: Requires an access model that doesn't exist (visibility scopes, instructor-comment annotation kind, public-canonical URL, abuse / moderation considerations). Schema scaffolds it via `kind: 'instructor_comment'` working without alteration, but the surface work is real.

**Trigger to revisit**: When the platform has an active CFI / cohort use case AND a sharing model elsewhere in the platform.

## Annotation export (markdown / PDF bundle)

**Why excluded**: "Export all my highlights and notes for PHAK Chapter 4" is a real ask but trivial to add once the data exists. Polish item, not load-bearing for the rich-reader experience.

**Trigger to revisit**: When a user has 50+ annotations and asks for export, or as a polish follow-up.

## Cross-section anchor search via `pg_trgm` GIN index

**Why excluded**: Phase-1 of `wp-notes-primitive` already supports search via Postgres ILIKE. Adding `pg_trgm` is a performance optimization that should wait for evidence the data demands it.

**Trigger to revisit**: When a user has 1000+ annotations and search latency exceeds 500ms.

## Highlight reactions (emoji-on-passage, like Substack)

**Why excluded**: Not requested. Would need a sharing model first.

**Trigger to revisit**: Only with a concrete use case + a social layer.

## Kindle-style "popular highlights" social layer

**Why excluded**: Not requested, requires sharing model, requires aggregation pipeline, requires opt-in. Privacy implications.

**Trigger to revisit**: Never speculatively. Only with an explicit user research signal.

## "Tags on highlights" (mini-tag layer separate from notes)

**Why excluded**: A highlight's primitive metadata is color (4 values) + section. Adding tags to highlights creates a parallel taxonomy with notes. If a user wants tags, they should make the highlight a note (the toolbar makes that one click).

**Trigger to revisit**: If highlight-only users (who never make notes) report needing tags.

## Co-edit / real-time collaboration on a card draft

**Why excluded**: Card drafts are single-user pre-card prefill. No collaboration model.

**Trigger to revisit**: Never -- the use case doesn't exist.

## Voice / audio note attachment

**Why excluded**: Notes are markdown today. Audio notes would need storage (per ADR 018: developer-local cache for source audio masters; per-user audio notes are user-generated content with different storage rules), playback UI, and possibly transcription.

**Trigger to revisit**: When the audio surface app comes online and a use case appears (pilot wants to dictate a note while studying).

## Annotation versioning / history

**Why excluded**: Notes can be edited; the current row reflects the latest. No diff history. Audit log captures changes.

**Trigger to revisit**: If a user wants to recover an old version of a note.

## Drag-and-drop highlights between sections

**Why excluded**: Highlights are anchored to a section; moving them changes the meaning. The user can copy text, paste into a new note, anchor that. No drag affordance.

**Trigger to revisit**: Never.

## Summary auto-generation ("AI summarize my highlights for this chapter")

**Why excluded**: Adjacent to "ask the AI about this passage." Different prompt template. Defer to AI-features WP.

**Trigger to revisit**: After the "ask the AI about this passage" follow-up ships.

## Bidirectional links between cards and source highlights

**Why excluded**: When a card is promoted from a draft anchored to a highlight, the source link is in the card's back-side markdown. The reverse (highlight knows its derived card) is NOT stored. Could be added with a `cardId` FK on the annotation, but adds query surface for an unclear win.

**Trigger to revisit**: If a user reports "I want to see what cards came from this highlight."
