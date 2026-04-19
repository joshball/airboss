---
title: "Tasks: course-catalog"
product: runway
feature: course-catalog
type: tasks
status: done
---

# Tasks: course-catalog

All tasks completed as part of Phase 4a, work package C.

## Route Constants

- [x] Add `RUNWAY_CATALOG` static route
- [x] Add `RUNWAY_CATALOG_SCENARIOS` static route
- [x] Add `RUNWAY_CATALOG_MODULES` static route
- [x] Add `RUNWAY_CATALOG_SCENARIO(slug)` parameterized route
- [x] Add `RUNWAY_CATALOG_MODULE(id)` parameterized route

## Server Load Functions

- [x] Catalog landing -- load latest release, modules, scenarios
- [x] Scenario list -- load latest release, scenarios, competencies
- [x] Scenario detail -- load scenario by slug, competencies; 404 on miss
- [x] Module list -- load latest release, modules
- [x] Module detail -- load module by ID, filter scenarios to module; 404 on miss

## Pages (Svelte 5)

- [x] `/catalog/+page.svelte` -- landing with featured scenarios + modules sections
- [x] `/catalog/scenarios/+page.svelte` -- full scenario card grid
- [x] `/catalog/scenario/[slug]/+page.svelte` -- scenario detail with competencies + CTA
- [x] `/catalog/modules/+page.svelte` -- full module card grid
- [x] `/catalog/module/[id]/+page.svelte` -- module detail with child scenario cards

## Shared Components

- [x] `CatalogCard.svelte` -- reusable card with title, description, href, metadata
- [x] `CatalogSection.svelte` -- titled section with actions snippet slot
- [x] `CatalogStats.svelte` -- scenario/module count display
- [x] `EmptyCatalog.svelte` -- empty state for no published content
- [x] `ScenarioDetail.svelte` -- full scenario view (briefing, difficulty, duration, topics, competencies)

## SEO

- [x] `<svelte:head>` with title, description, and Open Graph tags on all pages
