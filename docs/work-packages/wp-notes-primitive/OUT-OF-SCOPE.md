# wp-notes-primitive -- Out of scope

This file captures items rejected from `wp-notes-primitive` scope, why, and what would trigger building them.

## Annotations (highlights, card-draft anchors)

**Why excluded**: Annotations are a separate primitive. They need DOM-anchor matching, paint overlays, selection-event handling -- none of which notes need. Bundling them buries the easy thing under the hard thing.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: Never -- the split is intentional and stable.

## Inline composer in the reader (right column, three-column layout)

**Why excluded**: Reader integration depends on `wp-flightbag-reader-ux` shipping the persistent rail layout first, and on `wp-flightbag-rich-reader` shipping the selection toolbar that triggers the composer. The standalone `/notes/new` form here proves the create-flow works; the inline version reuses `<NoteComposer>` as a drop-in.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: When `wp-flightbag-rich-reader` is in flight.

## Per-section notes panel in the reader

**Why excluded**: Same reason as inline composer -- depends on the reader's persistent right column layout. The `<NotesList>` component shipped here is the panel, just not mounted in the reader yet.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: When `wp-flightbag-rich-reader` is in flight.

## Card drafts ("save passage as future card") + promote-note-to-card

**Why excluded**: `card_draft` is its own table with prefilled fields, source FKs, and a queue inbox. Notes can be promoted to drafts but the draft schema lives in the rich-reader WP. The "promote to card" button on `<NoteDetail>` ships here but no-ops with a "coming soon" tooltip until the dependent WP lands.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: When `wp-flightbag-rich-reader` is in flight; this WP's `<NoteDetail>` button gets wired.

## Public / shared / collaborative notes

**Why excluded**: Notes today are private (`user_id` FK on every row, no sharing surface, no permission model). Sharing changes the access model substantially: visibility scopes, instructor-comment kind, public-canonical URL, abuse / moderation considerations. Real surface would also need a way to subscribe to a note thread and a way to revoke sharing.

**Trigger to revisit**: When the platform has 50+ active users AND a concrete instructor / cohort use case (e.g. a CFI wanting to leave a comment on a student's note). Until then, private-only.

## Notes on sim debriefs / bug repros / arbitrary surfaces beyond study + flightbag

**Why excluded**: Schema already supports it via `knowledgeNodeId` / `courseId` / `goalId` / `syllabusNodeId` plus the optional `referenceSectionId`. What's missing is the surface that mounts `<NoteComposer>` for that context. Wiring is a per-surface decision, not a global one.

**Trigger to revisit**: When the surface needs it (sim has a debrief surface that's worth annotating, hangar bug repros want commentary, etc.). One-line wiring per surface.

## Note export / import (markdown bundle, CSV, PDF)

**Why excluded**: Pilots reading for a checkride often want a printout of "all my notes for PHAK Chapter 4." Real ask but not load-bearing for note creation -- premature without the data being abundant first. Trivial to add when the data exists.

**Trigger to revisit**: When a user has 50+ notes and asks for export.

## Tag taxonomy / hierarchy / nested tags

**Why excluded**: Free-form tags are good enough until they're not. Hierarchical tags add a model nobody asked for.

**Trigger to revisit**: When a power user reports their tag list is unmanageable. Probably never.

## Real-time collaborative editing (Yjs / Automerge / similar)

**Why excluded**: Notes are private and single-user; the data shape doesn't justify a CRDT. If sharing lands later, last-write-wins is fine for the access patterns we expect (one person edits a note, infrequent concurrent edit risk).

**Trigger to revisit**: Only if sharing + simultaneous editing become a real use case.

## Note-on-note (replies, threads, conversation)

**Why excluded**: Notes are personal scratchpads, not a discussion forum. A user replying to their own note is just editing it. A user replying to another user's note assumes sharing exists, which it doesn't.

**Trigger to revisit**: After sharing lands, if requested.
