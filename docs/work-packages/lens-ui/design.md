---
title: 'Design: Lens UI'
product: study
feature: lens-ui
type: design
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 8
---

# Design: Lens UI

How the two lenses compose. Read [spec.md](./spec.md) first.

## Route shape

| Route                                          | Purpose                                              | BC entry points                                                           |
| ---------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `/lens/handbook`                               | Pick a handbook                                      | `listReferences({ kind: 'handbook' })`, `getHandbookProgress`             |
| `/lens/handbook/[doc]?edition=<slug>`          | Chapter list for one handbook (active or pinned)     | `getReferenceByDocument`, `listHandbookChapters`                          |
| `/lens/handbook/[doc]/[chapter]`               | Sections + citing nodes for one chapter              | `getHandbookChapter`, `listChapterSections`, `getNodesCitingSection`       |
| `/lens/weakness`                               | Domain rollup + three severity buckets               | `getWeakAreas`, `getWeakNodes` (new), `getCalibrationPageData`            |
| `/lens/weakness/[severity]`                    | Full ranked list inside one bucket                   | `getWeakNodes` (new) with `severity` filter                               |

All routes use `+page.server.ts` for data load (BC reads), `+page.svelte` for render. Form actions: only the weakness "drill" button writes (creates a session); reuses existing form action under `apps/study/src/routes/(app)/sessions/`.

## Page composition

### Handbook lens chapter view

```text
+----------------------------------------------------------------+
|  LensPicker      [Handbook ▼ PHAK | Edition: 25C v1]           |
+----------------------------------------------------------------+
|  Chapter 12 -- Weight & Balance                                |
|  [Edition banner if pinned to superseded]                      |
+----------------------------------------------------------------+
|  Section 12-3: Weight Limits                                   |
|    Read-state widget [unread | read | comprehended]            |
|    Citing nodes:                                               |
|      [center-of-gravity (mastered)] [mac (due)] [zfw (never)]  |
|                                                                |
|  Section 12-4: ...                                             |
+----------------------------------------------------------------+
```

### Weakness lens index

```text
+----------------------------------------------------------------+
|  LensPicker      [Weakness ▼]                                  |
+----------------------------------------------------------------+
|  Domain rollup (existing WeakAreasPanel; clickable per row)    |
+----------------------------------------------------------------+
|  Severe (10)                                  [View all -> ]   |
|    1. node-slug-A    score 0.78    [miscalibration] [overdue]  |
|    2. node-slug-B    score 0.74    [low-accuracy]              |
|    ...                                                         |
+----------------------------------------------------------------+
|  Moderate (10)                                [View all -> ]   |
|    ...                                                         |
+----------------------------------------------------------------+
|  Mild (10)                                    [View all -> ]   |
|    ...                                                         |
+----------------------------------------------------------------+
```

## Lens-evidence table

What each lens reads, computes, and renders. The contract for "no new BC math" except `getWeakNodes`.

| Lens     | Source data (reads)                                                                                       | Derived field                                                          | Render                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| handbook | `reference`, `handbook_section`, `handbook_figure`, `handbook_read_state`, `knowledge_node.references`    | Per-section citing-node list with mastery state                        | Section card with citing-node chips; chip color by mastery bucket            |
| weakness | `card`, `card_review`, `confidence_calibration_point`, `knowledge_node`, `goal_node` (active goal filter) | Per-node weighted score from four signals; severity bucket assignment  | Bucket card with ranked node rows; reason chips per row                      |

## Weakness scoring

Each candidate node receives four signals normalized to `[0, 1]`:

| Signal             | Source                                                              | Normalization                                                                                           |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `miscalibration`   | `confidence_calibration_point` rows tagged with this node's domain  | Largest gap between confidence and accuracy across buckets, divided by 1.0 (the worst possible gap).     |
| `overdue`          | `card.next_due_at < now()` for cards on this node                   | `min(daysOverdue / 30, 1.0)` -- caps at 30 days overdue.                                                 |
| `low_accuracy`     | Recent `card_review` + `rep_review` accuracy on this node           | `1.0 - rolling30dAccuracy`. Requires `>= 5` data points; otherwise this signal is `0`.                   |
| `never_attempted`  | Node exists in graph + (active goal scope) but no card / rep ever   | Binary `0 | 1`.                                                                                          |

Final score: weighted sum using `WEAKNESS_SIGNAL_WEIGHTS` from spec open question. Score >= severity threshold determines bucket.

## Sibling-WP boundaries

| Surface                  | Owner WP            | Notes                                                                              |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| `/credentials/...`       | `wp/cert-dashboard` | ACS lens scoped to one credential. Picker links here; no edits in this WP.         |
| `/goals/...`             | `wp/goal-composer`  | Goal CRUD. Picker does not link here directly; weakness lens reads active goal id. |
| `/handbook/...` (reader) | shipped (PR #242)   | Existing handbook reader. Lens reuses its components; reader is unchanged here.    |
| `/dashboard`             | shipped             | `WeakAreasPanel` reused as-is at the top of `/lens/weakness`.                      |

If `wp/cert-dashboard` lands first, this WP picks up its `LensPicker` if it ships there. Otherwise the picker lands here. Coordinate before Phase 4 to avoid duplicate work.

## Performance

- Handbook chapter view loads citing-node mastery state in one query. `getNodesCitingSection` already returns `KnowledgeNodeRow[]`; mastery overlay uses `fetchNodeMastery` from `lenses.ts` (already a batched read against `card_review` + `rep_review`).
- Weakness lens index issues five reads in parallel via `Promise.all`: `getWeakAreas`, three `getWeakNodes` calls (one per severity), one `getCalibrationPageData`. Each is independent; no N+1.
- `getWeakNodes` paginates at the SQL layer (LIMIT + ORDER BY score DESC). Index on `(user_id, severity)` if profiling shows it -- defer until measured.
- LensPicker is a static component; no server data dependency.

## Risks

| Risk                                                                                                            | Mitigation                                                                                                       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Severity threshold defaults flag every overdue node as severe for a returning CFI rebuilding from zero          | Open question 1: weights skewed toward calibration. If still over-flags, `WEAKNESS_SIGNAL_WEIGHTS` is the lever. |
| Sibling WP ships `LensPicker` first and shapes drift                                                            | Coordinate via `wp/cert-dashboard` PR review; agree on a single `LensPicker` API before either WP merges.       |
| Handbook lens duplicates handbook reader UI                                                                     | Reuse reader components verbatim. If a component is currently inlined in the reader page, lift it to `libs/ui/`. |
| `getNodesCitingSection` returns large lists for a popular section (Ch. 12 weight & balance, Ch. 5 aerodynamics) | Render virtual list above 50 chips; otherwise inline.                                                            |
| Edition pin via query string drifts from ADR 020 model                                                          | Resolve every read through `getReferenceByDocument`; never trust `?edition=` blindly. Banner triggers on mismatch. |
| Weakness BC depends on `goal_node` (goal scope filter)                                                          | If no active goal, fall back to "every node the user has any card or review on" + the current studied set.      |

## Future work (not "someday" -- scheduled or dropped)

- **ACS lens UI**: covered by `wp/cert-dashboard` (in flight).
- **Domain lens UI**: drop. The `/dashboard` domain panel covers this surface; no separate route needed unless the user reports otherwise.
- **Bloom / phase-of-flight / custom lens UIs**: drop until phase 9 of ADR 016 takes them up explicitly.
- **In-page edition diff**: schedule once a real ACS or handbook second edition publishes. Tracked in ADR 020 follow-on.
