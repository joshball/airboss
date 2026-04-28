# Tasks: Cert Dashboard (ADR 016 phase 7)

Status: draft. Phased build via `/ball-wp-build` once spec is signed off.

Status legend: `[x]` done, `[ ]` pending.

## Phase 1 -- Index page (`/credentials`)

- [ ] `apps/study/src/routes/(app)/credentials/+page.server.ts` -- load `listCredentials({ status: 'active' })`, `getPrimaryGoal(userId)`, per-credential `getCredentialMastery` for the goal-filtered set
- [ ] `apps/study/src/routes/(app)/credentials/+page.svelte` -- credential cards in goal-aware default order; mastery + coverage tiles; primary-goal banner
- [ ] Loader unit tests (Vitest): goal-filter logic, no-goal fallback, ordering
- [ ] Empty state: no active credentials -> friendly message + link to `/goals/new`
- [ ] Header banner when user has no primary goal: "Set a primary goal to filter this list"; links to `/goals/new`

## Phase 2 -- Detail page (`/credentials/[slug]`)

- [ ] `+page.server.ts` -- `getCredentialBySlug`, `getCredentialPrimarySyllabus`, `getCredentialMastery`, immediate prereqs (one-hop via `getCredentialPrereqs` + per-id `getCredentialById`)
- [ ] `+page.svelte` -- credential header (title, kind, category/class), prereq snippet, area list with mastery bars
- [ ] `?edition=` honoured (loader resolves syllabus by edition pin; default = active syllabus)
- [ ] 404 path when `slug` doesn't match a credential
- [ ] Empty: no primary syllabus -> "Syllabus not yet authored" with the 7-cert ADR 016 phase 10 explanation linked
- [ ] Empty: no syllabus links anywhere -> coverage 0/0; mastery shown as "no data"
- [ ] "Supplemental syllabi" disclosure (collapsed by default) using `getCredentialSyllabi(id, { primacy: 'supplemental' })`

## Phase 3 -- Area drill (`/credentials/[slug]/areas/[areaCode]`)

- [ ] `+page.server.ts` -- `getSyllabusTree`, narrow to the requested area, per-leaf mastery from `acsLens` projection
- [ ] `+page.svelte` -- area header, task list, expandable element rows (K/R/S triad)
- [ ] Element row: linked knowledge nodes via `getKnowledgeNodesForSyllabusLeaf`; jump-to-learn buttons
- [ ] Citations panel per element: `getCitationsForSyllabusNode`
- [ ] 404 when areaCode doesn't exist on the syllabus
- [ ] Breadcrumbs (`/credentials -> /credentials/[slug] -> Area V`)

## Phase 4 -- Help, tests, polish

- [ ] `apps/study/src/lib/help/content/credentials.ts` -- HelpPage covering the three surfaces; sections: index, detail, area drill, edition pin, mastery vs coverage
- [ ] PageHelp drawer mounted on all three pages
- [ ] Playwright e2e: index + detail + area smoke; edition-pin round-trip; empty-syllabus fallback
- [ ] Vitest: loader edition resolution; goal-filter logic
- [ ] Theme tokens only -- no hex colours; pass `bun run lint:theme`
- [ ] `bun run check` clean

## Phase 5 -- Verification

- [ ] User walks the test plan; flips `status: done` in spec/tasks/test-plan/design/user-stories
- [ ] Agent flips `review_status: done` after `/ball-review-full` closes findings
- [ ] Update `docs/work/NOW.md`: mark ADR 016 phase 7 complete; remove from "in flight"
- [ ] ADR 016 migration table: phase 7 status -> Shipped (PR #...)
