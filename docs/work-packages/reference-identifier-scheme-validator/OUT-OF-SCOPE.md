---
title: 'Out of Scope: Reference identifier scheme validator'
product: platform
feature: reference-identifier-scheme-validator
type: out-of-scope
status: unread
---

# Out of Scope: Reference identifier scheme validator

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

This package is Phase 1 of the 10-phase plan in
[ADR 019](../../decisions/019-reference-identifier-system/decision.md) §8.
Most "out of scope" items here are explicitly owned by a later phase;
the trigger is "that phase begins" rather than an open-ended signal.

## Summary

| Item                                                        | Status       | Trigger to revisit                                                           |
| ----------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| Registry constants table + per-corpus resolvers + query API | Follow-on WP | Phase 2 (`reference-source-registry-core`) begins                            |
| Auto-stamp `--fix` mode for unpinned identifiers            | Follow-on WP | Phase 2 begins (depends on `getCurrentAcceptedEdition`)                      |
| Per-corpus locator-shape validation                         | Follow-on WP | A corpus's ingestion WP begins (Phase 3 CFR, Phase 6 handbooks, Phase 7 AIM) |
| Renderer + token substitution pipeline                      | Follow-on WP | Phase 4 (renderer) begins                                                    |
| Annual diff-job + lesson rewrite generator                  | Follow-on WP | Phase 5 begins                                                               |
| `unknown:` migration tool that rewrites placeholders        | Follow-on WP | Phase 9 begins (corpus ingestion)                                            |
| Citation rendering UI primitives                            | Follow-on WP | Phase 4 begins                                                               |
| IDE language server / NOTICE-tier IDE surfaces              | Deferred     | When a language server lands in the platform                                 |
| Multi-line / adjacent-identifier merging (`§91.167-91.171`) | Follow-on WP | Phase 4 begins                                                               |
| `?at=unpinned` ERROR-promotion CI gate                      | Deferred     | After observing `?at=unpinned` usage in practice                             |
| Orphan-ack ERROR-promotion (after 30-day grace)             | Deferred     | After the 30-day grace policy is exercised in practice                       |
| Non-Markdown content scanning (Svelte component imports)    | Deferred     | When Svelte components start importing `@ab/sources` identifiers             |
| Validator path expansion beyond `course/regulations/**`     | Deferred     | When a new content path comes online and needs validation                    |
| Inline annotations on PR file diff                          | Rejected     | Never -- depends on a GitHub-app integration not on the roadmap              |

## Registry constants table + per-corpus resolvers + query API

Status: Follow-on WP

What was deferred:
The actual `SOURCES` constants table, per-corpus resolver functions,
and the query API that backs `RegistryReader.*` in production.

Why:
Phase 1 owns the parser, the lesson walker, the rule engine, and the
`RegistryReader` interface; it stubs the implementation with
`NULL_REGISTRY`. Splitting "interface and validator" from "real data"
is what lets the validator merge as the publish gate before any
corpus is populated. Phase 2 fills the stub.

Trigger to revisit:
When Phase 2 (`reference-source-registry-core`) is scheduled.

Implementation pattern when triggered:
Implement `RegistryReader` against the constants table in
`@ab/sources/registry.ts`; export a `productionRegistry`. The single
caller change is `scripts/check.ts` swapping `NULL_REGISTRY` for
`productionRegistry`. Phase 1's tests stay valid; new tests cover
production-registry-backed paths.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> registry table row
- [user-stories.md](./user-stories.md) US-8
- ADR 019 §8 phase plan

## Auto-stamp `--fix` mode for unpinned identifiers

Status: Follow-on WP

What was deferred:
A `--fix` flag on the validator that rewrites lesson source files to
add `?at=<currentAccepted>` to unpinned identifiers.

Why:
Auto-fix requires the registry to know the current accepted edition
per corpus (`getCurrentAcceptedEdition`), which only exists once
Phase 2 ships. Phase 1 ships the ERROR for unpinned identifiers; the
fix is the only thing deferred.

Trigger to revisit:
When Phase 2 (`reference-source-registry-core`) begins.

Implementation pattern when triggered:
Add a `fixUnpinned: boolean` option to the validator's `validate`
entry point. During parse, capture source spans for each identifier;
when the option is set and an identifier matches the unpinned rule,
build a replacement string with the current accepted edition and
write back to the file. See
[design.md](./design.md) "Future expansion points -> `--fix` mode"
for the captured pattern.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> auto-stamping row
- [design.md](./design.md) "Future expansion points (captured, not deferred)"
- [user-stories.md](./user-stories.md) US-7, US-8

## Per-corpus locator-shape validation

Status: Follow-on WP

What was deferred:
The per-corpus `parseLocator` resolvers that turn an opaque locator
string (`cfr-14/91/103`, `aim/4/5/3`, etc.) into a typed shape.

Why:
Each corpus's locator grammar is the corpus's concern. Phase 1
treats locators as opaque (multi-segment, non-empty); per-corpus
resolvers ship in the ingestion phase that introduces the corpus.

Trigger to revisit:
When that corpus's ingestion WP begins (Phase 3 for CFR, Phase 6 for
handbooks, Phase 7 for AIM, etc.).

Implementation pattern when triggered:
Each corpus's WP registers a `parseLocator` function. The validator's
row 1 calls into the corresponding resolver when present; falls back
to the existing "non-empty" check when absent. The validator code is
in place; resolvers add per phase.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> per-corpus locator row
- [design.md](./design.md) "Future expansion points -> Per-corpus locator validation"

## Renderer + token substitution pipeline

Status: Follow-on WP

What was deferred:
The rendering pass that turns parsed identifiers into hyperlinks,
substitutes `@cite` / `@list` / `@short` / etc. tokens, attaches
"(acknowledged supersession)" annotations, renders `[Reserved]` /
`[redacted]` literals, and merges adjacent identifiers.

Why:
The validator gates publish; the renderer produces the rendered
lesson. They're separable, and Phase 1 deliberately ships the gate
first so the substrate is clean before the renderer assumes it.
Phase 1 recognises tokens only enough to detect "lazy text" (row 9
NOTICE); substitution itself is Phase 4.

Trigger to revisit:
When Phase 4 (renderer) is scheduled.

Implementation pattern when triggered:
Author the renderer WP using ADR 019 §3.1 (token recognition +
substitution) as the contract. The validator's `ParsedIdentifier`
shape and the lesson-parser's identifier-occurrence output are the
inputs the renderer consumes; nothing in this WP changes.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> renderer row
- [design.md](./design.md) "Non-decisions (deferred to later phases per ADR 019 §8)"
- [user-stories.md](./user-stories.md) US-4, US-5 "Out of scope" notes

## Annual diff-job + lesson rewrite generator

Status: Follow-on WP

What was deferred:
The yearly job that diffs the registry against the prior edition and
generates lesson rewrite suggestions when content has changed.

Why:
Owned by Phase 5 per ADR 019 §8.

Trigger to revisit:
When Phase 5 begins.

Implementation pattern when triggered:
Author the Phase 5 WP using ADR 019 §5 as the contract.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> annual diff-job row

## `unknown:` migration tool that rewrites placeholders

Status: Follow-on WP

What was deferred:
A tool that rewrites `airboss-ref:unknown/<slug>` placeholders to real
identifiers once the relevant corpus is ingested.

Why:
Owned by Phase 9 (corpus migration) per ADR 019 §8. Phase 1 ships
the ERROR (row 0) that catches `unknown:` at publish time; the
migration itself ships when there are corpora to migrate to.

Trigger to revisit:
When Phase 9 begins.

Implementation pattern when triggered:
Mirror the lesson-parser's body walk; for each `unknown:` identifier,
look up the registered mapping for that slug, generate the
replacement `airboss-ref:<corpus>/<locator>?at=<edition>` string, and
write back to the file. ADR 019 §9 captures the migration contract.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> unknown migration tool row
- [user-stories.md](./user-stories.md) US-2 "Out of scope" note

## Citation rendering UI primitives

Status: Follow-on WP

What was deferred:
The `<Citation>` / hover-popover / glossary-page UI primitives that
the renderer produces.

Why:
Phase 4 territory; the validator is build-time only and has no UI
surface.

Trigger to revisit:
When Phase 4 begins.

Implementation pattern when triggered:
Author against the renderer WP's design.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> renderer + citation rendering rows

## IDE language server / NOTICE-tier IDE surfaces

Status: Deferred

What was deferred:
A language server that surfaces NOTICE-tier findings inline in the
editor (instead of CLI / stdout).

Why:
ADR 019 §1.5 specifies NOTICE is "IDE language server only", but
no language server is currently part of the platform. Until one is,
Phase 1 prints NOTICE findings to stdout so they're visible in CI.

Trigger to revisit:
When/if a language server lands in the platform. The signal that
opens the conversation is "an LSP project ships for airboss" (or
any signal that an LSP is being authored, regardless of scope).

Implementation pattern when triggered:
Move NOTICE rendering from `console.log` (stdout) to a structured
finding stream the LSP can consume; keep ERROR and WARNING on the
build-time path. The validator's finding shape (`ValidationFinding`
in `libs/sources/src/types.ts`) is already structured.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> IDE language server row
- [design.md](./design.md) "Future expansion points -> NOTICE-to-IDE"
- [user-stories.md](./user-stories.md) US-9 "Out of scope" note
- ADR 019 §1.5 (severity tiers)

## Multi-line / adjacent-identifier merging (`§91.167-91.171`)

Status: Follow-on WP

What was deferred:
Render-time normalisation of adjacent or run-of-section identifiers
into a single human-readable token.

Why:
Phase 4 (renderer) concern. The validator only ever sees individual
identifiers, parsed and validated independently; merging is a render
pass.

Trigger to revisit:
When Phase 4 begins.

Implementation pattern when triggered:
Author against the renderer WP. The validator-shaped output is
unaffected.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> multi-line merge row
- [design.md](./design.md) "Non-decisions (deferred to later phases per ADR 019 §8)" -> adjacent merging

## `?at=unpinned` ERROR-promotion CI gate

Status: Deferred

What was deferred:
Promoting row 5 (`?at=unpinned`) from WARNING to ERROR via a CI flag.

Why:
The behaviour today is WARNING-only. Promoting to ERROR before we
observe whether `?at=unpinned` is actually used in practice (and how
authors react to the warning) would be premature; a flag flip is
trivial once we have signal.

Trigger to revisit:
After observing `?at=unpinned` usage in practice (e.g. the warning
shows up regularly on PRs and authors leave it standing, or
conversely authors fix it pre-merge -- either signal informs the
flip).

Implementation pattern when triggered:
Flip the rule's severity from `warning` to `error` in
`libs/sources/src/validator.ts`. The CI flag is a no-op since
`bun run check` runs at one severity per rule. Update tests.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> `?at=unpinned` row

## Orphan-ack ERROR-promotion (after 30-day grace)

Status: Deferred

What was deferred:
Promoting orphan-ack findings (acks whose `target` isn't referenced
in the body) from WARNING to ERROR after a 30-day grace period.

Why:
Same shape as `?at=unpinned`: warning today, promotion is a flag flip
once we see how orphans actually accrete on PRs.

Trigger to revisit:
After the 30-day grace policy is exercised in practice and we have
data on orphan-ack rate.

Implementation pattern when triggered:
Same as `?at=unpinned`: flip the severity in the validator + update
tests.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> orphan ack row
- ADR 019 §3.4 (acknowledgments)

## Non-Markdown content scanning (Svelte component imports of `@ab/sources` constants)

Status: Deferred

What was deferred:
Walking `.svelte` files for imports of `@ab/sources` identifier
constants and validating them through the same rule engine.

Why:
Phase 1 covers Markdown lessons only. Today no Svelte component
imports identifier constants because Phase 4 (renderer) hasn't
shipped. When that happens, the lesson-parser path expansion is a
one-paragraph follow-on, not a redesign.

Trigger to revisit:
When Svelte components start importing `@ab/sources` identifier
constants (post-Phase 4).

Implementation pattern when triggered:
Extend the `bun run check` walker in
`libs/sources/src/check.ts` to also walk `.svelte` files for
identifier imports; reuse the existing validator. Per ADR 019 §3.3
the imported constants are typed `SourceId` values, so the parser is
the same.

References:

- [spec.md](./spec.md) "Out of Scope (resolved, not deferred)" -> non-Markdown content row
- ADR 019 §3.3

## Validator path expansion beyond `course/regulations/**`

Status: Deferred

What was deferred:
Validating Markdown content under paths other than
`course/regulations/**` (e.g. `apps/study/src/lib/lessons/`,
`course/aim/`, etc.).

Why:
Phase 1 only has signed-off content under `course/regulations/`.
Adding paths now means choosing a list that's likely to drift before
those paths actually carry `airboss-ref:` URLs. The path list is a
constant in `@ab/sources` so expansion is one line per path.

Trigger to revisit:
When a new content path comes online that uses `airboss-ref:`
identifiers (e.g. AIM lessons land, study lessons start citing
canonical sources, etc.).

Implementation pattern when triggered:
Add the new path to `LESSON_CONTENT_PATHS` in
`libs/sources/src/check.ts`. One-line change.

References:

- [spec.md](./spec.md) "Open Items" -> path-list expansion bullet
- [design.md](./design.md) "Future expansion points -> Path list expansion"

## Inline annotations on PR file diff

Status: Rejected

What was rejected:
Surfacing validator findings inline on GitHub PR file diffs via a
GitHub-app integration.

Why:
Depends on a GitHub-app integration that isn't on the roadmap. The
CI step's plain stdout output is sufficient for reviewers today; the
extra surface isn't worth the integration cost.

References:

- [user-stories.md](./user-stories.md) US-6 "Out of scope" note
