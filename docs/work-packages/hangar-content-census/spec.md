---
id: hangar-content-census
title: Hangar Content Census -- Spec
product: hangar
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-17
owner: agent
depends_on: []
unblocks: []
tags:
  - admin
  - dashboard
  - content-management
legacy_fields:
  feature: hangar-content-census
  type: spec
  review_status: pending
---

# Hangar Content Census -- Spec

A `/content` command center inside the hangar that inventories **every learning-content
corpus airboss manages** -- knowledge nodes, cards, the encoded-text catalog, wx
scenarios, courses, handbooks, ACS, sources, glossary, sim content -- and shows, for
each, what exists, what state it's in, what's planned, and what's missing.

Not a number grid. Every metric on every page **explains itself**: what it measures,
why it matters, and what to do about it. See [Explanatory-surface requirement](#explanatory-surface-requirement).

## Relationship to `hangar-platform-dashboard`

`hangar-platform-dashboard` (`/platform`, signed-off) aggregates **process metadata** --
WP statuses, roadmaps, ADR index, NOW.md, drift. This WP aggregates **content** -- the
actual learning material and its completeness. They are siblings, not duplicates:
`/platform` answers "where do our work packages stand"; `/content` answers "what
learning content exists and what's missing." The two dashboards cross-link.

## Problem

The 2026-05-16 wx-catalog coverage work (PR #1006) surfaced a general pattern. The
coverage CLI reported "20 of 155 catalog examples matched" -- a real signal, but
nobody could see it without running a script, and the number meant nothing without
explanation (it measures generator reproducibility, not catalog quality -- two things
people conflate).

Every content corpus has this same shape and the same blind spot:

- **Knowledge nodes** -- 88 nodes; some have full Discover/Reveal bodies, some are
  skeletons. No surface shows which.
- **Cards** -- 331 cards embedded across nodes; some nodes have rich decks, some have
  none. Countable, never counted.
- **Encoded-text catalog** -- 155 examples, 87 token families, 43 covered. Visible
  only via CLI.
- **wx scenarios** -- 7 authored; `frontal-pressure-march` contributes 0 catalog
  matches. Invisible.
- **Handbooks** -- 3,872 ingested sections across a handful of books; which FAA
  handbooks are fully ingested vs partial is unknown without a manifest walk.
- **Courses / regulations** -- 90 sections across 10 weeks; which weeks have all three
  modalities (lessons, drills, orals) is uninspectable.
- **Glossary** -- 7 authored entries vs 70+ terms referenced by nodes. The gap is real
  and unsurfaced.

There is no census. There is no per-corpus completeness view. There is no place that
captures **intent** -- "we plan to add an AIRMET emitter," "this node wants 3 more
scenario examples," "this is high-value, do it next." Authoring decisions are made
from memory or not at all.

This WP delivers the census, the per-corpus drill-downs, and the intent model that
makes "what's next" answerable.

## Census scope -- the 14 corpora

The dashboard covers every managed-content corpus found in the 2026-05-17 survey:

| #   | Corpus                  | Location                                         | Count (approx) |
| --- | ----------------------- | ------------------------------------------------ | -------------- |
| 1   | Knowledge nodes         | `course/knowledge/**`                            | 88 nodes       |
| 2   | Cards (spaced-rep)      | `:::cards` blocks in node markdown               | 331 cards      |
| 3   | Encoded-text catalog    | `course/knowledge/weather/encoded-text-catalog/` | 155 examples   |
| 4   | wx-engine scenarios     | `libs/wx-engine/src/truth/scenarios/`            | 7 scenarios    |
| 5   | Regulations course      | `course/regulations/**`                          | 90 sections    |
| 6   | Handbooks               | `handbooks/**`                                   | 3,872 sections |
| 7   | ACS documents           | `acs/**`                                         | 10 documents   |
| 8   | Source registry         | `ac/`, `info/`, `safo/` + `libs/sources/`        | 29 docs        |
| 9   | Help library + glossary | `libs/help/`, `libs/db/seed/glossary.toml`       | 7 glossary     |
| 10  | Vision / PRD docs       | `docs/vision/**`                                 | 71 docs        |
| 11  | Work packages           | `docs/work-packages/**`                          | 493 WPs        |
| 12  | ADRs                    | `docs/decisions/**`                              | 42 ADRs        |
| 13  | wx charts / symbology   | `libs/wx-charts/`                                | chart types    |
| 14  | Sim scenarios / models  | `libs/bc/sim/`, `apps/sim/`                      | sim content    |

Corpora 11-12 (WPs, ADRs) overlap `hangar-platform-dashboard`; the content census
**links to** that dashboard's views rather than re-rendering them.

## What "census" means -- three layers per corpus

Every corpus is described by three layers. The dashboard renders all three.

### Layer 1 -- Derived state (computed, no new metadata)

Facts computed by reading the corpus today. No file edits required. Examples:

- A knowledge node is a *skeleton* if its body lacks Discover/Reveal phase content.
- A node's card count is the number of `:::cards` entries.
- A wx scenario's catalog contribution is countable from `scenario-matches.json`.
- A handbook's ingestion completeness is sections-extracted vs chapters-expected.

Layer 1 ships first and gives a real census with zero authoring cost.

### Layer 2 -- Authored intent (frontmatter, added per corpus)

What a human plans -- not derivable, must be authored. Captured as a frontmatter
`intent` block on each content item (see [ADR proposal](#adr-proposal-content-intent-frontmatter)):

```yaml
content_status: complete   # complete | draft | skeleton | stub
intent:
  planned:
    - "add 3 wx-scenario-derived examples"
  wanted:
    - "cross-link to go-nogo-decision once that node lands"
  value: high              # high | standard | low
  notes: "checkride-critical; prioritise"
```

Intent lives in the content file (git-versioned, drift-resistant, consistent with
ADR 025 WP frontmatter). It is added **one corpus at a time** -- a file without an
`intent` block renders as "no plan captured," which is itself a triage signal.

### Layer 3 -- Explanation (authored once per metric, in code)

Every metric carries a human explanation: what it measures, why it matters, what
action it implies. This is the [explanatory-surface requirement](#explanatory-surface-requirement)
and is non-negotiable.

## Explanatory-surface requirement

The dashboard must teach, not just report. For every metric on every page:

- **What it measures** -- a one-sentence definition in plain language. "Generator
  coverage = how many catalog examples the wx-engine can reproduce from a truth
  model. It is NOT a measure of catalog quality."
- **Why it matters** -- the consequence. "Uncovered token families can't be drilled
  with generated content -- only with static examples -- so the truth-aware drill
  has a blind spot there."
- **What to do** -- the action, linked. "44 families uncovered -> see the AIRMET
  emitter follow-up [link to the WP/issue]."
- **Links and references** -- every corpus page links to the relevant ADR, plan,
  spec, and source files. A reader lands on the wx-catalog page and can reach
  ADR 018, the catalog plan, `catalog.json`, and the matcher source in two clicks.

A bare number with no explanation is a spec violation. Reviewers reject pages that
ship metrics without the what/why/do triad.

## Surfaces

### `/content` -- the census overview

One row per corpus (all 14). Each row:

- Corpus name + what it is (one line)
- Item count
- Derived-state summary -- a small distribution bar (complete / draft / skeleton /
  stub, or corpus-appropriate states)
- A health indicator with an explained meaning (not a bare red/green dot -- a label
  + tooltip stating the rule)
- "Planned work" count (from Layer 2 intent, once that corpus has it; "--" until then)
- Link into the per-corpus drill-down

Above the rows: a short prose section explaining what the census is, what the three
layers mean, and how to read it.

### `/content/<corpus>` -- per-corpus drill-down

One page per corpus. Each shows:

- **Overview** -- prose: what this corpus is, why it exists, where it lives, the
  relevant ADRs/plans/specs (linked).
- **Inventory** -- the item list with derived state, filterable/sortable.
- **Gap view** -- what's missing or thin, explained. For the wx catalog: uncovered
  token families, the AIRMET-matching structural gap, the temporal-scenario gap --
  each with the what/why/do triad.
- **Intent view** -- planned/wanted/value from Layer 2 frontmatter, where present.
- **Next** -- a synthesised "what to do next" list, ranked by value, each item
  linking to the WP or plan that would deliver it.

The wx-catalog drill-down is the **reference implementation** -- built fully in this
WP's first phase as the pattern every other corpus page follows.

## ADR proposal -- content-intent frontmatter

Layer 2 needs a frontmatter contract. This WP proposes a new ADR ("Content-intent
frontmatter") defining the `content_status` + `intent` block, its schema, the
per-corpus rollout order, and a lint guard. The ADR is authored in Phase 1 and
approved before any corpus gets the block. Until the ADR lands, the dashboard runs
Layer-1-only (derived state) -- fully useful on its own.

Authored as [ADR 028 -- Content-intent frontmatter](../../decisions/028-content-intent-frontmatter.md),
status `proposed`.

## Out of scope

See [OUT-OF-SCOPE.md](OUT-OF-SCOPE.md).

## Success criteria

- `/content` renders all 14 corpora with derived-state census, zero new metadata.
- `/content/wx-catalog` is a complete reference drill-down: inventory + gap view +
  next, every metric carrying the what/why/do triad with links.
- Every other corpus has at least a stub drill-down page (overview prose + derived
  inventory + placeholder gap/intent/next sections) so the breadth is visible.
- The content-intent ADR is authored and ready for human approval.
- `bun run check` clean; e2e smoke for `/content` + `/content/wx-catalog`.
- A reader with no prior context can land on any page and understand what the
  numbers mean and what to do -- verified in the manual test plan.
