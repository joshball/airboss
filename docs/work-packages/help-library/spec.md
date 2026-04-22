---
title: 'Spec: Help Library'
product: study
feature: help-library
type: spec
status: unread
---

# Spec: Help Library

A shared `libs/help/` workspace that gives every airboss app the same help UX: schema-typed HelpPage content that apps register at boot, UI primitives (layout, TOC, sections, cards), and a cross-library faceted search that spans aviation references plus every registered help page. First consumer is the study app, which ships seven authored help pages covering the UX gaps flagged in the 2026-04-22 app-wide review. The library intentionally holds no aviation content of its own -- aviation data comes from `@ab/aviation` via wp-reference-system-core. This is phase 7 of the reference-system architecture: "app-specific help separated from aviation reference; search spans both."

## In Scope

- `libs/help/` workspace, package name `@ab/help`
- Schema: `HelpSection` (id, title, body, tags, related), `HelpPage` (id, title, sections, route, tags), `HelpRegistry` (in-memory registry with `registerPages(pages)`, `getAllPages()`, `getPage(id)`, `search(query, filters)`)
- UI primitives: `HelpLayout`, `HelpSection` (collapsible), `HelpTOC`, `HelpSearch` (cross-library), `HelpCard` (pull-out how-to snippets)
- `validation.ts` tag gates for help content (required axes in "Data Model" below)
- `search.ts` faceted search joining `@ab/aviation` and the help registry. Power-user query syntax (`tag:weather rules:ifr`), within-category ranking (exact-match then alias-match then keyword-match), explicit library + source-type labels on every result, no cross-category implicit ranking (per decision #4 of the architecture doc).
- `apps/study/src/lib/help/content/` with the seven authored pages listed in "Initial study content."
- `apps/study/src/lib/help/register.ts` -- called from the app root layout at boot to hand content to `@ab/help`
- Routes: `/help` index and `/help/[slug]` detail, both in the `(app)` group
- Nav entry for Help in `apps/study/src/routes/(app)/+layout.svelte`
- `ROUTES.HELP` and `ROUTES.HELP_SLUG(slug)` in `libs/constants/src/routes.ts`
- Search widget mounted in the app top nav (decision below)

## Initial study content

Seven first-pass help pages, each addressing concrete UX gaps flagged in [docs/work/reviews/2026-04-22-app-wide-ux.md](../../work/reviews/2026-04-22-app-wide-ux.md):

| Page                  | Slug                  | UX-review issues addressed                                                                                                                                                                                                             |
| --------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting started       | `getting-started`     | Login dev-accounts noise in prod (no signup path) -- help explains invite-only scope; first-time orientation so a brand-new user knows what airboss is for                                                                              |
| Dashboard             | `dashboard`           | Dashboard h1 vs nav label naming; deep-link filter chips that aren't obvious; per-panel explanations for the 9 panels (CTA, reviews-due, scheduled-reps, calibration, weak-areas, activity, cert-progress, map, study-plan)             |
| Memory review         | `memory-review`       | Review rating mistakes have no undo (explains rating semantics + that Again is not a failure); confidence slider skip weight (explains why the prompt appears ~50% of the time, per-card-per-day determinism)                           |
| Decision reps session | `reps-session`        | Confidence prompt appears random (predictability explainer); keyboard shortcuts undocumented; permanent-skip fat-finger risk (how skip sets work, how to reactivate from plan detail)                                                    |
| Calibration           | `calibration`         | Calibration page doesn't explain what calibration is once you have data; score meaning; overconfident vs underconfident patterns; what to do about a gap                                                                                 |
| Knowledge graph       | `knowledge-graph`     | `/knowledge/[slug]/learn` has no per-phase completion tracking (explains the 7 phases + dual-gate mastery so users read the stepper correctly); discovery-first pedagogy explainer                                                       |
| Keyboard shortcuts    | `keyboard-shortcuts`  | Cmd+Enter on new card undocumented; reps session `/` `[` `]` shortcuts undocumented; central reference for every kbd binding in the app                                                                                                  |

## Out of scope

- Authoring aviation glossary entries or the 175-term port (wp-reference-system-core)
- Building the source registry, extractors, CFR parser (wp-reference-extraction-pipeline)
- Implementing the wiki-link parser (wp-reference-system-core -- this WP uses `ReferenceText.svelte` from `@ab/aviation` in help-page bodies that mention references)
- Help content for future apps (spatial, audio, avionics) -- each app gets its own content folder when it exists
- Persisting "which help pages has this user seen?" state -- help is reference material, not a tracked flow
- Embedded help popovers at the point of use (in-context tooltips on dashboard panels, review buttons, etc.) -- handled by wp-reference-system-core's `ReferenceTerm` component; this WP owns the standalone `/help` surface

## Data model

All types in `libs/help/src/schema/`. No database. The registry is an in-memory singleton populated by each app's `register.ts` at boot. Help content is authored as TypeScript data files.

### HelpTags

```typescript
export interface HelpTags {
  /** Which surface this page documents. Required. Drives `app-surface` facet. */
  appSurface: AppSurface;
  /** What kind of help this is. Required. Drives the `help-kind` facet. */
  helpKind: HelpKind;
  /** Aviation topic, when the page discusses aviation content (rare for help). Optional. */
  aviationTopic?: readonly AviationTopic[];
  /** Freeform keywords for search. */
  keywords?: readonly string[];
}

export type AppSurface =
  | 'dashboard'
  | 'memory'
  | 'reps'
  | 'calibration'
  | 'knowledge'
  | 'session'
  | 'global';

export type HelpKind = 'concept' | 'how-to' | 'troubleshooting' | 'reference';
```

`aviationTopic` reuses the enum from `@ab/aviation` so the search facade can dedupe axes across libraries.

### HelpSection

```typescript
export interface HelpSection {
  /** Stable id, unique within the page. Used as anchor target. */
  id: string;
  /** Displayed heading. */
  title: string;
  /** Markdown body. May contain `[[display::id]]` wiki-links. */
  body: string;
  /** Section-level tag overrides. Inherits page tags when absent. */
  tags?: Partial<HelpTags>;
  /** Related reference ids or help page ids to render as "see also." */
  related?: readonly string[];
}
```

### HelpPage

```typescript
export interface HelpPage {
  /** Stable id. Matches the route slug. */
  id: string;
  /** Page title -- shown in TOC, nav, and search results. */
  title: string;
  /** One-line summary for search snippets + index cards. */
  summary: string;
  /** Ordered sections. First section renders without a heading on the page. */
  sections: readonly HelpSection[];
  /** Page-level tags. Every required axis must be present. */
  tags: HelpTags;
  /** The in-app route this page documents (deep-link target). Optional. */
  documents?: string;
}
```

### HelpRegistry

```typescript
export interface HelpRegistry {
  registerPages(pages: readonly HelpPage[]): void;
  getAllPages(): readonly HelpPage[];
  getPage(id: string): HelpPage | undefined;
  search(query: string, filters?: SearchFilters): SearchResults;
}
```

## Behavior

### Registration at boot

Each app's `src/lib/help/register.ts` imports `@ab/help`'s registry singleton and calls `registerPages(studyHelpPages)` once from the root `+layout.ts` (or equivalent module-init path). Registration is idempotent: re-registering the same page id replaces the prior entry. Unregistered content is invisible to search and to the `/help` route (the `/help` index enumerates `getAllPages()`).

### Search flow

1. User focuses the search widget (top nav) or presses `/`.
2. Widget parses the query string into structured filters plus a free-text term (see design.md for grammar).
3. `@ab/help`'s `search()` calls `@ab/aviation`'s `search()` and its own internal index in parallel, then merges results grouped by library.
4. Each result carries `{ library: 'aviation' | 'help', sourceType, id, title, snippet }`.
5. Within a library group, results rank by exact-match on display name or alias, then alias-match, then keyword/body match. No implicit ranking across libraries.
6. UI renders results as two collapsible sections (aviation, help) with explicit library + source-type labels. Filters narrow by library, source-type, or tag axis.
7. Keyboard: `/` focuses, `[` and `]` jump between library sections, `Enter` activates the focused result, `Escape` closes.

### Route load strategy

`/help` index loads `getAllPages()` on the server and renders a grouped list (grouped by `appSurface`). `/help/[slug]` loads `getPage(slug)` on the server and 404s when missing. Both routes are read-only; no form actions.

### Help page render

`HelpLayout` takes a `HelpPage`, emits a `<nav>` TOC built from sections, renders each section through `HelpSection`, and embeds `HelpSearch` in the page sidebar for on-page search. Markdown bodies pipe through `@ab/aviation`'s `ReferenceText.svelte` so `[[display::id]]` wiki-links resolve to the aviation glossary inline.

## Validation

Build-time gates in `libs/help/src/validation.ts`, invoked from `bun run check`:

- Every `HelpPage` has all required tag axes (`appSurface`, `helpKind`).
- Every `HelpSection.id` is unique within its page.
- Every `HelpPage.id` is unique across the registered set.
- Every wiki-link target in any section body resolves to a known reference id in `@ab/aviation`'s registry (enforced by the scanner from wp-reference-system-core; this WP just depends on the scanner running).
- `HelpPage.documents`, when present, is a string that starts with `/` (a route path).
- `related[]` entries, when present, resolve to either a registered help-page id or an aviation reference id.

## Dependencies

- `@ab/aviation` from wp-reference-system-core for: `ReferenceText.svelte` (wiki-link rendering in bodies), the aviation registry (search), the `AviationTopic` enum (shared tag axis), and the wiki-link scanner hook (validation).
- `@ab/constants` for route constants.
- `@ab/ui` once it lands -- currently `libs/ui/` has one component, so the UI primitives in this WP live in `libs/help/src/ui/` and will migrate to `@ab/ui` if general-purpose patterns emerge.

## Open items

1. **Content file shape.** Recommend TypeScript with a `body: string` field carrying markdown (ratifies the architecture doc's recommendation). Gates run on the TS wrapper, authoring is markdown. Design.md has an authoring example.
2. **Search widget placement.** Top nav permanent search box vs. Cmd+K command palette. See design.md for the decision and its rationale -- ships as top-nav button + Cmd+K palette (both paths, same component), because the UX review flagged discoverability problems that argue against a hidden-by-default invocation.
3. **Tooltip behavior on wiki-links inside help pages.** Same as aviation: hover-popover desktop, tap touch, focus-visible for a11y. Inherited from wp-reference-system-core's `ReferenceTerm` -- this WP does not override.
