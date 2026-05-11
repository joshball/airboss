---
id: wp-flightbag-reader-ux
title: 'Spec: WP-FLIGHTBAG-READER-UX -- chrome consolidation, /library cutover, reader prefs, overview view'
product: flightbag
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-11
owner: agent
depends_on: []
unblocks:
  - wp-flightbag-rich-reader
tags:
  - reader
  - ux
  - tokens
  - consolidation
---

# WP-FLIGHTBAG-READER-UX: chrome consolidation, library cutover, reader prefs, overview view

Make the flightbag readable as a book. Four phases:

1. **Chrome consolidation** -- every reader page through `<ReaderLayout>`, single empty state, single source-links placement, hoist heartbeat into the layout.
2. **Study `/library/*` cutover** -- retire the duplicate reader in study; redirect to flightbag.
3. **Reader pref tokens** -- font family / size / measure / density / heading-scale, scoped to `--reader-*` cascade with per-component override hatch. Site-wide pattern via `<ReadableScope>`.
4. **Overview view + persistent rail + transitions** -- handbook landing reshapes into a multi-column TOC overview, rail persists across in-doc navigation via shared layout, View Transitions for body swap, end-of-doc footer, keyboard nav.

This WP closes the structural rot identified in [docs/work/reviews/2026-05-11/flightbag-desktop-ux.md](../../work/reviews/2026-05-11/flightbag-desktop-ux.md). It does NOT add highlights, annotations, or notes integration -- those come in `wp-flightbag-rich-reader`. It does NOT add reader-side note-creation UI -- that's also `wp-flightbag-rich-reader` (which depends on `wp-notes-primitive` for the underlying components).

## Why this WP exists

The flightbag reader is functional but inconsistent. Two parallel handbook readers (study `/library/handbook` and flightbag `/handbook`) render the same content with different chrome. Six reader pages hand-roll their headers instead of using `<ReaderLayout>`. The TOC drawer pops in and out across navigation. There's no font-size / family / measure / density control on a long-form reading app -- the user has explicitly flagged this as a site-wide gap, not just flightbag.

The `wp-flightbag-book-experience` WP (in flight, status: in-flight, human_review pending) shipped phases 1-6 of book-feel additions: reading-order model, prev/up/next nav, TOC drawer, reading-time, read-state heartbeat. It did NOT consolidate the chrome that other surfaces hand-roll, did NOT retire the study `/library` duplicate, did NOT add reader prefs, did NOT solve the abrupt landing-to-reader transition. This WP fills those gaps.

## Anchors

- [docs/work/reviews/2026-05-11/flightbag-desktop-ux.md](../../work/reviews/2026-05-11/flightbag-desktop-ux.md) -- 24-issue review that triggered this WP. Sections "Plan: parent-relative reader token system" and "Plan: TOC -> reader transition" are source specs.
- [wp-flightbag-book-experience](../wp-flightbag-book-experience/spec.md) -- predecessor WP. Shipped reading-order, TOC drawer, reading-time, read-state. This WP extends and completes.
- [wp-notes-primitive](../wp-notes-primitive/spec.md) -- runs in parallel; no dependency either direction.
- [wp-flightbag-rich-reader](../wp-flightbag-rich-reader/spec.md) -- depends on this WP. Adds selection toolbar + inline composers on top of the persistent-rail layout shipped here.
- [ADR 023 -- flightbag as canonical references app](../../decisions/023-flightbag-as-canonical-references-app/decision.md) -- the architectural reason study `/library/*` should retire.
- [libs/library/src/](../../../libs/library/src/) -- reader component pack. This WP migrates every reader to use it.

## In Scope

### Phase 1: Chrome consolidation

Every reader page in `apps/flightbag/src/routes/` mounts `<ReaderLayout>`. Hand-rolled `<header class="page-header">` blocks deleted. Single source for breadcrumb placement, source-links placement, page-header spacing.

**Files migrated to `<ReaderLayout>`** (currently hand-rolled):

- `apps/flightbag/src/routes/+page.svelte` (catalog)
- `apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte` (handbook landing)
- `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/+page.svelte` (chapter; uses ReaderLayout shape inline today, doesn't import the component)
- `apps/flightbag/src/routes/aim/+page.svelte` (AIM landing)
- `apps/flightbag/src/routes/aim/[chapter]/+page.svelte`
- `apps/flightbag/src/routes/aim/[chapter]/[section]/+page.svelte`
- `apps/flightbag/src/routes/aim/[chapter]/[section]/[paragraph]/+page.svelte`
- `apps/flightbag/src/routes/cfr/[title]/[part]/+page.svelte` (already similar but standardize)
- `apps/flightbag/src/routes/cfr/[title]/[part]/[section]/+page.svelte`
- `apps/flightbag/src/routes/ac/[doc]/[rev]/+page.svelte`
- `apps/flightbag/src/routes/ac/[doc]/[rev]/[chapter]/+page.svelte`
- `apps/flightbag/src/routes/ac/[doc]/[rev]/[chapter]/[section]/+page.svelte`

**New component: `<ReaderEmptyState>` in `libs/library/`**. Props: `kind: 'sourced-only' | 'not-yet-ingested' | 'no-children'`, `localPdfHref?`, `externalUrl?`, `note?`. Replaces 4 different empty states (AIM `<p class="empty">`, CFR callout with eCFR, ACS "Sourced only" badge, handbook `<p class="empty">`).

**Heartbeat hoisted**: `<HeartbeatTicker>` moves into `<ReaderLayout>` so AIM, CFR, ACS sections feed read-state too (currently only handbook leaf sections). Component takes optional `sectionId`; layout conditionally mounts when set.

**SourceLinks placement**: standardized to the page-header eyebrow row, right-aligned. Always small, always present. Removed from `<RenderedSection>`'s breadcrumb snippet.

**Breadcrumb placement**: `<ReaderLayout>` always owns breadcrumb. `<RenderedSection>`'s `breadcrumb` snippet removed. Single source.

**Closes**: 6 of 11 majors and 3 of 7 minors from the review.

### Phase 2: Study `/library/*` cutover to flightbag

Retire the duplicate handbook reader at `apps/study/src/routes/(app)/library/`.

**301 redirects** (in `apps/study/src/routes/(app)/library/<route>/+server.ts`):

- `/library/handbook/[slug]` -> `ROUTES.FLIGHTBAG_HANDBOOK(slug, latestEdition)` (resolve latest edition server-side)
- `/library/handbook/[slug]/chapter/[n]` -> `ROUTES.FLIGHTBAG_HANDBOOK_CHAPTER(slug, latestEdition, n)`
- `/library/handbook/[slug]/chapter/[n]/section/[s]` -> `ROUTES.FLIGHTBAG_HANDBOOK_SECTION(...)`
- `/library/aircraft/[slug]` -> flightbag equivalent (when aircraft pages exist there; until then: 410 Gone with a "use FAA portal" message)
- `/library/regulations/...` -> flightbag CFR routes
- `/library/topic/[topic]` -> flightbag catalog filtered by topic
- `/library/testing/...` -> flightbag ACS routes
- `/library/advisories/...` -> flightbag AC routes

**Delete** the study `/library/<route>/+page.svelte` and `+page.server.ts` files for every route that has a flightbag equivalent. Leave the directory with `+server.ts` redirect handlers only.

**Update internal links**: grep for `ROUTES.LIBRARY_*` callers in `apps/study/src/`. Each call site flips to the flightbag equivalent. The study app's nav still has a "References" item; it now points at `ROUTES.FLIGHTBAG_HOME` (cross-app link).

**Routes constants cleanup**: `LIBRARY_HANDBOOK`, `LIBRARY_HANDBOOK_CHAPTER`, etc. become deprecated aliases (still exported, marked `@deprecated -- use FLIGHTBAG_*`). Removed in a follow-up sweep once all callers migrate.

**Closes**: critical #1.

### Phase 3: Reader pref tokens + control

**Constants additions** (`libs/constants/src/reading.ts`, new file):

```typescript
export const READING_FONT_FAMILIES = { SERIF: 'serif', SANS: 'sans', MONO: 'mono' } as const;
export const READING_FONT_FAMILY_VALUES = Object.values(READING_FONT_FAMILIES);
export type ReadingFontFamily = (typeof READING_FONT_FAMILY_VALUES)[number];
export const READING_FONT_FAMILY_DEFAULT: ReadingFontFamily = 'serif';

export const READING_FONT_SCALES = [0.85, 0.9, 1.0, 1.1, 1.25, 1.5] as const;
export type ReadingFontScale = (typeof READING_FONT_SCALES)[number];
export const READING_FONT_SCALE_DEFAULT: ReadingFontScale = 1.0;

export const READING_DENSITIES = { COMPACT: 'compact', COMFORTABLE: 'comfortable', SPACIOUS: 'spacious' } as const;
export const READING_DENSITY_VALUES = Object.values(READING_DENSITIES);
export type ReadingDensity = (typeof READING_DENSITY_VALUES)[number];
export const READING_DENSITY_DEFAULT: ReadingDensity = 'comfortable';
export const READING_DENSITY_LINE_HEIGHTS: Record<ReadingDensity, number> = {
  compact: 1.45,
  comfortable: 1.65,
  spacious: 1.85,
};

export const READING_MEASURES = { NARROW: 'narrow', NORMAL: 'normal', WIDE: 'wide' } as const;
export const READING_MEASURE_VALUES = Object.values(READING_MEASURES);
export type ReadingMeasure = (typeof READING_MEASURE_VALUES)[number];
export const READING_MEASURE_DEFAULT: ReadingMeasure = 'normal';
export const READING_MEASURE_CH: Record<ReadingMeasure, number> = { narrow: 60, normal: 72, wide: 84 };

export const READING_HEADING_SCALES = [0.9, 1.0, 1.15] as const;
export type ReadingHeadingScale = (typeof READING_HEADING_SCALES)[number];
export const READING_HEADING_SCALE_DEFAULT: ReadingHeadingScale = 1.0;
```

**`USER_PREF_KEYS` additions** (`libs/constants/src/study-home.ts`):

```typescript
READING_FONT_FAMILY:    'study.reading.font_family',
READING_FONT_SCALE:     'study.reading.font_scale',
READING_DENSITY:        'study.reading.density',
READING_MEASURE:        'study.reading.measure',
READING_HEADING_SCALE:  'study.reading.heading_scale',
```

**`USER_PREF_SCHEMAS`** (`libs/bc/study/src/user-prefs.ts`): Zod schemas for each new key validating against the closed value sets.

**`<ReadableScope>` component** (`libs/ui/components/ReadableScope.svelte` -- browser-safe). Wraps any block that should adopt the user's reading prefs. Sets `--reader-*` tokens on a wrapper div from `data.readingPrefs` (passed in from a server load).

```svelte
<script lang="ts">
import {
  READING_DENSITY_LINE_HEIGHTS,
  READING_MEASURE_CH,
  type ReadingDensity,
  type ReadingFontFamily,
  type ReadingFontScale,
  type ReadingHeadingScale,
  type ReadingMeasure,
} from '@ab/constants';
import type { Snippet } from 'svelte';

interface Props {
  fontFamily: ReadingFontFamily;
  fontScale: ReadingFontScale;
  density: ReadingDensity;
  measure: ReadingMeasure;
  headingScale: ReadingHeadingScale;
  children: Snippet;
}
let { fontFamily, fontScale, density, measure, headingScale, children }: Props = $props();

const familyVar = $derived({
  serif: 'var(--font-family-serif)',
  sans: 'var(--font-family-sans)',
  mono: 'var(--font-family-mono)',
}[fontFamily]);
</script>

<div
  class="readable-scope"
  style:--reader-body-font-family={familyVar}
  style:--reader-body-font-size={`calc(var(--font-size-base) * ${fontScale})`}
  style:--reader-body-line-height={String(READING_DENSITY_LINE_HEIGHTS[density])}
  style:--reader-measure-ch={`${READING_MEASURE_CH[measure]}ch`}
  style:--reader-heading-scale={String(headingScale)}
>
  {@render children()}
</div>
```

**Component-relative tokens** consumed by `<RenderedSection>`, `<TOCDrawer>`, etc.:

```css
.body {
  font-family: var(--reader-body-font-family, var(--font-family-base));
  font-size: var(--reader-body-font-size, var(--font-size-base));
  line-height: var(--reader-body-line-height, var(--line-height-relaxed));
  max-width: var(--reader-measure-ch, 72ch);
}
.body :global(h2) { font-size: calc(var(--reader-body-font-size, var(--font-size-base)) * 1.35 * var(--reader-heading-scale, 1)); }
.body :global(h3) { font-size: calc(var(--reader-body-font-size, var(--font-size-base)) * 1.15 * var(--reader-heading-scale, 1)); }
/* etc. */
```

**`<ReaderPrefsButton>`** (`libs/library/src/ReaderPrefsButton.svelte`). Gear icon in the reader chrome (next to ThemePicker in the AppHeader, or pinned to the TOC rail header). Opens a popover with: font-family radio (Sans / Serif / Mono), font-scale slider (5 stops), density radio (Compact / Comfortable / Spacious), measure radio (Narrow / Normal / Wide), heading-scale radio (Smaller / Normal / Larger). Mutating any control issues `POST /reading-prefs` with the new value; optimistic UI flip via the same `$state`-with-server-roundtrip pattern as `ThemePicker`.

**Server endpoint**: `apps/flightbag/src/routes/reading-prefs/+server.ts`. Accepts `{ key, value }`, validates against `USER_PREF_SCHEMAS`, writes via `setUserPref`. Mirror endpoint in `apps/study/src/routes/reading-prefs/+server.ts` (same handler, shared via `libs/auth/` or copied -- pattern decision in implementation).

**Layout integration**: `apps/flightbag/src/routes/+layout.server.ts` loads the 5 prefs from `getUserPrefs(userId, READING_PREF_KEYS)` and passes them through `data.readingPrefs`. `+layout.svelte` mounts `<ReadableScope>` around the `<main>` block. `apps/study/src/routes/(app)/+layout.svelte` does the same so the study app gets the cascade for free.

**Defaults**: serif body, scale 1.0, comfortable density, normal measure (72ch), heading-scale 1.0. Anonymous users (no session) get defaults; the prefs button is hidden for anonymous.

**Closes**: criticals #2 and #3.

### Phase 4: Overview view + persistent rail + transitions

**Shared layout**: `apps/flightbag/src/routes/handbook/[slug]/[edition]/+layout.svelte` (new file) mounts `<ReaderLayout>` once with the TOC rail. Children pages inject only the body. Rail no longer remounts on chapter / section navigation.

```svelte
<!-- handbook/[slug]/[edition]/+layout.svelte -->
<script lang="ts">
import ReaderLayout from '@ab/library/ReaderLayout.svelte';
import TOCRender from '@ab/library/TOCRender.svelte';
import type { LayoutData } from './$types';
let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<ReaderLayout>
  {#snippet tocSidebar()}
    <TOCRender mode="rail" entries={data.toc.entries} readSet={data.toc.readSet} />
  {/snippet}
  {@render children()}
</ReaderLayout>
```

`+layout.server.ts` loads the TOC once for the whole `/handbook/[slug]/[edition]/*` subtree and passes it down.

**`<TOCRender>`** (`libs/library/src/TOCRender.svelte`, new). Replaces `<TOCDrawer>` (which becomes a thin wrapper that mounts `<TOCRender mode="rail">`). Three modes:

- **`mode="overview"`**: full-width 2-3 column grid of `<ChapterTile>`. Each tile: chapter title, code, sub-section list (collapsed by default; expand on hover or click), progress ring (read / total), reading-time, "Continue here" button if this chapter contains the user's last-read section.
- **`mode="rail"`**: today's `<TOCDrawer>` shape -- 280px sticky column.
- **`mode="compact"`**: collapsed rail, only the current chapter expanded. Toggle in the chrome to switch.

**Reshape handbook landing**: `apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte` becomes the overview. Body content is `<TOCRender mode="overview" entries={...} readSet={...} />`. Heartbeat doesn't tick on the landing (no section). "Resume reading at §X.Y" pinned to the top, links to `data.lastReadSection.href` (loader queries `MAX(last_read_at)` for this user × this reference).

**View Transitions helper**: `libs/utils/src/view-transition.ts`:

```typescript
export function withViewTransition<T>(fn: () => T | Promise<T>): T | Promise<T> {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    return fn();
  }
  return document.startViewTransition(() => fn()).updateCallbackDone.then(() => fn() as T);
}
```

Wrapped around `goto(url)` in the chapter / section TOC links. Gracefully no-ops on Firefox / Safari until view-transitions ship there.

**Keyboard shortcuts** (layout level, in `+layout.svelte`'s `+layout.svelte` of the `/handbook/.../[edition]` subtree):

- `j` / `ArrowDown` -- next section in reading order
- `k` / `ArrowUp` -- previous section
- `o` -- overview view (handbook landing)
- `g` then `t` -- top of TOC drawer (Vim-style, optional)
- `?` -- cheatsheet overlay (mounts `<KeyboardCheatsheet>` lifted from `apps/sim/src/lib/panels/KeyboardCheatsheet.svelte`)

Skip when an input/textarea has focus.

**TOC auto-scroll active entry into view on mount** + on view transition (`activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' })` in an `$effect`).

**Mobile TOC auto-close on link click** -- `onnavigate` from `$app/navigation` flips `mobileOpen = false`.

**End-of-doc footer**: `<ReaderNav>` variant `end-of-doc` when `nav.next === null`. Renders: progress summary ("You've read 47 of 47 sections in PHAK -- nice"), "Mark this whole chapter as read" button, link to next handbook in cert syllabus when wired (not load-bearing; render placeholder when not).

**Same `<TOCRender>` cascade extended to AIM, CFR, ACS, AC** -- `apps/flightbag/src/routes/aim/+layout.svelte`, `cfr/[title]/[part]/+layout.svelte`, etc. Each subtree gets its own shared layout with the rail. ACS already uses `collapsibleGroups`; preserve that.

**Closes**: most majors around overview, transitions, rail-popping, plus minors around keyboard nav / scrollIntoView / auto-close.

## Out of Scope (explicit)

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md). Major exclusions:

- Highlights, card-draft anchors, selection toolbar -- `wp-flightbag-rich-reader`.
- Inline note composer in the reader -- `wp-flightbag-rich-reader` (composer reuses `<NoteComposer>` from `wp-notes-primitive`).
- Per-section notes panel in the reader -- `wp-flightbag-rich-reader`.
- Card-draft inbox at `/memory/drafts` -- `wp-flightbag-rich-reader`.
- "Render modes" (Learn / Review / Memorize) for handbook prose -- IDEAS.md row "Flightbag render modes," post-WP-3.
- Pace-aware reading-time (drop fixed 250 wpm in favor of user's heartbeat-derived pace) -- minor improvement, separate.
- Cross-handbook reading paths (curriculum) -- syllabus territory.
- Annotated PDF view -- never (we render markdown derivatives, PDF is a sibling affordance).

## Phases

### Phase 1: chrome consolidation

`<ReaderEmptyState>` shipped; every reader page through `<ReaderLayout>`; heartbeat hoisted; source-links + breadcrumb single-source.

**Done when**: visual diff vs `main` shows consistent reader chrome on every doc-type, no hand-rolled `<header class="page-header">` blocks remain in `apps/flightbag/src/routes/`, AIM and CFR sections feed read-state.

### Phase 2: study `/library/*` cutover

301 redirects landed; deleted study reader pages; internal links updated; deprecated route constants flagged.

**Done when**: hitting `/library/handbook/phak` 301s to `/handbook/phak/<latest>`; no SvelteKit page loaders remain in `apps/study/src/routes/(app)/library/handbook/`; `bun run check` clean; e2e smoke confirms the redirect chain.

### Phase 3: reader pref tokens + control

Constants + USER_PREF_KEYS + USER_PREF_SCHEMAS + `<ReadableScope>` + `<ReaderPrefsButton>` + `/reading-prefs` endpoints in flightbag and study; defaults wired in `+layout.server.ts`; `<RenderedSection>` and `<TOCDrawer>` consume `--reader-*` tokens.

**Done when**: opening `<ReaderPrefsButton>` lets me change family / scale / density / measure / heading-scale; the change persists across reload; the change applies to the reader and to the study `/study` knowledge bodies (proves the cascade is site-wide); defaults are serif, scale 1.0, comfortable, 72ch, heading 1.0.

### Phase 4: overview view + persistent rail + transitions

Shared `[edition]/+layout.svelte` with persistent rail; reshape handbook landing into `<TOCRender mode="overview">`; "Resume reading at §X.Y" pinned; view-transitions helper; keyboard nav; end-of-doc footer; same pattern extended to AIM / CFR / ACS / AC.

**Done when**: clicking from PHAK overview to §1.1 to §1.2 doesn't remount the rail; the rail's active marker animates between entries (not a hard cut); `j` / `k` / `o` work; pressing `?` shows the cheatsheet; `nav.next === null` renders the end-of-doc footer; visual confirmation in Chrome (View Transitions) and graceful fallback in Firefox.

## Risks

- **Layout-shift on prefs change.** Bumping font scale rewraps everything. Mitigate: animate via CSS transition on `font-size` (200ms ease) so it feels intentional. Acceptable; the user asked for the control.
- **View Transitions API browser support.** Chrome ✓, Edge ✓, Safari TP ✓, Firefox ✗ as of 2026-05. The helper falls back to plain `goto` -- no jank, just no animation.
- **Shared layout + page server data scope.** `+layout.server.ts` for `[slug]/[edition]/*` loads the TOC once; child page-server loaders need the `parent()` shape. Documented in implementation.
- **Study `/library` cutover breakage.** Citations and in-app links pointing at `/library/...`. Grep + replace at PR-time; e2e smoke catches strays.
- **Two separate reading-prefs endpoints (flightbag + study).** Could share via a `libs/auth/`-adjacent shared handler. Decide in implementation; copying is fine if sharing is more complexity than it saves.
- **TOCRender mode="overview" data.** Multi-column tile grid needs sub-section data per chapter, not just chapter rows. Loader extends to fetch the whole reading order (already done by the existing TOC pipeline -- just rendered differently).

## Success criteria

- A user opens the flightbag and sees one consistent reader chrome regardless of which doc-type they pick.
- Hitting `/library/handbook/...` redirects to flightbag; no duplicate reader exists.
- The user can change font family / size / density / measure / heading-scale and see the change persist; the change applies site-wide to long-form-reading surfaces.
- Opening a handbook lands on a 2-3 column overview with chapters and sub-sections visible at a glance, with "Resume reading" pinned if applicable.
- Clicking from chapter to chapter or section to section keeps the rail anchored and animates the body swap (Chrome / Edge / Safari) or cleanly cuts (Firefox).
- `j` / `k` / `o` / `?` work as keyboard shortcuts; `?` shows a cheatsheet.

## What this WP does NOT do

This WP makes the flightbag *consistent and configurable*. The next WP (`wp-flightbag-rich-reader`) makes it *interactive*: highlights, card drafts, inline composers, per-section notes panel. That WP depends on this one's persistent-rail layout and on `wp-notes-primitive`'s components.
