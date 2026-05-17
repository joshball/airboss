---
title: 'Out of Scope: Navigating FAA Documentation'
product: study
feature: faa-documentation-navigation
type: out-of-scope
status: unread
---

# Out of Scope: Navigating FAA Documentation

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                             | Status       | Trigger to revisit                                              |
| ------------------------------------------------ | ------------ | --------------------------------------------------------------- |
| The content of any specific document             | Rejected     | Never -- see detail below                                       |
| Hard prerequisite gating on content courses      | Deferred     | When learners repeatedly start content courses unoriented       |
| Live link-checking against FAA sites             | Rejected     | Never -- see detail below                                       |
| A searchable in-app document index               | Follow-on WP | When the reference family pages prove worth a dedicated surface |
| International (ICAO / Transport Canada) families | Deferred     | When airboss adds a non-US-regulatory course                    |

## The content of any specific document

Status: Rejected

What was rejected:
Teaching what any one FAA document actually says. "What does AC 00-45
say about METARs," "what the AIM weather chapter covers," "the contents
of PHAK Chapter 12" -- the substantive content of a named document.

Why:
This course teaches NAVIGATION, not content. It is the map, not the
territory. The content of weather documents is the weather course's job
(`course/courses/weather-comprehensive/`); the content of the FARs is
the regulations course's job (`course/regulations/`). If this course
drifted into document content it would duplicate and then diverge from
the content courses. The scope boundary is the whole point: this course
gets a pilot pointed in the right direction, then hands off.

References:

- spec.md "Scope of the deliverable" and the "Why this course exists" framing
- `course/courses/weather-comprehensive/manifest.yaml` -- where weather content lives
- `course/regulations/` -- where FAR content lives

## Hard prerequisite gating on content courses

Status: Deferred

What was deferred:
Making "Navigating FAA Documentation" a hard prerequisite of the content
courses, so a learner must complete it before `weather-comprehensive` or
the regulations course unlocks.

Why:
Per design.md "Key decisions," a hard prerequisite would cage an
experienced pilot who already knows the ecosystem and wants to start on
weather. The course ships standalone, framed in its manifest and first
step as "take this first," and linked as recommended orientation from
the first step of content courses. Soft framing orients the new pilot
without blocking the returning one.

Trigger to revisit (if Deferred):
When learner data or a manual review shows pilots repeatedly starting a
content course unoriented and struggling with the documentation
references inside it (for example, more than a handful of learners
hitting a content step that cites an AC and not knowing what an AC is).

Implementation pattern when triggered (if Deferred):
Mirror the existing course-prerequisite mechanism. Inspect how
`docs/work-packages/course-primitive/` and the cert-syllabus composer
model `requires` / prerequisite edges between courses; add the
prerequisite edge there rather than inventing a new gating concept.

References:

- design.md "Key decision: standalone course, framed take this first"
- `docs/work-packages/course-primitive/spec.md`
- ADR 011 (discovery-first pedagogy -- a gate must not punish prior knowledge)

## Live link-checking against FAA sites

Status: Rejected

What was rejected:
An automated check that fetches `drs.faa.gov`, eCFR, and the
`documentLibrary` PDF URLs cited in the reference pages to confirm they
still resolve, run as part of `bun run check`.

Why:
The check pipeline is local, fast, and offline by design; there is no CI
to host a network job. A network-dependent step would make the pipeline
flaky and slow for every contributor regardless of whether they touched
this content. FAA URLs are stable enough that periodic manual review is
the right cost. The citation-correctness gate at authoring time (verify
each source against the document) is the real safeguard.

References:

- CLAUDE.md "Critical Rules" -- there is no CI; the only gate is `bun run check` run locally
- spec.md "Validation" -- citations verified against the source at authoring time

## A searchable in-app document index

Status: Follow-on WP

What was deferred:
A dedicated in-app surface (a route, a component) that lets a learner
search and filter the FAA document families: type a regulation part and
get the matching AC series, filter by binding vs advisory, jump to a
family page. The reference artifact in this WP is browsable markdown
pages plus a static index table, not an interactive search surface.

Why:
This WP is content authoring with no application feature (spec.md "Scope
of the deliverable" -- no new route, no new component, no API surface).
A searchable index is a real feature with its own data shape, route, and
UI, and earns its own WP per the CLAUDE.md work-package threshold. It
should not ride along on a content package.

Trigger to revisit:
When the twelve family reference pages are live and a manual review (or
learner feedback) shows the static index table is being used enough to
justify an interactive surface -- the signal that the content is proven
and the navigation friction is real.

Implementation pattern when triggered:
Author a new WP via `/ball-wp-spec`. The reference pages and the family
index table from this WP become its content backing; the new WP adds the
route and search component. Mirror the flightbag reference-reader pattern
(`apps/flightbag/`, `libs/library/`) for a deep-linkable reference surface.

References:

- spec.md "Scope of the deliverable"
- CLAUDE.md "When to use a work package (and when NOT to)"
- `apps/flightbag/` and `libs/library/` -- the reference-reader surface pattern

## International (ICAO / Transport Canada) families

Status: Deferred

What was deferred:
Document families outside the US FAA system: ICAO Annexes and Docs,
Transport Canada AIM and CARs, and other national regulators' document
ecosystems.

Why:
airboss's user zero is a US private/instrument/CFI pilot, and every
content course today is US-regulatory. Adding international families now
would author a map for territory the platform does not yet cover.

Trigger to revisit (if Deferred):
When airboss adds a course built on a non-US regulatory system (an ICAO
or Transport Canada content course).

Implementation pattern when triggered (if Deferred):
Add the international families as additional reference pages under a
sibling directory (for example `course/regulations/references/document-families-icao/`)
and extend the family index, mirroring the per-family `page.md` shape
this WP establishes. Add matching glossary entries with non-colliding
keys.

References:

- MEMORY.md "User profile -- Joshua" -- returning US CFI, the platform's user zero
- spec.md "Why this course exists" -- audience is the US returning pilot
