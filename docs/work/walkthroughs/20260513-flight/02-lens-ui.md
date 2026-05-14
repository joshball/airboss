# Lens UI

Two read-only lenses -- handbook and weakness -- as projections over the knowledge graph and calibration data already shipped in PR #254. ADR 016 phase 8.

A "lens" is a filter view onto the knowledge nodes you already have. The handbook lens walks the FAA's published structure (PHAK chapters/sections) overlaid with the nodes that cite each section and the mastery state on those nodes. The weakness lens buckets nodes by severity (severe / moderate / mild) with evidence of why they're weak (miscalibration, overdue, low accuracy, never-attempted). Both are read-only views over the same underlying state. No new BC math; one new function (`getWeakNodes`).

Spec: [docs/work-packages/lens-ui/](../../../work-packages/lens-ui/). Status: in flight when this doc was written; check the WP for current status.

## Why two lenses, why these two

[DESIGN_PRINCIPLES.md](../../../platform/DESIGN_PRINCIPLES.md) principle 6: multiple lenses are a primary feature. A returning CFI reads in handbook order (the structure the FAA uses) and also wants to know where the gaps actually are (weakness). Same nodes, two projections.

The ACS lens (cert-dashboard) is the third lens already shipped. Domain, Bloom, phase-of-flight, custom are typed but not yet built.

## The journey

### Handbook lens

#### Index -- /insights/lens/handbook

[apps/study/src/routes/(app)/insights/lens/handbook/+page.server.ts](../../../../apps/study/src/routes/(app)/insights/lens/handbook/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/insights/lens/handbook/+page.svelte).

Loader calls `listReferences()` + `getHandbookProgressMap()` (the latter batched per review-tail-2026-05).

Render: list of handbooks (PHAK, AFH, AvWX, IFH, IPH) with active edition. Per handbook: sections read / sections with citing nodes / nodes mastered as a rollup chip.

#### Doc view -- /insights/lens/handbook/[doc]?edition=...

[apps/study/src/routes/(app)/insights/lens/handbook/[doc]/+page.server.ts](../../../../apps/study/src/routes/(app)/insights/lens/handbook/%5Bdoc%5D/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/insights/lens/handbook/%5Bdoc%5D/+page.svelte).

Loader calls `getReferenceByDocument(doc)` + `listHandbookChapters(...)`. Edition resolved via query string per ADR 020 (defaults to active).

Render: chapter list, per-chapter rollup (section count, citing-node count, mastered count).

#### Chapter view -- /insights/lens/handbook/[doc]/[chapter]

[apps/study/src/routes/(app)/insights/lens/handbook/[doc]/[chapter]/+page.server.ts](../../../../apps/study/src/routes/(app)/insights/lens/handbook/%5Bdoc%5D/%5Bchapter%5D/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/insights/lens/handbook/%5Bdoc%5D/%5Bchapter%5D/+page.svelte).

Loader chain (batched to close the N+1 perf MAJOR from review-tail-2026-05):

- `getReferenceByDocument(doc)`
- `listHandbookChapters(...)`
- `listChapterSections(...)`
- `getNodesCitingSectionsBatch([sectionIds])` -- one indexed JSONB query, not N+1 per section.

Render: section list. Per section: code, title, citing-node chips. Each chip colors by mastery state (mastered / due / overdue / never-attempted). Click a chip -> the node's `/knowledge/[slug]` page.

### Weakness lens

#### Index -- /insights/lens/weakness

[apps/study/src/routes/(app)/insights/lens/weakness/+page.server.ts](../../../../apps/study/src/routes/(app)/insights/lens/weakness/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/insights/lens/weakness/+page.svelte).

Loader calls `getWeakAreas()` (existing domain-level rollup) and -- once shipped -- `getWeakNodes()` (the one new BC function).

Render: domain rollup at top (existing `WeakAreasPanel` shape). Below: three severity buckets (severe / moderate / mild), each with top-N nodes (default 10 via `WEAKNESS_INDEX_LIMIT`). Each node row: score + reason chips (miscalibration / overdue / low_accuracy / never_attempted).

#### Severity view -- /insights/lens/weakness/[severity]

[apps/study/src/routes/(app)/insights/lens/weakness/[severity]/+page.server.ts](../../../../apps/study/src/routes/(app)/insights/lens/weakness/%5Bseverity%5D/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/insights/lens/weakness/%5Bseverity%5D/+page.svelte).

Render: full ranked list for that severity (default 100 via `WEAKNESS_BUCKET_LIMIT`). Each row surfaces all reasons + a "Drill" CTA that starts a study session targeting the node.

### Cross-cutting -- LensPicker

A shell component in the `(app)` layout header that switches between lenses (handbook / weakness / ACS via cert-dashboard / domain). Active lens highlighted; query state preserved where overlap exists.

LensPicker is Phase 4 of this WP; not yet shipped at this writing.

### Cross-cutting -- edition banner

When the user pins a superseded edition via `?edition=`, the page surfaces a banner with a CTA to switch to the active edition without losing chapter context. Same pattern as cert-dashboard.

## Code map

| Concern                | Lives at                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handbook index         | [apps/study/src/routes/(app)/insights/lens/handbook/](../../../../apps/study/src/routes/(app)/insights/lens/handbook/)                                                                                                                                                                                                 |
| Handbook doc view      | [apps/study/src/routes/(app)/insights/lens/handbook/[doc]/](../../../../apps/study/src/routes/(app)/insights/lens/handbook/%5Bdoc%5D/)                                                                                                                                                                                 |
| Handbook chapter view  | [apps/study/src/routes/(app)/insights/lens/handbook/[doc]/[chapter]/](../../../../apps/study/src/routes/(app)/insights/lens/handbook/%5Bdoc%5D/%5Bchapter%5D/)                                                                                                                                                         |
| Weakness index         | [apps/study/src/routes/(app)/insights/lens/weakness/](../../../../apps/study/src/routes/(app)/insights/lens/weakness/)                                                                                                                                                                                                 |
| Weakness severity      | [apps/study/src/routes/(app)/insights/lens/weakness/[severity]/](../../../../apps/study/src/routes/(app)/insights/lens/weakness/%5Bseverity%5D/)                                                                                                                                                                       |
| Lens framework + types | [libs/bc/study/src/lenses.ts](../../../../libs/bc/study/src/lenses.ts) -- `Lens<TFilters>`, `LensInput`, `MasteryRollup`, `LensLeafMastery`, `computeMasteryRollup`, `acsLens`, `domainLens`                                                                                                                           |
| References BC          | [libs/bc/study/src/references.ts](../../../../libs/bc/study/src/references.ts) -- `listReferences`, `getReferenceByDocument`, `listHandbookChapters`, `listChapterSections`, `getNodesCitingSection`, `getNodesCitingSectionsBatch`, `getHandbookProgress`, `getHandbookProgressMap`                                   |
| Weak-area BC           | [libs/bc/study/src/dashboard.ts](../../../../libs/bc/study/src/dashboard.ts) -- `getWeakAreas`, `getRepBacklog`, **future** `getWeakNodes`                                                                                                                                                                             |
| Calibration            | [libs/bc/study/src/calibration.ts](../../../../libs/bc/study/src/calibration.ts) -- `getCalibrationPageData`                                                                                                                                                                                                           |
| Mastery                | [libs/bc/study/src/mastery.ts](../../../../libs/bc/study/src/mastery.ts) -- `getLeafMasteryStateMap`, `getNodeEvidenceStateMap`                                                                                                                                                                                        |
| Constants              | [libs/constants/src/credentials.ts](../../../../libs/constants/src/credentials.ts) -- `LENS_KINDS`, `WEAKNESS_SEVERITY`, `WEAKNESS_SEVERITY_THRESHOLDS`, `WEAKNESS_INDEX_LIMIT`, `WEAKNESS_BUCKET_LIMIT`                                                                                                               |
| Routes                 | [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts) -- `INSIGHTS_LENS`, `INSIGHTS_LENS_HANDBOOK`, `INSIGHTS_LENS_HANDBOOK_DOC(doc)`, `INSIGHTS_LENS_HANDBOOK_CHAPTER(doc, chapter)`, `INSIGHTS_LENS_WEAKNESS`, `INSIGHTS_LENS_WEAKNESS_BUCKET(severity)`                                          |
| Tests                  | [libs/bc/study/src/lenses.test.ts](../../../../libs/bc/study/src/lenses.test.ts), [lenses-course.test.ts](../../../../libs/bc/study/src/lenses-course.test.ts), [lens-tree-walk.test.ts](../../../../libs/bc/study/src/lens-tree-walk.test.ts), [references.test.ts](../../../../libs/bc/study/src/references.test.ts) |

## Key decisions

### The lens framework (ADR 016)

```typescript
Lens<TFilters> = (db: Db, userId: string, input: LensInput<TFilters>) => Promise<LensResult>
```

Every lens projects the goal's reachable knowledge nodes onto a tree shape (ACS areas/tasks/elements, handbook chapters/sections, domain taxonomy, phase-of-flight, Bloom, weakness severity). All projections read from the same underlying node-mastery state -- lenses are render-time views, not separate data. Filters narrow the projection without changing the shape.

### Handbook lens trade-offs

| Decision                                                      | Why                                                                                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Edition pinning via query string, never trusts param blindly. | The page resolves `?edition=` via `getReferenceByDocument` (ADR 020) and falls back to active when unknown.           |
| Reuses handbook reader components.                            | Section card components, read-state widgets, handbook navigation lift from the existing reader. No duplicate UI.      |
| Batched citation lookups via `getNodesCitingSectionsBatch`.   | One indexed JSONB query, not N+1 per section. Closes a MAJOR perf finding from review-tail-2026-05.                   |
| No new schema.                                                | All data flows through existing `reference`, `reference_section`, `knowledge_node.references`, `handbook_read_state`. |

### Weakness lens trade-offs

| Decision                                                                                   | Why                                                                                                               |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Four signals: miscalibration, overdue, low_accuracy, never_attempted.                      | Each is a separable signal; weighted sum gives a per-node score. Reason chips surface why each node is weak.      |
| Severity thresholds: severe >= 0.70, moderate >= 0.40, mild >= 0.15.                       | From `WEAKNESS_SEVERITY_THRESHOLDS`. Below 0.15 not surfaced.                                                     |
| Severity bucketing at the node level, not the domain level.                                | The existing `getWeakAreas` rolls up at domain. The new `getWeakNodes` returns per-node scored list with reasons. |
| No schema changes.                                                                         | Reads existing `card`, `card_review`, `confidence_calibration_point`, `knowledge_node`.                           |
| Goal scoping: when an active goal exists, filter `getWeakNodes` by `goal_node` membership. | Fall back to "every node the user has any rep/review/read-state on" when no goal. From spec.md.                   |
| Index limit 10, bucket limit 100, via constants.                                           | Default top-N; configurable later.                                                                                |

### Open questions (still in the WP)

- Exact weights for the four signals -- proposed in spec.md (miscalibration 0.30, overdue 0.25, low_accuracy 0.30, never_attempted 0.15). Phase 0 check before code.
- LensPicker shipping here or in cert-dashboard. Phase 4 coordination needed.

## Operator notes

### Seed

```bash
bun run db:reset && bun run db:seed
```

Seeds Abby + handbooks (PHAK, AFH, AvWX, IFH, IPH) + ACS. Sign in as `abby@airboss.test` to get a user with non-empty cards / reps / calibration data and PHAK Ch. 12 (Weight & Balance) with citing nodes seeded.

### Run

```bash
bun run dev study
```

Visit:

- `/insights/lens/handbook`
- `/insights/lens/handbook/phak`
- `/insights/lens/handbook/phak/ch-12`
- `/insights/lens/weakness`
- `/insights/lens/weakness/severe`

### Inspect handbook structure (offline-friendly)

```bash
bun run db sources show phak             # chapters
bun run db sources show phak ch-12       # sections
bun run db sources show phak ch-12 sec-3 # one section + citing nodes
```

### Manual walkthrough

Test plan in [docs/work-packages/lens-ui/test-plan.md](../../../work-packages/lens-ui/test-plan.md) covers every acceptance scenario. No merge without sign-off.

## Deferred / follow-ups

From [docs/work-packages/lens-ui/OUT-OF-SCOPE.md](../../../work-packages/lens-ui/OUT-OF-SCOPE.md):

| Item                                    | Status          | Trigger                                                                          |
| --------------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| ACS lens UI                             | Owned elsewhere | [cert-dashboard](01-cert-dashboard.md). Picker links to `/program/quals`.        |
| Domain lens UI                          | Deferred        | When domain rollup is missing from a flow users land in. BC `domainLens` exists. |
| Bloom / phase-of-flight / custom lenses | Deferred        | Typed in ADR 016 phase 8; revisit in phase 9.                                    |
| Weakness BC beyond `getWeakNodes`       | Rejected        | Phase 8 is "render existing weakness signal," not revisit the model.             |
| Goal-driven filters                     | Deferred        | Until `goal-composer` ships ([03 -- goal-composer](03-goal-composer.md)).        |
| Cross-lens deep-linking                 | Deferred        | Until both surfaces live and user reports jump patterns.                         |
| In-page edition diff                    | Deferred        | ADR 020 follow-on; separate feature under handbook reader.                       |

## Related docs

- [docs/work-packages/lens-ui/](../../../work-packages/lens-ui/) -- spec, design, user-stories, test-plan, OUT-OF-SCOPE
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../../decisions/016-cert-syllabus-goal-model/decision.md)
- [docs/decisions/020-handbook-edition-and-amendment-policy.md](../../../decisions/020-handbook-edition-and-amendment-policy.md)
- [docs/platform/DESIGN_PRINCIPLES.md](../../../platform/DESIGN_PRINCIPLES.md) -- principle 6

## Read next

[03 -- goal-composer](03-goal-composer.md). The third leg of the cert/syllabus/goal/lens model. Sits on top of cert-dashboard data and the lens framework.
