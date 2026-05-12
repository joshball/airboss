---
title: 'Out of Scope: Help Library'
product: study
feature: help-library
type: out-of-scope
status: unread
---

# Out of Scope: Help Library

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                    | Status       | Trigger to revisit                                                                |
| ------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| Aviation glossary authoring / 175-term port             | Follow-on WP | Handled by wp-reference-system-core                                               |
| Source registry, extractors, CFR parser                 | Follow-on WP | Handled by wp-reference-extraction-pipeline                                       |
| Wiki-link parser implementation                         | Follow-on WP | Handled by wp-reference-system-core (this WP consumes its `ReferenceText.svelte`) |
| Help content for future apps (spatial, audio, avionics) | Deferred     | When each app exists                                                              |
| Persisted "help page seen" state per user               | Rejected     | Never -- see detail below                                                         |
| Embedded help popovers at point of use                  | Follow-on WP | Handled by wp-reference-system-core's `ReferenceTerm`                             |

## Aviation glossary authoring / 175-term port

Status: Follow-on WP

What was deferred:
Authoring of the aviation glossary content, the port of the 175 existing
aviation terms, and the data layer that the `@ab/aviation` registry
exposes.

Why:
Owned by a separate WP -- wp-reference-system-core. The help library
intentionally holds no aviation content of its own; aviation data flows
from `@ab/aviation`. Mixing aviation content into help-library would
break the layering decision called out in the spec ("library
intentionally holds no aviation content of its own").

Trigger to revisit:
The follow-on is named: wp-reference-system-core. When that WP advances,
this one consumes its outputs (registry, `ReferenceText.svelte`,
`AviationTopic` enum, scanner hook).

Implementation pattern when triggered:
Author against wp-reference-system-core's spec. The help-library does
not gain aviation-authoring surfaces; it only consumes the registry.

References:

- [spec.md](./spec.md) "Out of scope" item "Authoring aviation glossary entries or the 175-term port (wp-reference-system-core)"
- [spec.md](./spec.md) "Dependencies" section on `@ab/aviation`

## Source registry, extractors, CFR parser

Status: Follow-on WP

What was deferred:
The source-document registry, format-specific extractors, and the CFR
parser that ingests Title 14 CFR sections.

Why:
Owned by a separate WP -- wp-reference-extraction-pipeline. The help
library is the consumption surface for `@ab/aviation`'s search and
glossary, not the ingestion pipeline. Building extractors here would
duplicate the responsibility of the extraction-pipeline WP and create
two paths to the same registry.

Trigger to revisit:
The follow-on is named: wp-reference-extraction-pipeline. When that
WP advances, this one's search facade benefits without any code change
here (the aviation registry it queries grows).

Implementation pattern when triggered:
Author against wp-reference-extraction-pipeline's spec. Extractors run
ingestion-side; the help library only reads the resulting registry.

References:

- [spec.md](./spec.md) "Out of scope" item "Building the source registry, extractors, CFR parser (wp-reference-extraction-pipeline)"

## Wiki-link parser implementation

Status: Follow-on WP

What was deferred:
The `[[display::id]]` wiki-link parser that resolves bracketed
references inside help-page bodies (and aviation content) into
inline `ReferenceTerm` components.

Why:
Owned by wp-reference-system-core. This WP consumes
`ReferenceText.svelte` from `@ab/aviation`, which is where the parser
lives. Implementing a parser inside help-library would fork the wiki-link
grammar across two libraries and invite drift.

Trigger to revisit:
The follow-on is named: wp-reference-system-core. When that WP ships
the `ReferenceText.svelte` component, this WP renders help bodies
through it.

Implementation pattern when triggered:
Already designed: help bodies pipe through `@ab/aviation`'s
`ReferenceText.svelte`. No parser in `libs/help/`.

References:

- [spec.md](./spec.md) "Out of scope" item "Implementing the wiki-link parser (wp-reference-system-core -- this WP uses `ReferenceText.svelte` from `@ab/aviation` in help-page bodies that mention references)"
- [spec.md](./spec.md) "Help page render" section

## Help content for future apps (spatial, audio, avionics)

Status: Deferred

What was deferred:
Authored help pages for any of the future surface apps (`spatial/`,
`audio/`, `avionics/`, `firc/`). Each app's `src/lib/help/content/`
folder, its `register.ts`, and its initial set of pages.

Why:
"Each app gets its own content folder when it exists." Authoring help
for a non-existent app would be guesswork -- the help surfaces a real
UX, and the UX needs to exist first. The library design (a registry that
any app can call `registerPages()` against) is forward-compatible: when
an app exists, it ships its own content folder with zero changes to
`@ab/help`.

Trigger to revisit:
When each future app exists -- a scaffolded `apps/spatial/`,
`apps/audio/`, `apps/avionics/`, or `apps/firc/` with real surfaces
that warrant help pages.

Implementation pattern when triggered:
Mirror the study app's pattern. New app gets `src/lib/help/content/`
with TypeScript page modules, a `register.ts` that calls
`registerPages()`, and the call wired into the app's root `+layout.ts`
init path. Existing study help pages stand as the authored reference.

References:

- [spec.md](./spec.md) "Out of scope" item "Help content for future apps (spatial, audio, avionics) -- each app gets its own content folder when it exists"
- [design.md](./design.md) "For a future app with its own help content" section

## Persisted "help page seen" state per user

Status: Rejected

What was rejected:
Per-user persistence of which help pages a user has viewed -- a
`seen_at` row, a "what's new in help" indicator, gating of features on
"the user read the docs."

Why:
"Help is reference material, not a tracked flow." Help-as-flow is a
different product (an onboarding tour, a guided walkthrough) with
different UX premises (sequencing, completion signals, dismissal). The
spec deliberately treats `/help` as durable reference -- read it once,
read it again three months later, no state required.

References:

- [spec.md](./spec.md) "Out of scope" item "Persisting which help pages this user has seen -- help is reference material, not a tracked flow"

## Embedded help popovers at point of use

Status: Follow-on WP

What was deferred:
In-context tooltips on dashboard panels, review buttons, and other
UI affordances. Hover / focus popovers that explain a control without
sending the user to `/help`.

Why:
Owned by wp-reference-system-core's `ReferenceTerm` component. This WP
owns the standalone `/help` surface; point-of-use help is a sibling
problem with a different component (popover, anchor, dismissal model).
Mixing the two responsibilities into one library would couple their
release cadence and inflate the API surface.

Trigger to revisit:
When wp-reference-system-core ships `ReferenceTerm` with the
hover-popover affordance the spec references.

Implementation pattern when triggered:
Already designed: `ReferenceTerm` from `@ab/aviation` handles the
popover behavior (hover desktop, tap touch, focus-visible a11y). UI
sites mount `ReferenceTerm` instead of building their own tooltip.

References:

- [spec.md](./spec.md) "Out of scope" item "Embedded help popovers at the point of use (in-context tooltips on dashboard panels, review buttons, etc.) -- handled by wp-reference-system-core's `ReferenceTerm` component; this WP owns the standalone `/help` surface"
