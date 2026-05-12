---
title: 'Out of Scope: Global search + command palette'
product: platform
feature: command-palette
type: out-of-scope
status: unread
---

# Out of Scope: Global search + command palette

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                            | Status   | Trigger to revisit                                                                                            |
| ----------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Server-side full-text search                    | Deferred | When any in-memory query consistently exceeds 50ms or the corpus grows past what an in-memory ranker can hold |
| Cross-tenant or cross-org search                | Rejected | Never -- see detail below                                                                                     |
| Personalisation beyond recents                  | Deferred | When recents-only ranking proves insufficient for the active user base                                        |
| Localisation                                    | Rejected | Never -- see detail below                                                                                     |
| Indexing user reflection journals (`mine.note`) | Deferred | When user reflection journals ship as a surface and `mine.note` loader has a corpus to read                   |
| Voice / natural-language queries                | Rejected | Never -- see detail below                                                                                     |
| Alfred-style multi-step built-in workflows      | Rejected | Never -- see detail below                                                                                     |
| Reskin of `apps/hangar`'s `/docs` admin search  | Rejected | Never -- see detail below                                                                                     |

## Server-side full-text search

Status: Deferred

What was deferred:
A server-side FTS index (Postgres tsvector, Meilisearch, or similar) backing the palette query pipeline.

Why:
Phase 2 is in-memory only. The current corpus (FAA registry, study refs, knowledge nodes, courses) is small enough that an in-memory ranker holds under the 50ms budget. Building a server-side FTS surface before the in-memory ranker is the bottleneck would invent infrastructure and ranking-pipeline complexity that nothing today needs.

Trigger to revisit:
When any palette query consistently exceeds 50ms in the ranker, OR when the corpus size grows past what an in-memory ranker can carry without measurable hydration cost.

Implementation pattern when triggered:
Author a follow-on WP. Prefer the platform's existing Postgres FTS infrastructure (already in use by `hangar.docs_search_index`) before reaching for an external service. Keep the in-memory ranker for cmd / quick-open modes where latency matters more than recall.

References:

- [spec.md "Non-goals"](./spec.md)
- [design.md "Contracts"](./design.md)

## Cross-tenant or cross-org search

Status: Rejected

What was rejected:
Any search behaviour that spans tenants or organizations.

Why:
Airboss is single-user single-tenant per the current product shape. Cross-tenant search is not a product concept here; building it would invent constraints (auth boundary, data isolation, per-tenant ranking) that don't exist.

References:

- [spec.md "Non-goals"](./spec.md)

## Personalisation beyond recents

Status: Deferred

What was deferred:
Collaborative filtering, learned ranking weights, per-user term-frequency boosts, or other personalisation signals beyond Phase 5's recents tracker.

Why:
Personalisation requires a feedback signal large enough to learn from, and infrastructure to safely persist + apply per-user weights. Recents (Phase 5) is the lightweight version that captures the strongest signal (recency) without learning machinery. Going further before that lands and proves out would be speculative.

Trigger to revisit:
When the recents-only ranker proves insufficient for the active user base -- specifically when users routinely fail to find a result they've used before, or when palette friction surfaces in user feedback as a recurring complaint.

Implementation pattern when triggered:
Author a follow-on WP. Start with a stored per-user term-frequency table keyed by `(user_id, result_id)` and a small additive boost in the ranker. Avoid ML / collaborative filtering until the simple signal is exhausted.

References:

- [spec.md "Non-goals"](./spec.md)

## Localisation

Status: Rejected

What was rejected:
Translation of palette UI strings, multi-language synonym sets, or non-English query parsing.

Why:
The platform is English-only by product scope. The FAA corpus the palette indexes is English-only. Building localisation before the platform-wide localisation question is settled would invent constraints that don't match the product direction.

References:

- [spec.md "Non-goals"](./spec.md)

## Indexing user reflection journals (`mine.note`)

Status: Deferred

What was deferred:
A real loader for `mine.note` palette results that reads from user reflection journals.

Why:
`mine.note` is scaffolded in the result-type union but its loader is a stub. Reflection journals are not yet a shipped surface. Indexing them today would index nothing.

Trigger to revisit:
When user reflection journals ship as a surface AND a corpus exists for the loader to read.

Implementation pattern when triggered:
Mirror the `mine.card` / `mine.rep` / `mine.plan` loader pattern in `libs/help/src/loaders/`. Author a follow-on PR scoped to the loader plus its tests; no other palette changes should be needed because the type is already in the union.

References:

- [spec.md "Non-goals"](./spec.md)
- [design.md "File layout"](./design.md)

## Voice / natural-language queries

Status: Rejected

What was rejected:
Voice input, speech-to-text query entry, or NL query parsing ("show me the weather chapter of PHAK").

Why:
The palette contract is keyboard-driven and structured (filter chips, doc-code autocomplete, mode keybindings). NL queries would require a parser, an intent classifier, and probably an LLM call per keystroke -- a different product surface with different latency and cost characteristics.

References:

- [spec.md "Non-goals"](./spec.md)

## Alfred-style multi-step built-in workflows

Status: Rejected

What was rejected:
Multi-step interactive workflows attached to palette results (e.g. "search -> select -> sub-action -> sub-sub-action -> commit").

Why:
Each palette result has one primary action plus `Cmd+Enter` / `Cmd+\` modifiers. Multi-step workflows would push the palette past its scope as a launcher / locator and into an action-orchestration surface. That's a different product (commands or app-level workflows), not a palette feature.

References:

- [spec.md "Non-goals"](./spec.md)

## Reskin of `apps/hangar`'s `/docs` admin search

Status: Rejected

What was rejected:
Replacing or restyling the existing `/docs` admin search inside `apps/hangar` to match the palette.

Why:
The `/docs` admin search is a different surface for content authors with different ergonomics (typeahead within a single doc tree, no cross-app commands). The command palette is for end users + admins from any app. Reskinning would force one surface to do two jobs.

References:

- [spec.md "Non-goals"](./spec.md)
