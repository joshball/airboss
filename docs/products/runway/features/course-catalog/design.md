---
title: "Design: course-catalog"
product: runway
feature: course-catalog
type: design
status: done
---

# Design: course-catalog

## Read from Published Schema

All catalog pages read from the `published` schema via `@firc/bc/course/read`. Content is versioned by release -- every load starts with `getLatestRelease()` and scopes all queries to that `release_id`. This means the catalog always reflects the most recently published snapshot, never draft content.

No writes occur anywhere in this feature.

## SSR for SEO

Runway is the only app with SSR enabled (per project SSR decisions). All catalog pages are server-rendered with full `<svelte:head>` metadata -- title, description, and Open Graph tags. This is critical because the catalog is the public-facing discovery surface for search engines and social sharing.

## Route Structure

| Route                      | Param  | Lookup                                     |
| -------------------------- | ------ | ------------------------------------------ |
| `/catalog`                 | --     | Latest release -> modules + scenarios      |
| `/catalog/scenarios`       | --     | Latest release -> scenarios + competencies |
| `/catalog/scenario/[slug]` | `slug` | `getPublishedScenarioBySlug`               |
| `/catalog/modules`         | --     | Latest release -> modules                  |
| `/catalog/module/[id]`     | `id`   | `getPublishedModuleById`                   |

Scenarios use slug-based URLs for SEO-friendly paths. Modules use opaque IDs (no slug field on modules).

## Component Architecture

Five shared components in `apps/runway/src/lib/components/`:

| Component        | Role                                                                       |
| ---------------- | -------------------------------------------------------------------------- |
| `CatalogCard`    | Reusable card -- title, description, href, metadata array                  |
| `CatalogSection` | Titled section with Svelte 5 snippet for action buttons                    |
| `CatalogStats`   | Scenario + module count summary                                            |
| `EmptyCatalog`   | Empty state when no release exists                                         |
| `ScenarioDetail` | Full scenario view -- briefing, difficulty, duration, topics, competencies |

`CatalogSection` uses `{#snippet actions()}` / `{@render}` (Svelte 5 pattern, no `<slot>`).

## Key Decisions

### Slug fallback to ID

- **Options:** Require slugs on all scenarios vs. fall back to ID when slug is null
- **Chosen:** Fallback -- `scenario.slug ?? scenario.id`
- **Rationale:** Slugs are set during content authoring and may not exist for all scenarios yet. Falling back to ID keeps links functional without blocking on content completeness.

### No pagination

- **Options:** Paginated lists vs. load all items
- **Chosen:** Load all items
- **Rationale:** FIRC courses have a bounded number of scenarios and modules (likely under 50 total). Pagination adds complexity with no practical benefit at this scale.

### Parallel data loading

- **Chosen:** `Promise.all` for independent queries in every load function
- **Rationale:** Modules and scenarios are independent queries scoped to the same release. Parallel loading reduces waterfall latency.
