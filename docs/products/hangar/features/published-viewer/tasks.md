---
title: Published Viewer -- Tasks
product: hangar
feature: published-viewer
type: tasks
status: done
---

# Published Viewer -- Tasks

## Bug fixes (pre-requisites)

- [x] Fix `getLatestRelease` in `libs/bc/course/src/read.ts` -- change `orderBy(release.publishedAt)` to `orderBy(desc(release.publishedAt))`
- [x] Add `getPublishedMicroLessons(releaseId)` to `libs/bc/course/src/read.ts`
- [x] Add `getPublishedStudentModels(releaseId)` to read.ts (current function takes unused `_modelId`, returns only one)
- [x] Add auth guard to `/publish/+page.server.ts` actions (import and call `requireAuth`)

## Routes and constants

- [x] Add `PUBLISH_RELEASE: (releaseId: string) => '/publish/${releaseId}'` to `libs/constants/src/routes.ts`
- [x] Create `/publish/[releaseId]/+page.server.ts` -- load release + all published content
- [x] Create `/publish/[releaseId]/+page.svelte` -- read-only content viewer

## UI

- [x] Release header: version, published date, FAA status badge
- [x] Content sections (one per type): scenarios, modules, questions, micro-lessons, student models, competencies
- [x] Use DataTable for each section
- [x] Strip `correctAnswer` from questions in the load function before sending to client
- [x] "Back to publish" link

## Integration

- [x] Add "View release" link on `/publish` page next to current release info

## Tests

- [ ] Unit test: `getLatestRelease` returns most recent release (not earliest)
- [ ] Unit test: `getPublishedMicroLessons` returns micro-lessons for a given release
- [ ] E2E test: publish content, navigate to viewer, verify content appears
