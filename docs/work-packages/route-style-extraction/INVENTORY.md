# Adoption inventory -- PageHeader / EmptyState / ScoreCard

Snapshot taken 2026-04-29 against current `worktree-agent-a698fc578d98d6448`. Listed sites are the ones that hand-roll a primitive's shape after PR #315. "Mechanical" = drop-in (rewire markup, delete the now-dead local style block). "Skip" = the local layout has bespoke chrome that the primitive's API does not express; documented as residual.

## PageHeader

| Route                                                     | Status      | Notes                                                                                                                                                  |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/study/src/routes/(app)/dashboard/+page.svelte        | Mechanical  | Imports PageHeader but does not use it; hand-rolled `<header class="hd">` with eyebrow + title + sub. Uses `titleSuffix` for PageHelp + sub via snippet |
| apps/study/src/routes/(app)/handbooks/+page.svelte        | Mechanical  | `<header class="page-header">` with h1 + p; clean fit                                                                                                  |
| apps/study/src/routes/(app)/handbooks/[doc]/+page.svelte  | Mechanical  | breadcrumb (eyebrow snippet) + title with edition badge (titleSuffix) + counts (subtitle)                                                              |
| apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/+page.svelte             | Mechanical  | Same shape as above; locator -> subtitle                                                                                                               |
| apps/study/src/routes/(app)/handbooks/[doc]/[chapter]/[section]/+page.svelte   | Skip        | Has an `AmendmentPanel` after the locator; PageHeader cannot host arbitrary post-subtitle blocks. Could refactor but would push the panel out of header context. Documented as residual. |
| apps/study/src/routes/(app)/memory/[id]/+page.svelte      | Skip        | Header has back-link + title-row + `<div class="badges">` block under it, with badges that include InfoTip pop-overs. PageHeader has no slot for under-subtitle structured badges; `actions` slot is right-aligned, not below. Documented as residual. |
| apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte | Skip | Custom counter + jump button + share button, not a title at all. Bespoke session-runner chrome, not a page header. Skip per the seed-PR "pages with extra chrome keep bespoke headers" rule. |
| apps/study/src/routes/(app)/references/[id]/+page.svelte  | Mechanical  | h1 + `.sub` row of two badges; subtitle snippet fits                                                                                                   |
| apps/study/src/routes/(app)/glossary/[id]/+page.svelte    | Mechanical  | h1 + id badge; subtitle snippet                                                                                                                        |
| apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte | Skip        | Title-row + multiple rows of structured badges (domain, cross-domain, lifecycle, depth, stability, types). No subtitle slot fits; would lose the structured `<div class="tags">` semantics. Documented as residual. |
| apps/study/src/routes/(app)/reps/[id]/+page.svelte        | Skip        | Title-row + `<dl class="meta">` definition list; PageHeader subtitle is for prose, not a dl. Documented as residual.                                  |
| apps/study/src/routes/cards/[id]/+page.svelte             | Skip        | Two badge spans only, no h1, no subtitle. Not a page-header shape; this is per-card chrome inside an inner layout. Skip.                              |
| apps/study/src/routes/login/+page.svelte                  | Skip        | "airboss / study" wordmark inside auth card; not a route page header. Skip.                                                                            |
| apps/study/src/routes/(dev)/references/+page.svelte       | Skip        | Header includes a tab nav (`mode-nav`) under the lede. PageHeader has no slot for a sub-nav strip. Documented as residual. |
| apps/sim/src/routes/+page.svelte                          | Mechanical  | h1 + subtitle, clean fit                                                                                                                               |
| apps/sim/src/routes/[scenarioId]/+page.svelte             | Skip        | Cockpit chrome: back-link + title + ScenarioSurfaceNav + auto-coord toggle + pause icon button. Bespoke runner chrome, not a page header. Skip.       |
| apps/sim/src/routes/[scenarioId]/horizon/+page.svelte     | Skip        | Same family as cockpit -- back link + title + ScenarioSurfaceNav. Surface nav is structurally below the title; PageHeader cannot host it cleanly. Skip. |
| apps/sim/src/routes/[scenarioId]/window/+page.svelte      | Skip        | Same as horizon                                                                                                                                       |
| apps/sim/src/routes/[scenarioId]/dual/+page.svelte        | Skip        | Same as horizon                                                                                                                                       |
| apps/sim/src/routes/[scenarioId]/debrief/+page.svelte     | Skip        | back-link + title; semantically similar to scenario chrome; keep grouped with sim runner. Skip.                                                       |
| apps/sim/src/routes/history/+page.svelte                  | Mechanical  | h1 + subtitle                                                                                                                                         |
| apps/sim/src/routes/history/[attemptId]/+page.svelte      | Skip        | h1 + meta paragraph holding a Badge + reason text. Not prose subtitle; the badge is structural. Skip.                                                 |
| apps/sim/src/routes/_dev/instruments/+page.svelte         | Skip        | Dev-only debug surface, header includes inline `<select>` for fault picker. Not adopted.                                                              |
| apps/hangar/src/routes/(app)/+page.svelte                 | Mechanical  | h1 + sub                                                                                                                                              |
| apps/hangar/src/routes/(app)/admin/audit-ping/+page.svelte | Mechanical | h1 + sub paragraph with code spans -> subtitleSnippet                                                                                                  |
| apps/hangar/src/routes/(app)/users/+page.svelte           | Mechanical  | h1 + sub                                                                                                                                              |
| apps/hangar/src/routes/(app)/users/[id]/+page.svelte      | Skip        | identity block + email mono + role pill + banned badge in `.badges`. Structural badges; same pattern as memory/[id]. Documented as residual.          |
| apps/hangar/src/routes/(app)/sources/+page.svelte         | Mechanical  | h1 + sub                                                                                                                                              |
| apps/hangar/src/routes/(app)/sources/[id]/+page.svelte    | Skip        | h1 (id mono) + title + actions row with 4 forms; PageHeader actions is fine but the source-id-as-h1 + title-as-subtitle inversion is unusual. Could fit but worth a closer look in dashboard refresh. Documented as residual. |
| apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte | Mechanical | h1 + sub + actions slot (two form Buttons)                                                                                                            |
| apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte | Mechanical | h1 + sub paragraph with code + count spans -> subtitleSnippet                                                                                         |
| apps/hangar/src/routes/(app)/sources/[id]/upload/+page.svelte | Mechanical | h1 + sub paragraph -> subtitleSnippet                                                                                                                 |
| apps/hangar/src/routes/(app)/glossary/+page.svelte        | Mechanical  | h1 + sub + actions row (link + sync form)                                                                                                             |
| apps/hangar/src/routes/(app)/glossary/new/+page.svelte    | Mechanical  | h1 + sub paragraph (back link) -> subtitleSnippet                                                                                                     |
| apps/hangar/src/routes/(app)/glossary/sources/+page.svelte | Mechanical | h1 + sub + actions row                                                                                                                                |
| apps/hangar/src/routes/(app)/glossary/sources/new/+page.svelte | Mechanical | h1 + sub paragraph (back link) -> subtitleSnippet                                                                                                  |
| apps/hangar/src/routes/(app)/glossary/sources/[id]/+page.svelte | Skip   | Crumb paragraph + h1 + meta row of badges + mono rev + muted spans. Same family as memory/[id]. Documented as residual.                                |
| apps/hangar/src/routes/(app)/glossary/[id]/+page.svelte   | Skip        | Same as glossary/sources/[id]                                                                                                                         |
| apps/hangar/src/routes/(app)/jobs/+page.svelte            | Mechanical  | h1 + sub                                                                                                                                              |
| apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte       | Skip        | crumbs + mono h1 + meta strip with status chip + multiple muted spans. Documented as residual.                                                        |
| apps/hangar/src/routes/login/+page.svelte                 | Skip        | Same as study login -- wordmark inside auth card, not a route page header                                                                              |
| apps/avionics/src/routes/+page.svelte                     | Mechanical  | h1 + subtitle                                                                                                                                         |
| apps/avionics/src/routes/+layout.svelte                   | Skip        | Chrome: brand + theme picker. Not a page header                                                                                                       |
| apps/avionics/src/routes/scan/+page.svelte                | Mechanical  | h1 + subtitle                                                                                                                                         |
| apps/avionics/src/routes/aircraft/+page.svelte            | Mechanical  | h1 + subtitle                                                                                                                                         |
| apps/avionics/src/routes/mfd/+page.svelte                 | Mechanical  | h1 + subtitle                                                                                                                                         |

## EmptyState

| Route                                                     | Status      | Notes                                                                                                                                                  |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| apps/study/src/routes/(app)/handbooks/+page.svelte        | Mechanical  | `<div class="empty">` with paragraph + dev-hint paragraph. Use bodySnippet                                                                              |
| apps/study/src/routes/(app)/handbooks/[doc]/+page.svelte  | Mechanical  | `<p class="empty">` one-liner. Use body string                                                                                                         |
| apps/study/src/routes/(app)/knowledge/+page.svelte        | Mechanical  | `<div class="empty">` filter-aware copy + clear-filters link OR seed hint. bodySnippet + actions when filters active                                  |
| apps/study/src/routes/(app)/session/start/+page.svelte    | Mechanical  | `<article class="empty">` "Nothing to study yet" + two CTAs                                                                                            |
| apps/sim/src/routes/+page.svelte                          | Mechanical  | `<p class="empty">` -- wrap in EmptyState                                                                                                              |
| apps/sim/src/routes/[scenarioId]/debrief/+page.svelte     | Mechanical  | Two `<section class="empty" role="status">` blocks: "No flight on record" with action button, and "No frames recorded"                                |
| apps/sim/src/routes/history/+page.svelte                  | Mechanical  | `<section class="empty">` paragraph + cta link -> EmptyState with action                                                                              |
| apps/sim/src/routes/history/[attemptId]/+page.svelte      | Mechanical  | `<p class="empty">` -- wrap                                                                                                                            |
| apps/hangar/src/routes/(app)/admin/audit-ping/+page.svelte | Mechanical | `<p class="empty">` one-liner with code span -> bodySnippet                                                                                            |
| apps/hangar/src/routes/(app)/users/+page.svelte           | Mechanical  | `<p class="empty">` filter-aware -> bodySnippet                                                                                                       |
| apps/hangar/src/routes/(app)/users/[id]/+page.svelte      | Mechanical  | Two `<p class="empty">` one-liners (sessions, audits)                                                                                                  |
| apps/hangar/src/routes/(app)/sources/+page.svelte         | Mechanical  | `<p class="empty">` one-liner                                                                                                                         |
| apps/hangar/src/routes/(app)/sources/[id]/+page.svelte    | Mechanical  | `<p class="empty">` one-liner                                                                                                                         |
| apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte | Mechanical | `<p class="empty">` one-liner                                                                                                                         |
| apps/hangar/src/routes/(app)/sources/[id]/files/+page.svelte | Mechanical | `<p class="empty">` rich -> bodySnippet                                                                                                                |
| apps/hangar/src/routes/(app)/glossary/+page.svelte        | Mechanical  | `<p class="empty">` filter-aware with link -> bodySnippet                                                                                              |
| apps/hangar/src/routes/(app)/glossary/sources/+page.svelte | Mechanical | `<p class="empty">` filter-aware with link -> bodySnippet                                                                                              |
| apps/hangar/src/routes/(app)/jobs/+page.svelte            | Mechanical  | `<p class="empty">` filter-aware with link -> bodySnippet                                                                                              |
| apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte       | Skip        | `<p class="empty">No log lines yet.</p>` is a list-empty inside a streaming log component; deferring to keep the log row layout intact. Tiny, single-line; trivial residual. |

## ScoreCard

| Site                                                                       | Status      | Notes                                                                                                                                                                  |
| -------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/study/src/routes/(app)/dashboard/_panels/CalibrationPanel.svelte      | Skip        | Bespoke mono numeric + "/ 100" unit + over/underconfident gap line. ScoreCard's `value` + `unit` would render but typography (mono + heading-1) and the secondary gap paragraph are panel-specific. Documented as residual. |
| apps/study/src/routes/(app)/dashboard/_panels/CtaPanel.svelte              | Skip        | dl with 3 stats (due / done / streak), not a single hero stat. Outside ScoreCard's API.                                                                                |
| apps/study/src/routes/(app)/dashboard/_panels/* (other panels)             | Skip        | All multi-stat panels with `dl` rows or list mastery bars. None are single-big-stat blocks.                                                                            |

## Summary

- **PageHeader mechanical:** 26 routes (3 study + 4 hangar app pages + 1 study handbook list + 4 avionics + 3 sim + ...). [Final count tallied after migrations land.]
- **EmptyState mechanical:** 19 sites
- **ScoreCard mechanical:** 0 -- no remaining single-big-stat hand-roll outside the seed-migrated calibration page

## Residuals (kept-deferred trigger material)

PageHeader does not currently expose:

- a slot for structured badge / dl meta blocks **below** the subtitle (memory/[id], reps/[id], knowledge/[slug], hangar users/[id], glossary/[id], glossary/sources/[id], hangar sources/[id], jobs/[id])
- a slot for a sub-nav strip below the title (handbooks/[doc]/[chapter]/[section] amendments panel; sim scenario surface nav; (dev)/references mode-nav)
- bespoke runner chrome (memory/review session counter, sim scenario cockpit/horizon/window/dual)

These are real residual scope. They want either a `meta` snippet on PageHeader (to host structured badges/dl blocks) or a `subnav` slot (to host secondary navigation strips). Not in this WP -- gated on the dashboard refresh, which will exercise these shapes.

ScoreCard residuals are smaller. The dashboard CalibrationPanel could swap to ScoreCard if a `font-family-mono` size-`md` variant is added, but the gap line breaks the API. Reasonable to revisit during the dashboard refresh.
