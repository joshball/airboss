# wp-flightbag-reader-ux -- Out of scope

This file captures items rejected from `wp-flightbag-reader-ux` scope, why, and what would trigger building them.

## Highlights, annotations, card-draft anchors, selection toolbar

**Why excluded**: A separate primitive that needs DOM-anchor matching, paint overlays, and selection-event handling. Bundling here would make this WP huge and gate its consistency wins behind annotation work.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: Never -- the split is intentional.

## Inline note composer in the reader (right column, three-column layout)

**Why excluded**: Depends on `wp-notes-primitive` shipping the `<NoteComposer>` component AND on this WP shipping the persistent-rail layout. Sequencing keeps each WP focused.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: When `wp-notes-primitive` is in flight; this WP's overview phase ships the layout shell that the composer mounts into.

## Per-section "Notes on this section (N)" panel in the reader

**Why excluded**: Same reason. Reuses `<NotesList>` from `wp-notes-primitive`; mount point is the right column shipped here.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: When `wp-notes-primitive` is in flight.

## Card draft inbox at `/memory/drafts`

**Why excluded**: Card drafts are a separate schema (`study.card_draft`) tied to the selection toolbar's "save for later" affordance. Inbox surface lives with the affordance.

**Where it lives**: `wp-flightbag-rich-reader`.

**Trigger to revisit**: When `wp-flightbag-rich-reader` is in flight.

## "Render modes" (Learn / Review / Memorize) for handbook prose

**Why excluded**: IDEAS.md row "Flightbag render modes" is a different mechanism from the knowledge-node render modes that `RENDER_MODES` already covers. Handbook prose isn't decomposable into named sections, so "Memorize" means hide-prose-show-only-boxed-regs -- a real but separate piece of work.

**Trigger to revisit**: Real demand from a user studying for a specific oral / checkride who wants "show only the boxed regs in PHAK ch. 4."

## Pace-aware reading-time estimates

**Why excluded**: 250 wpm fixed is good enough for an MVP. Replacing with the user's heartbeat-derived pace is a polish item; data exists to compute it (`reference_section_read_state.total_seconds_visible` joined to section word counts) but the UI win is small.

**Trigger to revisit**: A user complaining the estimates are wrong, or hitting a "this took 3x the estimate" moment.

## Cross-handbook reading paths (curriculum sequencing)

**Why excluded**: "Finish PHAK chapter 1, then read AFH chapter 1 because the syllabus says so" is curriculum territory, not reader territory. The reader can show "next handbook in cert syllabus" once the syllabus has hooks for that order.

**Trigger to revisit**: When the cert-syllabus WP ships a "next-up reading recommendation" surface.

## Annotated PDF view (render the original PDF inline + overlay annotations)

**Why excluded**: Never. We render markdown derivatives because the markdown is the queryable / linkable / annotatable corpus. The PDF is a sibling affordance for users who want the original layout. Annotations would have to live in two places, and the markdown extraction would be the fallback for everything that doesn't survive a re-extraction.

**Trigger to revisit**: Never.

## Site-wide `<ReadableScope>` rollout to non-reader surfaces (forms, dashboards)

**Why excluded**: `<ReadableScope>` ships in this WP and is mounted on flightbag's `+layout.svelte` AND on study's `(app)/+layout.svelte` so the reading surfaces in both apps adopt it. UI-density surfaces (forms, dashboards, controls) intentionally don't read `--reader-*` tokens -- they're a different scope.

**Trigger to revisit**: If a UI-density surface has long prose embedded (e.g. a long help drawer, a long ADR rendered in hangar), wrap that block in `<ReadableScope>` directly. No global rollout needed.

## Print stylesheet for "print this chapter" / "save as PDF"

**Why excluded**: Adjacent ask but separate. Pilots reading for a checkride often want a printable. Stylesheet work is small; doing it well requires page-break consideration, figure handling, and print-only chrome -- worth its own pass.

**Trigger to revisit**: A user requesting it, or as a polish PR after this WP lands.

## Native PDF download per section (extract just §4.2 from the source PDF)

**Why excluded**: Requires PDF page-range extraction tooling we don't have. The source PDF link already lets the user open the full doc; jumping to a page is a `#page=N` URL fragment.

**Trigger to revisit**: Real ask from a user who wants section-level PDF.

## Offline / PWA mode

**Why excluded**: Flightbag is a hosted-only product per the user's licensing memory. No offline today.

**Trigger to revisit**: If the platform ever ships a desktop / mobile native shell.
