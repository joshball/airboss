---
title: 'Out of Scope: Hangar sources v1'
product: hangar
feature: hangar-sources-v1
type: out-of-scope
status: unread
---

# Out of Scope: Hangar sources v1

Deferred items, why they're deferred, and the trigger that should make us
revisit each. Future agents and humans: do not build these without the
documented trigger. If you think the trigger is hit, surface it for a
decision rather than building silently.

## Summary

| Item                          | Status       | Trigger to revisit                                                       |
| ----------------------------- | ------------ | ------------------------------------------------------------------------ |
| Chart / plate / diagram types | Follow-on WP | Shipped in `wp-hangar-non-textual` (#113)                                |
| Cron-based automatic refresh  | Deferred     | When yearly-refresh cycles or staleness incidents demand it post-MVP     |
| Cross-source bulk diff review | Rejected     | Never -- see detail below                                                |
| Analytics / dashboards        | Follow-on WP | When operator monitoring needs surface (see `hangar-platform-dashboard`) |

## Chart / plate / diagram types

Status: Follow-on WP

What was deferred / rejected / postponed:

Non-textual source types (sectional charts, IFR plates, airport diagrams, other
binary-visual sources). hangar-sources-v1 covers textual sources only: CFR XML,
handbooks, AIM, ACS, AC, NTSB-ALJ, SAFO, InFO -- everything that flows through
fetch -> extract -> verbatim diff -> validate. Visual sources need a different
pipeline (tile generation, georeferencing, viewer component) that does not
share the verbatim-diff mental model.

Why:

The reference-system flow diagram (the primary surface for this WP) is built
around the verbatim-extraction lifecycle. A sectional chart has no verbatim to
extract -- its content is the image plus geographic metadata. Bolting that into
the same UI would have either (a) muddied the textual flow with non-applicable
controls or (b) required a parallel "non-textual" branch in the same diagram
before the team had built one non-textual source end-to-end. The clean split
was to ship the textual surface first and author a dedicated WP for the
non-textual family once the shape was known.

Trigger to revisit (if Deferred):

Already triggered and shipped. `wp-hangar-non-textual` (PR #113) landed the
binary-visual source family with the Denver VFR sectional as its first
instance.

Implementation pattern when triggered (if Deferred):

See [docs/work-packages/hangar-non-textual/spec.md](../hangar-non-textual/spec.md)
for the shipped pattern.

References:

- [Reference system flow](../../ingestion-pipeline/reference-system-flow.md)
- PR #113 `feat(hangar): wp-hangar-non-textual -- binary-visual source family + Denver VFR sectional`
- [hangar-non-textual WP](../hangar-non-textual/spec.md)

## Cron-based automatic refresh

Status: Deferred

What was deferred / rejected / postponed:

A scheduled job that periodically re-fetches every source whose URL is reachable,
compares checksums against the registry, and enqueues an `extract` job when the
remote bytes change. No human-in-the-loop trigger -- the cron fires, the system
notices the delta, the diff and revalidation chain proceeds automatically up
to (but not past) the "Commit this diff" review step.

Why:

For MVP, the hangar operator runs the yearly refresh cycle by hand. Every
source action -- fetch, extract, diff, commit -- has a UI affordance behind it
(spec.md "Forms use the reference-system scripts" section), and the operator
is expected to walk that path. Automating the fetch step before the team has
seen multiple yearly cycles risks (a) silently re-pulling a freshly-uploaded
manual override, (b) burying a refresh failure in a job log nobody reads, or
(c) generating noisy "no change" jobs that drown the queue. The cron makes
sense only once the manual cycle has been exercised enough that the failure
modes are known.

Trigger to revisit (if Deferred):

When the hangar operator has run at least one full yearly-refresh cycle
manually (CFR Title 14 reg-year rollover is the canonical case) AND the
operator surfaces "I want this to just happen on a schedule" as a felt pain.
Concretely: when staleness incidents (e.g., a regulation update missed for
more than a week) appear in the bug tracker or in a session-todo more than
once.

Implementation pattern when triggered (if Deferred):

Mirror the existing `citation-audit` scheduled job at
`scripts/scheduled-jobs/citation-audit/`. The scheduler infra
(`scripts/scheduler/`) already supports cron-scheduled bun scripts. The job
body wraps the same `bun run references` CLI that the hangar UI already
enqueues via job handlers, so the handler logic does not need to be
duplicated -- the cron simply enqueues the same `fetch` job kind already
registered in this WP's Phase 2.

References:

- [hangar-sources-v1/spec.md "Out of scope"](./spec.md) (original "post-MVP" note)
- [scripts/scheduler/README.md](../../../scripts/scheduler/README.md)
- `scripts/scheduled-jobs/citation-audit/` -- canonical scheduled-job pattern
- Phase 2 job handlers in [tasks.md](./tasks.md) -- the `fetch` handler the cron would call

## Cross-source bulk diff review

Status: Rejected

What was deferred / rejected / postponed:

A UI that takes a set of sources (e.g., "every source whose checksum changed
in the last 24 hours") and renders a single combined diff review screen where
the operator approves or discards changes across all of them in one pass.
Instead, hangar-sources-v1 ships per-source `/sources/[id]/diff` only -- one
source at a time.

Why:

Per the spec ("Cross-source bulk diff review (one source at a time is fine)"),
the deliberate decision is that reviewing verbatim diffs is a careful, focused
task. The diff is the moment the operator decides whether the regulation
actually changed, whether the extraction picked up the change correctly, and
whether the downstream verbatim should be regenerated. Batching that decision
across sources lowers the attention budget per source and makes it easier to
rubber-stamp a bad extraction. The single-source-at-a-time flow is the
intended design, not a scope cut.

Trigger to revisit (if Deferred):

Never -- see detail above. A re-decision would need evidence that single-source
review is itself causing harm (operator skipping diffs to get through a batch,
diffs piling up unreviewed), and would need to address why bulk review
wouldn't make the rubber-stamp problem worse.

References:

- [hangar-sources-v1/spec.md "Out of scope"](./spec.md)
- [Spec: "Why diff review commits the updated `*-generated.ts`"](./spec.md) -- the careful-review rationale

## Analytics / dashboards

Status: Follow-on WP

What was deferred / rejected / postponed:

An analytics or dashboard surface inside `/sources` -- e.g., charts of fetch
frequency over time, verbatim-materialisation coverage trends, validator
error rate by source, operator action histograms. The status panel below the
flow diagram (registered sources, downloaded, verbatim count, TBD count,
validation, freshness) is the only metric surface that ships in this WP.

Why:

The flow diagram + status tiles answer the operator's "what is the state of
the pipeline right now?" question. They do not answer "how is the pipeline
trending?" or "where are we losing time?" -- those are monitoring questions,
not operating questions. For the MVP, monitoring is out of scope because
there is no baseline to monitor against yet. Adding charts before the first
yearly cycle has run would mean designing the dashboard against a hypothesis
of what's interesting rather than against what operators actually need.

Trigger to revisit (if Deferred):

When the operator (or a second operator) starts asking trend or capacity
questions that the current status tiles cannot answer. Concretely: the
`hangar-platform-dashboard` WP at
[docs/work-packages/hangar-platform-dashboard/](../hangar-platform-dashboard/)
already exists as the destination for cross-cutting hangar monitoring; when
that WP's gating signal fires (per its own spec), source-level analytics
folds into it rather than into hangar-sources-v1.

Implementation pattern when triggered (if Deferred):

See [docs/work-packages/hangar-platform-dashboard/spec.md](../hangar-platform-dashboard/spec.md)
for the dashboard surface contract. Source-level metrics should be authored
as tiles in that WP, not as a separate analytics page under `/sources`.

References:

- [hangar-sources-v1/spec.md "Out of scope"](./spec.md)
- [hangar-platform-dashboard WP](../hangar-platform-dashboard/)
- [Spec: status panel below diagram](./spec.md) -- the metric surface that did ship
