---
title: 'Phase 3 UX Review: Hangar Review Queue'
reviewer: ux
date: 2026-05-04
diff: 642669cd...f7ec6c19
---

# Phase 3 UX Review: Hangar Review Queue

## Summary

- Files reviewed: 11
- Critical: 3
- Major: 7
- Minor: 9
- Nit: 5

Phase 3 ships a workable two-pane docs browser and a debounced typeahead, and the keyboard plumbing in the search box is in the right shape. The big problems are content fidelity (the project's own docs use GFM pipe tables and hash-anchor cross-links, neither of which render -- so reading `spec.md` in the app looks broken compared to reading it in an editor), the empty-state form (no pending feedback, no error path, doesn't refresh on success), and several navigational dead ends (Escape on search doesn't release focus or clear input; loader-button-only landing leaves the user with nothing to do once it has run; tree's "auto-expand to active file" only fires on a clean `localStorage`).

## Findings

### Critical

#### 1. Markdown tables (GFM pipe syntax) do not render

- **Location**: flow `/docs/[...path]` for any doc with a table; root cause `libs/utils/src/markdown.ts:778` (`renderMarkdown`)
- **Problem**: `renderMarkdown` supports `<table>`/`<div class="handbook-table">` HTML blocks but has no parser for GFM pipe syntax (`| col | col |`). The hangar-review-queue spec.md, design.md, the "Tracking: three levels" table in CLAUDE.md, the data-model table in the spec, and most ADRs are written in pipe syntax. They render as paragraphs of `|` characters with broken alignment.
- **Why it matters**: The whole point of `/docs` is "rich markdown viewer over `docs/**`" with tables aligned (spec lines 55, 263). The spec's own acceptance criterion states "tables aligned." A reviewer opening `spec.md` (the canonical use case) sees a smear of pipes. This makes the surface less useful than `cat`.
- **Fix**: Add GFM pipe-table parsing to `renderMarkdown` (header row + separator row + body rows -> `<table>`/`<thead>`/`<tbody>`). Or, if extending the renderer is out of scope here, swap to a real parser (`marked` with `gfm: true` plus the existing `sanitizeInlineHtml` post-pass). Either way, write a test that round-trips one of the actual project tables (e.g. the data-model table from the spec).

#### 2. Search-popover XSS / display corruption from `ts_headline` snippets

- **Location**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:136` `{@html hit.snippet}`; backed by `libs/bc/hangar/src/docs-search.ts:60` (no sanitization of body before passing through `ts_headline`)
- **Problem**: `ts_headline` does not HTML-escape the body content; it splices `<mark>` and `</mark>` markers into raw text. If a markdown body contains literal `<` characters (code samples, ADR snippets, unescaped templates), the snippet returned to the client carries them, and `{@html hit.snippet}` renders them as live HTML. This is a security boundary violation and also a display bug -- the `Hit-snippet` style only theming the `mark` tag fails when ANY other tag survives the headline.
- **Why it matters**: The component header even says "sanitising on the server (see `/docs/search.json/+server.ts`'s contract -- only `<mark>`/`</mark>` and the bracketed body fragment are emitted)" -- but no such sanitization exists. The contract is implicit and broken. Any markdown body containing `<script>` or `<img onerror=...>` and a matching search hit is XSS.
- **Fix**: Either (a) escape the body BEFORE storing in `hangarDocsSearchIndex.body` (changes loader semantics); or (b) post-process the `ts_headline` output server-side: replace `<mark>` + `</mark>` markers with sentinels, HTML-escape, replace sentinels back. Today the right call is (b) inside `searchDocs` so the `hits` JSON contract truly is "only `<mark>` survives," matching the comment.

#### 3. Index-empty landing has only one action and gives no feedback while running

- **Location**: `apps/hangar/src/routes/(app)/docs/+page.svelte:22-26`
- **Problem**: When `indexCount === 0`, the index page shows a single `[Run loader]` button. Clicking it submits the form action; there is no `aria-busy`, no disabled state, no spinner, no progress indicator. The loader walks `docs`/`course`/`handbooks`/`regulations` -- thousands of files -- and the user sits on the same page wondering whether anything is happening. With nothing else on the page (no tree-to-browse hint, no link to NOW.md alt), they will rage-click.
- **Why it matters**: First-run UX. A user who has just deployed sees "Index is empty" and a button that seemingly does nothing. The whole `/docs` surface looks broken until the loader returns 30+ seconds later.
- **Fix**: Use SvelteKit's progressive-enhancement pattern: `use:enhance`, `submitting` state -> disable + label "Indexing... ({duration})", success -> push the new `indexCount` into derived state so the empty-state collapses without a reload, error -> surface a toast/banner with the exception message and a retry button. Bonus: render the file tree in the rail even when the index is empty (the tree comes from `listDocsTree`, not the FTS index, so it is already populated).

### Major

#### 4. After `runLoader` succeeds, the page still shows the empty-state nudge

- **Location**: `apps/hangar/src/routes/(app)/docs/+page.svelte:22-35`
- **Problem**: The action returns `{ ranLoader, fts, durationMs }` but does not refresh `data.indexCount`. The empty-state heading "Index is empty. Click below to populate..." stays visible alongside the success line "Loader ran in N ms. FTS: 4666 added..." The Run-loader form also stays mounted, so the user can re-fire the loader for no reason.
- **Why it matters**: User-visible conflict: success message + empty-state nudge on the same screen. Looks broken.
- **Fix**: After action returns, call `invalidate('app:docs:index-count')` (or rely on `enhance` default reload of the load function). Conditional on `form?.ranLoader || data.indexCount > 0` to hide both the form and the "is empty" sentence.

#### 5. Search-result HTML escapes break when paths contain XML-meaningful characters

- **Location**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:133-134`
- **Problem**: `<span class="hit-title">{hit.title}</span>` and `<span class="hit-path">{hit.path}</span>` are interpolated as text, which is correct -- but `hit.title` is derived from doc frontmatter or H1 lines that may contain stray inline `<`/`>` in code-fenced contexts. Acceptable. The bigger gap: the snippet line uses `{@html}` (see #2) AND the same component shows results without any fallback for "result has no title" -- a doc with no frontmatter `title` and no H1 will display its raw filename in `hit-title`, then the same path again in `hit-path`. Visually that is two identical lines stacked.
- **Why it matters**: Discoverability. The path-as-title gives no hint of the doc's content; both lines wasted on the same string makes the result feel like noise.
- **Fix**: When `title === path` (or when title is derived from path), only render path once and surface the snippet more prominently. Or, fold `hit-title` and `hit-path` into one line with mono path subordinate: `Title -- path/to/file.md`.

#### 6. Headings H1 and H2 are demoted to H3 in body content

- **Location**: `libs/utils/src/markdown.ts:947` (`renderMarkdown`'s `level = Math.max(3, heading[1].length)`)
- **Problem**: The renderer is reused from the knowledge-graph phase pipeline, which intentionally reserves H1/H2 for upstream phase splitting. The docs browser does no such splitting -- it renders whole files. The first `# Hangar Review Queue -- Spec` becomes `<h3>`. The breadcrumb is the only "title" the page shows; the breadcrumb says only `spec` (the basename). There is no visible page heading at the right size.
- **Why it matters**: Visual hierarchy collapses. All sections look the same level. Section H2 (`## Problem`, `## Concepts`) become `<h3>`, the same as their child H3s. The page has no clear "what am I reading" anchor.
- **Fix**: Either (a) introduce a `renderMarkdown(md, { minHeadingLevel: 1 })` option and pass `1` from the docs page; or (b) have the docs renderer post-process to lift levels back. Alternatively, the docs page can render the file's first H1 as a real `<h1>` outside the `renderMarkdown` output (using the frontmatter `title` or the first line) and strip it from the body.

#### 7. Hash-anchor links to in-doc sections do not work

- **Location**: `libs/utils/src/markdown.ts:944-951` (heading rendering); `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:28` (`raw.startsWith('#')` early-returns the full href unchanged)
- **Problem**: `renderMarkdown` produces `<h3>Heading text</h3>` with no `id` attribute. Documents reference their own sections via `[Concepts](#concepts)`, `[Surface 1](#surface-1--docs-browser)`, etc. The link rewrite preserves these as-is, but the page has no anchor targets, so clicking does nothing.
- **Why it matters**: Internal navigation within long docs (the spec is 270+ lines, 30+ headings) is broken. The reader cannot jump to "Frontmatter rules" or "Data model" via the table of contents.
- **Fix**: Slugify heading text and emit `<h3 id="slug">...</h3>`. Use the same algorithm GFM uses (lowercased, non-alphanumerics -> dash, collapse). Add a unit test confirming `# Foo Bar` -> `<h1 id="foo-bar">`.

#### 8. Breadcrumb stutters with `Docs / docs / ...` and shows no human-readable title

- **Location**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:53-65` (`buildCrumbs`)
- **Problem**: A crumb chain for `docs/work-packages/hangar-review-queue/spec.md` becomes `Docs / docs / work-packages / hangar-review-queue / spec`. The first two crumbs are redundant (`Docs` and `docs/`) and the final segment is the bare filename, not the document's title from frontmatter.
- **Why it matters**: Breadcrumbs exist to orient the reader; ours obscures rather than clarifies. The filename-as-title pattern fails for `spec.md`/`design.md`/`tasks.md` -- every WP has the same filenames so every crumb chain ends in `spec` and the reader cannot tell which spec.
- **Fix**: (a) Drop the first segment of `path` from the breadcrumb when it equals one of `DOCS_SEARCH_ROOTS` (since `Docs ->` already covers it). (b) Use frontmatter `title` (or first H1) for the final crumb when present; fall back to filename otherwise. The server load already returns frontmatter entries.

#### 9. ESC on search closes popover but leaves stale query and hits

- **Location**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:67-71` (`onKeydown`'s `Escape` branch)
- **Problem**: Pressing ESC toggles `open = false` but `query` and `hits` are unchanged. Re-focusing the input opens the popover with the old hit list, even though the user clearly wanted to clear the search. Comparable command palettes (Slack, VS Code, GitHub) clear the query on first ESC, then close on second.
- **Why it matters**: Keyboard-only users cannot reset the search without clicking. Backspace works but is N keystrokes for an N-character query.
- **Fix**: First ESC: clear `query`, `hits`, `activeIndex`; keep popover open if there is anything else to show, otherwise close. Second ESC: blur input. Document the convention in the file header.

#### 10. ArrowUp at top of list cannot escape back to the input

- **Location**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:84-86`
- **Problem**: `activeIndex = Math.max(activeIndex - 1, 0)` clamps at the first hit. There is no path to "no selection" / "input field" via keyboard; the user has to press ESC and refocus to start typing again.
- **Why it matters**: Combobox conventions (W3C ARIA APG) say ArrowUp from index 0 should either wrap to the last hit or release back to the input. Either is fine; staying stuck at 0 is the worst option.
- **Fix**: Decrement to `-1` (no selection, focus back to input visually) or wrap to `hits.length - 1`. Pick one and align with the rest of the codebase if there is precedent.

#### 11. Tree's "auto-expand to active file" only runs on a clean `localStorage`

- **Location**: `libs/ui/src/components/FileTree.svelte:50-75`
- **Problem**: The effect tries to read `localStorage.getItem(storageKey)`. If `raw` is null (first-ever visit), it falls through to "expand the chain that contains the active file" -- correct for first visit. But once the user collapses anything, `localStorage` has a value (even an empty array `[]`), so future visits to a deep file (e.g. `docs/decisions/018-source-artifact-storage-policy/decision.md`) leave the tree fully collapsed and the active file not visible at all.
- **Why it matters**: Click a search hit to a deep file; the tree on the rail does not scroll/expand to show it. The user has to manually re-open every parent directory to see where they are. This kills the "tree as orientation" mental model.
- **Fix**: Always merge the active-path chain into the persisted set on load (union, not replace). Save the union back so subsequent loads keep ancestors open until the user explicitly collapses them. Optional: scroll the active row into view via `el.scrollIntoView({ block: 'nearest' })`.

### Minor

#### 12. NOW.md missing on `/docs` index says "not found" but offers no alternative

- **Location**: `apps/hangar/src/routes/(app)/docs/+page.svelte:41-46`
- **Problem**: When `data.now` is null (NOW.md missing or unreadable), the page shows `<code>docs/work/NOW.md</code> not found.` and that is the entire body. No suggestion to browse the tree, no link to `docs/`, no fallback to the README.
- **Why it matters**: A new contributor whose NOW.md was deleted hits a dead landing page. Tree on the left still works, but nothing tells them that.
- **Fix**: Add a sentence: "Pick a file from the tree on the left, or jump to [docs/](/docs/docs/README.md)". Or render a short list of "common entry points" (NOW.md, IDEAS.md, MULTI_PRODUCT_ARCHITECTURE.md) so first-timers have a launchpad.

#### 13. Loader success line uses `<strong>` for numeric metrics but does not announce via aria-live

- **Location**: `apps/hangar/src/routes/(app)/docs/+page.svelte:28-35`
- **Problem**: The `{#if form?.ranLoader}` block becomes a paragraph with three numbers but no `aria-live="polite"` region. Keyboard / screen-reader users who fired the action don't hear the result.
- **Why it matters**: Action feedback for assistive tech.
- **Fix**: Wrap the success block in `<p role="status">` (implicit polite live region).

#### 14. Search box has no visible "search docs" affordance until you focus

- **Location**: `apps/hangar/src/routes/(app)/docs/+layout.svelte:30` and `DocsSearchBox.svelte:113`
- **Problem**: The placeholder is "Search docs" but there is no icon (the design.md sketch shows a `[Search ⌕]` glyph). The input is right-aligned at the top with no surrounding label. On a 1440px screen it can be missed entirely; on narrow screens the rail-vs-main split eats most of the topbar.
- **Why it matters**: Discoverability. A core feature should look like a feature.
- **Fix**: Add a leading magnifying-glass icon (existing icon set in `libs/ui`?), set `aria-label` already done, but also surface a keyboard hint such as `Ctrl+K` / `/` to focus the input. Not in the spec, but the design sketch shows it; matching that.

#### 15. Search box position resets when the page navigates between docs

- **Location**: `apps/hangar/src/routes/(app)/docs/+layout.svelte:6` and `DocsSearchBox.svelte:26`
- **Problem**: `query`, `hits`, `open`, `activeIndex` are component-local `$state` -- they reset every time the layout re-mounts. SvelteKit shared layouts persist their script state across child route navigations, so this is fine in theory; in practice if a user opens a search result, the popover closes (because `goto` triggers a layout transition) and their query is lost.
- **Why it matters**: Workflow-breaking for "search, peek, come back, refine query." User has to retype.
- **Fix**: Persist the search query in URL (`?q=`) or in a small store. Or accept the current behavior but auto-open the popover when the user lands somewhere with `q` set.

#### 16. Empty search query renders a popover that says "No matches"

- **Location**: `DocsSearchBox.svelte:123-128`
- **Problem**: `{#if open && (loading || hits.length > 0 || query.trim() !== '')}` -- when `query.trim() === ''` the popover hides, good. But: the `query.trim() !== ''` branch also fires when the user has typed one space and not enough characters to match anything; then "No matches" shows after debounce. Misleading.
- **Why it matters**: Friction on the first character. The user feels they have searched and failed when they just typed a partial token.
- **Fix**: Only show the popover when `hits.length > 0` OR `(loading && query.length >= MIN_QUERY_LEN)`. `MIN_QUERY_LEN = 2` is conventional.

#### 17. Frontmatter rail shows raw values; status fields look identical to other entries

- **Location**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:80-85`
- **Problem**: The rail dl renders every key/value identically. `status: ready-for-review`, `review_status: pending`, `type: spec` all look the same. Spec asks for "small panel (status, review_status, type, dates)" -- the implementation surfaces them but does not pill/colour the status fields, so a reader has to read every value to find the two important ones.
- **Why it matters**: Visual scanning. The whole point of putting frontmatter in a rail is to glance at status without reading the doc.
- **Fix**: Promote `status` and `review_status` to top of the dl with status-pill styling (`unread` / `reading` / `done` colors; `pending` / `done` colors). Group "type" and "title" next; lump dates and other fields beneath a "More" summary or below a divider.

#### 18. Frontmatter rail renders even when there is one entry of frontmatter ceremony but nothing useful

- **Location**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:76-86`
- **Problem**: The condition is `data.entries.length > 0`. A file like `--- last-updated: 2024-01-01 ---` still triggers the rail, taking 14-18rem of horizontal space for a one-row dl. Over-eager.
- **Why it matters**: Wasted real estate on docs whose frontmatter does not earn a sidebar.
- **Fix**: Only render the rail when at least one of `status`, `review_status`, `type`, `title`, `category`, `feature`, or another known set is present. Otherwise, inline the entries in a footer or hide them entirely.

#### 19. FileTree uses `aria-selected="false"` on directory rows and `role="tree"`/`role="treeitem"` without `tabindex` management

- **Location**: `libs/ui/src/components/FileTree.svelte:99-141`
- **Problem**: The tree has `role="tree"` and child `role="treeitem"` but the treeitem rows have no `tabindex` (the contained `<button>`/`<a>` are tabbable, but the WAI-ARIA tree pattern expects exactly one element with `tabindex=0` and the rest `tabindex=-1`, with arrow-key navigation between rows). As built, Tab cycles through every directory toggle and every file link -- not a tree, just a long list of buttons and links.
- **Why it matters**: Keyboard-only users cannot use Up/Down/Left/Right to navigate the tree; they must Tab through every element. UX that diverges from the role they declared.
- **Fix**: Either (a) drop the tree roles and accept it is a nested list of links/buttons (the `role="tree"`/`treeitem` markup is misleading), or (b) implement the keyboard pattern: arrow keys move row-to-row, Enter activates, single roving `tabindex`. (a) is the smaller change for v1.

#### 20. No active highlight on the docs index when at `/docs` exactly

- **Location**: `apps/hangar/src/routes/(app)/docs/+layout.svelte:13-15`
- **Problem**: `activePath` is `undefined` on `/docs` (no `[...path]` segment). The tree has nothing highlighted, which is correct; but `data.now` shows NOW.md, which IS one of the tree files (`docs/work/NOW.md`). The user sees NOW.md content on the right but the tree gives no hint about that.
- **Why it matters**: Mental model gap. "Where am I?" The page is rendering NOW.md but the tree has it un-highlighted, so the user thinks they are on a separate landing.
- **Fix**: When `data.now` is non-null on `/docs`, set `activePath` to `'docs/work/NOW.md'` (and ensure the path matches the tree node's `path`). Treat "/docs" as "implicit pointer at NOW.md."

### Nit

#### 21. Loader success metric labels are too compact

- **Location**: `apps/hangar/src/routes/(app)/docs/+page.svelte:28-35`
- **Problem**: "FTS: **4666** added, **0** updated, **0** removed." Reads like log output.
- **Fix**: "Indexed 4,666 files (0 updated, 0 removed) in 3.2 s." Localized number, sentence shape.

#### 22. `Searching…` ellipsis should match the project's other loading states

- **Location**: `DocsSearchBox.svelte:126`
- **Problem**: Uses single-character `…` literal. Other loading lines elsewhere use `Loading...` or a spinner.
- **Fix**: Pick one and use it everywhere; minor consistency item.

#### 23. The `"file-tree-open"` storageKey is generic enough to collide

- **Location**: `libs/ui/src/components/FileTree.svelte:39`
- **Problem**: Default is `file-tree-open`; if FileTree is mounted twice in the same app on different roots (unlikely now but possible), they share state. The hangar passes `hangar:docs:open-dirs` which is fine. The default just smells.
- **Fix**: Make `storageKey` required (no default) and force callers to pick a namespaced key.

#### 24. Inline arrow chevrons (`▾`/`▸`) are font-dependent

- **Location**: `libs/ui/src/components/FileTree.svelte:116`
- **Problem**: Using Unicode geometric shapes; they are sized off-grid against the body font and may render as boxes on locked-down systems. The hangar already has icon primitives.
- **Fix**: Swap to actual chevron icons from the icon set if there is one, or SVG inlines.

#### 25. `onclick={() => (open = false)}` on hit anchor closes the popover before `goto` fires

- **Location**: `DocsSearchBox.svelte:132`
- **Problem**: The anchor has `href={ROUTES.HANGAR_DOCS_PATH(hit.path)}` and an onclick that toggles state. Browsers handle the navigation via the href; the onclick assignment is fine but redundant given the `setTimeout(() => open = false, 150)` blur handler. Two close paths.
- **Fix**: Drop the onclick; rely on the blur handler. Or skip the blur handler and only close on explicit user action. Pick one.

## Areas verified clean

- Search-box debounce length (200 ms) is in the right window for typeahead.
- Search-box ARIA combobox/listbox roles, `aria-expanded`, `aria-controls`, `aria-selected` per option are correctly placed.
- Server-side path traversal gate (`isDocsPathAllowed`) is solid: rejects `..`, non-md, and non-allow-listed roots; covered by tests.
- Mobile / narrow viewport: layout collapses to single column at 800px, frontmatter rail collapses to single column at 900px. Both reasonable breakpoints.
- Sidebar `Docs` entry has correct active-state via `aria-current="page"` and matches the `(app)` shell pattern.
- Auth gate: every load and the search endpoint correctly call `requireRole(AUTHOR, OPERATOR, ADMIN)`.
- File tree first-paint is collapsed (no SSR/hydration mismatch).
- Internal `.md` link rewrite resolves relative paths against current dir and rejects schemes outside the allow-list.
