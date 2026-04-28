---
title: 'Spec: Cert Dashboard'
product: study
feature: cert-dashboard
type: spec
status: draft
review_status: pending
created: 2026-04-28
adr: 016
phase: 7
---

# Spec: Cert Dashboard

ADR 016 phase 7. The page-level surface that turns the credential / syllabus / mastery data layer (shipped via PRs #248, #254, #264, #270, #274) into something a learner can navigate.

Pure read-only consumer of the existing BC. No new schema, no new BC functions, no new write paths. Three SvelteKit routes (`/credentials`, `/credentials/[slug]`, `/credentials/[slug]/areas/[areaCode]`) -- the route constants are already defined in `libs/constants/src/routes.ts`.

## Why this WP exists

| Need                                                                                | What's missing today                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "How am I doing on each cert at a glance?"                                          | The data exists (`getCredentialMastery`); no page renders it.                                              |
| Drill from cert -> Area -> Task -> linked knowledge nodes without losing the spine. | ACS lens is implemented in BC (`acsLens`); UI to render the tree is not.                                   |
| See the prereq DAG (CFII = CFI + IR add-on; MEI = CFI + multi-engine + ...).        | `getCredentialPrereqDag` returns the structure; no surface visualises it.                                  |
| Resume a credential mid-prep on the edition the learner started on.                 | `?edition=` is in `ROUTES.CREDENTIAL_AT_EDITION`; loader doesn't honour it yet.                            |

## Anchors

- [ADR 016 -- Cert / Syllabus / Goal model](../../decisions/016-cert-syllabus-goal-model/decision.md). Phase 7 row of the migration plan; this WP is its acceptance.
- [ADR 016 context](../../decisions/016-cert-syllabus-goal-model/context.md) -- why DAG + per-cert rollup + lens-based browsing.
- [ADR 020 -- Handbook edition + amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md). Edition-pin behaviour for `?edition=`.
- [Learning Philosophy](../../platform/LEARNING_PHILOSOPHY.md), principles 2 (cert as constraint set), 3 (DAG composition), 5 (mastery rollup).
- [Predecessor WP -- cert-syllabus-and-goal-composer](../cert-syllabus-and-goal-composer/spec.md). The data layer this WP consumes.
- [Sibling WP -- lens-ui](../lens-ui/spec.md). Owns `/lens/...`. Cert dashboard renders the ACS lens for one credential; lens-ui owns the cross-lens browse surface.
- [Sibling WP -- goal-composer](../goal-composer/spec.md). Owns `/goals/...`. Cert dashboard reads `getPrimaryGoal` for default filtering; it never writes goals.
- [reference-citations-pattern.md](../../agents/reference-citations-pattern.md). How to mount cited-by panels on a new surface.
- [reference-sveltekit-patterns.md](../../agents/reference-sveltekit-patterns.md). Loader / page-server / route-style conventions.

## In Scope

| #  | Item                                                                                                                                                       |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `/credentials` index page. Lists active credentials with mastery + coverage %; default-filtered to the user's primary goal's credentials when one exists.   |
| 2  | `/credentials/[slug]` per-cert detail. Header (cert title, kind, category, class), prereq DAG snippet (immediate prereqs only), mastery rollup, area list. |
| 3  | `/credentials/[slug]/areas/[areaCode]` per-Area drill. Task list with per-task mastery; expandable elements (K/R/S triad) showing linked knowledge nodes.   |
| 4  | `?edition=` query param honoured. Loader resolves the credential's primary syllabus edition the learner pinned on; default = active edition.               |
| 5  | Mastery rollup display. Three numbers per node: `total leaves`, `covered`, `mastered`. Coverage % vs mastery % shown distinct (90% of 30% reads different). |
| 6  | Prereq DAG snippet on the detail page. Immediate prereqs (`required` + `recommended` kinds) with deep links to each. Full DAG visualisation deferred.        |
| 7  | Empty / fallback states. No primary syllabus, no syllabus links, no goal, no mastery data -- each has explicit copy.                                       |
| 8  | Help page (`apps/study/src/lib/help/content/credentials.ts`) covering the three surfaces.                                                                  |
| 9  | Playwright e2e for the three routes (smoke + edition-pin + empty state).                                                                                   |
| 10 | Vitest unit tests for the loader's edition resolution + goal-default-filter logic.                                                                         |

## Out of Scope (explicit)

- **Goal composition / writing.** All goal writes belong to [goal-composer](../goal-composer/spec.md). Cert dashboard reads the primary goal; it never opens a write path.
- **Cross-lens browse.** Handbook lens, weakness lens, custom lens -- those live under `/lens/...` and ship in [lens-ui](../lens-ui/spec.md).
- **Full prereq DAG visualisation.** The detail page shows immediate prereqs only (one-hop). A DAG visualiser is a separate WP if the simple list doesn't suffice.
- **Edition diff surface.** When the FAA publishes a new ACS, the loader keeps the learner on the pinned edition. A "what changed" diff viewer between editions is a follow-on WP gated on a real second edition publishing.
- **Authoring.** ACS / PTS / endorsement transcription work continues per ADR 016 phase 10; this WP just renders whatever the BC returns.
- **CFI / instructor-cert evidence-kind gating.** ADR 016 phase 8 records the data shape; this WP does not enforce "S leaf needs scenario evidence." Filter UI for evidence kind is deferred.
- **Mobile-specific layouts.** Desktop-first per the rest of the study app.

## BC reads consumed (no new functions)

| Function                                                          | File                                  | Used on                  |
| ----------------------------------------------------------------- | ------------------------------------- | ------------------------ |
| `listCredentials({ status })`                                     | `libs/bc/study/src/credentials.ts`    | `/credentials` index     |
| `getCredentialBySlug(slug)`                                       | `libs/bc/study/src/credentials.ts`    | `/credentials/[slug]`    |
| `getCredentialPrereqs(credentialId)` + `getCredentialById` join   | `libs/bc/study/src/credentials.ts`    | Detail prereq snippet     |
| `getCredentialMastery(userId, credentialId)`                      | `libs/bc/study/src/credentials.ts`    | All three pages           |
| `getCredentialPrimarySyllabus(credentialId)`                      | `libs/bc/study/src/credentials.ts`    | Detail + Area pages       |
| `getCredentialSyllabi(credentialId, { primacy })`                 | `libs/bc/study/src/credentials.ts`    | Detail "supplemental" panel |
| `acsLens(db, userId, { goal })`                                   | `libs/bc/study/src/lenses.ts`         | Per-syllabus tree render  |
| `getSyllabusTree(syllabusId)`                                     | `libs/bc/study/src/syllabi.ts`        | Area drill loader         |
| `getCitationsForSyllabusNode(syllabusNodeId)`                     | `libs/bc/study/src/syllabi.ts`        | Element citations chip    |
| `getKnowledgeNodesForSyllabusLeaf(leafId)`                        | `libs/bc/study/src/syllabi.ts`        | Element jump-to-learn     |
| `getPrimaryGoal(userId)`                                          | `libs/bc/study/src/goals.ts`          | Index default-filter      |

## Constants and routes (already shipped)

- `ROUTES.CREDENTIALS`, `ROUTES.CREDENTIAL(slug)`, `ROUTES.CREDENTIAL_AREA(slug, areaCode)`, `ROUTES.CREDENTIAL_TASK(slug, areaCode, taskCode)`, `ROUTES.CREDENTIAL_AT_EDITION(slug, edition)` -- all already in `libs/constants/src/routes.ts`.
- `CREDENTIAL_KIND_LABELS`, `CREDENTIAL_STATUS_LABELS`, `SYLLABUS_KIND_LABELS`, `SYLLABUS_PRIMACY` -- in `libs/constants/src/credentials.ts`.
- `QUERY_PARAMS.EDITION` -- already defined.
- No new constants required.

## Open question

| #  | Question                                                                                                          | Default                                                                                                                                                |
| -- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1  | Index default filter when the user has no primary goal: show all active credentials, or empty + CTA to `/goals/new`? | Show all active credentials. Empty + CTA pushes the user away from the page they arrived at. The CTA shows as a header banner instead, not a redirect. |

## Acceptance

- All three routes render against the existing BC with zero new BC functions.
- `bun run check` clean. Unit + e2e tests pass.
- Help page exists, validated, and linked from the surfaces.
- `?edition=` round-trips correctly (a learner mid-prep on an older edition lands on that edition's syllabus).
- Empty / fallback states render with explicit copy (no blank pages, no console errors).
- Manual test plan in [test-plan.md](./test-plan.md) walked end-to-end by the user.
