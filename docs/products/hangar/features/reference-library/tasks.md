---
title: "Tasks: Reference Library & Regulatory Monitoring"
product: hangar
feature: reference-library
type: tasks
status: done
---

# Tasks: Reference Library & Regulatory Monitoring

## Pre-flight

- [ ] Read `docs/agents/best-practices.md` -- Svelte 5 patterns, forms
- [ ] Read `docs/agents/reference-sveltekit-patterns.md` -- constants, DB schema patterns
- [ ] Review `libs/bc/platform/src/manage.ts` -- task auto-creation patterns
- [ ] Review `libs/bc/compliance/src/` -- existing compliance BC patterns
- [ ] Complete design review (write findings in `review.md`)

## Implementation

### 1. Constants + types

- [ ] Create `libs/constants/src/reference.ts` -- `REFERENCE_DOC_TYPE`, `REFERENCE_SOURCE`, `REFERENCE_ENTITY_TYPE`, `REGULATORY_CHECK_INTERVAL_DAYS`
- [ ] Export from `libs/constants/src/index.ts`
- [ ] Add reference and regulatory check routes to `ROUTES` in `libs/constants/src/routes.ts`
- [ ] Create `libs/types/src/reference.ts` -- `ReferenceDocument`, `ReferenceLink`, `RegulatoryCheck`
- [ ] Export from `libs/types/src/index.ts`
- [ ] Run `bun run check` -- 0 errors, commit

### 2. Schema

- [ ] Add `course.reference_document` table to Drizzle schema
- [ ] Add `course.reference_link` table with unique constraint
- [ ] Add `compliance.regulatory_check` table
- [ ] Regenerate initial migration, reset DB
- [ ] Run `bun run check` -- 0 errors, commit

### 3. BC layer -- reference documents

- [ ] Add CRUD functions to `libs/bc/course/src/manage.ts` -- `createReferenceDoc`, `updateReferenceDoc`, `deleteReferenceDoc`
- [ ] Add read functions to `libs/bc/course/src/read.ts` -- `getReferenceDocuments`, `getReferenceDocById`, `searchReferenceDocuments`
- [ ] Add link functions -- `createReferenceLink`, `deleteReferenceLink`, `getLinksForDocument`, `getLinksForEntity`
- [ ] Write Vitest unit tests for CRUD + link operations
- [ ] Run `bun run check` -- 0 errors, commit

### 4. BC layer -- regulatory checks

- [ ] Add `createRegulatoryCheck` to `libs/bc/compliance/src/manage.ts`
- [ ] Add `getRegulatoryChecks`, `getLastRegulatoryCheck` to `libs/bc/compliance/src/read.ts`
- [ ] Add `getDaysSinceLastCheck` helper
- [ ] Wire task auto-creation: when `changesFound = true`, call `@firc/bc/platform/manage.createTask`
- [ ] Write Vitest unit tests
- [ ] Run `bun run check` -- 0 errors, commit

### 5. Reference document list + detail pages

- [ ] Create `apps/hangar/src/routes/(app)/references/+page.server.ts` -- load documents with search
- [ ] Create `apps/hangar/src/routes/(app)/references/+page.svelte` -- list with filters
- [ ] Create `apps/hangar/src/routes/(app)/references/[id]/+page.server.ts` -- load doc + linked content
- [ ] Create `apps/hangar/src/routes/(app)/references/[id]/+page.svelte` -- detail view with linked content
- [ ] Run `bun run check` -- 0 errors, commit

### 6. Reference document create/edit

- [ ] Create `apps/hangar/src/routes/(app)/references/new/+page.server.ts` -- create action with file upload
- [ ] Create `apps/hangar/src/routes/(app)/references/new/+page.svelte` -- create form
- [ ] Create `apps/hangar/src/routes/(app)/references/[id]/edit/+page.server.ts` -- update + delete actions
- [ ] Create `apps/hangar/src/routes/(app)/references/[id]/edit/+page.svelte` -- edit form
- [ ] Run `bun run check` -- 0 errors, commit

### 7. Reference linking on content pages

- [ ] Add "References" section to scenario edit page -- show links, add/remove
- [ ] Add "References" section to module edit page
- [ ] Add "References" section to competency page
- [ ] Add "References" section to question edit page
- [ ] Run `bun run check` -- 0 errors, commit

### 8. Superseded doc -> task creation

- [ ] When marking a doc as superseded, query all `reference_link` rows for that doc
- [ ] For each linked entity, create a compliance task via `@firc/bc/platform/manage`
- [ ] Show task creation count in success feedback
- [ ] Run `bun run check` -- 0 errors, commit

### 9. Regulatory check pages

- [ ] Create `apps/hangar/src/routes/(app)/compliance/regulatory-checks/+page.server.ts` -- load check history
- [ ] Create `apps/hangar/src/routes/(app)/compliance/regulatory-checks/+page.svelte` -- list view
- [ ] Create `apps/hangar/src/routes/(app)/compliance/regulatory-checks/new/+page.server.ts` -- create action with task auto-creation
- [ ] Create `apps/hangar/src/routes/(app)/compliance/regulatory-checks/new/+page.svelte` -- checklist form
- [ ] Run `bun run check` -- 0 errors, commit

### 10. Compliance dashboard integration

- [ ] Add "Days since last regulatory check" widget to `/compliance/dashboard`
- [ ] Show warning when > 90 days
- [ ] Link to `/compliance/regulatory-checks/new`
- [ ] Run `bun run check` -- 0 errors, commit

## Post-implementation

- [ ] Full manual test per `test-plan.md`
- [ ] All unit tests pass
- [ ] Request implementation review
- [ ] Update hangar TASKS.md
- [ ] Commit docs updates
