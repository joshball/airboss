---
feature: flightbag
category: desktop-ux
date: 2026-05-11
branch: main
issues_found: 24
critical: 4
major: 11
minor: 7
nit: 2
status: unread
review_status: done
---

# Flightbag desktop-UX review + rich-reader plan

Scope: the **flightbag** app as a long-form reading surface. Brief from the user covered four asks: (1) review consistency / configurability gaps in what exists today; (2) rework the abrupt TOC -> reader transition; (3) design select-to-card and select-to-note flows; (4) plan a note viewer with rich context (book, section, topic, goal, knowledge area). The desktop-UX lens applies throughout — flightbag is a reading app, and reading apps live or die on typography control, navigation continuity, and selection behavior.

## Summary

The flightbag is structurally on the right path: a `libs/library/` component pack (`ReaderLayout`, `RenderedSection`, `TOCDrawer`, `Breadcrumbs`, `ReaderNav`) gives the *handbook-section* reader a clean book-feel. But that primitive is **only adopted on the deepest leaf pages** — every other reader surface (handbook landing, AIM, AIM chapter, AIM section, CFR, CFR landing, ACS task, the catalog itself) hand-rolls its own header, breadcrumb spacing, list shape, and color usage. A user clicking PHAK -> Chapter 4 -> §4.2 walks through three visually distinct reader chrome variants and never knows which "tier" they're on. Worse, the **same handbooks are still being rendered by `apps/study/src/routes/(app)/library/handbook/[slug]`** with a totally different chrome (`PageHeader`, `HandbookEditionBadge`, raquo-text breadcrumb, `EmptyState`). Two readers, two visual languages, same content.

Configurability is essentially zero: there is no font-size control, no font-family control, no line-height / measure / theme-density control on a *reading* surface that should treat those as table-stakes (Kindle, Apple Books, Instapaper, iA Writer all expose them). The token plumbing is good — typography flows through generated `--font-size-*` / `--line-height-*` tokens that resolve to a `--type-reading-body-size` family — but no surface lets the user shift those for the reader scope only. There is no `--reader-*` token layer, and no per-component override hatch.

The TOC -> reader transition is "abrupt" because there is no transition: the handbook landing page is a list of chapters cards (`apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte`), and clicking a chapter dumps the user into the chapter page which suddenly grows a TOC drawer that wasn't visible a moment ago, in a different layout, with different spacing. Books don't work that way — a real book opens to a TOC that you can pan over and dive into. The `TOCDrawer` already exists; it just isn't shown until you're already past the entry.

Highlights and select-to-card are not built. The schema is partially primed: `study.reference_section_read_state.notes_md` exists for *per-section* private notes (a markdown blob keyed on `(user_id, reference_section_id)`), so notes already have a home — but it's a single blob per section, not a list of typed annotations with a text anchor. There is no highlight table, no card-draft table, no note-with-context schema. The `ideas pending review since` mention in IDEAS.md row 36-38 ("student journal", "CFI-reviewed reference study") and the WP-FLIGHTBAG-BOOK-EXPERIENCE spec §8 ("Foundation for rich-reader subsystems (data shape only)") both flag this as the next layer; the WP punted it explicitly. This review is the place to bring it back as a designed thing rather than a deferred one.

The rest of this document is organized as: **issues** (numbered, severity-tagged, with file paths and proposed fixes), then **plans** for the four features the user asked about. The plans are written to be liftable into work packages; phase boundaries are called out.

## Issues

### CRITICAL: Two parallel handbook readers exist (study + flightbag) with totally different chrome

- **File**: `apps/study/src/routes/(app)/library/handbook/[slug]/+page.svelte` vs `apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte`
- **Problem**: Same content (handbook chapters), two readers. Study uses `PageHeader` + `HandbookEditionBadge` + a `raquo` text breadcrumb + `EmptyState` + `HandbookChapterListItem`. Flightbag uses an inline `<header class="page-header">` + a `Breadcrumbs` component + a hand-rolled `<ol class="chapters">`. A user who clicks a citation chip lands in flightbag; a user who clicks "Library" in study lands in study's reader. Same handbook, different visual language, different progress indicators (study has read/reading/unread tri-state; flightbag has read/total only). The flightbag-as-canonical-references-app ADR (#023) explicitly intends to *replace* the study `/library/...` routes; that migration is incomplete.
- **Fix**: Audit every `/library/handbook` / `/library/aircraft` / `/library/regulations` / `/library/topic` / `/library/testing` / `/library/advisories` route in study. Either (a) hard-redirect each to its flightbag equivalent and delete the study version, or (b) shim study's surface to embed flightbag components. Authoring-surface PR-sized: a single dispatcher that 301s `/library/handbook/:slug` -> `/_flightbag-origin/handbook/:slug/:edition` is the cheapest path. Open separate WP `wp-flightbag-library-cutover`.

### CRITICAL: No font-size, font-family, or line-height control on a reading app

- **File**: `apps/flightbag/src/routes/+layout.svelte` (header has no reader-pref affordance), `libs/themes/picker/ThemePicker.svelte` (theme + appearance only), `libs/library/src/RenderedSection.svelte:441-446` (body type is hardcoded to `--font-family-base` / `--font-size-base` / `--line-height-relaxed` with no override variable)
- **Problem**: This is a long-form reading app. Every comparable reader (Apple Books, Kindle, Instapaper, iA Writer, Readwise Reader, even the GitHub markdown viewer's "Wide / Default / Narrow") gives the user font-size, font-family choice (sans / serif / dyslexic), line-height, and content-width controls. We give zero. A pilot reading the IFH at 11pt body on a 27" monitor or at 14pt on a 13" laptop has no recourse. The user explicitly flagged this as a site-wide gap, not just flightbag.
- **Fix**: Two layers, in order:
    1. **Reader pref schema** — add `study.reading.font_scale` (number, default `1.0`, allowed `[0.85, 0.9, 1.0, 1.1, 1.25, 1.5]`), `study.reading.font_family` (`'sans' | 'serif' | 'mono'`, default `'serif'` for flightbag), `study.reading.measure` (`'narrow' | 'normal' | 'wide'` mapped to 60ch / 72ch / 84ch), `study.reading.density` (`'compact' | 'comfortable' | 'spacious'` mapped to line-height 1.45 / 1.65 / 1.85). Plumb through the existing `USER_PREF_KEYS` machinery in `libs/constants/src/study-home.ts` and `libs/bc/study/src/user-prefs.ts`.
    2. **`--reader-*` token layer** — emit a generated `--reader-body-font-family`, `--reader-body-font-size`, `--reader-body-line-height`, `--reader-measure-ch` that resolve to the prefs at the layout root. `RenderedSection.body` consumes `--reader-body-*` instead of `--font-family-base` / `--font-size-base`. The wider site can opt-in by setting the same `--reader-*` tokens on its scoped containers.
- **Severity rationale**: This isn't polish; this is "we can't ship a serious reading product without it." Making it CRITICAL because shipping the rich-reader subsystem on top of an unconfigurable type stack will burn re-work later.

### CRITICAL: Design tokens don't honor the parent-relative-with-overrides model the user asked for

- **File**: token system at `libs/themes/generated/tokens.css` is **flat** — every component reads `--font-size-base`, `--ink-body`, `--space-md` directly. There's no `--reader-body-*` family that inherits from `--font-size-base * scale` then can be individually overridden by a child component (e.g. `--reader-table-font-size: calc(var(--reader-body-font-size) * 0.85)`).
- **Problem**: User stated: "we want each component in the readers called out with a design token that is based on parents, and relative to them (size for instance) but able to be overridden both individually and parent inheritance." Today there is no parent layer, no relative-to-parent computation, no per-component override hook. Adjusting "the body type" in flightbag means changing the global token, which leaks into hangar/sim/study control labels.
- **Fix**: Introduce a **scoped token cascade** for the reader. Three tiers:
    1. **Scope-root tokens** (set once on `<ReaderLayout>`'s outer wrapper): `--reader-body-font-family`, `--reader-body-font-size` (resolves from user pref scale * `--font-size-base`), `--reader-body-line-height`, `--reader-measure-ch`, `--reader-heading-scale` (1.0 -> 1.5x scale step).
    2. **Component-relative tokens** (set on each reader subcomponent, defaulting to `calc()` against scope root): `--reader-h1-font-size: calc(var(--reader-body-font-size) * var(--reader-heading-scale) * 1.6)`; `--reader-table-font-size: calc(var(--reader-body-font-size) * 0.9)`; `--reader-figcaption-font-size: calc(var(--reader-body-font-size) * 0.875)`; `--reader-toc-font-size: calc(var(--reader-body-font-size) * 0.92)`. Each subcomponent reads its *own* token so an override at the scope sets the family; an override on `--reader-h1-font-size` only changes h1.
    3. **Per-instance overrides** via inline `style="--reader-body-font-size: 1.125rem"` on a single `<RenderedSection>` if a power-user wants to crank up just one section, *and* via a "view options" gear in the reader chrome that writes the prefs.
- This replaces nothing; it adds a layer above. Existing flat tokens stay for non-reader surfaces.

### CRITICAL: No selection-to-action affordance — highlights, card draft, note are all unbuilt

- **File**: nothing in `libs/library/src/` listens for `selectionchange`; `RenderedSection.body` has no instrumentation; `study.reference_section` has no annotation FK; `study.cards` has no "draft from passage" path
- **Problem**: User wants to be able to highlight a passage and (1) queue a card draft for later, (2) open a card composer right next to the text, (3) save the selection as a note with rich context. None of this exists. The data path is the hardest part — see "Plan: rich-reader annotations" below.
- **Fix**: Plan in §"Plan: select-to-action" below. Implementation needs new schema (`study.reference_section_annotation`, `study.card_draft`), new BC (`annotations.ts` with anchor-text + offset rules), new UI (`<SelectionToolbar>`, `<InlineCardComposer>`, `<NoteContextPicker>`), and a notes-viewer surface.

### MAJOR: Per-page reader chrome is hand-rolled instead of using `<ReaderLayout>`

- **Files**:
    - `apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte` — has its own `<header class="page-header">` block (lines 27-40)
    - `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/+page.svelte` — has hand-rolled grid (lines 142-165) instead of `<ReaderLayout>`, even though the section page uses it
    - `apps/flightbag/src/routes/aim/[chapter]/+page.svelte` — bare `Breadcrumbs` + `SourceLinks` + `<header>` (lines 14-30)
    - `apps/flightbag/src/routes/aim/+page.svelte` — same pattern
    - `apps/flightbag/src/routes/aim/[chapter]/[section]/+page.svelte` — same pattern
    - `apps/flightbag/src/routes/cfr/[title]/[part]/+page.svelte` — same pattern
    - `apps/flightbag/src/routes/cfr/[title]/[part]/[section]/+page.svelte` — same pattern
- **Problem**: Only `handbook/.../section/+page.svelte` and `acs/[doc]/+page.svelte` actually use `<ReaderLayout>`. Everything else hand-rolls its header, leading to subtle drift: the handbook landing has a `subjects` chip row, the CFR landing has a `subjects` chip row that styles differently, the AIM landing has neither. Spacing differs (handbook landing uses `--space-lg` between header and chapters; AIM uses `--space-sm`). Body width is sometimes capped to `72ch` (RenderedSection) and sometimes uncapped (every list page). Breadcrumbs and SourceLinks render outside the ReaderLayout snippet block, so their spacing isn't owned by a single component.
- **Fix**: Migrate every reader page to `<ReaderLayout>`. Extract `<TOCDrawer>` for *every* surface — handbook landings should show the doc's TOC drawer too (same component, just no `isActive` entry). The list pages (chapter list, section list) become the body content of a `<ReaderLayout>` instance, not a standalone page shape. This collapses ~6 hand-rolled headers into one, and lets the user jump directly from "I'm on the handbook landing" to "I want section 4.2" via the rail without ever seeing the chapter list.

### MAJOR: TOC drawer appears and disappears across navigation steps

- **File**: handbook landing `apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte` (no TOC); chapter `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/+page.svelte` (TOC appears); section `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/[section]/+page.svelte` (TOC stays)
- **Problem**: The user explicitly flagged this: "there seems to be a very abrupt transition from TOC/overview to the reader." The TOC isn't a *navigation aid that grows with you* — it's a thing that pops into existence when you cross from "landing" to "chapter." That's the opposite of how a book opens: in a book, the TOC is *the* opening view, and you flip to a section *from* it.
- **Fix**: Two changes:
    1. The handbook landing should mount `<TOCDrawer>` from the start (same data, no active section). The right rail is *always* present once you've picked a doc.
    2. Add a third **"overview view"** for the doc that *is* the full TOC, full-width, no body content (see "Plan: overview view" below). The current landing is half-overview half-list; collapse them. Preserve the deep-link URL of the handbook landing.

### MAJOR: No "overview view" — TOC is always small-rail, never the centerpiece

- **File**: `libs/library/src/TOCDrawer.svelte` (only renders as a 280px rail), `apps/flightbag/src/routes/handbook/[slug]/[edition]/+page.svelte` (landing is a chapters list, not a TOC)
- **Problem**: User explicitly asked: "I think it is important to be able to see things like a toc and expand and explore and get big pictures quickly. And that is a different view than reader (might be full width of the toc, like seeing it in a book)." Right now the TOC drawer is 280px wide and shows ~30 entries before scrolling. For PHAK (~150 sections) or AIM (~250 paragraphs) that's a lot of scrolling in a thin column. The user wants a "spread the book open" view — the entire TOC, multi-column, with chapter previews, "where you left off," progress, reading-time totals.
- **Fix**: Add an **Overview** view per reference, route `/handbook/:slug/:edition/_overview` (or just the existing landing reshaped). Layout: full-width 2-3 column grid of chapter cards, each showing its sub-sections as a nested list, progress ring per chapter, reading-time per chapter, "Resume reading at §X.Y" pinned to the top. Link in the breadcrumb chain: `Flightbag › Handbooks › IFH › Overview` (the current landing). When the user clicks a chapter or section, they land in the reader with the rail TOC visible — the same rail that was conceptually in the overview. The transition becomes "the table of contents shrinks to the rail; the section opens in the body."

### MAJOR: Book-opening transition is a hard cut, not a progressive disclosure

- **File**: the SvelteKit page transition is a default route swap; no transition animation
- **Problem**: Going from chapter list -> chapter page -> section page is three discrete navigations, each a full-page swap. The user sees the layout *re-flow* every step (header re-renders, breadcrumb grows, TOC appears). This is the "abrupt transition" they flagged. Books don't reflow; they turn pages.
- **Fix**: Two-part fix:
    1. Make the TOC drawer the **persistent layout shell** for the entire `/handbook/:slug/:edition/*` subtree. Shared layout file at `apps/flightbag/src/routes/handbook/[slug]/[edition]/+layout.svelte` mounts `<ReaderLayout>` once, lets pages inject only the body. The rail stays put across navigations.
    2. Use Svelte 5 view transitions (`document.startViewTransition` polyfill or the platform API) for the body swap. The rail doesn't transition (it's outside the transitioned region); only the section content fades / cross-dissolves. Result: clicking a TOC entry feels like the page turning, not the app rebuilding.

### MAJOR: Reader font-family is `--font-family-base` (system sans), not a serif

- **File**: `libs/library/src/RenderedSection.svelte:441-446`
- **Problem**: System sans is correct for UI labels. For long-form reading, the convention is serif (Books, Kindle default, every newspaper). Sans is fine if the user prefers it, but the *default* on a textbook reader should be a serif. The `--font-family-serif` token already exists (`ui-serif, Georgia, Cambria, ...`).
- **Fix**: Change the default `--reader-body-font-family` to `--font-family-serif` (per the new pref system above). Keep an Atkinson-Hyperlegible / Inter / Lexend option for users who prefer sans for accessibility reasons.

### MAJOR: Body width is fixed at 72ch with no override

- **File**: `libs/library/src/RenderedSection.svelte:333` (`max-width: 72ch`)
- **Problem**: 72ch is a sensible default but the user is explicit about per-component override. On a wide monitor a pilot may want 84ch (more text per page) or 56ch (book-like). There's no control.
- **Fix**: Replace the literal with `max-width: var(--reader-measure-ch, 72ch)`. The pref system writes the value at the scope root.

### MAJOR: Heartbeat-driven read-state UI exists only on the leaf section page

- **File**: `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/[section]/+page.svelte:86` (`<HeartbeatTicker>`); chapter page has none; AIM/CFR sections have none
- **Problem**: Heartbeat is what powers `total_seconds_visible` and the per-section progress indicators. Today only handbook leaf sections feed it. AIM, CFR, ACS — all the same data, none of it ticking. Inconsistent: the user reads PHAK §4.2 and gets a "you've read this 3 times" line; reads AIM ¶7-1-1 and gets nothing.
- **Fix**: Hoist `<HeartbeatTicker>` into the shared `<ReaderLayout>` and pass `sectionId` from any reader page. Until every reader uses `<ReaderLayout>` (see issue above), this is a partial fix.

### MAJOR: Empty-state copy and shape is inconsistent

- **Files**: `aim/[chapter]/+page.svelte:33` ("No sections seeded under this chapter."), `cfr/[title]/[part]/+page.svelte:57` (full callout with eCFR link), `acs/[doc]/+page.svelte:119` ("Sourced only" badge with PDF buttons), `handbook/[slug]/[edition]/+page.svelte:43` ("This handbook has no chapter rows in the catalog yet.")
- **Problem**: Four reader surfaces, four different empty states. CFR is the most polished (offers eCFR external link); AIM and handbook are bare prose; ACS has a badge + actions. None reuse the `EmptyState` component that study uses.
- **Fix**: Use a single `<ReaderEmptyState>` component in `libs/library/`. Props: `kind` (sourced-only / not-yet-ingested / no-children), `localPdfHref`, `externalUrl`, `note`. Every reader composes the same shape.

### MAJOR: Breadcrumbs sometimes render inside ReaderLayout's slot, sometimes inside RenderedSection's snippet, sometimes free-floating

- **Files**: `handbook/.../section/+page.svelte:68-77` (inside RenderedSection snippet), `acs/[doc]/+page.svelte:30-37` (inside ReaderLayout snippet), `aim/[chapter]/+page.svelte:14-20` (free-floating before the page-header)
- **Problem**: The vertical spacing between breadcrumb and the next element differs by mount point. Visual rhythm broke.
- **Fix**: `<ReaderLayout>` always owns breadcrumb placement. `<RenderedSection>`'s `breadcrumb` snippet can be removed once every page mounts via `<ReaderLayout breadcrumb={...}>`. Single-source.

### MAJOR: Catalog (`/+page.svelte`) doesn't use any library primitive — it's a bespoke card grid

- **File**: `apps/flightbag/src/routes/+page.svelte`
- **Problem**: 200+ lines of inline grid CSS, custom subject chips, custom badges. A user lands here and the visual language doesn't match the readers underneath. The hero header reads `--font-size-2xl` bold; the reader pages read the same size — but the catalog uses `--font-family-base` (system sans) and the readers should be serif (per the fix above). Catalog feels like the marketing index; the reader feels like the product.
- **Fix**: Catalog is *also* a reader-style surface. Wrap it in `<ReaderLayout>` (no TOC rail, since there's no doc). Use `<ReferenceCard>` extracted into `libs/library/`. Subject chips become a `<SubjectChip>` token-driven primitive shared with the per-doc landings.

### MINOR: TOC drawer's heading link does double duty as the doc title and as a "back to landing" link

- **File**: `libs/library/src/TOCDrawer.svelte:181-185`
- **Problem**: The heading is a clickable link (`headingHref`) that takes the user back to the doc landing. There's no visual affordance that it's a link — it just looks like a section header. Discoverability is poor.
- **Fix**: Add a subtle home/up icon to the heading link, or wrap in a labeled affordance: `<a href={headingHref} class="heading-link">{heading} <span aria-hidden>↗</span></a>`. Or move the "back to overview" affordance out of the heading entirely into a small breadcrumb at the top of the drawer.

### MINOR: TOC drawer doesn't auto-scroll the active entry into view on cold load

- **File**: `libs/library/src/TOCDrawer.svelte:339-343` (only sets `scroll-padding`)
- **Problem**: For PHAK, jumping to §12.4 means the active entry is ~80% down the rail and offscreen. The drawer doesn't `.scrollIntoView({ block: 'nearest' })` on mount.
- **Fix**: `$effect(() => { if (!activeEl) return; activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); })` on mount; also on view transitions.

### MINOR: Mobile TOC opens on tap but doesn't auto-close after the user picks a section

- **File**: `libs/library/src/TOCDrawer.svelte` (no auto-close on link click)
- **Problem**: Mobile user opens TOC, taps §4.2, navigates — TOC stays open over the new section. Has to manually close to read.
- **Fix**: `onclick` listener on each `<a>` that calls `mobileOpen = false` after navigation. Use `onnavigate` from `$app/navigation` if you want the cleaner version.

### MINOR: Reading-time estimate is fixed at 250 wpm with no consideration for technical density

- **File**: `libs/library/src/ReadingTime.svelte` (and the `wordsPer minute` constant)
- **Problem**: 250 wpm is a healthy default for general prose but FAA handbooks are dense, with regulations cross-referenced, tables, figures requiring inspection. A 4-min estimate often takes a careful reader 8-10 min.
- **Fix**: Either (a) drop reading-time on the reader page header (it's a vanity metric; keep in TOC summary), or (b) add a `--reader-reading-pace-wpm` pref (default 200 for technical) tied to the user's actual heartbeat-derived pace once we have enough data. (b) is the more honest version.

### MINOR: No keyboard shortcut for prev/next section

- **File**: `libs/library/src/ReaderNav.svelte` (only mouse-clickable)
- **Problem**: Standard book/reader convention: J/K for next/prev (Vim, Gmail, Twitter, Kindle), or arrow keys, or H/L. We have none. Power-readers expect them.
- **Fix**: Layout-level keydown handler in `<ReaderLayout>`: `j`/`ArrowDown` -> next, `k`/`ArrowUp` -> prev (when no input has focus), `g g` -> top of TOC, `o` -> overview. Document in a `?` cheatsheet overlay (sim app already has `KeyboardCheatsheet.svelte` to crib from).

### MINOR: SourceLinks placement varies (sometimes after breadcrumb, sometimes inside the metadata disclosure)

- **Files**: `handbook/.../section/+page.svelte:71` (inside RenderedSection breadcrumb snippet); `aim/[chapter]/+page.svelte:22-26` (free-floating); `cfr/[title]/[part]/+page.svelte:21-25` (free-floating)
- **Problem**: PDF/external link is sometimes prominent, sometimes buried.
- **Fix**: Standard placement is in the page-header eyebrow row, right-aligned. Always small, always present.

### MINOR: Footer prev/next strip is the only "you reached the end" signal

- **File**: `libs/library/src/ReaderNav.svelte` (no special end-of-doc treatment)
- **Problem**: The WP-FLIGHTBAG-BOOK-EXPERIENCE spec mentions "optionally show a 'you've reached the end' footer" — not implemented.
- **Fix**: When `nav.next === null`, render a "End of Chapter" / "End of Book" celebration block: progress summary, link to next handbook in the cert syllabus (when wired), "Mark this whole chapter as read" button.

### NIT: `RenderedSection` body's heading hierarchy starts at `<h3>`

- **File**: `libs/library/src/RenderedSection.svelte:452-457`
- **Problem**: H1 is the section title; markdown headings render as h3-h6. There's no h2 in the body, which means the doc-outline (`view-source-outline`, screen-reader rotor) skips a level.
- **Fix**: Either render markdown `#` -> h2 (currently skipped to avoid clobbering the title), or render the title as h2 and let the page wrapper own h1. Latter is cleaner; matches the convention `<ReaderLayout>` should own the H1 already.

### NIT: Color tokens for "read" state lean on `--signal-success-edge` with fallbacks; no dedicated read-state token

- **Files**: `libs/library/src/TOCDrawer.svelte:399`; `apps/flightbag/src/routes/handbook/[slug]/[edition]/[chapter]/+page.svelte:223-225`
- **Problem**: "I read this" semantically isn't success — it's progress. Mapping to `--signal-success-*` is borrowing.
- **Fix**: Add `--reading-progress-read-edge` / `--reading-progress-read-ink` to the token set; map in the theme.

---

## Plan: parent-relative reader token system

Goal: a token cascade that lets the user (and individual components) override font / size / spacing for the reader scope without touching global tokens.

### The cascade

```text
Global tokens (libs/themes/generated/tokens.css)
    ↓
Reader scope root (set on <ReaderLayout> outer wrapper, read user prefs)
  --reader-body-font-family: var(--font-family-serif)
  --reader-body-font-size:   calc(var(--font-size-base) * var(--reader-scale, 1))
  --reader-body-line-height: 1.65 (or pref)
  --reader-measure-ch:       72ch  (or pref)
  --reader-heading-scale:    1.0   (or pref)
    ↓
Component-relative tokens (set on each subcomponent, default = calc against scope root)
  --reader-h1-font-size:      calc(var(--reader-body-font-size) * 1.6 * var(--reader-heading-scale))
  --reader-h2-font-size:      calc(var(--reader-body-font-size) * 1.35 * var(--reader-heading-scale))
  --reader-h3-font-size:      calc(var(--reader-body-font-size) * 1.15 * var(--reader-heading-scale))
  --reader-table-font-size:   calc(var(--reader-body-font-size) * 0.92)
  --reader-fig-cap-font-size: calc(var(--reader-body-font-size) * 0.875)
  --reader-toc-font-size:     calc(var(--reader-body-font-size) * 0.9)
  --reader-meta-font-size:    calc(var(--reader-body-font-size) * 0.85)
    ↓
Per-instance override (inline style on a single <RenderedSection> if needed)
  style="--reader-body-font-size: 1.125rem"
```

### Where the user pref values come from

`USER_PREF_KEYS` adds:

```typescript
READER_FONT_FAMILY: 'study.reading.font_family',  // 'sans' | 'serif' | 'mono'
READER_FONT_SCALE:  'study.reading.font_scale',   // 0.85 | 0.9 | 1.0 | 1.1 | 1.25 | 1.5
READER_DENSITY:     'study.reading.density',      // 'compact' | 'comfortable' | 'spacious'
READER_MEASURE:     'study.reading.measure',      // 'narrow' | 'normal' | 'wide'
READER_HEADING_SCALE: 'study.reading.heading_scale', // 0.9 | 1.0 | 1.15
```

`<ReaderLayout>` resolves these in `+layout.server.ts` (server-side, no flash on load), writes them as inline `style="--reader-...:..."` on the outer wrapper. The `<ReaderPrefsButton>` in the reader chrome opens a popover with sliders for size and dropdowns for family/density/measure; mutating the popover writes the pref via `POST /reader-prefs`. Pattern mirrors the existing theme/appearance picker plumbing in `apps/flightbag/src/routes/+layout.svelte`.

### Why this generalizes beyond flightbag

User said: "this is true with the entire site as well." The same token layer can apply to any long-form-reading surface (knowledge nodes, course steps, work-package docs, future help content). Every such surface wraps its body in a `<ReadableScope>` component (or applies the `data-readable-scope` attribute) that sets `--reader-*` from the user's pref. UI-density surfaces (forms, tables, dashboards) are unaffected — they don't read `--reader-*`.

---

## Plan: TOC -> reader transition (overview view + persistent rail)

Goal: kill the "abrupt transition" by making the TOC the *opening view* and the rail a *persistent shell*.

### Three views per reference

1. **Overview** (full-width TOC, no body) — landing page. Multi-column chapter grid. Each chapter card: title + sub-section list + progress ring + reading-time + "Resume here." Visual model: opening a book to its TOC spread.
2. **Reading view** (rail TOC + body) — current section pages. The rail is the same TOC, just shrunk to a column. Active section highlighted.
3. **Compact reading view** (collapsed rail + body) — user-toggleable. For wide-screen prose-only sessions. Rail collapses to a thin "open TOC" tab; clicking expands.

### Transitions

- Overview -> Reading: section card click -> the chapter grid morphs into the rail (View Transitions API on chapter blocks) and the body fades in. On unsupported browsers, just navigate.
- Reading -> Reading (next section): rail stays put (shared layout), body cross-dissolves. View Transitions on body only.
- Reading -> Overview: keyboard `o` or breadcrumb click -> rail expands back to full width.

### Implementation outline

1. **Shared layout**: `apps/flightbag/src/routes/handbook/[slug]/[edition]/+layout.svelte` mounts `<ReaderLayout>` once with the TOC rail. Children pages inject only the body via slot. This makes the rail truly persistent — no remount per route.
2. **Overview route**: Reshape the existing landing (`/handbook/:slug/:edition/`) to render the *new* overview-mode TOC. The shared layout's rail also renders, but the overview page's body content is the same TOC at full width. (Alternatively: the layout reads the route name and renders rail-mode vs overview-mode of the same `<TOCRender>` component.)
3. **`<TOCRender mode="overview" | "rail" | "compact" />`**: Single component, three layouts. Overview: 2-3 column grid of `<ChapterTile>` (title, progress ring, reading-time, mini-section-list). Rail: today's `<TOCDrawer>`. Compact: just the active chapter expanded, others collapsed.
4. **View Transitions**: Add a tiny helper in `libs/utils/` that wraps `goto(url)` in `document.startViewTransition` when supported. Use it for in-doc navigation only.
5. **Reading-time-based "where you left off"**: heartbeat already feeds `last_read_at` per section; pull the most recent and surface as "Resume reading at §X.Y" pinned to overview top.

This subsumes the WP-FLIGHTBAG-BOOK-EXPERIENCE spec phases 3 and 5 — they were going to ship a rail and a landing page; this proposes shipping them as one cohesive transition story instead of two disjoint pieces.

---

## Plan: select-to-action (highlight, card draft, card now, note)

Goal: select text in the reader, choose what to do with it, never leave the page.

### The interaction

1. User selects text in any `<RenderedSection>` body. A floating `<SelectionToolbar>` pops up immediately (anchored above the selection, like Google Docs / Notion / Apple Books).
2. Toolbar offers:
   - **Highlight** (color picker — yellow / blue / green / pink, mapped to user-meaning like "memorize / context / question / disagree")
   - **Card draft** (queue for later — no composer, just captures the text + anchor + metadata; appears in `/memory/drafts`)
   - **Card now** (opens an inline composer **next to the text in a side panel**, not a modal — see below)
   - **Note** (opens an inline note composer in the same side panel)
   - **Copy with citation** (copies the text + a `airboss-ref:` URI, for pasting elsewhere)

### Inline composer ("next to text") layout

User explicitly said: "Do this NEXT to the text so they can access the entire thing (instead of a modal). And allow them to just do it now."

The reader becomes three columns when the inline composer opens: TOC rail (left, narrow) | body (center) | composer (right, ~22rem). The body stays scrollable; the user can keep reading while the composer is open. The selection stays highlighted in the body so the source is visible. Clicking outside the composer doesn't close it — only an explicit close/save closes it (so the user can't lose their draft mid-thought).

Layout shifts handled by the `<ReaderLayout>` grid: when composer is open, grid becomes `18rem minmax(0, 1fr) 22rem`. On narrow viewports (<80rem), the composer overlays as a right-side sheet that the user can resize.

### Schema (new)

```typescript
// libs/bc/study/src/schema.ts -- additions

/**
 * Per-(user, section) annotation. One row per user-authored highlight, note,
 * or pinned reference. Anchored to a passage of the section body via plain-
 * text offsets and an anchor-text snapshot (resilient to source re-extracts).
 */
export const referenceSectionAnnotation = studySchema.table(
  'reference_section_annotation',
  {
    id: text('id').primaryKey(),                    // ann_<ULID>
    userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),
    referenceSectionId: text('reference_section_id').notNull().references(() => referenceSection.id, { onDelete: 'cascade' }),

    /** 'highlight' | 'note' | 'card_draft_anchor' (see ANNOTATION_KINDS) */
    kind: text('kind').notNull(),

    /** Optional color ('yellow' | 'blue' | 'green' | 'pink' | null for note-only). */
    color: text('color'),

    /** Plain-text excerpt as it appeared at annotation time (re-anchor fallback). */
    anchorText: text('anchor_text').notNull(),
    /** UTF-16 offset in the section's plain-text projection at annotation time. */
    anchorStart: integer('anchor_start').notNull(),
    anchorEnd: integer('anchor_end').notNull(),

    /** Optional note body (markdown). Empty for highlight-only. */
    bodyMd: text('body_md').notNull().default(''),

    /** Foreign key into card_draft when this annotation seeded a draft. Null otherwise. */
    cardDraftId: text('card_draft_id'),

    ...timestamps(),
  },
  (t) => ({
    userSectionIdx: index('reference_section_annotation_user_section_idx').on(t.userId, t.referenceSectionId),
    sectionIdx: index('reference_section_annotation_section_idx').on(t.referenceSectionId),
    kindCheck: check('reference_section_annotation_kind_check', sql.raw(`"kind" IN (${inList(ANNOTATION_KIND_VALUES)})`)),
  }),
);

/**
 * A queued card draft. The user captured a passage and intends to author a
 * card later; the draft sits in /memory/drafts with the source link and
 * pre-filled front/back pulled from the anchor text.
 *
 * Becomes a real `study.card` row when promoted (the draft row is then
 * deleted -- promotion is a one-way migration to keep the draft inbox clean).
 */
export const cardDraft = studySchema.table(
  'card_draft',
  {
    id: text('id').primaryKey(),                    // draft_<ULID>
    userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),

    /** Pre-filled card fields (user can edit before promotion). */
    front: text('front').notNull().default(''),
    back: text('back').notNull().default(''),
    domain: text('domain'),
    cardType: text('card_type').notNull().default(CARD_TYPES.BASIC),
    kind: text('kind').notNull().default(CARD_KINDS.RECALL),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

    /** Source anchor (so the user can jump back to context). Optional. */
    sourceAnnotationId: text('source_annotation_id').references(() => referenceSectionAnnotation.id, { onDelete: 'set null' }),

    /** Free-form context fields the user can attach (see "note context" below). */
    contextGoalId: text('context_goal_id'),
    contextCourseId: text('context_course_id'),
    contextKnowledgeNodeId: text('context_knowledge_node_id'),

    promotedToCardId: text('promoted_to_card_id'),  // Set when promoted; for audit trail.

    ...timestamps(),
  },
  (t) => ({
    userIdx: index('card_draft_user_idx').on(t.userId, t.createdAt),
  }),
);
```

`ANNOTATION_KINDS` constant in `libs/constants/src/study.ts`: `{ HIGHLIGHT: 'highlight', NOTE: 'note', CARD_DRAFT_ANCHOR: 'card_draft_anchor' }`.

### Why anchor-text + offsets, not DOM ranges

DOM ranges break when the source re-extracts (figure injection, frontmatter changes, table reformatting). Anchor text is the snapshot at annotation time; offsets locate it on first read; if the offsets shift due to a re-render, fuzzy-match the anchor text to find the new position. This is the same technique Hypothes.is and Genius use. `libs/utils/src/text-anchors.ts` holds the matching logic; tests cover the re-anchor cases.

### BC + UI components

- `libs/bc/study/src/annotations.ts` (server) — `createAnnotation`, `listAnnotationsForSection`, `deleteAnnotation`, `promoteAnnotationToCard`, `createCardDraft`, `promoteDraftToCard`. Browser barrel re-exports types only.
- `libs/library/src/SelectionToolbar.svelte` — listens for `selectionchange` on `<RenderedSection>`, computes anchor + offsets, positions a floating toolbar.
- `libs/library/src/InlineCardComposer.svelte` — embedded version of the existing `/memory/new` form. Reuses the same form action; just doesn't navigate after save.
- `libs/library/src/InlineNoteComposer.svelte` — markdown textarea + context picker (see notes plan below).
- `libs/library/src/AnnotationLayer.svelte` — mounts inside `<RenderedSection>`, paints highlights as `<mark>` overlays positioned by the offsets, intercepts hover for "note bubble" preview.

### Drafts inbox

`/memory/drafts` route in study. List of `card_draft` rows with: passage excerpt, source link, "create" button, "discard" button, "create + open another" button. Empty-state copy: "Drafts you queue from the flightbag show up here." Promoting a draft uses the existing `POST /memory/new` action with the prefilled fields — no new flow.

### Phasing

1. **Phase 1**: Schema + BC + `<SelectionToolbar>` with Highlight + Copy-with-citation only. Persists highlights, paints them on re-load. No card / note paths yet.
2. **Phase 2**: Card draft path. Toolbar adds "Save for later." `/memory/drafts` route. Heartbeat into the existing `/memory/new` action for promotion.
3. **Phase 3**: Inline card composer ("create now"). Three-column layout. Same form action, no navigation.
4. **Phase 4**: Inline note composer + notes viewer (see notes plan).
5. **Phase 5**: Highlight colors with semantic meaning. Filter/search annotations across the whole flightbag.

---

## Plan: notes + note viewer

Goal: capture a note that survives "where did I write that" — context fields make it findable.

### What is a note vs a highlight vs a card draft

| Kind       | Purpose                                                     | Has body | Has anchor | Promotes to | Lives in            |
| ---------- | ----------------------------------------------------------- | -------- | ---------- | ----------- | ------------------- |
| Highlight  | "I want to find this passage again"                         | No       | Yes        | n/a         | Reader (painted)    |
| Card draft | "I want to make a card from this later"                     | Optional | Yes        | study.card  | /memory/drafts      |
| Note       | "I have something to say about this passage / topic / book" | Yes      | Optional   | n/a         | /notes (new viewer) |

Notes are the thinking layer. They can attach to a passage (anchor), a section (no anchor), a chapter, a whole reference, or to *no reference* (a freestanding thought-of-the-day on a topic / goal / knowledge area). The schema supports all of these via optional FKs.

### Schema (new)

```typescript
export const note = studySchema.table(
  'note',
  {
    id: text('id').primaryKey(),                    // note_<ULID>
    userId: text('user_id').notNull().references(() => bauthUser.id, { onDelete: 'cascade' }),

    /** Markdown body. */
    bodyMd: text('body_md').notNull(),

    /** Optional title (first line auto-derived if absent). */
    title: text('title').notNull().default(''),

    /** Anchor: at most one annotation. Null = section/chapter/ref-level note. */
    annotationId: text('annotation_id').references(() => referenceSectionAnnotation.id, { onDelete: 'set null' }),

    /** Reference context: at most one of these is "primary." Multiple can be set. */
    referenceId: text('reference_id').references(() => reference.id, { onDelete: 'set null' }),
    referenceSectionId: text('reference_section_id').references(() => referenceSection.id, { onDelete: 'set null' }),

    /** Curriculum context (any combination). */
    knowledgeNodeId: text('knowledge_node_id'),     // FK when knowledge schema lands
    courseId: text('course_id'),
    goalId: text('goal_id'),
    syllabusNodeId: text('syllabus_node_id'),

    /** Topical tags (free-form). */
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),

    /** Optional "next action": a follow-up the user wants to act on. */
    followUpMd: text('follow_up_md').notNull().default(''),
    followUpDoneAt: timestamp('follow_up_done_at', { withTimezone: true }),

    /** Quote the source so the note remains readable when the source changes. */
    quotedExcerpt: text('quoted_excerpt').notNull().default(''),

    /** Soft-archive flag (we never delete notes; user can hide them). */
    archivedAt: timestamp('archived_at', { withTimezone: true }),

    ...timestamps(),
  },
  (t) => ({
    userIdx: index('note_user_idx').on(t.userId, t.createdAt),
    refIdx: index('note_reference_idx').on(t.referenceId).where(sql`reference_id IS NOT NULL`),
    sectionIdx: index('note_section_idx').on(t.referenceSectionId).where(sql`reference_section_id IS NOT NULL`),
    goalIdx: index('note_goal_idx').on(t.goalId).where(sql`goal_id IS NOT NULL`),
    courseIdx: index('note_course_idx').on(t.courseId).where(sql`course_id IS NOT NULL`),
    knowledgeIdx: index('note_knowledge_idx').on(t.knowledgeNodeId).where(sql`knowledge_node_id IS NOT NULL`),
    followUpOpenIdx: index('note_follow_up_open_idx').on(t.userId, t.followUpDoneAt).where(sql`follow_up_md != '' AND follow_up_done_at IS NULL`),
  }),
);
```

Notes get a generous context surface because **the user said they don't yet know what to do with them** — keeping the context wide means future surfaces (a goal's "your notes on this," a section's "show all my notes," a follow-up inbox) all become trivial joins instead of schema migrations.

### The note composer (inline)

Same right-column composer as the card composer. Fields:

- **Body** (markdown editor, large)
- **Title** (auto-derived, editable)
- **Quoted excerpt** (auto-filled from selection, editable, can be cleared if user wants a freestanding note)
- **Context picker**: a collapsible panel with auto-detected defaults (current reference, current section) + manual pickers for goal / course / knowledge node. Defaults to "everything I'm currently looking at gets attached."
- **Follow-up** (optional textarea + checkbox for "I'll come back to this")
- **Tags** (chip input, free-form)

### The notes viewer

New route `/notes` in study (or flightbag — TBD; recommend study because notes are study-scoped, not reference-scoped). Three views:

1. **All notes** (reverse chronological, search bar, filter chips for: has-anchor, has-followup, archived, tag, reference, goal, course)
2. **By context** (faceted nav — "Notes on PHAK Chapter 4" / "Notes for Private Pilot goal" / "Notes on weather knowledge nodes")
3. **Follow-ups inbox** (open follow-ups only; check-off marks them done)

Each note card shows: title, body preview (first 2 lines), context badges (the FKs that are set, as colored chips: orange = reference, blue = goal, green = course, purple = knowledge node), follow-up badge if open, anchor link "Source: PHAK §4.2 →" when annotation_id is set.

Click a note -> note detail view: full body, source excerpt + jump-to-source button, edit / archive / delete actions, "promote to card" button (creates a card draft pre-filled from the note).

### Per-section notes panel (in the reader)

In the right column when no composer is open, a collapsible "Notes on this section (N)" panel renders the user's notes attached to the current section. Click a note -> opens it in the side panel for editing. This makes the reader the primary surface for "remember what I thought" without forcing a context-switch to a notes app.

### Why this satisfies "we don't want to lose the note"

Every note carries up to 5 context FKs (reference, section, knowledge node, course, goal) plus tags + an optional anchor. Lookups: by source, by topic, by curriculum. The follow-up field captures the "I'll come back to this" intent without making notes themselves into tasks (separate concept; we're not building a task manager).

### Phasing

1. **Phase A**: Schema + BC + `/notes` route (all-notes view) + create-note action. No reader integration yet — uses `/notes/new` standalone. Validates the data shape.
2. **Phase B**: Inline note composer in the reader (right column).
3. **Phase C**: Per-section notes panel in the reader.
4. **Phase D**: Faceted-by-context viewer.
5. **Phase E**: Follow-ups inbox + cross-surface "your notes on X" embeds (on goal pages, course pages, knowledge nodes).

---

## Other thoughts (the user asked)

A few things that came up while reviewing that didn't fit elsewhere:

- **A passage-level "ask the AI" affordance.** The `api/page-explainer` route already exists in study. With selection-to-action working, "ask the AI about this passage" becomes a fifth toolbar action. Cheap to add once the toolbar exists.
- **A "discuss this passage" affordance.** When social / instructor surfaces land, the same anchor system supports "your CFI added a comment on this paragraph." Schema scaffolds for this in the annotation table — `kind: 'instructor_comment'` works without alteration.
- **Cross-section anchor search.** Once highlights / notes are anchored, "search my highlights" becomes a real feature: a `/notes?tag=stalls` lookup that returns highlights and notes across every reference. Requires a small `pg_trgm` index on `anchor_text` and `body_md`.
- **Export.** Pilots reading for a checkride often want a printout. "Export all my highlights and notes for PHAK Chapter 4" -> markdown / pdf. Trivial once the data exists.
- **The "abrupt transition" is partly about animation, partly about layout.** I planned both above; if only one ships, layout (persistent rail) matters more than animation. Animation without persistent layout doesn't fix the underlying remount jolt.
- **The "ability for users to change fonts and size is critical … this is true with the entire site as well"** — the `<ReadableScope>` token cascade pattern works on knowledge node bodies, course steps, work-package docs, and the help library. None of those have configurable type today; all of them should. Worth filing as a separate WP `wp-readable-scope-platform` once the flightbag implementation proves the pattern.

---

## Recommended sequencing

This is too much for one WP. Suggest:

1. **WP-FLIGHTBAG-CHROME-CONSOLIDATION** (small) — every reader page through `<ReaderLayout>`, hand-rolled headers deleted, single empty-state component, single source-links placement. Closes the consistency findings without new schema.
2. **WP-READER-PREFS-AND-TOKENS** (small/medium) — `--reader-*` token cascade, USER_PREF_KEYS additions, `<ReaderPrefsButton>` + popover. Includes site-wide `<ReadableScope>` story.
3. **WP-FLIGHTBAG-OVERVIEW-AND-TRANSITIONS** (medium) — overview view, persistent rail layout, view-transition helper, end-of-doc footer. Cleans up the "abrupt transition."
4. **WP-FLIGHTBAG-LIBRARY-CUTOVER** (small but coordinated) — retire `apps/study/src/routes/(app)/library/...` to flightbag-equivalent redirects. Handles the dual-reader CRITICAL.
5. **WP-RICH-READER-ANNOTATIONS** (large, multi-phase) — schema + BC + selection toolbar + highlights + card-drafts + inline-card-composer + inline-note-composer.
6. **WP-NOTES-VIEWER** (medium) — `/notes` route + facets + follow-ups + cross-surface embeds.

Items 1, 2, 3, 4 should ship before 5/6 — the rich-reader features depend on a clean chrome and a stable token system.
