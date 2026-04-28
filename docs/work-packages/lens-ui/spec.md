---
title: 'Spec: Lens UI'
product: study
feature: lens-ui
type: spec
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 8
---

# Spec: Lens UI

ADR 016 phase 8: ship the page-level surface for two of the lenses defined by the lens framework -- the **handbook lens** and the **weakness lens**. Both are read-only projections over already-shipped BC. The lens framework data layer (lens types, ACS / Domain lens implementations, mastery rollups) merged in PR #254. This WP adds the `/lens/...` route surface that consumes it.

## Why

User zero (a returning CFI rebuilding seven credentials) asked for two views the existing study dashboard cannot give him:

- **"What does PHAK Chapter 12 look like through what I've actually studied?"** -- the handbook lens. Walks the FAA structure he reads in, overlaid with the knowledge nodes that cite each section and his mastery state on those nodes.
- **"Where am I weakest, and why?"** -- the weakness lens. Buckets the graph by severity, with the actual evidence (miscalibration, overdueness, low accuracy, never-attempted) shown so he can choose what to attack.

Sibling WPs cover the other phase 8/9 surfaces: `cert-dashboard` owns `/credentials/...` (ACS lens scoped to one credential); `goal-composer` owns `/goals/...`. This WP owns `/lens/...` only.

## Anchors

- [ADR 016 -- Cert, Syllabus, Goal, Multi-Lens Learning Model](../../decisions/016-cert-syllabus-goal-model/decision.md), phase 8 row in the migration plan.
- [ADR 016 context](../../decisions/016-cert-syllabus-goal-model/context.md).
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md). Edition pinning for the handbook lens.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), principle 6 (lenses are projections, not separate data).
- [Cert, Syllabus, Goal Composer spec](../cert-syllabus-and-goal-composer/spec.md). Data layer this WP consumes.
- [Handbook Ingestion and Reader spec](../handbook-ingestion-and-reader/spec.md). `reference`, `handbook_section`, `handbook_figure` tables; `getNodesCitingSection` BC function.
- [Calibration Tracker spec](../calibration-tracker/spec.md). `getCalibration` BC + `study.confidence_calibration_point` table the weakness lens reads.
- [Citations pattern reference](../../agents/reference-citations-pattern.md). Picker / chip / cited-by panel composition.

Sibling WPs (different branches; not yet on main):

- `wp/cert-dashboard` -- `/credentials/...` surface. ACS lens for one credential.
- `wp/goal-composer` -- `/goals/...` surface. Goal CRUD.

## In Scope

| #   | Item                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Handbook lens index**: `/lens/handbook` -- pick a handbook (PHAK / AFH / AvWX / IFH / IPH) and edition. Lists handbooks the user has any read state or any citing knowledge node activity on, plus the full registry below.                                                                                                                                                         |
| 2   | **Handbook lens doc view**: `/lens/handbook/<doc>?edition=<slug>` -- chapter list with per-chapter rollup (sections read / sections with citing nodes / nodes mastered). Default edition is the active edition per ADR 020; query string overrides for cross-edition browsing.                                                                                                        |
| 3   | **Handbook lens chapter view**: `/lens/handbook/<doc>/<chapter>` -- sections of the chapter, each with the knowledge nodes that cite that section and the user's mastery state (mastered / due / overdue / never-attempted) per node. Section read-state widget reused from the handbook reader.                                                                                      |
| 4   | **Weakness lens index**: `/lens/weakness` -- three severity buckets (severe / moderate / mild), each showing top-N node IDs ranked by weakness score with reasons. Domain-level rollup at the top reuses the existing `getWeakAreas` dashboard fetcher.                                                                                                                               |
| 5   | **Weakness lens severity view**: `/lens/weakness/<severity>` -- full ranked list inside one bucket with all reasons surfaced per node. Each row links to the node detail page with a "drill" CTA that queues a card session against that node.                                                                                                                                        |
| 6   | **Lens picker shell** in the (app) layout: a single `LensPicker` component in the header allowing kind switch (handbook / weakness / ACS / domain). The picker is shared infrastructure for the sibling cert-dashboard surface; this WP ships it and the two lenses it covers, plus links into `/credentials` and `/goals` for the other lens kinds.                                  |
| 7   | **Mounting points reuse**: handbook lens reuses `getNodesCitingSection`; weakness lens reuses `getCalibrationPageData` + `getWeakAreas`. No new BC functions written here unless flagged in "BC functions to add" below.                                                                                                                                                              |
| 8   | **Edition pinning UX**: when a user opens the handbook lens with no `?edition=` query, the page resolves the active edition via the existing `getReferenceByDocument({ document, status: 'active' })` BC. A subtle "newer edition available" banner surfaces if the user is pinned to a superseded edition. ADR 020 supplies the model; the lens just renders.                        |
| 9   | **Empty / loading / error states** for every panel: domain bucket empty (no calibration points yet), handbook empty (handbook not yet ingested for that edition), severity bucket empty (no signal yet at that severity), citing-nodes empty (FAA section that no graph node currently cites). All states use the existing `EmptyState` / `ErrorBoundary` UI primitives.              |
| 10  | **Route constants in `libs/constants/src/routes.ts`**: `ROUTES.LENS_HANDBOOK`, `ROUTES.LENS_HANDBOOK_DOC(doc)`, `ROUTES.LENS_HANDBOOK_CHAPTER(doc, chapter)`, `ROUTES.LENS_WEAKNESS`, `ROUTES.LENS_WEAKNESS_BUCKET(severity)`. **Need adding when this WP is built** (not in the constants file yet).                                                                                  |
| 11  | **`WEAKNESS_SEVERITY` enum** + values + labels in `libs/constants/src/credentials.ts` (alongside `LENS_KINDS`). Three values: `severe`, `moderate`, `mild`. `WEAKNESS_SIGNAL_WEIGHTS` constant captures the four-signal weighted scoring. **See open question below for default weights.**                                                                                            |

## Out of Scope (explicit)

- **ACS lens UI**: covered by `wp/cert-dashboard` at `/credentials/[slug]/...`. The lens framework's `acsLens` BC function already exists and is consumed there, not here.
- **Domain lens UI**: defer until either cert-dashboard or this WP demonstrates the domain rollup is missing from somewhere users actually land. The `domainLens` BC exists; no UI in this WP.
- **Bloom / phase-of-flight / custom lenses**: typed but unimplemented per ADR 016 phase 8 row. Out of scope here.
- **Weakness BC additions** (other than the new function flagged below): no calibration math changes, no new score formulas, no new persistence tables. The weakness lens reads existing rep / card / calibration state only.
- **Goal-driven filters on either lens**: e.g., "show me weak nodes only inside my active goal". Belongs in `goal-composer` after both surfaces ship.
- **Cross-lens deep-linking** (e.g., handbook lens -> ACS lens for the same node). Defer until both surfaces are live and the user reports actual jump patterns.
- **In-page edition diff** (compare PHAK 25B vs 25C section by section). ADR 020 work; not this WP.

## BC reads consumed

All shipped on `main`. No new BC functions written by this WP except where flagged.

| BC function                                                                       | File                              | Lens     | Purpose                                                            |
| --------------------------------------------------------------------------------- | --------------------------------- | -------- | ------------------------------------------------------------------ |
| `listReferences({ kind: 'handbook' })`                                            | `libs/bc/study/src/handbooks.ts`  | handbook | Index page (which handbooks exist + active edition resolution).    |
| `getReferenceByDocument({ document, status })`                                    | `libs/bc/study/src/handbooks.ts`  | handbook | Resolve active edition from `?edition=` query or default.          |
| `listHandbookChapters(referenceId)`                                               | `libs/bc/study/src/handbooks.ts`  | handbook | Doc view chapter list.                                             |
| `listChapterSections(chapterId)`                                                  | `libs/bc/study/src/handbooks.ts`  | handbook | Chapter view section list.                                         |
| `getHandbookSection({ id })` / `getHandbookChapter({ id })`                       | `libs/bc/study/src/handbooks.ts`  | handbook | Section + chapter detail (already used by reader; reused here).    |
| `getNodesCitingSection({ sectionId })`                                            | `libs/bc/study/src/handbooks.ts`  | handbook | Bidirectional jump: which graph nodes cite this section.           |
| `getHandbookProgress(userId, referenceId)`                                        | `libs/bc/study/src/handbooks.ts`  | handbook | Per-doc rollup for the index card.                                 |
| `getCitationsForSyllabusNode(syllabusNodeId)`                                     | `libs/bc/study/src/syllabi.ts`    | handbook | Reverse jump: from a citing node, surface its other syllabus hits. |
| `getCalibrationPageData({ userId })`                                              | `libs/bc/study/src/calibration.ts` | weakness | Per-domain calibration buckets feeding the severity score.         |
| `getWeakAreas(userId, limit, db, now)`                                            | `libs/bc/study/src/dashboard.ts`  | weakness | Existing domain-level weak-area rollup (top-of-page summary).      |
| `getRepBacklog(userId, db)`                                                       | `libs/bc/study/src/dashboard.ts`  | weakness | Overdue counts feeding the `overdue` signal.                       |
| `computeMasteryRollup(leaves)`                                                    | `libs/bc/study/src/lenses.ts`     | both     | Shared rollup primitive (shipped with lens framework).             |

## BC functions to add

The current `getWeakAreas` rolls up at the **domain** level, not the **node** level, and ranks by `card-accuracy / rep-accuracy / overdue` reasons. The weakness lens needs node-level ranking with `miscalibration / overdue / low_accuracy / never_attempted` reasons.

| New function           | File                              | Signature (sketch)                                                                                  |
| ---------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `getWeakNodes`         | `libs/bc/study/src/dashboard.ts`  | `(userId, severity?, limit?, db?, now?) -> Promise<WeakNode[]>` returning per-node scored list.      |
| `WeakNode` type        | same file                         | `{ nodeId, severity, score, reasons: WeakNodeReason[] }`. Reasons shape mirrors `WeakNodeSignal`.    |
| `WeakNodeReason` union | same file                         | `miscalibration / overdue / low_accuracy / never_attempted`, each with the underlying signal value.  |

Spec'd here, implemented in this WP's Phase 1. No schema changes -- reads existing `card`, `card_review`, `confidence_calibration_point`, `knowledge_node` tables.

## Constants and routes

New entries (Phase 0 of tasks.md):

- `WEAKNESS_SEVERITY` (`severe / moderate / mild`) + values + labels + colors mapping in `libs/constants/src/credentials.ts`.
- `WEAKNESS_SIGNAL_KINDS` (`miscalibration / overdue / low_accuracy / never_attempted`) + labels.
- `WEAKNESS_SIGNAL_WEIGHTS` -- four-number config object; default values in the open question below.
- `WEAKNESS_SEVERITY_THRESHOLDS` -- score cutoffs separating severe / moderate / mild. Default: `severe >= 0.70`, `moderate >= 0.40`, `mild >= 0.15`. Values below 0.15 are not surfaced.
- `WEAKNESS_LIMITS` -- per-severity top-N for the index page (default 10) and for the bucket page (default 100).
- `ROUTES.LENS_HANDBOOK` (`/lens/handbook`).
- `ROUTES.LENS_HANDBOOK_DOC(doc)` (`/lens/handbook/${doc}`).
- `ROUTES.LENS_HANDBOOK_CHAPTER(doc, chapter)` (`/lens/handbook/${doc}/${chapter}`).
- `ROUTES.LENS_WEAKNESS` (`/lens/weakness`).
- `ROUTES.LENS_WEAKNESS_BUCKET(severity)` (`/lens/weakness/${severity}`).

`LENS_KINDS` already exists in `libs/constants/src/credentials.ts` (PR #248); the picker reads from it.

## Open question

| #   | Question                                  | Default (proposed)                                                                                   | Why this default                                                                                                                                                                                                                              |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Weakness signal weights                  | `miscalibration: 0.30`, `overdue: 0.25`, `low_accuracy: 0.30`, `never_attempted: 0.15` (sum = 1.00) | Biased toward calibration + direct evidence. A returning CFI rebuilding from zero has many overdue nodes by definition; weighting overdue lower than miscalibration prevents the severe bucket from drowning in "overdue, never attempted". |

Confirm before Phase 0 ships. If the user wants different weights, only the values in `WEAKNESS_SIGNAL_WEIGHTS` change; nothing else is gated on the answer.

## Acceptance

- [ ] `bun run check` clean (0 errors, 0 warnings).
- [ ] All five `/lens/...` routes load without error against the dev seed (Abby's user).
- [ ] Handbook lens chapter view correctly lists citing knowledge nodes for at least one section in PHAK Ch. 12 (the Weight & Balance citation chain seeded today).
- [ ] Weakness lens severity buckets are non-empty for Abby on dev seed; reasons render correctly per the four signal kinds.
- [ ] LensPicker switches between handbook and weakness without losing query state.
- [ ] Edition banner appears when the user pins a superseded edition.
- [ ] Empty / loading / error states present and a11y-reviewed (per `ball-review-a11y` skill).
- [ ] Manual test plan in `test-plan.md` walked end-to-end and signed off.
- [ ] Sibling-WP boundary respected: this branch touches no files under `apps/study/src/routes/(app)/credentials/` or `apps/study/src/routes/(app)/goals/`.
