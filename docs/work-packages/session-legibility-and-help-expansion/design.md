---
title: 'Design: Session Legibility and Help Expansion'
product: study
feature: session-legibility-and-help-expansion
type: design
status: unread
---

# Design: Session Legibility and Help Expansion

## Key decision 1: Markdown renderer — extend the in-house renderer, not marked / remark

[libs/utils/src/markdown.ts](../../../libs/utils/src/markdown.ts) is a 353-line bespoke renderer already used for knowledge-graph phase bodies. Adding callouts, GFM tables, external-link decoration, wikilink resolution, and Shiki integration is ~300-500 lines of additional code against a known, already-type-safe surface.

**Why not remark / unified:**

- Adds ~80KB of deps + ~40 transitive packages.
- Unified plugin API is powerful but overkill for the author-controlled content we ship. Every doc is in-repo TypeScript we trust.
- HTML escaping, whitespace handling, and wikilink substitution already work correctly in the in-house renderer. Swapping adds risk without a feature we actually need.

**Why not marked:**

- GFM tables yes, but callouts still require a plugin, and no first-party wikilink support. Once we're writing custom plugins anyway, the win shrinks.

**Chosen:** grow [libs/utils/src/markdown.ts](../../../libs/utils/src/markdown.ts) or a sibling [libs/help/src/markdown/renderer.ts](../../../libs/help/src/markdown/renderer.ts). Decision: **put the new renderer in `libs/help/`** because the additions (callouts tied to `HelpCard`, externalRefs, `[[display::id]]` resolution against the help registry) are help-library concerns. `libs/utils` stays minimal and neutral.

**Shiki integration:** load Shiki as a deferred/lazy import inside the renderer so client bundles don't ship 400KB+ of highlighter when no code block appears. First resolution per language caches a highlighter instance. For SSR (which is where help pages render at build time / load time), import sync.

```typescript
// libs/help/src/markdown/shiki.ts
let highlighterPromise: Promise<Highlighter> | null = null;

export async function highlight(code: string, lang: string): Promise<string> {
  if (lang === 'text' || !SUPPORTED_LANGS.has(lang)) {
    return escapeHtml(code);
  }
  highlighterPromise ??= createHighlighter({
    themes: ['github-light'],
    langs: Array.from(SUPPORTED_LANGS),
  });
  const h = await highlighterPromise;
  return h.codeToHtml(code, { lang, theme: 'github-light' });
}
```

Supported langs: `typescript`, `svelte`, `sql`, `bash`, `json`, `text` (passthrough).

## Key decision 2: Callouts as directive syntax, rendered via existing `HelpCard`

The existing [HelpCard.svelte](../../../libs/help/src/ui/HelpCard.svelte) already has `tip | warn | danger | howto` variants with matching tokens. Reusing it means the Markdown renderer emits component mount-points rather than inline HTML blocks.

**Two strategies considered:**

| Strategy                                                                                     | Pro                                 | Con                                                       |
| -------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| A) Renderer emits raw HTML matching `HelpCard`'s styling.                                    | No component mount; faster SSR.     | Styles duplicated. If `HelpCard` changes, callouts drift. |
| B) Renderer returns an AST; Svelte wrapper walks it and mounts `HelpCard` for callout nodes. | Single source of truth for styling. | More moving parts.                                        |

**Chosen: B**. The `MarkdownBody.svelte` component takes the body string, parses into an AST of `TextNode | HtmlNode | CalloutNode | WikilinkNode | CodeBlockNode | TableNode | FigureNode`, then renders Svelte components per node-kind with `{#each ast as node}` and a discriminating `{#if node.kind === 'callout'}` block. Keeps Svelte in the driver's seat and lets `HelpCard` evolve.

AST sketch:

```typescript
type MdNode =
  | { kind: 'heading'; level: 2 | 3 | 4; id: string; children: InlineNode[] }
  | { kind: 'paragraph'; children: InlineNode[] }
  | { kind: 'list'; ordered: boolean; items: MdNode[][] }
  | { kind: 'table'; header: InlineNode[][]; rows: InlineNode[][][]; align: ('left' | 'right' | 'center' | null)[] }
  | { kind: 'code'; lang: string; code: string; highlighted: string }  // highlighted filled during parse
  | { kind: 'blockquote'; children: MdNode[] }
  | { kind: 'callout'; variant: 'tip' | 'warn' | 'danger' | 'howto'; children: MdNode[] }
  | { kind: 'figure'; src: string; alt: string; caption: string | null }
  | { kind: 'hr' };

type InlineNode =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; children: InlineNode[] }
  | { kind: 'em'; children: InlineNode[] }
  | { kind: 'code'; value: string }
  | { kind: 'link'; href: string; external: boolean; sourceBadge?: 'wikipedia' | 'faa' | 'paper' | 'book' | 'other'; children: InlineNode[] }
  | { kind: 'wikilink'; display: string; id: string; target: 'help' | 'aviation' | 'unresolved' };
```

The renderer is async only for the Shiki pass; the rest is pure. For SSR, the load function awaits the parse and passes `{ ast }` to the page; in CSR, the component parses on mount.

## Key decision 3: `InfoTip` — Popover primitive, no external dep

No existing popover/tooltip component; none of the third-party options (floating-ui, tippy) are installed. Own the ~200 lines.

**Positioning:**

- Start: absolute, relative to trigger, below-right.
- Flip logic: after mount, measure `getBoundingClientRect()` of popover vs viewport; flip horizontally if `right > innerWidth - 8`; flip vertically if `bottom > innerHeight - 8`.
- `use:action` directive handles position recomputation on resize + scroll.

**Accessibility (WAI-ARIA tooltip vs dialog):**

Popover here is interactive (contains a link), so it cannot use `role="tooltip"` (tooltips must not be interactive). Use `role="dialog"` + `aria-modal="false"` — a non-modal dialog, which matches actual behaviour (outside clicks close, but the rest of the page remains usable).

- Trigger: `<button type="button" aria-haspopup="dialog" aria-expanded={open ? 'true' : 'false'} aria-controls={popoverId}>`
- Popover: `<div role="dialog" aria-modal="false" aria-labelledby={titleId} id={popoverId}>`
- Close button inside popover: standard button with `aria-label="Close"`.

**Focus trap:** reuse the pattern from [ConfirmAction.svelte](../../../libs/ui/src/components/ConfirmAction.svelte) — dynamic focusable discovery, tab-wrap. Extract the focus-trap helper to [libs/ui/src/lib/focus-trap.ts](../../../libs/ui/src/lib/focus-trap.ts) so `InfoTip` and `ConfirmAction` share it.

**Hover vs click:**

- Desktop: `mouseenter` opens, `mouseleave` closes — but only if the popover didn't capture focus. If user clicks the trigger, treat as "pinned" (closes on Escape / outside / explicit close).
- Touch: `click` toggles; no hover behaviour.
- Detect touch via `(hover: none)` media query for CSS; JS uses `pointer` capability.

**Size:** popover max-width `18rem`; body uses `--ab-space-sm` padding, `--ab-font-size-sm`, `--ab-line-height-normal`.

## Key decision 4: `PageHelp` — link first, drawer later

Ship Phase 1 as a styled `<a href="/help/<pageId>">?</a>` — not a drawer. Drawers demand more engineering (portal, backdrop, scroll-lock, focus trap) and the navigation path already works. Revisit in a follow-up package.

Component:

```svelte
<script lang="ts">
import { ROUTES } from '@ab/constants';
import { helpRegistry } from '@ab/help';

let { pageId, label = 'Help for this page' }: { pageId: string; label?: string } = $props();

const exists = $derived(helpRegistry.getById(pageId) !== undefined);
</script>

{#if exists}
  <a href={ROUTES.HELP_ID(pageId)} class="pagehelp" aria-label={label} title={label}>
    <span aria-hidden="true">?</span>
  </a>
{/if}
```

New route constant `ROUTES.HELP_ID(id)` = `/help/${id}` added to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts). (Check whether it already exists — if so, reuse.)

## Key decision 5: External-link badges auto-derive from `externalRefs`, not inline

Authors write external links as standard Markdown (`[FSRS-5](https://en.wikipedia.org/wiki/FSRS-5)`). The renderer marks the link "external." If the hostname matches a known source (`wikipedia.org`, `faa.gov`, `arxiv.org`, `doi.org`), the link gets a small source badge automatically; otherwise it gets a generic external-link arrow.

The `externalRefs` block on each concept page is rendered at the bottom of the page as a formatted references section (like an academic paper's "References"). Source badges appear there too.

```typescript
function sourceFromUrl(url: string): ExternalRef['source'] {
  const host = new URL(url).hostname;
  if (host.endsWith('wikipedia.org')) return 'wikipedia';
  if (host.endsWith('faa.gov')) return 'faa';
  if (host === 'arxiv.org' || host.includes('doi.org')) return 'paper';
  return 'other';
}
```

Authors pass explicit `source` in `externalRefs`; inline links infer.

## Key decision 6: `/session/start` Reason-code InfoTip strategy

13 reason codes, each with its own 1-2 sentence explanation. Two options:

| Strategy                                                                                                                     | Pro                                             | Con                                           |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| A) Each reason chip gets an `InfoTip` with its own text.                                                                     | Zero extra lookups.                             | 13 hardcoded strings co-located with chip UI. |
| B) Ship a const map `SESSION_REASON_CODE_DEFINITIONS` in [libs/constants](../../../libs/constants). `InfoTip` reads from it. | One source of truth; help page + chip share it. | Slight indirection.                           |

**Chosen: B.** Add:

```typescript
// libs/constants/src/study.ts
export const SESSION_REASON_CODE_DEFINITIONS: Record<SessionReasonCode, string> = {
  continue_recent_domain: 'This card or rep lives in a domain you studied in your last session or two. Continuing builds momentum.',
  continue_due_in_domain: 'This card is coming due and happens to be in a domain you just touched. Good overlap.',
  // …13 total…
};
```

Plus a `SESSION_REASON_CODE_SLICE: Record<SessionReasonCode, SessionSlice>` map so the session-start help page can auto-build the reason-codes table.

## Key decision 7: Build the real `/reps/<scenarioId>` detail route

No `/reps/<scenarioId>` detail route existed when this work package began. Three options were considered:

| Option                                                                                    | Pro                                                 | Con                                           |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------- |
| A) Link to `/reps/browse?scenarioId=<id>` and have the browse page scroll/focus that row. | Leverages existing route.                           | Requires browse-page change; lands on a list. |
| B) Link to `/reps/new?scenarioId=<id>` (start a new attempt).                             | Direct action.                                      | Skips the "view this scenario" intent.        |
| C) Build the real `/reps/<scenarioId>` detail route.                                      | Consistent with Card + Node IDs; proper affordance. | More code in Phase 4.                         |

**Chosen: C.** The Card and Node IDs both land on real detail pages; a fallback Rep link erodes the affordance. Minimum-viable detail page (title, domain, prompt, last-5 accuracy, last-attempt summary, "Start attempt" CTA → `/reps/new?scenarioId=<id>`, "Back to session" link) mirrors the existing memory-card and knowledge-node detail pages. Adds `ROUTES.REP_DETAIL(id)` to [libs/constants/src/routes.ts](../../../libs/constants/src/routes.ts) and a new route under [apps/study/src/routes/(app)/reps/[id]/](../../../apps/study/src/routes/(app)/reps/[id]/). BC lookup reuses `getScenarioById` from [libs/bc/study/src/](../../../libs/bc/study/src/) (or adds a thin wrapper if absent).

## Key decision 8: Legend persistence — `localStorage`, not DB

The "What am I looking at?" legend open/closed state is a UI preference with no cross-device value and no analytic worth at this stage. `localStorage` key `airboss:session-start-legend-open`, default `false`. Failing read = default collapsed.

## Schema additions

### HelpPage

```typescript
// libs/help/src/schema/help-page.ts
export interface HelpPage {
  id: string;
  title: string;
  summary: string;
  sections: readonly HelpSection[];
  tags: HelpTags;
  documents?: string;
  related?: readonly string[];
  author?: string;
  reviewedAt?: string;
  appId?: string;

  /** When true, page is a concept page indexed under /help/concepts. */
  concept?: boolean;

  /** External references rendered as a footer block. */
  externalRefs?: readonly ExternalRef[];
}
```

### ExternalRef

```typescript
// libs/help/src/schema/external-ref.ts
export type ExternalRefSource = 'wikipedia' | 'faa' | 'paper' | 'book' | 'other';

export interface ExternalRef {
  title: string;
  url: string;
  source: ExternalRefSource;
  note?: string;
}
```

### HelpTags (optional group for concept index)

```typescript
export interface HelpTags {
  appSurface: readonly AppSurface[];
  helpKind: HelpKind;  // now includes 'concept'
  aviationTopic?: readonly AviationTopic[];
  keywords?: readonly string[];

  /** When `concept === true` on the parent page, group on the concept index. */
  conceptGroup?: 'learning-science' | 'airboss-architecture' | 'aviation-doctrine';
}
```

### HelpKind enum addition

```typescript
// libs/constants — wherever HELP_KIND_VALUES is defined
export const HELP_KIND_VALUES = [
  'overview',
  'howto',
  'reference',
  'concept',  // NEW
  // ...existing values
] as const;
```

### Session reason-code definitions

```typescript
// libs/constants/src/study.ts
export const SESSION_REASON_CODE_DEFINITIONS: Record<SessionReasonCode, string> = {
  continue_recent_domain: '…',
  // 13 total
};

export const SESSION_REASON_CODE_SLICE: Record<SessionReasonCode, SessionSlice> = {
  continue_recent_domain: 'continue',
  // …
};
```

## API surface

### Help registry — no public API change

`concept` and `externalRefs` are optional fields; existing consumers unaffected. New helper:

```typescript
export function getConceptPages(): readonly HelpPage[] {
  return helpRegistry.getAllPages().filter((p) => p.concept === true);
}
```

### New route: `/help/concepts`

- Loader: reads registry, groups by `tags.conceptGroup ?? 'airboss-architecture'`.
- Page: renders grouped card grid identical in style to `/help` index.

### Markdown renderer public API

```typescript
// libs/help/src/markdown/index.ts
export interface ParseOptions {
  /** Used by wikilink resolution to decide if a target exists. */
  helpIds: ReadonlySet<string>;
  /** Used by wikilink resolution to decide if a target exists. */
  hasAviationReference: (id: string) => boolean;
}

export function parseMarkdown(body: string, opts: ParseOptions): Promise<MdAst>;
```

`MdAst` is the array of `MdNode`s defined in Key decision 2.

### Svelte component APIs

**`<MarkdownBody>`** (libs/help/src/ui/MarkdownBody.svelte):

```svelte
<script lang="ts">
let { ast }: { ast: MdAst } = $props();
</script>
```

**`<InfoTip>`** (libs/ui/src/components/InfoTip.svelte): see spec.

**`<PageHelp>`** (libs/help/src/ui/PageHelp.svelte): see spec.

## Component structure

```text
libs/ui/src/
├── components/
│   ├── InfoTip.svelte           (NEW)
│   └── ...
└── lib/
    └── focus-trap.ts            (NEW — extracted from ConfirmAction)

libs/help/src/
├── markdown/
│   ├── parser.ts                (NEW — AST parser)
│   ├── shiki.ts                 (NEW — lazy highlighter)
│   └── index.ts                 (NEW — public parseMarkdown fn)
├── schema/
│   ├── external-ref.ts          (NEW)
│   ├── help-page.ts             (UPDATED — concept?, externalRefs?)
│   └── help-tags.ts             (UPDATED — conceptGroup?)
├── ui/
│   ├── MarkdownBody.svelte      (NEW)
│   ├── ExternalRefsFooter.svelte (NEW)
│   ├── PageHelp.svelte          (NEW)
│   ├── HelpSection.svelte       (UPDATED — uses MarkdownBody)
│   └── ...
└── validation.ts                (UPDATED — externalRefs, concept, callout validation)

apps/study/src/
├── lib/help/content/
│   ├── concepts/                (NEW — 10 pages)
│   │   ├── fsrs.ts
│   │   ├── spaced-rep.ts
│   │   ├── active-recall.ts
│   │   ├── calibration.ts
│   │   ├── interleaving.ts
│   │   ├── desirable-difficulty.ts
│   │   ├── knowledge-graph.ts
│   │   ├── session-slices.ts
│   │   ├── adm-srm.ts
│   │   └── proficiency-currency.ts
│   ├── session-start.ts         (NEW)
│   └── memory-review.ts         (REWRITTEN)
└── routes/(app)/
    ├── help/concepts/
    │   ├── +page.svelte         (NEW)
    │   └── +page.ts             (NEW)
    ├── memory/review/+page.svelte (UPDATED — adds <PageHelp />)
    └── session/start/+page.svelte (UPDATED — InfoTips, clickable IDs, legend)
```

## Data flow

### Help page render (existing + new)

```text
/help/[id]/+page.ts
  -> helpRegistry.getById(id)
  -> parseMarkdown(body, { helpIds, hasAviationReference }) per section
/help/[id]/+page.svelte
  -> <HelpLayout page={page} asts={asts}>
    -> <HelpSection>
      -> <MarkdownBody ast={ast} />
    -> <ExternalRefsFooter refs={page.externalRefs} />
```

### `/session/start` render

```text
+page.server.ts  (unchanged — returns preview)
+page.svelte
  -> <PageHelp pageId="session-start" />
  -> <SessionLegend />    (collapsible, localStorage state)
  -> {#each slices}
       <h2>{label} <InfoTip term={...} helpId="concept-session-slices" helpSection={slice} /></h2>
       {#each items}
         <Badge>{kindLabel} <InfoTip .../></Badge>
         <a href={detailRoute(item)}>{idText}</a>
         <span class="reason">{reasonLabel} <InfoTip term={reasonLabel} definition={SESSION_REASON_CODE_DEFINITIONS[reasonCode]} helpId="session-start" helpSection="reason-codes" /></span>
       {/each}
     {/each}
```

### Validation run

```text
bun run check
  -> scripts/help/validate.ts  (or equivalent — check existing hook)
    -> validateHelpPages(allPages, { hasAviationReference, ...new checks })
      -> pre-existing checks
      -> NEW: validate externalRefs URLs + fields
      -> NEW: validate concept flag ↔ helpKind consistency
      -> NEW: pre-parse markdown; any :::unknown-variant = error
      -> NEW: any InfoTip-referenced helpId exists (via a separate scan step)
```

InfoTip `helpId` validation is trickier because it lives in `.svelte` files. Options:

- Runtime check in dev (console.warn). Ship Phase 1 with this.
- Static analysis pass that greps `.svelte` files for `<InfoTip ... helpId="…" />` literals and asserts against the registry. Defer to a follow-up.

## Key decisions recap

| #   | Decision                                                              | Why                                                           |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Extend in-house markdown renderer, not third-party.                   | Author-controlled content; minimal deps; already typed.       |
| 2   | Callouts as `:::variant` directives + AST + HelpCard.                 | Reuse existing component; single styling source.              |
| 3   | `InfoTip` = interactive `role="dialog"`.                              | Contains "Learn more" link; tooltip role forbids interaction. |
| 4   | `PageHelp` links to `/help/<id>`; drawer deferred.                    | Ship value fast; drawer needs more engineering.               |
| 5   | External-link badges auto from hostname + explicit in `externalRefs`. | Authors don't annotate inline links.                          |
| 6   | Reason-code definitions live in `@ab/constants`.                      | Shared by chip and help page.                                 |
| 7   | Build the real `/reps/<scenarioId>` detail route.                     | Peer affordance with Card and Node; fallback would erode it.  |
| 8   | Legend state in `localStorage`.                                       | UI preference; no cross-device value.                         |

## Risks

| Risk                                                         | Mitigation                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Markdown renderer grows beyond what's tractable to maintain. | Keep AST tiny; push anything exotic to `HelpCard` variants. Unit-test every node kind. |
| Shiki adds client bundle weight despite lazy loading.        | SSR parse the AST; ship pre-highlighted HTML strings. Client only re-hydrates.         |
| `InfoTip` density on `/session/start` feels noisy.           | `InfoTip` icon uses `--ab-color-fg-subtle`; low contrast until hover/focus.            |
| Concept pages get long and drift from app reality.           | `reviewedAt` already warns >12 months. Add to docs-review calendar.                    |
| External URLs rot.                                           | Validator rejects private IPs now; link-checker is a follow-up.                        |
| Rep detail page scope creeps beyond minimum-viable.          | Constrain to the 5 elements in Key decision 7; defer richer views to a follow-up.      |
