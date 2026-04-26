---
title: Published Content Viewer
product: hangar
feature: published-viewer
type: spec
status: done
---

# Published Content Viewer

**Size:** Medium
**Route:** `/publish/[releaseId]`
**BC access:** `@firc/bc/course` -- read level

## What it does

Read-only viewer showing all published content for a specific release. Lets content authors verify exactly what sim users will see before going live. Accessed from the `/publish` page.

## Data

Loads all content tied to a `releaseId` from the `published.*` schema:

| Content type   | Read function                               | Display                                          |
| -------------- | ------------------------------------------- | ------------------------------------------------ |
| Scenarios      | `getPublishedScenarios(releaseId)`          | Title, difficulty, duration, linked competencies |
| Modules        | `getPublishedModules(releaseId)`            | Title, time allocation, scenario count           |
| Questions      | `getPublishedQuestions(releaseId)`          | Text, type, option count (hide `correctAnswer`)  |
| Micro-lessons  | `getPublishedMicroLessons(releaseId)` (new) | Title, trigger context                           |
| Student models | (filter by releaseId)                       | Name, parameter summary                          |
| Competencies   | `getPublishedCompetencies(releaseId)`       | ID, domain, skill                                |

## Behavior

- Navigate from `/publish` page via "View release" link next to the current release info.
- Page shows release metadata (version, published date, FAA status) at top.
- Content grouped by type in collapsible or tabbed sections.
- All data is read-only -- no edit forms, no actions.
- If the `releaseId` doesn't exist, show 404.
- `correctAnswer` on questions is **never sent to client** -- strip it in the load function.

## Bug fixes included in this work

- `getLatestRelease` uses ascending order -- fix to `desc(release.publishedAt)`.
- No `getPublishedMicroLessons` function exists -- add it.
- Publish endpoint has no auth guard -- add `requireAuth` check.
