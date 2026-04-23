---
title: 'Spec: Session Legibility and Help Expansion'
product: study
feature: session-legibility-and-help-expansion
type: spec
status: unread
---

# Spec: Session Legibility and Help Expansion

Make every piece of terminology on `/session/start` self-explanatory via inline `InfoTip` popovers and real links, and grow `@ab/help` into a polished docs-site-quality library with rich Markdown, callouts, a concept library, and a drop-in `PageHelp` affordance.

## Summary

Two initiatives shipped as one work package because they share infrastructure:

1. **Part A — `/session/start` legibility.** The page today renders cryptic labels ("core topic, unstarted," "unused domain," "NODE vs CARD vs REP") and shows ULIDs as static text. Wrap every term in an `InfoTip`, make every ID a link to its detail page, and add a collapsible "What am I looking at?" legend.
2. **Part B — Robust help system.** Today `@ab/help` resolves `[[display::id]]` wikilinks and renders bodies as pre-wrap prose. Grow it into a real docs library: rich Markdown (tables, callouts, code blocks, pull-quotes), `concept` pages with `externalRefs`, a `PageHelp` component for any route's header, a `/help/concepts` index, and ten foundational concept pages.

Part A ships on top of Part B's `InfoTip` + `PageHelp` + concept pages, so the phases are ordered Part B first.

## Data Model

No database changes. All new data lives in-memory in the help registry.

### HelpPage schema additions

Extend the existing `HelpPage` interface in [libs/help/src/schema/help-page.ts](../../../libs/help/src/schema/help-page.ts):

| Field          | Type                     | Required | Purpose                                                                                       |
| -------------- | ------------------------ | -------- | --------------------------------------------------------------------------------------------- |
| `concept`      | `boolean`                | Optional | When `true`, page is a domain-concept page (vs per-page help). Drives `/help/concepts` index. |
| `externalRefs` | `readonly ExternalRef[]` | Optional | External references (Wikipedia, FAA, papers). Auto-rendered as a references footer.           |

### New `ExternalRef` type

New file [libs/help/src/schema/external-ref.ts](../../../libs/help/src/schema/external-ref.ts):

| Field    | Type                                                   | Required | Rule                                                          |
| -------- | ------------------------------------------------------ | -------- | ------------------------------------------------------------- |
| `title`  | `string`                                               | Required | Non-empty; display label.                                     |
| `url`    | `string`                                               | Required | Absolute http(s) URL; no `localhost` / private IPs.           |
| `source` | `'wikipedia' \| 'faa' \| 'paper' \| 'book' \| 'other'` | Required | Drives the source badge + styling.                            |
| `note`   | `string`                                               | Optional | One-line context ("See §5 for rating semantics"). Plain text. |

### New `HelpKind` value

Extend `HelpKind` enum (currently defined in [libs/constants](../../../libs/constants/) per the help schema) to include `'concept'`. A concept page declares both `helpKind: 'concept'` and `concept: true`. Both fields are retained intentionally: the boolean makes index queries trivial (`pages.filter(p => p.concept)`) and `helpKind` keeps search-facet coverage uniform with other kinds. Validator enforces they agree.

## Behavior

### Part B.1 — Rich Markdown rendering

Replace the current "body as pre-wrap prose plus wikilink substitution" rendering with a real Markdown renderer that supports:

| Feature              | Syntax                                            | Output                                                                                                                 |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Headings h2-h4       | `##`, `###`, `####`                               | Semantic `<h2>`-`<h4>` with anchor ids for TOC scroll tracking.                                                        |
| Paragraphs           | Blank-line-separated blocks                       | `<p>` with token-driven line-height.                                                                                   |
| Bold / italic / code | `**b**`, `*i*`, `` `c` ``                         | `<strong>`, `<em>`, `<code>`.                                                                                          |
| Ordered / unordered  | `1.`, `-`                                         | `<ol>` / `<ul>` with proper spacing; nested to 2 levels.                                                               |
| Tables               | GFM pipe tables                                   | `<table>` with aligned columns, header row styled, responsive horizontal scroll on mobile.                             |
| Fenced code          | ```` ```lang ````                                 | `<pre><code class="language-lang">` with Shiki-rendered tokens (typescript, sql, bash, text).                          |
| Blockquotes          | `> text`                                          | Styled pull-quote with left border + muted bg.                                                                         |
| Callouts             | `:::note / :::tip / :::warn / :::example ... :::` | Directive-style block rendered via existing [HelpCard.svelte](../../../libs/help/src/ui/HelpCard.svelte). Icon + tone. |
| Wikilinks            | `[[display::id]]`                                 | Resolves against help + aviation registries. Unresolved = render warning in dev, plain text in prod.                   |
| External links       | `[text](https://…)`                               | `<a>` with external-link icon suffix; wiki/FAA/paper sources get source badge.                                         |
| Figures              | `![alt](src "caption")`                           | `<figure><img /><figcaption /></figure>`.                                                                              |

Renderer lives at [libs/help/src/ui/MarkdownBody.svelte](../../../libs/help/src/ui/MarkdownBody.svelte). The existing [ReferenceText.svelte](../../../libs/aviation/src/ui/ReferenceText.svelte) stays scoped to glossary snippet rendering; help uses the new component.

### Part B.2 — Callout syntax

Fenced directive blocks:

```text
:::note
Study sessions pull from four slices. Weights come from your current mode.
:::

:::tip
Use **Cmd+K** to open the search palette from anywhere.
:::

:::warn
A card in **relearning** state always ranks high in Strengthen.
:::

:::example
After rating a card `Again`, it enters relearning. Its next appearance is within the same session slice.
:::
```

Each callout maps to a `HelpCard` variant (`tip` / `warn` / `danger` / `howto`). `:::note` = default/tip; `:::warn` = warn; `:::example` = howto; `:::danger` reserved.

### Part B.3 — `PageHelp` component

New [libs/help/src/ui/PageHelp.svelte](../../../libs/help/src/ui/PageHelp.svelte) — drop into any route header:

```svelte
<PageHelp pageId="memory-review" />
```

Behavior:

- Renders a small circled `?` button sized to align with page `<h1>` baseline.
- Clicking: navigates to `/help/<pageId>`. (Phase 1 ships with navigation. A drawer overlay is out of scope for this work package.)
- If the `pageId` does not resolve, the component renders nothing in prod and a dev-only warning in the console. Never throws.
- Keyboard: standard button focus ring; Enter activates.
- Optional `label?: string` prop overrides the default "Help for this page" accessible name.

### Part B.4 — `InfoTip` component

New [libs/ui/src/components/InfoTip.svelte](../../../libs/ui/src/components/InfoTip.svelte) — inline term annotation:

```svelte
<h2>Strengthen <InfoTip term="Strengthen" definition="Cards and reps the engine thinks you're losing." helpId="memory-review" helpSection="strengthen" /></h2>
```

Props:

| Prop          | Type         | Required | Notes                                                                                           |
| ------------- | ------------ | -------- | ----------------------------------------------------------------------------------------------- |
| `term`        | `string`     | Required | Accessible label ("More about: Strengthen").                                                    |
| `definition`  | `string`     | Required | 1-2 sentence plain-text definition rendered in popover.                                         |
| `helpId`      | `string`     | Optional | If set, popover shows a "Learn more" link to `/help/<helpId>` (with optional `#<helpSection>`). |
| `helpSection` | `string`     | Optional | Section anchor on the help page.                                                                |
| `size`        | `'sm'\|'md'` | Optional | Default `'sm'`. Icon sizing only; popover unaffected.                                           |

Behavior:

- Renders an inline `?` icon button, tokenised, next to the term.
- Hover, focus, or tap toggles the popover open. Second interaction, Escape, or outside-click closes it.
- Popover is absolutely positioned, auto-flips when near viewport edge.
- Keyboard: `Tab` focuses the trigger; `Enter` / `Space` opens; `Escape` closes and returns focus to trigger.
- Focus trap inside popover while open (trigger, "Learn more" link, close `X`).
- Touch: tap opens; tap outside closes. No hover-only behaviour.
- Tokens: uses `--ab-color-surface-raised`, `--ab-color-border`, `--ab-shadow-lg`, `--ab-focus-ring`. No hex.
- Renders correctly inline in headings, `Badge` components, table cells, and paragraphs (inline-flex).

### Part B.5 — Concept library

Author 10 concept pages under [apps/study/src/lib/help/content/concepts/](../../../apps/study/src/lib/help/content/concepts/):

| id                        | Title                   | External refs anchors                                                   |
| ------------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `concept-fsrs`            | FSRS-5                  | Wikipedia FSRS, Open Spaced Repetition paper, Jarrett Ye blog.          |
| `concept-spaced-rep`      | Spaced repetition       | Wikipedia spaced repetition, Ebbinghaus forgetting curve.               |
| `concept-active-recall`   | Active recall           | Wikipedia active recall, Karpicke & Roediger testing effect paper.      |
| `concept-calibration`     | Calibration             | Kahneman & Tversky overconfidence, FAA ADM handbook on self-assessment. |
| `concept-interleaving`    | Interleaving            | Rohrer & Taylor interleaving studies.                                   |
| `concept-desirable-diff`  | Desirable difficulty    | Bjork's desirable difficulties.                                         |
| `concept-knowledge-graph` | Knowledge graph         | Links back to in-app ADR 011.                                           |
| `concept-session-slices`  | Session slices          | Internal concept; links to engine docs.                                 |
| `concept-adm-srm`         | ADM and SRM             | FAA-H-8083-25C ADM chapter, FAA Risk Management Handbook.               |
| `concept-prof-currency`   | Proficiency vs currency | FAR 61.57 currency, AC 120-71 on proficiency training.                  |

Each page:

- `concept: true`, `helpKind: 'concept'`, `tags.appSurface: ['study']` (primary), `tags.keywords` populated.
- Lede paragraph (first section, no heading).
- 2-5 substantive sections using callouts, tables, and cross-links to other concept pages via `[[display::concept-*]]`.
- `externalRefs` block with 2-6 entries.
- `related` array cross-linking other concept pages and per-page pages.
- `reviewedAt` set to today.

### Part B.6 — `memory-review` per-page help rebuild

Rewrite [apps/study/src/lib/help/content/memory-review.ts](../../../apps/study/src/lib/help/content/memory-review.ts) using the new pattern:

- Sections use callouts and tables generously.
- Cross-links to `concept-fsrs`, `concept-active-recall`, `concept-calibration`, `concept-spaced-rep`.
- `externalRefs` block with Wikipedia FSRS, OSR paper, relevant FAA handbook chapter.
- Drop `<PageHelp pageId="memory-review" />` in the `/memory/review` route header.

### Part B.7 — `/help/concepts` index route

New route [apps/study/src/routes/(app)/help/concepts/+page.svelte](../../../apps/study/src/routes/(app)/help/concepts/+page.svelte) + `+page.ts`:

- Server/static load calls `helpRegistry.getAllPages()` and filters `concept === true`.
- Renders concept pages grouped alphabetically or by theme (learning-science vs aviation-doctrine — authors tag via an optional `conceptGroup?: string` field on `HelpTags`). Group assignment:

| Group                | Pages                                                                      |
| -------------------- | -------------------------------------------------------------------------- |
| Learning science     | fsrs, spaced-rep, active-recall, interleaving, desirable-diff, calibration |
| Airboss architecture | knowledge-graph, session-slices                                            |
| Aviation doctrine    | adm-srm, prof-currency                                                     |

- Nav: convert the existing "Help" nav entry into a dropdown with two items — **Help index** → `/help`, **Concepts** → `/help/concepts`. Dropdown opens on hover + focus + click, closes on blur/Escape, keyboard-navigable. Reuses whatever nav pattern exists in [apps/study/src/lib/nav/](../../../apps/study/src/lib/nav/); if no dropdown primitive exists, build one consistent with `InfoTip`'s popover pattern (smaller scope, same a11y rules).

### Part B.8 — Validation additions

Extend [libs/help/src/validation.ts](../../../libs/help/src/validation.ts):

| Check                                                                | Severity |
| -------------------------------------------------------------------- | -------- |
| `externalRefs[].url` is absolute http(s).                            | Error    |
| `externalRefs[].url` is not `localhost` / `127.*` / `::1` / RFC1918. | Error    |
| `externalRefs[].title` non-empty.                                    | Error    |
| `externalRefs[].source` is an enum member.                           | Error    |
| If `concept === true`, `helpKind === 'concept'`.                     | Error    |
| If `concept === true`, `externalRefs.length >= 1`.                   | Warning  |
| Callout syntax (`:::foo`) uses known variant.                        | Error    |

### Part A.1 — `/session/start` InfoTip wiring

In [apps/study/src/routes/(app)/session/start/+page.svelte](../../../apps/study/src/routes/(app)/session/start/+page.svelte):

| Element                                     | InfoTip term      | Help target                                                                                                     |
| ------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Slice heading "Continue where you left off" | Continue          | `concept-session-slices#continue`                                                                               |
| Slice heading "Strengthen"                  | Strengthen        | `concept-session-slices#strengthen`                                                                             |
| Slice heading "Expand"                      | Expand            | `concept-session-slices#expand`                                                                                 |
| Slice heading "Diversify"                   | Diversify         | `concept-session-slices#diversify`                                                                              |
| Kind badge "Card"                           | Card              | `memory-review#what-is-a-card`                                                                                  |
| Kind badge "Rep"                            | Rep               | `reps-session#what-is-a-rep`                                                                                    |
| Kind badge "Node"                           | Node              | `knowledge-graph#what-is-a-node`                                                                                |
| Reason chip (per code)                      | Reason code label | `session-start#reason-codes` with `?reason=<code>` hash-param the help page reads to highlight the relevant row |
| Domain label (e.g., "Weather")              | Domain name       | `session-start#domains`                                                                                         |
| "Core topic, unstarted" phrase              | Priority: core    | `session-start#priorities`                                                                                      |
| "Unused domain" phrase                      | Diversify trigger | `concept-session-slices#diversify`                                                                              |

### Part A.2 — Preview row IDs become links

In `renderItem`-equivalent section of `+page.svelte`:

| Kind         | Route                 | Route constant                                                |
| ------------ | --------------------- | ------------------------------------------------------------- |
| `card`       | `/memory/<cardId>`    | `ROUTES.MEMORY_CARD(cardId)`                                  |
| `node_start` | `/knowledge/<nodeId>` | `ROUTES.KNOWLEDGE_SLUG(nodeId)`                               |
| `rep`        | `/reps/<scenarioId>`  | `ROUTES.REP_DETAIL(scenarioId)` — new route added in Phase 4. |

### Part A.3 — Collapsible legend

Add a `<details>`-backed legend at the top of the preview:

- Summary text: "What am I looking at?"
- Expanded contents: a labelled diagram (text-based SVG or HTML flow) showing one slice with callouts explaining: slice heading, kind badge, reason chip, ID, preview count. A "Read the full guide" button linking to `/help/session-start`.
- Collapsed by default. Open state persisted to `localStorage` as `airboss:session-start-legend-open`.

### Part A.4 — `session-start` help page

New [apps/study/src/lib/help/content/session-start.ts](../../../apps/study/src/lib/help/content/session-start.ts):

- Sections: "What `/session/start` shows you", "Slices", "Kinds", "Reason codes", "Priorities", "Domains", "Modes and weights".
- Reason-codes section is a table with every `SessionReasonCode`, its label, which slice it belongs to, and a plain-English explanation.
- Cross-links to all relevant concept pages.
- `externalRefs` minimal (mostly internal).
- Drops `<PageHelp pageId="session-start" />` in `/session/start` route header.

## Validation

| Field / input                    | Rule                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `HelpPage.concept`               | Boolean; if true requires `helpKind === 'concept'`.                                            |
| `HelpPage.externalRefs[].url`    | Matches `^https?://`; hostname not in `{localhost, 127.*, ::1, 10.*, 192.168.*, 172.16-31.*}`. |
| `HelpPage.externalRefs[].title`  | Non-empty, trimmed length 1-120.                                                               |
| `HelpPage.externalRefs[].source` | One of `'wikipedia' \| 'faa' \| 'paper' \| 'book' \| 'other'`.                                 |
| `HelpPage.externalRefs[].note`   | Optional, trimmed length 0-200.                                                                |
| Callout directive variant        | One of `note \| tip \| warn \| example \| danger`. Unknown = build error.                      |
| Markdown fenced code `lang`      | One of supported Shiki langs OR `text` (unstyled). Unknown = build warning.                    |
| `InfoTip.term`                   | Non-empty string.                                                                              |
| `InfoTip.helpId`                 | Optional; when present must resolve in help registry at build time (validated via new test).   |
| `PageHelp.pageId`                | Runtime-only: when unresolved, render nothing + dev console warning.                           |

## Edge Cases

| Case                                                                | Behaviour                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| User on mobile taps an `InfoTip` in a badge near the viewport edge. | Popover auto-flips to fit viewport; max-width 18rem; caret aligns.                                                                   |
| `InfoTip.helpId` points to a page that later gets deleted.          | Build-time check in validator catches it. Runtime render: popover hides "Learn more".                                                |
| Rendered Markdown has unsupported syntax (e.g., HTML tag).          | Strip/escape; never inject raw HTML. Log a dev warning once per offending page.                                                      |
| Callout block is never closed (`:::note` without `:::`).            | Build error from the renderer-validator pre-pass.                                                                                    |
| `externalRefs` URL is http (not https).                             | Warning in dev; shipped. (Some FAA PDF mirrors are still http.)                                                                      |
| Wikilink target deleted after page authored.                        | Build error (existing behaviour; extends to concept pages).                                                                          |
| `PageHelp` rendered on a route with no matching page.               | Component returns `null`; dev warning; never blocks render.                                                                          |
| Legend `localStorage` read fails (disabled, quota).                 | Default to collapsed; no throw.                                                                                                      |
| Session preview has zero rows in a slice.                           | Slice heading still renders with its `InfoTip`; body shows existing empty state.                                                     |
| Session rep item ID clicked, scenario unknown or deleted.           | Rep detail route renders a 404 with a "back to session" link; engine shouldn't surface deleted scenarios, but the page is defensive. |
| User hovers `InfoTip` then tabs away.                               | Popover closes on `focusout` unless the popover itself has focus.                                                                    |
| `prefers-reduced-motion`.                                           | Popover fade/transition uses `--ab-transition-normal` which already reduces to 0ms.                                                  |
| Help page opened via `PageHelp` on small viewport.                  | Existing `HelpLayout` collapses to single column; no additional work needed.                                                         |

## Out of Scope

- **Per-page help pages beyond `memory-review` and `session-start`.** The user adds these one by one later as requests.
- **Drawer overlay for `PageHelp`.** Phase 1 ships with navigation to `/help/<id>`. A drawer is a future enhancement.
- **Syntax-highlighted code block theming for dark/TUI.** Shiki ships a single theme here; theme-switching is a follow-up.
- **Full-text search within a help page.** Existing palette search covers cross-page search.
- **Authoring tool / preview for help pages.** Authors edit TS files directly.
- **Rep detail route `/reps/<id>`.** If the rep doesn't have a detail page today, link to `/reps/browse?scenarioId=<id>` and file a parking-lot item.
- **Engine / BC logic changes on `/session/start`.** This is presentation only.
- **Locked worktree audit** (`worktree-agent-a55453e3`).
- **`concept-*` naming convention enforcement.** Convention documented, not lint-enforced.
- **Image hosting / CDN for figures.** Figures use in-repo `static/` paths only; no external image pipeline.
- **Analytics on InfoTip opens or PageHelp clicks.** Possible future signal; not this package.
