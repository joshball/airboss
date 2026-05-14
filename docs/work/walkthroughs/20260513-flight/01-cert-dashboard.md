# Cert Dashboard

The credentials surface in apps/study. Three read-only routes that take the cert/syllabus/goal/lens data layer (ADR 016 phase 6) and turn it into pages a returning CFI can navigate. ADR 016 phase 7.

Status: shipped. PR #321 landed the WP; PRs #650, #619, #400 are follow-ups (route rename, help index regen, edition-pin test fix). Spec lives at [docs/work-packages/cert-dashboard/](../../../work-packages/cert-dashboard/).

## The journey

Three routes. Read-only. No mutations.

### 1. Index -- /program/quals

[apps/study/src/routes/(app)/program/quals/+page.server.ts](../../../../apps/study/src/routes/(app)/program/quals/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/program/quals/+page.svelte).

Loader calls:

- `listCredentials({ status: 'active' })` -- everything in the catalog.
- `getPrimaryGoal(userId)` -- to mark the primary-goal credentials.
- `getCredentialMasteryMap(userId, [credentialIds])` -- batched mastery rollup (closes the N+1 perf MAJOR that earlier landed as N separate `getCredentialMastery` calls in PR #482).

Render: card grid (3-up desktop). Cards ordered by primary-goal credentials first, then by kind + slug. Each card carries title, kind label, category/class, mastery %, coverage %, total leaf count. Primary-goal credentials get a "Primary goal" badge. When the user has no primary goal, a banner appears with a soft prompt (no redirect -- showing all active creds is less jarring per the spec's "Open question" resolution).

Click a card -> detail page.

### 2. Detail -- /program/quals/[slug]

[apps/study/src/routes/(app)/program/quals/[slug]/+page.server.ts](../../../../apps/study/src/routes/(app)/program/quals/%5Bslug%5D/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/program/quals/%5Bslug%5D/+page.svelte).

Loader resolves edition pin from `?edition=` (per ADR 020), then calls:

- `getCredentialBySlug(slug)`
- `getCredentialPrimarySyllabus(credentialId)` -- the ACS (or PTS) that anchors this credential.
- `getCredentialMastery(userId, credentialId)` -- mastery rollup for the user.
- `getCredentialPrereqs(credentialId)` -- required + recommended one-hop.
- `getCredentialsByIds([prereqIds])` -- batched resolution (avoids N+1 again).
- `getCredentialSyllabi(credentialId, { primacy: 'supplemental' })` -- school curricula etc.

Render, top to bottom:

- Breadcrumb: Quals > credential title.
- Header: title, kind, category/class.
- Edition pin banner (only when `?edition=` is set): "Pinned to edition X. Switch to current." Switch removes the query param.
- Mastery rollup: three stats with fraction labels (mastery %, coverage %, total leaves).
- Prereqs: one-hop list grouped by required/recommended. Each prereq is a deep link to its own detail page.
- Area list: one row per area of operation, with per-area mastery/coverage/leaf counts.
- Supplemental syllabi: collapsed disclosure (default closed).

Click an area row -> area drill.

### 3. Area drill -- /program/quals/[slug]/areas/[areaCode]

[apps/study/src/routes/(app)/program/quals/[slug]/areas/[areaCode]/+page.server.ts](../../../../apps/study/src/routes/(app)/program/quals/%5Bslug%5D/areas/%5BareaCode%5D/+page.server.ts) +
[+page.svelte](../../../../apps/study/src/routes/(app)/program/quals/%5Bslug%5D/areas/%5BareaCode%5D/+page.svelte).

Loader resolves edition pin, then:

- `getCredentialBySlug(slug)` -- for the breadcrumb.
- `getSyllabusArea(syllabusId, areaCode)` -- the tree for one area.
- `getCitationsForSyllabusNodes([elementIds])` -- batched.
- `getKnowledgeNodesForSyllabusLeaves([elementIds])` -- batched.

Render:

- Breadcrumb: Quals > credential > Area {code}.
- Area header: code + title + optional description.
- Task list: grouped by task (Task A, Task B, ...). Each task shows its code + title.
- Within each task, elements (the K/R/S triad):
  - Element code, triad badge (Knowledge / Risk / Skill), title, description.
  - "Knowledge:" section -- jump-to-learn links to `/knowledge/[slug]/learn`.
  - Citation chips that resolve to the handbook reader.

There's no dedicated `/program/quals/[slug]/areas/[areaCode]/tasks/[taskCode]` page. Tasks inline under their area; the spec defers a task surface until one task carries enough content to justify its own page.

## Code map

| Concern              | Lives at                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Index loader + view  | [apps/study/src/routes/(app)/program/quals/](../../../../apps/study/src/routes/(app)/program/quals/)                                                                                                                                                   |
| Detail loader + view | [apps/study/src/routes/(app)/program/quals/[slug]/](../../../../apps/study/src/routes/(app)/program/quals/%5Bslug%5D/)                                                                                                                                 |
| Area loader + view   | [apps/study/src/routes/(app)/program/quals/[slug]/areas/[areaCode]/](../../../../apps/study/src/routes/(app)/program/quals/%5Bslug%5D/areas/%5BareaCode%5D/)                                                                                           |
| Credentials BC reads | [libs/bc/study/src/credentials.ts](../../../../libs/bc/study/src/credentials.ts)                                                                                                                                                                       |
| Syllabi BC reads     | [libs/bc/study/src/syllabi.ts](../../../../libs/bc/study/src/syllabi.ts)                                                                                                                                                                               |
| Goal integration     | [libs/bc/study/src/goals.ts](../../../../libs/bc/study/src/goals.ts) (`getPrimaryGoal`, `getDerivedCertGoals`)                                                                                                                                         |
| Schema               | [libs/bc/study/src/schema.ts](../../../../libs/bc/study/src/schema.ts) -- tables `credential`, `credential_prereq`, `credential_syllabus`, `syllabus`, `syllabus_node`, `syllabus_node_link`                                                           |
| Constants            | [libs/constants/src/credentials.ts](../../../../libs/constants/src/credentials.ts) -- `CREDENTIAL_KINDS`, `CREDENTIAL_KIND_LABELS`, `CREDENTIAL_CATEGORIES`, `CREDENTIAL_STATUS_VALUES`, `CREDENTIAL_PREREQ_KINDS`, `SYLLABUS_PRIMACY_VALUES`          |
| Routes               | [libs/constants/src/routes.ts](../../../../libs/constants/src/routes.ts) -- `PROGRAM_QUALS`, `PROGRAM_QUAL(slug)`, `PROGRAM_QUAL_AREA(slug, areaCode)`, `PROGRAM_QUAL_AT_EDITION(slug, edition)`                                                       |
| Validation           | [libs/bc/study/src/credentials.validation.ts](../../../../libs/bc/study/src/credentials.validation.ts) -- `credentialYamlSchema`, slug regex                                                                                                           |
| Tests                | [tests/e2e/credentials.spec.ts](../../../../tests/e2e/credentials.spec.ts), [libs/bc/study/src/credentials.test.ts](../../../../libs/bc/study/src/credentials.test.ts), [libs/bc/study/src/goals.test.ts](../../../../libs/bc/study/src/goals.test.ts) |
| Help                 | [apps/study/src/lib/help/content/credentials.ts](../../../../apps/study/src/lib/help/content/credentials.ts) + bodies                                                                                                                                  |

## Key decisions

| Decision                                                                                             | Why                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Three routes, not one sprawling page.                                                                | Spine-preserving navigation. The FAA's areas -> tasks -> elements hierarchy matches the user's mental model.                                         |
| Read-only consumer. No new BC functions.                                                             | All data already exists in the mastery/syllabus BC. The cert dashboard is pure UI. Keeps writes scoped to certs, syllabi, mastery, goals.            |
| Mastery and Coverage shown as separate percentages.                                                  | "90% mastered at 30% coverage" reads "expert on a narrow slice." Both numbers needed to know the real shape of progress. From user-stories.md US-7.  |
| Prereq DAG snippet is a one-hop list. Full graph deferred.                                           | One-hop list answers "what gates this?" with minimal UI. Premature graph rendering would burn design budget for uncertain ROI. From OUT-OF-SCOPE.md. |
| Edition pinning via `?edition=` query param. Default = active edition.                               | Learner mid-prep on an older ACS edition stays on it when FAA publishes a new one. ADR 020.                                                          |
| Default filter to primary-goal credentials. No redirect if no goal.                                  | Showing all active creds is less jarring than redirecting to `/goals/new`. Banner reminds to set one.                                                |
| Empty state per missing piece. "No primary syllabus", "no areas yet", "no tasks", "no linked nodes". | Each render path has explicit copy so users don't think the system is broken. From user-stories.md US-6.                                             |
| Batched mastery + prereq queries via `getCredentialMasteryMap` and `getCredentialsByIds`.            | Closes the chunk-1 perf MAJOR / backend MAJOR N+1 finding from review-tail-2026-05.                                                                  |
| Supplemental syllabi collapsed by default.                                                           | A credential may have an ACS (primary) plus a school curriculum (supplemental). Default view stays clean.                                            |
| Desktop-first. No mobile-specific layout.                                                            | The study app is desktop-first; the cert dashboard inherits that. Mobile responsiveness implicit in the token system.                                |

For the full decision trail: [docs/work-packages/cert-dashboard/spec.md](../../../work-packages/cert-dashboard/spec.md) and the ADR 016 phase 7 entry.

## Operator notes

### Seed and inspect

```bash
bun run db seed credentials     # idempotent
bun run db seed syllabi
bun run db seed all             # full reset + seed for Abby
```

Abby (the dev-seed user, `abby@airboss.test`) gets:

- Seven active credentials: private, instrument, commercial, cfi, cfii, mei, meii.
- Primary goal set to PPL ASEL.
- PPL ACS Area V authored (the only area transcribed; full ACS is phase 10).
- Reps + cards on Area V so mastery rollups are non-zero.

### Run the routes locally

```bash
bun run dev study               # opens on the configured dev port
```

Then sign in as `abby@airboss.test` and visit:

- `/program/quals`
- `/program/quals/private`
- `/program/quals/private?edition=ppl-acs-25`   (edition pin)
- `/program/quals/private/areas/V`

### Test

```bash
bunx playwright test credentials.spec.ts
bun test credentials.test.ts
bun test goals.test.ts
bun run check                  # full pipeline; includes the e2e + unit suites
```

### Edition pinning test flow

1. Visit `/program/quals/private` -- default to active PPL ACS edition.
2. Visit `/program/quals/private?edition=ppl-acs-25` -- pinned banner appears with "Switch to current" link.
3. The loader resolves the edition slug, falls back to active if unknown.

## Deferred / follow-ups

From [docs/work-packages/cert-dashboard/OUT-OF-SCOPE.md](../../../work-packages/cert-dashboard/OUT-OF-SCOPE.md):

| Item                                       | Status       | Trigger                                                                                          |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------ |
| Goal composition / writing                 | Follow-on WP | When `/goals/...` surface ships (see [03 -- goal-composer](03-goal-composer.md)).                |
| Cross-lens browse (`/lens/...`)            | Follow-on WP | When lens-ui ships (see [02 -- lens-ui](02-lens-ui.md)).                                         |
| Full prereq DAG visualisation              | Deferred     | When the one-hop list proves insufficient for navigation.                                        |
| Edition diff viewer                        | Deferred     | When FAA publishes a second edition for an authored credential.                                  |
| ACS / PTS / endorsement authoring at scale | Follow-on WP | ADR 016 phase 10. Already a content workstream; not engineering blocker.                         |
| CFI evidence-kind gating UI                | Deferred     | Data shipped (`getCredentialMastery.byEvidenceKind`, `acsLens.missingKinds`). UI is pure add-on. |
| Mobile-specific layouts                    | Rejected     | Study app is desktop-first.                                                                      |
| Dedicated task page                        | Deferred     | When one task carries enough content to warrant its own surface.                                 |

## Related docs

- [docs/work-packages/cert-dashboard/](../../../work-packages/cert-dashboard/) -- spec, design, user-stories, test-plan, OUT-OF-SCOPE
- [docs/decisions/016-cert-syllabus-goal-model/decision.md](../../../decisions/016-cert-syllabus-goal-model/decision.md) -- the model behind this feature
- [docs/decisions/020-handbook-edition-and-amendment-policy.md](../../../decisions/020-handbook-edition-and-amendment-policy.md) -- edition policy

## Read next

[02 -- lens-ui](02-lens-ui.md). The handbook and weakness lenses share the same framework with the ACS lens that powers the page above. Reading them together completes the lens picture.
