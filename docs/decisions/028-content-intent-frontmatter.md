# 028: Content-Intent Frontmatter

Proposed 2026-05-17. Status: `proposed` -- awaiting human approval.

Relates to: [ADR 011 -- Knowledge graph learning system](011-knowledge-graph-learning-system/decision.md), [ADR 018 -- Source artifact storage policy](018-source-artifact-storage-policy/decision.md), [ADR 025 -- WP frontmatter contract](025-wp-frontmatter-contract/decision.md).

Drives: [hangar-content-census work package](../work-packages/hangar-content-census/spec.md), Layer 2.

## Context

The `hangar-content-census` work package builds a `/content` dashboard that inventories every managed-content corpus -- knowledge nodes, cards, the encoded-text catalog, wx scenarios, courses, handbooks, ACS, sources, glossary, sim content. The census describes each corpus in three layers:

1. **Derived state** -- facts computed by reading the corpus today (a node is a skeleton if it has no Discover/Reveal body; a catalog example is matched if a scenario reproduces it). No new metadata.
2. **Authored intent** -- what a human plans for a content item. Not derivable. Must be authored.
3. **Explanation** -- the what-it-measures / why-it-matters / what-to-do triad on every metric, authored in code.

Layer 1 ships in Phase 1 and Phase 2 with zero new metadata. Layer 3 is authored inside the census adapters. Layer 2 -- authored intent -- has no home yet. There is no place that captures "we plan to add an AIRMET emitter," "this node wants three more scenario examples," or "this corpus is checkride-critical, do it next." Authoring decisions are made from memory or not at all.

This ADR defines that home: a `content_status` plus `intent` frontmatter block on each content item.

### Why frontmatter, not a database table

The `hangar-content-census` OUT-OF-SCOPE.md records that an intent DB table was considered and rejected. Intent must be:

- **Versioned** -- a change to a plan is reviewable in a PR diff.
- **Drift-resistant** -- the intent lives next to the content it describes, so renaming or moving the content carries the intent with it.
- **Reseed-proof** -- intent survives a DB reseed; a Postgres table does not.

This is exactly how ADR 025 WP frontmatter and the ADRs themselves already work. A table breaks all three properties. Frontmatter is the consistent choice.

## Decision

Every managed-content item MAY carry a `content_status` field and an `intent` block in its frontmatter. The block is optional: an item without it renders on the census as "no plan captured," which is itself a triage signal -- the absence of a plan is visible.

### Schema

```yaml
content_status: complete   # complete | draft | skeleton | stub
intent:
  planned:                 # work the author has committed to
    - "add 3 wx-scenario-derived examples"
  wanted:                  # work the author would like, not committed
    - "cross-link to go-nogo-decision once that node lands"
  value: high              # high | standard | low
  notes: "checkride-critical; prioritise"
```

Field rules:

| Field            | Type         | Required          | Meaning                                                         |
| ---------------- | ------------ | ----------------- | --------------------------------------------------------------- |
| `content_status` | enum         | no                | The author's assessment of completeness, distinct from Layer 1. |
| `intent`         | object       | no                | The whole block is optional.                                    |
| `intent.planned` | string array | no (default `[]`) | Committed work. Surfaces in the census "planned work" count.    |
| `intent.wanted`  | string array | no (default `[]`) | Aspirational work. Surfaces in the corpus intent view.          |
| `intent.value`   | enum         | yes if `intent`   | `high` / `standard` / `low` -- ranks the corpus "next" list.    |
| `intent.notes`   | string       | no                | Free-text rationale.                                            |

`content_status` is the author's claim; Layer 1 derived state is the computed fact. The census shows both, and a mismatch (author says `complete`, derived state says `skeleton`) is a useful signal.

The `ContentIntent` TypeScript type in `libs/content-census/src/types.ts` is the runtime shape the census adapters parse this block into.

### Storage location per corpus

Most corpora are markdown with frontmatter -- the block goes directly in the file's frontmatter fence. Corpora that are not markdown (sim scenarios authored as TypeScript modules, JSON registries) carry the block in a co-located `<corpus>.intent.yaml` sidecar. The exact placement is decided per corpus when its Phase 3 adapter is built, recorded in that corpus's census adapter.

### Per-corpus rollout order

Intent is authored one corpus at a time, in `hangar-content-census` Phase 3, ranked by item count and value:

1. Knowledge nodes (highest item count, highest value).
2. Cards.
3. Encoded-text catalog.
4. wx scenarios.
5. Handbooks.
6. Regulations course.
7. The remaining corpora.

Until a corpus has the block authored, its census shows "no plan captured." This is honest and intentional -- a corpus with no intent block is visibly un-triaged.

### Lint guard

A `bun run check` step validates the block wherever it appears. The guard:

- Parses `intent` from any content file's frontmatter (or sidecar).
- Fails the check if `intent` is present but `intent.value` is missing or not in `high | standard | low`.
- Fails if `content_status` is present but not in `complete | draft | skeleton | stub`.
- Fails if `intent.planned` or `intent.wanted` is present but not a string array.
- Does NOT fail when the block is simply absent -- absence is allowed and meaningful.

The guard is a graph validator in the mould of the existing references / browser-globals / help-ids validators. It is authored alongside the first Phase-3 corpus rollout (knowledge nodes), so the block and its guard land together. There is no CI; the guard is a step in `bun run check`.

## Consequences

- The census gains a real Layer 2: planned-work counts on the overview, an intent view on each drill-down, and a value-ranked "next" list.
- Authoring intent becomes a reviewable, versioned act -- a plan change shows up in a PR.
- The absence of a plan is surfaced, not hidden, so un-triaged corpora are visible.
- Each corpus carries a small authoring cost when its Phase-3 rollout adds the block; the rollout order front-loads the highest-value corpora.
- A future need for non-versioned, high-churn intent would require a deliberate superseding ADR -- it is not accommodated here by design.
