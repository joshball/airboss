---
title: 'Out of Scope: Hangar Review Queue e2e Cluster Fix'
product: hangar
feature: hangar-review-queue-cluster-fix
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Review Queue e2e Cluster Fix

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                              | Status       | Trigger to revisit                                                                               |
| ----------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| Background-job `claimNext` warning hardening (`bauth_rate_limit`) | Follow-on WP | When the warning persists or escalates after the cluster fix lands                               |
| Form-action validation pattern migration across hangar            | Deferred     | When admin / tasks `fail()` failures remain after the Buffer leak fix lands and re-run           |
| Re-shape of the docs FTS index                                    | Follow-on WP | When the Phase 2 query-side fix proves insufficient and the crash is determined to be structural |

## Background-job `claimNext` warning hardening (`bauth_rate_limit`)

Status: Follow-on WP

What was deferred:
Hardening of the `hangar.job` `claimNext` query failure that was incidentally surfaced in the same e2e log during a `bauth_rate_limit` insert.

Why:
This is a different system (the background-job worker, not the review-queue routes) and a different symptom. Mixing it into this WP would dilute the cluster's focus on the 24-spec failure set. The cluster-fix WP is scoped to closing the 24 failing specs; the job warning lives outside that surface.

Trigger to revisit:
When the warning persists or escalates after the cluster fix lands -- specifically when the warning appears in CI-equivalent runs without the cluster's other symptoms, or when it begins surfacing as a user-visible job-queue failure.

Implementation pattern when triggered:
Author a follow-on WP under `docs/work-packages/hangar-job-claimnext-warning/` (or similar) scoped to the job queue. Inspect `libs/hangar-jobs/`, the `claimNext` query path, and the `bauth_rate_limit` insert flow. Treat as a separate cluster with its own root-cause analysis.

References:

- [spec.md "Non-goals"](./spec.md)

## Form-action validation pattern migration across hangar

Status: Deferred

What was deferred:
A broader migration of the form-action validation pattern across the hangar app (the systematic use of `fail()` with structured errors, consistent redirect targets, etc.).

Why:
The Phase 1 Buffer leak fix is expected to dissolve part of the form-action cascade (the `waitForURL` cluster). Migrating the entire pattern before re-running would be premature engineering -- some of the failures resolve as a side effect of fixing hydration. The cluster-fix WP isolates remaining failures only after re-run.

Trigger to revisit:
When admin / tasks `fail()` failures remain after the Buffer leak fix lands AND the residual failures share a common pattern that a systematic migration would close.

Implementation pattern when triggered:
Author a follow-on WP scoped to the hangar form-action pattern. Audit every action handler in `apps/hangar/src/routes/(app)/**/+page.server.ts` for `fail()` / redirect consistency. Mirror SvelteKit's form-action conventions and the airboss `requireRole` pattern used in `/review`.

References:

- [spec.md "Non-goals"](./spec.md)
- [spec.md "Cluster 5: Form-action waitForURL cascade"](./spec.md)

## Re-shape of the docs FTS index

Status: Follow-on WP

What was deferred:
A redesign of the `hangar.docs_search_index` table (column shape, generated-tsv strategy, alternative FTS approach).

Why:
Phase 2 of this WP investigates the `searchDocs` query crash and lands a query-side or schema-alignment fix. Index design questions are a separate scope -- if Phase 2 reveals the crash is structural (not just schema-out-of-sync or seed-loader-incomplete), the redesign lands in its own WP rather than mid-flight inside the cluster fix.

Trigger to revisit:
When the Phase 2 query-side / loader-side fix proves insufficient AND the crash is determined to be structural (e.g. tsv generation pattern wrong, ts_headline parameter order incompatible, FTS index unsuited for the docs corpus shape).

Implementation pattern when triggered:
Author a follow-on WP under `docs/work-packages/hangar-docs-fts-redesign/` (or similar). Evaluate alternatives: generated tsvector column with btree_gin, separate search-vector table, or external FTS (Meilisearch / Typesense) per the broader platform's direction.

References:

- [spec.md "Non-goals"](./spec.md)
- [spec.md "Cluster 2: searchDocs Postgres query crash"](./spec.md)
