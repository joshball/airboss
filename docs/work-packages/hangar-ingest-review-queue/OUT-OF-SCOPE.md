---
title: 'Out of Scope: Hangar Ingest-Review Queue'
product: hangar
feature: hangar-ingest-review-queue
type: out-of-scope
status: unread
---

# Out of Scope: Hangar Ingest-Review Queue

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                              | Status   | Trigger to revisit                                                                            |
| ----------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| Embedded PDF viewer (pdf.js, page screenshots, OCR overlays)      | Deferred | When the external `file://` link path proves insufficient for triaging multiple corpora       |
| Auto-suggested resolutions beyond the geometric tier window       | Deferred | When the candidate set on page +- 2 routinely fails to contain the correct image / caption    |
| Bulk operations (multi-select, batch resolve)                     | Deferred | When a future plugin (e.g. knowledge-graph drift) produces > 1k unresolved issues in one pass |
| Cross-corpus or full-text search across issues                    | Deferred | When more than one corpus is producing issues and corpus / kind / status filters fall short   |
| Replacing or modifying the ingest pipelines themselves            | Rejected | Never -- see detail below                                                                     |
| Authoring brand-new figures from scratch                          | Rejected | Never -- see detail below                                                                     |
| Drift-detection check-pipeline step (fail build on DB/YAML drift) | Deferred | When DB / YAML drift is observed in practice during normal authoring sessions                 |
| Audit-log volume mitigations for high-volume plugins              | Deferred | When a future plugin pushes drift volume past 1k overrides                                    |

## Embedded PDF viewer (pdf.js, page screenshots, OCR overlays)

Status: Deferred

What was deferred:
An in-app PDF viewer mounted on the issue detail page (pdf.js, pre-rendered page screenshots, or an OCR-overlay surface) for inspecting the source page without leaving the hangar.

Why:
The "View page N in PDF" button is a `file://` link to the developer-local cache. For v1 with 21 live issues this is sufficient and avoids a heavy dependency (pdf.js bundle, server-side rasterisation, or an OCR pipeline). The hangar UI's audience is the maintainer running the developer-local cache, so the external link is acceptable.

Trigger to revisit:
When the external link path proves insufficient -- specifically when corpora arrive whose source PDFs are not in the developer-local cache (e.g. remote-only docs) or when the back-and-forth between viewer and queue measurably slows triage of multiple corpora.

Implementation pattern when triggered:
Author a follow-on WP scoped per-viewer-approach (pdf.js vs page screenshots vs OCR overlay). Prefer the lightest option (page screenshots from existing extracted figures) before reaching for pdf.js. Gate behind a route-level prop so single-corpus queues that don't need it skip the bundle.

References:

- [spec.md "Non-goals"](./spec.md)

## Auto-suggested resolutions beyond the geometric tier window

Status: Deferred

What was deferred:
Smarter candidate ranking that looks beyond `page_num +- 2`, uses semantic similarity between caption text and figure content, or auto-applies high-confidence pairings without user click.

Why:
The plugin contract requires the user to pick. v1 trusts that the right candidate is within the geometric window and the human is the arbiter. Premature ML / heuristic ranking inverts the contract and obscures provenance of overrides.

Trigger to revisit:
When the candidate set on page +- 2 routinely fails to contain the correct image / caption AND the residual long-tail volume justifies a smarter ranker.

Implementation pattern when triggered:
Author a follow-on WP scoped to one plugin first. Extend `findCandidates` to return a ranked list with confidence scores; UI still requires the user to click. Auto-apply remains out of scope until a separate user-decision affirms it.

References:

- [spec.md "Non-goals"](./spec.md)

## Bulk operations (multi-select, batch resolve)

Status: Deferred

What was deferred:
UI affordances for selecting multiple issues at once and applying the same action across them.

Why:
v1 covers 21 live issues -- single-issue actions are not a friction point. Bulk operations add real complexity to the action handler contract (transactionality, partial failure semantics, undo). Adding them before they are needed would risk locking in a contract that doesn't fit the actual high-volume use case.

Trigger to revisit:
When a future plugin (knowledge-graph drift detection is the canonical example) produces > 1k unresolved issues in a single ingest pass, OR when an existing plugin sustains > 100 unresolved issues across sessions.

Implementation pattern when triggered:
Author a follow-on WP. Design the bulk action protocol at the plugin level (`applyBulkAction(issues[], action, ctx)`) rather than as a UI-only feature so failure semantics are explicit and per-plugin.

References:

- [spec.md "Non-goals"](./spec.md)

## Cross-corpus or full-text search across issues

Status: Deferred

What was deferred:
Free-text search and richer filters across the entire queue (e.g. "find every issue mentioning ILS", "issues touching CFR Part 91 in any corpus").

Why:
v1 queue is filterable by corpus / source / kind / status. With one corpus producing issues that is sufficient. Building a search index for cross-corpus full-text now would mean indexing a single corpus.

Trigger to revisit:
When more than one corpus is producing issues AND corpus / kind / status filters no longer make it easy to find the issue the user wants to act on.

Implementation pattern when triggered:
Author a follow-on WP. Prefer reusing whatever search index the broader platform adopts (Postgres full-text, Meilisearch, or similar) rather than authoring a queue-only index.

References:

- [spec.md "Non-goals"](./spec.md)

## Replacing or modifying the ingest pipelines themselves

Status: Rejected

What was rejected:
Embedding the figure-pairing pipeline (or any other ingest pipeline) inside the queue surface so the user can re-run extractors inline.

Why:
The queue reads issues that pipelines emit. It never re-runs `figures.py` or any extractor. Coupling pipeline execution to the queue would conflate the editing surface with the extraction surface, complicate failure modes, and force the queue to host extractor dependencies (PyMuPDF, etc.) it has no business carrying.

References:

- [spec.md "Non-goals"](./spec.md)

## Authoring brand-new figures from scratch

Status: Rejected

What was rejected:
A workflow inside the queue for creating entirely new figure entries that the pipeline did not see (uploading a new image, authoring a new caption header, etc.).

Why:
v1 only re-pairs / classifies what the pipeline already saw. Authoring new content from scratch is a different surface with different constraints (provenance, source-of-truth, version pinning). Adding it would push the queue past its scope as a triage tool and into a content-authoring tool.

References:

- [spec.md "Non-goals"](./spec.md)

## Drift-detection check-pipeline step (fail build on DB/YAML drift)

Status: Deferred

What was deferred:
A `bun run check` step that detects when `ingest_override` rows have been written but `export-overrides.ts` has not been run, and fails the build.

Why:
v1 mitigates DB / YAML drift via a "Pending export" badge in the hangar nav and a documented manual export step. A hard build-failure check is overkill before drift is observed in practice and risks breaking the build when an author is mid-session.

Trigger to revisit:
When DB / YAML drift is observed in practice during normal authoring sessions -- specifically when an authored override fails to apply on re-ingest because the YAML sidecar was not exported.

Implementation pattern when triggered:
Author a follow-on WP. Add a check that reads `ingest_override.created_at` and compares to the per-sidecar last-export timestamp (stored in a manifest or git-tracked metadata file). Fail with a one-line `bun scripts/ingest-review/export-overrides.ts` remediation hint.

References:

- [spec.md "Risks"](./spec.md)

## Audit-log volume mitigations for high-volume plugins

Status: Deferred

What was deferred:
Sampling, batching, or aggregation on writes to `audit_log` from queue action handlers.

Why:
For 21 issues per session, every action writes one `audit_log` row -- trivial volume. Mitigating before a high-volume plugin exists would be speculative engineering.

Trigger to revisit:
When a future plugin (knowledge-graph drift is the canonical example) pushes drift volume past 1k overrides per session.

Implementation pattern when triggered:
Author a follow-on WP. Evaluate per-plugin opt-in `audit_log` strategies (batch insert, per-session summary row, ring-buffer of recent overrides) rather than a queue-wide policy change.

References:

- [spec.md "Risks"](./spec.md)
