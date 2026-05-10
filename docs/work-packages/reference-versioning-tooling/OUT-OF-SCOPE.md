---
title: 'Out of Scope: Reference versioning tooling'
product: platform
feature: reference-versioning-tooling
type: out-of-scope
status: unread
---

# Out of Scope: Reference versioning tooling

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

The source is the "Out" subsection of [spec.md](./spec.md) Scope (lines 89-97) and the "Out of scope (revisit triggers)" subsection of [tasks.md](./tasks.md) (lines 112-118). Phase 5 of the ADR 019 ten-phase rollout is the WP this captures; it shipped via PR #250 (per the WP git log). The deferrals are the boundaries Phase 5 drew between "ship the annual rollover diff job + lesson-pin advancer" and "every adjacent ergonomics, notification, and content-curation surface."

## Summary

| Item                                                    | Status   | Trigger to revisit                                                                              |
| ------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| PR creation tooling for `advance`                       | Deferred | When the per-rollover review choreography stabilizes                                            |
| Live eCFR API calls in tests                            | Rejected | Never -- see detail below                                                                       |
| Notifications on diff job result (Slack, digest emails) | Deferred | When `revisit.md` R3 / R14 fire (multi-operator workflow needs notify)                          |
| Cross-reference staleness propagation                   | Deferred | When `revisit.md` R4 fires (lessons cite related sections beyond the amended one)               |
| Multi-corpus diffing in one run                         | Deferred | When the operator regularly diffs more than one corpus per rollover                             |
| Hangar UI for reviewing the needs-review report         | Deferred | When `apps/hangar/` revives (per revisit.md R5 + hangar revival ADR)                            |
| Postgres-backed historical edition storage              | Deferred | When `sections.json` JSON-file reads become the bottleneck OR ADR 019 §2.5 phase implementation |

## PR creation tooling for `advance`

Status: Deferred

What was deferred:
A `gh pr create` invocation inside `runAdvanceCli` (or a sibling subcommand) that opens the rollover PR after `advance` writes its commit. Phase 5's `advance` writes the rewrite commit on the current branch and stops; the operator opens the PR manually.

Why:
Per [spec.md](./spec.md) Scope -> Out: every annual rollover wants different review choreography. Sometimes the operator bundles multiple corpora into one PR; sometimes they split per-corpus; sometimes they want to interleave with content edits before opening. Automating the PR step would force one choreography on every rollover and remove the operator's natural review pause.

Trigger to revisit:
The per-rollover review choreography stabilizes -- after several annual rollovers (CFR 2027 -> 2028 -> 2029) the operator has converged on one shape (e.g., "always one PR per corpus, always titled `chore(sources): rollover <corpus> <old> -> <new>`, always the diff report attached as a body section"). Concrete signal: the operator has manually created the same-shape PR three years running.

Implementation pattern when triggered:
Add a `--open-pr` flag to `runAdvanceCli`. When set, after the rewrite commit is written, invoke `gh pr create` with a body assembled from the diff report's summary block (counts per `DiffOutcomeKind`, top needs-review entries). Title format derived from `report.corpus` + `report.editionPair`. The flag is opt-in; default behavior remains "operator opens manually."

References:

- [spec.md](./spec.md) Scope -> Out ("PR creation tooling")
- [tasks.md](./tasks.md) Out of scope (revisit triggers) -- "PR-creation tooling for `advance`"

## Live eCFR API calls in tests

Status: Rejected

What was rejected:
Test cases that hit the live eCFR API (or any other live corpus source) during the Phase 5 test run. All Phase 5 tests are fixture-driven; the CLI accepts `--fixture-pair` for the same reason.

Why:
Per [spec.md](./spec.md) Scope -> Out: live ingestion is a Phase 3 concern. Phase 5's correctness is a function of the diff algorithm, the alias-resolver, the body-hasher's normalization, and the rewriter -- none of which depends on live data. Adding live API calls would make tests flaky (network dependency, eCFR rate limits, API surface drift), slow (wall-clock latency per test), and non-deterministic (the API returns whatever the latest publish is, so test assertions would have to be relative).

A re-decision would have to clear: a regression that only reproduces against the live API AND no fixture can synthetically reproduce the failure shape (which would itself indicate a bug in the fixture-construction methodology, since the diff algorithm operates on derivative trees that are deterministic per input XML). No such case has been observed.

References:

- [spec.md](./spec.md) Scope -> Out ("Live eCFR API calls in tests")

## Notifications on diff job result (Slack, digest emails)

Status: Deferred

What was deferred:
Slack-notify-on-diff-job-result (`revisit.md` R3) and digest emails for stale pins (`revisit.md` R14). Phase 5's diff job prints a stdout summary; that's the only notification surface.

Why:
Per [spec.md](./spec.md) Scope -> Out: notifications are a runtime concern that the diff job's stdout already covers for the operator-run-by-hand pattern. Building Slack / email plumbing into the diff job would presume a multi-operator workflow that doesn't exist yet (Joshua is the only operator today).

Trigger to revisit:
Per `revisit.md` R3 / R14: a multi-operator workflow needs notify (e.g., a second person joins as a content reviewer and needs to know when the operator runs the rollover so they can pick up the needs-review queue) OR an automated runner schedules the diff job and needs to surface results without the operator watching stdout.

Implementation pattern when triggered:
Add an optional notification module under `libs/sources/src/diff/notify.ts`. The diff orchestrator, after writing the report, invokes the configured notifier(s) with the summary. Slack via webhook URL from env; email via a configured transport. The diff job's stdout summary is the schema the notifier renders.

References:

- [spec.md](./spec.md) Scope -> Out ("Notifications")
- [tasks.md](./tasks.md) Out of scope (revisit triggers) -- "Notifications on diff job result"
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R3, R14

## Cross-reference staleness propagation

Status: Deferred

What was deferred:
Per `revisit.md` R4: when section X is amended, every lesson that cites a related section gets a notice (not just lessons that cite X directly). Phase 5 only handles per-section pin advancement -- a lesson that cites §61.103 (which is unchanged) but discusses concepts also covered in §61.105 (which IS amended) gets no signal from Phase 5.

Why:
Per [spec.md](./spec.md) Scope -> Out: cross-reference staleness requires a "related section" graph that doesn't exist yet. The substrate ships per-section semantics; the graph layer is its own design (which sections are "related," at what granularity, with what signal-to-noise ratio).

Trigger to revisit:
Per `revisit.md` R4: lessons cite related sections beyond the amended one AND the lesson-author's review backlog grows large enough that "lessons that cite related amended sections" is a useful filter. Concrete signal: a missed-amendment incident where a lesson's claim was invalidated by a sibling-section amendment that Phase 5 didn't surface because the lesson didn't cite the amended section directly.

Implementation pattern when triggered:
Build a per-section "related to" graph (manually curated or extracted from CFR cross-references like `(see §61.105)`). The diff job, after partitioning into auto-advance / needs-review, walks the graph from each needs-review section to find lessons citing related sections. Surface those as a separate "related-amended" needs-review pile.

References:

- [spec.md](./spec.md) Scope -> Out ("Cross-reference staleness propagation")
- [tasks.md](./tasks.md) Out of scope (revisit triggers) -- "Cross-reference staleness"
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R4

## Multi-corpus diffing in one run

Status: Deferred

What was deferred:
A diff CLI invocation that walks more than one corpus per run. Phase 5's CLI takes a single `--corpus=` filter (default `regs`); multi-corpus diffing requires separate runs.

Why:
Per [spec.md](./spec.md) Scope -> Out: this is an ergonomics concern, not a Phase 5 requirement. Each corpus has its own annual cadence (eCFR yearly, FAA handbooks irregular, AIM ~6-month, AC ad-hoc). Bundling multi-corpus runs into one CLI assumes a synchronized rollover that doesn't match how the source publishers operate.

Trigger to revisit:
The operator regularly diffs more than one corpus per rollover -- e.g., after the year-end CFR rollover, also diffing handbooks at the same sitting. Concrete signal: the operator has run `diff --corpus=regs` immediately followed by `diff --corpus=handbooks` (or several others) more than three times in a row.

Implementation pattern when triggered:
Add a `--corpus=*` (or `--corpora=regs,handbooks,aim`) form to the diff CLI. The orchestrator runs each corpus serially, writing a separate report per corpus to the standard `data/sources-diff/` path. The stdout summary aggregates counts across corpora.

References:

- [spec.md](./spec.md) Scope -> Out ("Multi-corpus diffing in one run")
- [tasks.md](./tasks.md) Out of scope (revisit triggers) -- "Multi-corpus diff in one run"

## Hangar UI for reviewing the needs-review report

Status: Deferred

What was deferred:
A hangar-side surface that lets a reviewer browse the diff job's needs-review queue, click into individual sections, see the unified diff, and mark each as "advance anyway" / "needs lesson edit" / "no-op." Phase 5's needs-review queue is the JSON report; the operator reads it in stdout or a text editor.

Why:
Per [spec.md](./spec.md) Scope -> Out and revisit.md R5: the `apps/hangar/` surface is dormant pending a hangar revival ADR. Building a review UI inside a dormant app is premature; the JSON report is structured to make a UI trivial later (`DiffReport.outcomes[]` per-entry kind, hash, snippet).

Trigger to revisit:
The `apps/hangar/` revival ADR lands AND the hangar product surface is in flight AND the needs-review queue is regularly large enough that text-editor review is impractical (concrete: more than 50 needs-review entries per rollover).

Implementation pattern when triggered:
Add a hangar surface under `/sources/diff/<report-id>` (or whichever route the hangar revival ADR establishes). Reads consume the JSON `DiffReport`. Per-entry actions write a per-reviewer disposition that the operator merges before running `advance`.

References:

- [spec.md](./spec.md) Scope -> Out ("Hangar UI for reviewing the needs-review report")
- [tasks.md](./tasks.md) Out of scope (revisit triggers) -- "Hangar UI for review"
- [docs/decisions/019-reference-identifier-system/revisit.md](../../decisions/019-reference-identifier-system/revisit.md) R5
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Hangar-driven editing UI" (the corpus-side analogue)
- [reference-renderer-runtime/OUT-OF-SCOPE.md](../reference-renderer-runtime/OUT-OF-SCOPE.md) "Hangar UI for editing references / acks" (the renderer-side analogue)

## Postgres-backed historical edition storage

Status: Deferred

What was deferred:
A Postgres-backed store for historical edition derivatives. Phase 5 reads derivatives from disk (the same `data/<corpus>/<edition>/` paths Phase 3 writes to); ADR 019 §2.5 names Postgres for the indexed tier.

Why:
Per [spec.md](./spec.md) Scope -> Out: disk-backed derivatives are sufficient for the diff job's read pattern (one-shot per-rollover walk). Postgres adds operational complexity (schema, migrations, indexing strategy) that isn't justified until the JSON / file-tree approach hits a measurable bottleneck.

Trigger to revisit:
Either (a) disk-backed reads become measurably slow for the diff job (e.g., a corpus with thousands of sections per edition, multiplied by N editions, makes the per-pair walk take minutes not seconds), or (b) ADR 019 §2.5 phase implementation lands the Postgres tier as part of broader corpus query infrastructure. Same trigger as the corpus-side WPs (CFR ingestion, handbook ingestion, renderer) noted -- this is the cross-cutting move.

Implementation pattern when triggered:
Add a Postgres-backed reader to the body-hasher (`hashEditionBody`) behind a config switch. The diff orchestrator's contract is unchanged; only the read path swaps. Migration: import per-edition derivative files into typed Postgres tables.

References:

- [spec.md](./spec.md) Scope -> Out ("Postgres-backed historical edition storage")
- [docs/decisions/019-reference-identifier-system/decision.md](../../decisions/019-reference-identifier-system/decision.md) §2.5
- [reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md](../reference-cfr-ingestion-bulk/OUT-OF-SCOPE.md) "Postgres-backed indexed tier" (corpus-side analogue)
- [reference-renderer-runtime/OUT-OF-SCOPE.md](../reference-renderer-runtime/OUT-OF-SCOPE.md) "Postgres-backed indexed tier" (renderer-side analogue)
