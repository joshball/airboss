---
title: 'Out of Scope: Content Citations'
product: study
feature: content-citations
type: out-of-scope
status: unread
---

# Out of Scope: Content Citations

Deferred items, why they're deferred, and the trigger that should make us
revisit each. Future agents and humans: do not build these without the
documented trigger. If you think the trigger is hit, surface it for a
decision rather than building silently.

The polymorphic table, BC, picker, and renders all shipped (PR #127, PR #278,
PR #299, PR #309). The items below remain explicit deferrals per the spec
verdict (2026-04-28): each would be a fresh WP if a concrete need arises.

## Summary

| Item                                                 | Status   | Trigger to revisit                                                            |
| ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Auto-backfill of citations from existing card bodies | Deferred | When coverage data shows manual authoring is missing citations at scale       |
| Inline-in-body markdown citation syntax              | Deferred | When the explicit structured picker proves insufficient for an authoring flow |
| Public citation discovery surfaces                   | Deferred | When a concrete browse / leaderboard use case earns its keep                  |
| Bulk citation import / CSV                           | Rejected | Never -- see detail below                                                     |
| Citation moderation / approval                       | Rejected | Never -- see detail below                                                     |

## Auto-backfill of citations from existing card bodies

Status: Deferred

What was deferred:
An automated scan over existing card bodies (and other content) that detects
patterns like `14 CFR X.Y` and creates `content_citations` rows linking the
card to the referenced regulation node.

Why:
Users authored the existing cards and can cite manually. A regex pass will
produce false matches (e.g. mid-sentence quotes, ambiguous part references,
quoted exam questions) and the system would then own the error cases. Manual
authoring keeps each citation deliberate and accountable to the author.

Trigger to revisit:
Coverage data shows manual authoring is missing citations at scale -- e.g.
the cited-by panel on a regulation node is consistently empty for nodes that
appear by name in card bodies, or learners report missing cross-references
they expected. At that point, the regex pass becomes a curated batch tool
rather than an unattended job.

Implementation pattern when triggered:
A new BC function in `libs/bc/study/src/citations/` that walks card bodies,
applies regulation-pattern detectors from `libs/sources/`, and proposes
citations for author review (rather than creating them silently). Mount the
review queue inside the hangar authoring surface. Use the existing
`createCitation` BC; do not bypass validation.

References:

- [spec.md "Out of scope"](./spec.md)
- `libs/bc/study/src/citations/citations.ts`
- `libs/constants/src/citations.ts`

## Inline-in-body markdown citation syntax

Status: Deferred

What was deferred:
An inline markdown citation syntax (e.g. `{cite: node-id}` or
`[[cite:node-id]]`) parsed at render time into citation chips, alongside the
explicit picker-driven citations.

Why:
v1 uses explicit structured citations via the picker. Inline syntax adds a
parser surface, a render path, and an authoring affordance that the existing
picker already covers. Two paths to create the same row is duplicate
maintenance until a real authoring need appears.

Trigger to revisit:
The picker proves insufficient for an authoring flow -- for example, a card
template wants citation chips inline at specific sentence positions rather
than aggregated below the body, or AI-authored content wants to express
citations as it generates.

Implementation pattern when triggered:
A markdown plugin in `libs/sources/` or `libs/ui/` that resolves
`{cite: target-type:target-id}` tokens to `CitationChip` components. The
underlying row creation still routes through `createCitation` to keep
validation centralized; the inline syntax becomes another path into the
same BC.

References:

- [spec.md "Out of scope"](./spec.md)
- [spec.md "Open questions (non-blocking)"](./spec.md) (auto-suggest by body scan -- adjacent open question)

## Public citation discovery surfaces

Status: Deferred

What was deferred:
A "most-cited regulations" leaderboard, a citation-browse surface, or any
public discovery UI built on top of the citations graph.

Why:
A concrete use case has not surfaced. The cited-by panel already exposes the
per-target view inline on the regulation-node and knowledge-node detail
pages, which is enough for "what cites this?" navigation. A public leaderboard
or browse UI is product-shape work that needs its own design rationale.

Trigger to revisit:
A concrete use case earns its keep -- for example, a learner asks "what are
the most-studied regulations on the platform?", or a content audit needs a
view of orphaned references.

Implementation pattern when triggered:
A new route under `/library/citations` or similar, backed by `getCitedBy`
aggregated across target types. Coordinate with the [flightbag](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)
library surfaces.

References:

- [spec.md "Out of scope"](./spec.md)

## Bulk citation import / CSV

Status: Rejected

What was rejected:
A bulk import path (CSV upload, JSON import, scripted backfill from external
data) for creating citations en masse.

Why:
Never -- see detail below. Citations are author-owned and tied to authoring
permission gates (`createCitation` requires the source row to be
owned / edited by the user). A bulk import path bypasses those gates and
puts the system in the position of owning the validity of imported rows.
Manual creation via the picker keeps each citation accountable.

Trigger to revisit:
Re-decision would require a product shape where citations are a
machine-curated artifact rather than an author-curated one. That is a
significant product-shape change.

References:

- [spec.md "Out of scope"](./spec.md)
- `libs/bc/study/src/citations/citations.ts` (validation gates)

## Citation moderation / approval

Status: Rejected

What was rejected:
A moderation workflow where citations enter a pending state and require
approval before they render on the cited content.

Why:
Never -- see detail below. Authors own their citations. The picker validates
the target exists, the unique index prevents duplicates, the
`citation_context` field is bounded at 500 chars (`CITATION_CONTEXT_MAX_LENGTH`).
A moderation layer adds workflow without addressing a real failure mode in
the existing system.

Trigger to revisit:
Re-decision would require a multi-author content model where one author's
citations affect another author's surface in a way that needs human review.
That is a different product shape from "authors own their own content."

References:

- [spec.md "Out of scope"](./spec.md)
- `libs/constants/src/citations.ts` (`CITATION_CONTEXT_MAX_LENGTH`)
