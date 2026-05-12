---
title: 'Out of Scope: WP-FLIGHTBAG-BOOK-EXPERIENCE'
product: flightbag
feature: wp-flightbag-book-experience
type: out-of-scope
status: unread
---

# Out of Scope: WP-FLIGHTBAG-BOOK-EXPERIENCE

Deferred items, why they're deferred, and the trigger that should make us
revisit each. Future agents and humans: do not build these without the
documented trigger. If you think the trigger is hit, surface it for a
decision rather than building silently.

## Summary

| Item                         | Status       | Trigger to revisit                                                   |
| ---------------------------- | ------------ | -------------------------------------------------------------------- |
| Rich-reader features         | Follow-on WP | When `wp-flightbag-rich-reader` is ready to land                     |
| Cross-handbook reading paths | Follow-on WP | When `cert-syllabus-and-goal-composer` adds reading-path composition |
| Annotated PDF view           | Rejected     | Never -- see detail below                                            |

## Rich-reader features

Status: Follow-on WP

What was deferred / rejected / postponed:

Highlights, marginalia/comments, Q&A authoring from a passage, public Q&A
merging per section, instructor comments, self-rated understanding, and
implicit understanding inference from card accuracy on the flightbag reader.
None of these surfaces ship in this WP.

Why:

This WP scopes deliberately to "make the flightbag readable as a book"
(reading-order model, prev/up/next, breadcrumbs, TOC drawer, reading-time
estimates, per-(user, section) read state). The rich-reader layer is what
turns it into a *studyable* textbook, and it has enough surface area to
warrant its own spec, schema discussion, and review pass. Shipping it
inline would double the WP's scope and entangle two distinct review cycles.

The per-(user, reference_section) read-state row introduced in phase 6 of
this WP uses a naming convention (`study.reference_section_<feature>`) that
the rich-reader layer is intended to compose with, so the foundation is
already laid.

Trigger to revisit (if Deferred):

When `wp-flightbag-rich-reader` is ready to land. The follow-on WP already
exists at `docs/work-packages/wp-flightbag-rich-reader/`.

Implementation pattern when triggered (if Deferred):

Follow the schema convention established by
`study.reference_section_read_state` (added in phase 6 of this WP). New
per-(user, section) state tables go in `libs/bc/study/src/schema.ts` named
`study.reference_section_<feature>` with `user_id` + `reference_section_id`
as the composite key dimensions. See the existing WP at
`docs/work-packages/wp-flightbag-rich-reader/spec.md`.

References:

- [Spec: In Scope #8 -- Foundation for rich-reader subsystems (data shape only)](./spec.md)
- [docs/platform/IDEAS.md "Flightbag as a Rich Reading & Studying Surface"](../../platform/IDEAS.md)
- [docs/work-packages/wp-flightbag-rich-reader/](../wp-flightbag-rich-reader/)
- [ADR 023 -- Flightbag as canonical references app](../../decisions/023-flightbag-as-canonical-references-app/decision.md)

## Cross-handbook reading paths

Status: Follow-on WP

What was deferred / rejected / postponed:

Curated reading sequences that span more than one source document (e.g.
"finish PHAK chapter 1, then read AFH chapter 1 to anchor the same concept
in two voices"). The reading-order model in this WP is scoped to a single
reference: `getReadingOrder(referenceId)` returns the depth-first ordinal
traversal of a single handbook / AC / CFR; it does not stitch references
together.

Why:

Cross-handbook ordering is a curriculum concern, not a reading-structure
concern. The order in which PHAK and AFH chapters should be read depends
on the syllabus, the cert the learner is pursuing, and the lesson plan in
front of them -- none of which the flightbag reader knows about. Owning
this question inside the reader would couple the reader to syllabus state
and violate the WP's scope discipline ("make a single book readable").

The owning surface is `cert-syllabus-and-goal-composer`, which already has
its own WP. Reading-path composition belongs there.

Trigger to revisit (if Deferred):

When `cert-syllabus-and-goal-composer` adds reading-path composition (a
syllabus referencing N sections across M references, surfaced as a single
ordered sequence). At that point the flightbag reader needs to accept an
optional path-context and render prev/up/next against the syllabus path
instead of the within-handbook ordinal traversal.

Implementation pattern when triggered (if Deferred):

Extend `getReadingOrder(referenceId)` to a sibling `getSyllabusPath(pathId)`
in `libs/bc/study/src/references.ts` that returns the same shape (the entry
record per section) but is sourced from a syllabus path row rather than the
single-reference depth-first traversal. The reader's prev/up/next strip then
takes an optional `pathId` param and switches data source. Mirror the
pattern used for `getReadingOrder` in this WP. See the WP at
`docs/work-packages/cert-syllabus-and-goal-composer/spec.md`.

References:

- [Spec: Out of Scope -- Cross-handbook reading paths](./spec.md)
- [docs/work-packages/cert-syllabus-and-goal-composer/](../cert-syllabus-and-goal-composer/)
- [ADR 023 -- Flightbag as canonical references app](../../decisions/023-flightbag-as-canonical-references-app/decision.md)

## Annotated PDF view

Status: Rejected

What was deferred / rejected / postponed:

Rendering the original FAA PDF (with the reader's annotations, highlights,
comments) as the primary reading surface, or providing a PDF-overlay view
that draws our annotations on top of the source PDF.

Why:

The flightbag reader renders markdown derivatives extracted from the source
PDF, not the PDF itself. That is a deliberate architectural choice (ADR
023): markdown is structured, queryable, citation-able, and composable with
read state / highlights / TOC / search. A PDF is a pixel blob; everything
the reader does well (deep links, citations, reading-time estimates, TOC
drawer, prev/next) becomes much harder or impossible against a PDF surface.

The user who wants the original PDF is served by the existing SourceLinks
"open PDF" affordance on every reader page; we keep that escape hatch.
Rebuilding annotation infrastructure against PDFs (PDF.js overlays,
coordinate-anchored highlights, PDF-page-to-section reverse mapping) is
substantial work that would compete with the markdown-rendering path
without adding capability.

Trigger to revisit (if Deferred):

Never -- see detail above. A re-decision would have to clear a high bar:
either the markdown derivative pipeline fails for a class of documents we
must support, or there is a regulatory / accessibility requirement that
the canonical PDF render in-app. Both are unlikely given ADR 023's
direction; revisit only with a fresh architecture decision.

References:

- [Spec: Out of Scope -- Annotated PDF view](./spec.md)
- [ADR 023 -- Flightbag as canonical references app](../../decisions/023-flightbag-as-canonical-references-app/decision.md)
- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)
