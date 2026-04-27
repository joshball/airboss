---
title: "Spec: course-catalog"
product: runway
feature: course-catalog
type: spec
status: done
---

# Spec: course-catalog

Public-facing catalog pages that display published FIRC course content -- scenarios and modules -- to unauthenticated visitors. Read-only, SSR-enabled for SEO.

## Data Model

No data model changes. Reads from existing published content tables via `@firc/bc/course/read` functions:

| Function                                      | Returns                             |
| --------------------------------------------- | ----------------------------------- |
| `getLatestRelease()`                          | Current published release (or null) |
| `getPublishedScenarios(releaseId)`            | All scenarios in a release          |
| `getPublishedScenarioBySlug(releaseId, slug)` | Single scenario by slug             |
| `getPublishedModules(releaseId)`              | All modules in a release            |
| `getPublishedModuleById(releaseId, id)`       | Single module by ID                 |
| `getPublishedCompetencies(releaseId)`         | All competencies in a release       |

## Behavior

### Catalog Landing (`/catalog`)

Loads latest release, displays up to 3 featured scenarios and up to 3 modules as preview cards. Links to full list pages. Shows `EmptyCatalog` when no release exists.

### Scenario List (`/catalog/scenarios`)

All scenarios in the current release. Each card shows title, briefing, duration, and up to 2 FAA topics. Also loads competencies (available for filtering/display).

### Scenario Detail (`/catalog/scenario/[slug]`)

Single scenario looked up by slug. Displays full briefing, difficulty, duration, FAA topics, and mapped competencies. Includes CTA to register. Returns 404 if no release or slug not found.

### Module List (`/catalog/modules`)

All modules in the current release. Cards show title, scenario count, and time allocation.

### Module Detail (`/catalog/module/[id]`)

Single module looked up by ID. Shows title, scenario count badge, time allocation badge, and cards for each scenario in the module. Returns 404 if no release or ID not found.

## Validation

No user input. All pages are read-only server-rendered views.

## Edge Cases

- No published release exists -- catalog landing, scenario list, and module list show `EmptyCatalog` component
- No published release exists on detail pages -- 404 error
- Scenario slug not found -- 404 error
- Module ID not found -- 404 error
- Scenario has no slug -- falls back to `scenario.id` in link URLs
- Module has zero scenarios -- shows `EmptyCatalog` on detail page

## Out of Scope

- Search or filtering
- Authenticated content (enrollment, progress)
- Content editing or publishing
- Pagination (all items loaded at once)
