---
title: 'Out of Scope: WP-TOC-VALIDATION-SCHEMA'
product: hangar
feature: wp-toc-validation-schema
type: out-of-scope
status: unread
---

# Out of Scope: WP-TOC-VALIDATION-SCHEMA

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                        | Status       | Trigger to revisit                                              |
| --------------------------- | ------------ | --------------------------------------------------------------- |
| The dashboard UI            | Follow-on WP | Tracked in WP-HANGAR-REFS                                       |
| TOC entry hierarchy walking | Deferred     | When a UI need surfaces that the per-entry schema can't satisfy |
| Cross-doc validation        | Deferred     | When admins repeatedly batch-validate across many docs          |

## The dashboard UI

Status: Follow-on WP

What was deferred:

The TOC validation user interface itself (3-column layout, keyboard
shortcuts `y` / `n` / `s`, per-entry marking, aggregate status panel). This
WP defines only the on-disk schema, the validation manifest layout, and
the BC operations that read/write the schema.

Why:

The schema is pre-work for the dashboard. Splitting schema from UI keeps
the data shape's review tractable (Zod schemas, file layout, drift
detection) without entangling SvelteKit routing, hangar admin auth, and
the audit-log integration the dashboard needs. The dashboard ships in
WP-HANGAR-REFS.

Trigger to revisit (Follow-on WP):

WP-HANGAR-REFS is the home for the UI. The schema this WP defines is
exactly its data contract.

Implementation pattern when triggered:

Follow [wp-hangar-references-dashboard/spec.md](../wp-hangar-references-dashboard/spec.md)
for the dashboard surface. Consume the schema via `markTocEntry`,
`getTocEntryStatus`, and `computeCorpusValidationSummary` defined here.

References:

- [spec.md](./spec.md) -- "Out of scope" item 1
- [wp-hangar-references-dashboard/spec.md](../wp-hangar-references-dashboard/spec.md)

## TOC entry hierarchy walking

Status: Deferred

What was deferred:

Schema-side support for walking the TOC tree (parent/child relationships,
ancestor chains, sibling ordering) beyond what's already addressable via
`section_code`. The dashboard is expected to render the tree from the
source manifest; this schema persists only per-entry validation state.

Why:

The source manifest in `study.reference_section` already carries the
hierarchy (via `section_code` ordinals like `1`, `1-2`, `1-2-3` and parent
references in the manifest). Duplicating tree state into the validation
schema would couple two sources of truth. The dashboard composes the tree
from the source manifest and overlays per-entry validation state from
this WP's schema. That separation is intentional.

Trigger to revisit (Deferred):

When a UI need surfaces that the per-entry schema can't satisfy (e.g.
"mark this subsection's entire subtree as verified at once" needs to
record state at a node level rather than per leaf). Concrete signal: a
recurring admin workflow that requires bulk-tree state.

Implementation pattern when triggered:

Extend `tocValidationEntrySchema` with optional tree metadata (e.g.
`subtree_status` aggregating descendants). Keep the canonical hierarchy
in the source manifest; this schema only annotates.

References:

- [spec.md](./spec.md) -- "Out of scope" item 2

## Cross-doc validation

Status: Deferred

What was deferred:

A schema-side affordance for validating across documents at once (e.g.
"verify all PHAK ch 2 entries at once" or "verify all CFR Part 91 across
editions").

Why:

Per-doc validation manifests are the natural unit. Cross-doc aggregation
is a UI feature (the dashboard composes summaries by reading multiple
per-doc manifests) and `computeCorpusValidationSummary(corpus)` already
handles the corpus-level rollup. Building cross-doc operations into the
schema would entangle two scopes.

Trigger to revisit (Deferred):

When admins repeatedly batch-validate across many docs and the UI-layer
aggregation becomes the bottleneck. Concrete signal: an admin workflow
that needs to record cross-doc validation state (not just summarize it).

Implementation pattern when triggered:

Decide whether the cross-doc state belongs in a separate file
(`validation/<corpus>/cross-doc.json`) or as a denormalized aggregate
inside each per-doc manifest. The current per-doc layout favors clean
ownership; a cross-doc surface should justify the denormalization.

References:

- [spec.md](./spec.md) -- "Out of scope" item 3
- `computeCorpusValidationSummary` in [spec.md](./spec.md) handles corpus-level rollup at read time today.
