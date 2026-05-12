---
title: 'Out of Scope: Node render modes'
product: study
feature: node-render-modes
type: out-of-scope
status: unread
---

# Out of Scope: Node render modes

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

Sources: the "Out of scope" and "Flightbag handbook sections" subsections of [spec.md](./spec.md), the Decisions table (decision 4 on flightbag, decision 8 in [design.md](./design.md)), and the "Forward compatibility" notes in [design.md](./design.md). Pedagogy anchor: [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md).

## Summary

| Item                                        | Status       | Trigger to revisit                                                             |
| ------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| Flightbag handbook-section render modes     | Follow-on WP | When a real ask surfaces for "show only boxed regs" on a handbook section page |
| Mode-choice analytics                       | Deferred     | When > 1 user is on the system and mode-default tuning becomes a real question |
| New BC functions for evidence               | Rejected     | Never -- see detail below                                                      |
| New card / scenario authoring tooling       | Rejected     | Never -- see detail below                                                      |
| Multi-author collaboration on node bodies   | Rejected     | Never -- see detail below                                                      |
| Version history of section content (in-app) | Rejected     | Never -- see detail below                                                      |
| A/B test of mode defaults                   | Rejected     | Never -- see detail below                                                      |
| Per-user custom mode (free-form ordering)   | Rejected     | Never -- see detail below                                                      |

## Flightbag handbook-section render modes

Status: Follow-on WP

What was postponed:
A Learn / Review / Memorize toggle on `/library/handbook/[id]/[chapter]/[section]` (the flightbag handbook reader). The knowledge-node renderer ships in this WP; the handbook-section equivalent is deliberately deferred.

Why:
Per decision 4 in [spec.md](./spec.md), decision 8 in [design.md](./design.md), and the v1.1 callout in the spec's "Surfaces" -> "Flightbag handbook sections" block: handbook prose isn't (and shouldn't be) decomposed into hook / explanation / synthesis. It's authored FAA prose with boxed regulation excerpts inline. The render-mode primitive there is "show only the boxed regs; hide the surrounding prose" -- a different rendering model than the knowledge-node re-ordering. Building it speculatively against a hypothetical demand would freeze the wrong shape.

Trigger that fires the follow-on:
A real user ask for "show only the boxed regs" (or equivalent) on a handbook section page -- not a synthetic "wouldn't it be nice." The IDEAS.md entry [flightbag-render-modes](../../platform/IDEAS.md) holds the placeholder.

References:

- [spec.md](./spec.md) "Surfaces" -> "Flightbag handbook sections"
- [spec.md](./spec.md) "Out of scope" -> "No flightbag section render modes"
- [spec.md](./spec.md) Decisions table, row 4
- [design.md](./design.md) Decision 8

## Mode-choice analytics

Status: Deferred

What was deferred:
Per-user / per-mode telemetry that captures which mode each user picks per node. The spec's "No analytics on which mode users pick. Could add later; not v1." Today the user-pref row stores the *current* mode; we do not log mode *changes* or per-node mode selections.

Why:
Per [spec.md](./spec.md) "Out of scope": the v1 product question is whether the three-mode primitive works for one user. With a single-user system, aggregate analytics tell us nothing the user can't tell us directly. Building a logging surface speculatively means designing the analytics shape before the question that the analytics should answer has been asked.

Trigger to revisit:
When > 1 user is on the system AND a product question depends on "which mode does the population pick by default?" -- e.g., revisiting the Learn-as-default decision, or sizing the cost of moving a section type around.

Implementation pattern when triggered:
Mirror an existing audit-log pattern. A `study.knowledge_render_event` table (or extend `audit_log`) with `(user_id, knowledge_node_id, mode, occurred_at)`. The mode toggle's `?/setPref` action emits the event in the same transaction. Aggregation lives in a BC query, not at write time.

References:

- [spec.md](./spec.md) "Out of scope" -> "No analytics on which mode users pick"
- [spec.md](./spec.md) "Out of scope" -> "No A/B test of mode defaults" (related deferral)

## New BC functions for evidence

Status: Rejected

What was rejected:
Any BC function in this WP that touches evidence. Specifically: `getNodeEvidenceStateMap` and the demonstration / practice evidence layer remain unchanged. Render modes do not add a new evidence kind and do not modify how evidence is read or written.

Why:
Per [spec.md](./spec.md) "Out of scope" -> "No new BC functions for evidence": this WP is purely a rendering / authoring change. Evidence is a separate concern owned by WP 2 (flight-evidence-and-cfi-feedback) in the same three-WP arc. Mixing rendering and evidence work would entangle two reviews and break the WP arc's parallel-build plan.

References:

- [spec.md](./spec.md) "Out of scope" -> "No new BC functions for evidence"
- [spec.md](./spec.md) WP arc context: WP 2 owns evidence; WP 3 owns rendering
- [flight-evidence-and-cfi-feedback/spec.md](../flight-evidence-and-cfi-feedback/spec.md)

## New card / scenario authoring tooling

Status: Rejected

What was rejected:
Any new authoring surface for memory cards or scenarios. Existing surfaces (hangar app for scenarios, the card authoring path for cards) continue to own those artifacts. The `practice_prompts` section uses `airboss-ref:card:<id>` / `airboss-ref:scenario:<id>` markers that resolve against the existing registry.

Why:
Per [spec.md](./spec.md) "Out of scope" -> "No new card / scenario authoring tooling": the render-modes feature reads existing artifacts; it does not author them. The marker resolution path (see [tasks.md](./tasks.md) step 7) is read-side only.

References:

- [spec.md](./spec.md) "Out of scope" -> "No new card / scenario authoring tooling"
- [tasks.md](./tasks.md) step 7 (marker resolution)
- [spec.md](./spec.md) "Validation" -> `practice_prompts` markers row

## Multi-author collaboration on node bodies

Status: Rejected

What was rejected:
Concurrent-editing / multi-author / review-and-merge tooling for knowledge node bodies. There is one author (the user) and one source of truth (the markdown file in `course/knowledge/`).

Why:
Per [spec.md](./spec.md) "Out of scope" -> "No multi-author collaboration on node bodies": airboss has one author. Building collaborative editing now would invent ceremony for a single-author workflow. Git is the collaboration surface; if a second author appears, they propose changes via PR like any other contributor.

References:

- [spec.md](./spec.md) "Out of scope" -> "No multi-author collaboration on node bodies"
- [design.md](./design.md) Schema section ("No schema changes. Knowledge node bodies are markdown files...")

## Version history of section content (in-app)

Status: Rejected

What was rejected:
An in-app "see previous versions of this section" affordance, or a DB column on a `body_section_history` table tracking edit history.

Why:
Per [spec.md](./spec.md) "Out of scope" -> "No version history of section content. Git is the version history." Markdown files live in the repo; `git log` and `git blame` are the existing version-history surface. Re-implementing them in the app duplicates what git already does.

References:

- [spec.md](./spec.md) "Out of scope" -> "No version history of section content"
- [design.md](./design.md) Schema section

## A/B test of mode defaults

Status: Rejected

What was rejected:
Any A/B / experimentation tooling that varies the default mode across users (or across visits) to compare engagement. Learn is the default. We do not experiment on the default.

Why:
Per [spec.md](./spec.md) "Out of scope" -> "No A/B test of mode defaults" and [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md): the discovery-first principle is a pedagogy commitment, not a hypothesis. Defaulting to Memorize for some users would contradict the principle for those users. A/B testing the default would imply we are uncertain about Learn-as-default; we are not.

References:

- [spec.md](./spec.md) "Out of scope" -> "No A/B test of mode defaults"
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) (discovery-first principle)
- [design.md](./design.md) Decision 3 (Learn as default)

## Per-user custom mode (free-form ordering)

Status: Rejected

What was rejected:
A configuration surface that lets a user define a custom mode (e.g., "memorize but with the hook collapsed and prompts first") beyond the three fixed modes. The product ships with exactly three modes: Learn, Review, Memorize.

Why:
Per [spec.md](./spec.md) "Out of scope" -> "No per-user custom mode": three fixed modes capture three reading purposes (first-exposure understanding, returning-learner review, rule-drill memorization). A custom-mode surface invents a personalization product on top of a pedagogy product. The right way to want a different reading order is to author a different mode in `MODE_ORDERS` and ship it system-wide -- which is a design conversation, not a per-user setting.

A re-decision would have to clear: a use case where one of the three modes is genuinely wrong for an entire class of learner AND adding a fourth mode (system-wide) doesn't cover it. None has surfaced.

References:

- [spec.md](./spec.md) "Out of scope" -> "No per-user custom mode"
- [design.md](./design.md) Decision 6 (`MODE_ORDERS` is a closed enum-of-arrays)
