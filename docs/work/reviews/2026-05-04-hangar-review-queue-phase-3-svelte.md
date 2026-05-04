---
title: 'Phase 3 Svelte Review: Hangar Review Queue'
reviewer: svelte
date: 2026-05-04
diff: 642669cd...f7ec6c19
---

# Phase 3 Svelte Review: Hangar Review Queue

## Summary

- Files reviewed: 14 (3 `.svelte`, 6 `.ts` route loaders / endpoints / BC, 1 BC test, 1 BC index re-export, 1 `Nav.svelte` add-link, plus the 2 new `.svelte` components themselves -- `FileTree.svelte` and `DocsSearchBox.svelte`)
- Critical: 0
- Major: 4
- Minor: 6
- Nit: 5

Overall the diff is solidly Svelte 5: runes-only, no `export let` / `$:` / `<slot>` / Svelte 4 stores, `$app/state` is used, snippets + `{@render}` carry the `FileTree` recursion, and props are typed inline with `$props()`. The biggest issues are not framework violations but design-spec drift (rolling a bespoke markdown renderer + ~80 lines of `:global(prose ...)` CSS in a route file instead of mounting the existing `<RenderedSection>` per design.md), a combobox missing `aria-activedescendant`, two Svelte timer leaks (debounce + blur close) with no `$effect` cleanup, and a form action that doesn't `use:enhance`.

## Findings

### Critical

(none)

### Major

#### MAJOR: `[...path]/+page.svelte` rolls a bespoke renderer + styles instead of reusing `<RenderedSection>` per design.md

- **File**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:1-195`
- **Problem**: design.md Surface 1 states "rendered markdown using the existing `RenderedSection` / library renderer, so tables align, code is syntax-highlighted, internal links between docs work, ADRs render cleanly." The implementation imports `renderMarkdown` from `@ab/utils` directly, runs `rewriteDocsLinks` over the resulting HTML string, then ships ~80 lines of `.prose :global(h1)` / `:global(pre)` / `:global(code)` / `:global(table)` / `:global(th)` / `:global(td)` / `:global(a)` styling **inside the route file**. The skill rubric explicitly bans visual CSS in route files ("colors, font styles, borders, shadows, backgrounds, padding on visual elements ... belong in components in `libs/ui/` driven by design tokens"). Because `<RenderedSection>` exists in `libs/library/` and already wraps `renderMarkdown` + figure handling for the flightbag, this is divergence from the design AND a route-file-CSS-bloat finding rolled into one.
- **Why it matters**: every doc rendered through `/docs/[...path]` now bypasses the canonical reference renderer. Future styling changes (e.g. table affordances, code highlighting, figure handling) have to be made in two places. The internal-link rewrite is a useful add, but it should be a prop (or post-process) on `<RenderedSection>`, not a parallel implementation that duplicates 80 lines of prose CSS.
- **Fix**: replace the inline `<article class="prose">{@html bodyHtml}</article>` block with `<RenderedSection content={data.body} ... />`. If `<RenderedSection>` doesn't yet expose a "rewrite hrefs" hook, add a `linkResolver?: (href: string) => string` prop to it (one place, reused on the flightbag too) and pass `(href) => rewriteOne(href, data.repoRelPath)`. Move the `rewriteDocsLinks` / `resolveRelativeRepoPath` helpers into `libs/library` or `libs/utils` next to the renderer. Strip the entire `:global(...)` block from the route file. The route's `<style>` should be reduced to layout-only (the existing `.docs-page`, `.grid`, `.frontmatter` rules).

#### MAJOR: Combobox missing `aria-activedescendant` -- arrow-key selection is invisible to screen readers

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:109-122` (input + wrapper) and `:130-139` (`<li role="option">`)
- **Problem**: this is a WAI-ARIA combobox pattern (`role="combobox"`, `aria-controls`, listbox + options). When the user presses ArrowDown / ArrowUp, `activeIndex` updates and the matching `<li>` gets `class="active"` + `aria-selected="true"`, but the input never advertises *which* option is active. The combobox spec requires `aria-activedescendant={idOfActiveOption}` on the input (or on the combobox element) so an AT user knows the focus shifted to the new option without losing input focus. Right now, screen-reader users hitting ArrowDown hear nothing change.
- **Why it matters**: the search box is the primary navigation affordance for `/docs`. A11y at the Svelte level is part of this rubric. This is a real keyboard-only / SR-only break, not a polish item.
- **Fix**: give each option a stable id and wire `aria-activedescendant`:

  ```svelte
  <input
    ...
    aria-activedescendant={activeIndex >= 0 ? `docs-search-opt-${activeIndex}` : undefined}
  />
  ...
  <li id={`docs-search-opt-${idx}`} class="hit" class:active={idx === activeIndex} role="option" ...>
  ```

  Also consider moving `role="combobox"` from the wrapping `<div>` onto the `<input>` itself (WAI-ARIA 1.2 pattern), and dropping `aria-owns` (deprecated; `aria-controls` covers it).

#### MAJOR: `setTimeout` debounce + blur-close are not cleaned up on unmount

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:62-65, 97-102`
- **Problem**: two `setTimeout`s outlive the component. The debounce timer (`debounceTimer = setTimeout(() => { void runSearch(query); }, ...)`) is only cleared when *another* keystroke comes in. The blur-close (`setTimeout(() => { open = false; }, 150)`) has no cleanup at all. If the user types, then navigates away within the debounce window (or focuses out then unmounts within 150ms), the timer fires after destroy: `runSearch` issues a `fetch` and writes `hits = []` / `loading = ...` on a torn-down component, and the blur timer writes `open = false` likewise. Svelte 5 tolerates orphan-state writes without crashing, but `runSearch` also dispatches a no-longer-needed network request and the lingering closure pins the component graph until it resolves.
- **Why it matters**: the route layout is the search box's parent, but route navigation unmounts/re-mounts the layout in some hash-link / nested-route flows. This is the classic "I built the search box outside an effect" trap.
- **Fix**: move the timer plumbing into `$effect` so Svelte handles cleanup, or expose an explicit teardown:

  ```ts
  $effect(() => {
    return () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
    };
  });
  ```

  Same for the blur-close timer (track it in a separate `let blurTimer` and cancel it on cleanup, on focus, and on Escape). Also drop the `$state<...>` wrapper on `debounceTimer` (see the corresponding minor finding) -- it's never read by the template, so it doesn't need to be reactive.

#### MAJOR: `runLoader` form action does not use `use:enhance` -- full page reload + no progress

- **File**: `apps/hangar/src/routes/(app)/docs/+page.svelte:23-26`
- **Problem**: the empty-index nudge is `<form method="POST" action="?/runLoader">` with a plain submit button. The action triggers a filesystem walk over four roots (`docs`, `course`, `handbooks`, `regulations`), upserts FTS rows, returns a result. Without `use:enhance`, submitting reloads the entire page (and every layout above it), which is jarring and loses the `form?.ranLoader` toast on subsequent navigations. The skill rubric specifically asks "Form actions use `use:enhance` for progressive enhancement?".
- **Why it matters**: this is the ingress for a multi-second job. The user gets no spinner, no disabled button, no "still working" state -- they get a frozen page until the redirect lands. Standard SvelteKit pattern is `use:enhance` with a `pending` flag.
- **Fix**:

  ```svelte
  <script lang="ts">
    import { enhance } from '$app/forms';
    let running = $state(false);
  </script>

  <form method="POST" action="?/runLoader" use:enhance={() => {
    running = true;
    return async ({ update }) => {
      await update();
      running = false;
    };
  }}>
    <button type="submit" disabled={running}>{running ? 'Running…' : 'Run loader'}</button>
  </form>
  ```

### Minor

#### MINOR: `FileTree`'s open-dirs `$effect` only auto-expands the active chain on first ever load

- **File**: `libs/ui/src/components/FileTree.svelte:50-75`
- **Problem**: the effect does `if (!raw) { /* expand active chain */; return; }`. Once the user toggles any directory, `localStorage` is non-empty, so all subsequent navigations skip the active-chain expansion entirely. Click a file deep under a collapsed branch and the tree won't open the path to highlight it.
- **Why it matters**: the active highlight (`aria-current="page"` + `.active`) is only useful if the chain is open. Spec.md design.md says "Active file highlighted in the tree" -- the highlight exists, but in steady-state it's invisible.
- **Fix**: split into two concerns: (1) load persisted open-dirs once, (2) merge in the active chain whenever `activePath` changes. Keep both in `$effect` blocks but make the second a proper `$derived`-then-merge so a new active path always opens its ancestors without clobbering the user's other expansions.

  ```ts
  $effect(() => {
    // load persisted -- once per storageKey
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try { /* parse + set */ } catch { /* ignore */ }
  });

  $effect(() => {
    // ensure active chain is expanded
    if (!activePath) return;
    const parts = activePath.split('/');
    let prefix = '';
    const next = new Set(openDirs);
    for (let i = 0; i < parts.length - 1; i++) {
      prefix = prefix === '' ? (parts[i] ?? '') : `${prefix}/${parts[i]}`;
      if (prefix !== '') next.add(prefix);
    }
    if (next.size !== openDirs.size) openDirs = next;
  });
  ```

#### MINOR: Search-result `<a onclick={() => (open = false)}>` races the parent's `onBlur` 150 ms timeout

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:97-102, 132`
- **Problem**: when the user clicks a hit, the input fires `blur` -> 150 ms later `open = false`. The hit's own `onclick` also sets `open = false`. Native click navigates the link (so visual races aren't user-visible), but the blur timer outlives navigation; if another result list is opened immediately the timer can close it. Also, mousedown on the popover races the input's blur event in some browsers -- the canonical fix is to suppress blur on popover mousedown.
- **Why it matters**: subtle but reproducible flicker; once major #3 is fixed (cleanup), this becomes the right home for `mousedown.preventDefault()` instead of a hard-coded 150ms.
- **Fix**: replace the blur timer with `onmousedown={(e) => e.preventDefault()}` on the `<ul class="results">` (keeps focus on the input while click runs) and close the popover only on Escape, on Enter-to-navigate, and on `focusout` to a target outside the wrapper. Track popover `mousedown` instead of guessing 150ms.

#### MINOR: `aria-controls`/`aria-owns` duplication on combobox wrapper

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:109`
- **Problem**: the wrapper has both `aria-controls="docs-search-results"` and `aria-owns="docs-search-results"`. `aria-owns` is deprecated for combobox in WAI-ARIA 1.2; the listbox is already DOM-adjacent and `aria-controls` is sufficient. Some screen readers re-announce the listbox twice when both are present.
- **Why it matters**: minor a11y noise, not a break.
- **Fix**: drop `aria-owns`. Move `role="combobox"` from the wrapper to the `<input>` (1.2 pattern) while you're there.

#### MINOR: `$page.svelte` for `/docs` index ships visual button styling in a route file

- **File**: `apps/hangar/src/routes/(app)/docs/+page.svelte:65-110`
- **Problem**: the route's `<style>` block has `.loader-prompt button { padding ... border ... border-radius ... background: var(--action-default-wash); ... }` and `.prose :global(h1)` / `:global(p)` / `:global(code)` / `:global(a)`. The skill rubric: "Only layout/flow CSS is acceptable in routes." Visual button styling and prose tokens belong in a shared component (a `<PrimaryButton>` and the `<RenderedSection>` consolidation in major #1 cover both).
- **Why it matters**: the same prose styles are duplicated in `[...path]/+page.svelte` (~80 lines) and now here (~30 lines). When tokens shift, two route files need touching.
- **Fix**: replace the loader-form button with whatever the existing primary-button affordance is in `libs/ui` (or extract one). Replace `<article class="prose">` with `<RenderedSection ... />` per major #1.

#### MINOR: `inputEl` is bound but never used

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:31, 110`
- **Problem**: `let inputEl = $state<HTMLInputElement | null>(null)` is declared and `bind:this={inputEl}` is set, but no code ever reads `inputEl`. Dead reactive state.
- **Why it matters**: no functional impact, but it's the kind of leftover that gets copy-pasted into the next combobox and used to focus on Escape (a feature Escape would otherwise want anyway).
- **Fix**: either remove `inputEl` entirely, or use it -- e.g., `inputEl?.focus()` after `Escape` so focus stays on the input after closing the popover.

#### MINOR: Plural treeitems missing `aria-level` / `aria-posinset` / `aria-setsize`

- **File**: `libs/ui/src/components/FileTree.svelte:108-129`
- **Problem**: the tree uses `role="tree"` + `role="treeitem"` correctly, but each treeitem has no `aria-level`, `aria-posinset`, or `aria-setsize`. WAI-APG tree pattern recommends all three so AT can announce "level 3, item 2 of 5". Without them, a screen-reader user navigating the tree hears flat siblings with no nesting cue.
- **Why it matters**: the tree is the primary nav for `/docs` and is recursive -- depth + position is the whole point.
- **Fix**: thread `depth` (already a snippet param) into `aria-level={depth + 1}` and pass position info from the `{#each}`:

  ```svelte
  {#each roots as node, idx (node.path)}
    {@render renderNode(node, 0, idx + 1, roots.length)}
  {/each}

  {#snippet renderNode(node, depth, posInSet, setSize)}
    <li role="treeitem" aria-level={depth + 1} aria-posinset={posInSet} aria-setsize={setSize} ...>
  ```

  Also: keyboard navigation in a tree expects ArrowLeft/ArrowRight/Up/Down + Home/End to move between treeitems; right now the only keyboard affordance is tab-through. That's a deeper a11y story; flag it if the tree is meant to be a real APG tree, leave it as a list-of-links if not (in which case `role="tree"` itself is wrong and should drop). Pick one.

### Nit

#### NIT: `debounceTimer` does not need to be `$state`

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:31`
- **Problem**: `debounceTimer` is never read by the template, only by `onInput`. Wrapping it in `$state` adds a reactive proxy for nothing.
- **Fix**: `let debounceTimer: ReturnType<typeof setTimeout> | null = null;` -- plain `let`.

#### NIT: Use `event.preventDefault()` consistently in keyboard handler

- **File**: `apps/hangar/src/lib/components/DocsSearchBox.svelte:67-95`
- **Problem**: `Escape` does not `event.preventDefault()`. In some embedded contexts (modals etc.), Escape might bubble to a parent. Cheap defense to `preventDefault()` after handling.
- **Fix**: add `event.preventDefault()` in the Escape branch (matches the ArrowUp/Down/Enter style).

#### NIT: Inline `style="padding-left: calc(...)"` in `FileTree`

- **File**: `libs/ui/src/components/FileTree.svelte:112, 133`
- **Problem**: indentation per depth uses an inline `style` attribute. Works, but a CSS variable on the row (`style="--depth: {depth}"`) plus a class rule (`padding-left: calc(var(--depth) * var(--space-md) + var(--space-xs));`) keeps the cascade clean and is more themable.
- **Fix**: pass `--depth` as a custom property and move the calc into the `<style>` block.

#### NIT: `tree-row` button + `<a>` mix means click target is inconsistent for dirs vs files

- **File**: `libs/ui/src/components/FileTree.svelte:108-140`
- **Problem**: dir rows are `<button>` (toggle), file rows are `<a href>`. Both are valid, but the visual treatment is identical -- a user can't tell from the row which kind of click target they have until hovering. Also, dirs have no "navigate to dir" affordance at all (clicking a dir only toggles).
- **Fix**: optional -- consider a separate chevron-only `<button>` for the toggle and a row `<a>` for "navigate to dir index" if/when dir landing pages exist. Defer until that's a real ask.

#### NIT: Route `+page.svelte` keeps an unused-on-render `aside.frontmatter` style for empty `entries`

- **File**: `apps/hangar/src/routes/(app)/docs/[...path]/+page.svelte:76-87`
- **Problem**: `{#if data.entries.length > 0}` already gates the aside; the styles always ship. Negligible. Worth bundling into the `<RenderedSection>` consolidation if the renderer learns to surface a frontmatter side-rail itself.
- **Fix**: roll into the major #1 consolidation; not worth a standalone change.

## Areas verified clean

- **Runes only.** Every reactive state is `$state`, every computed value is `$derived`, every side effect is `$effect`. No `$:`, `export let`, `<slot>`, `writable`, `readable`, or `$app/stores` in the diff.
- **Snippets.** `FileTree.svelte` uses recursive `{#snippet renderNode(...)}` + `{@render renderNode(node, 0)}`, correctly typed. No legacy slots.
- **`$props()` destructuring.** All three `.svelte` files destructure props inline with types -- including `Snippet` typing for `children` in the docs layout.
- **`$app/state` vs `$app/stores`.** `Nav.svelte` and `+layout.svelte` use `import { page } from '$app/state'` correctly.
- **Path aliases.** All cross-lib imports use `@ab/*` (`@ab/constants`, `@ab/utils`, `@ab/ui/components/...`, `@ab/bc-hangar`). No relative cross-lib paths.
- **Routes via `ROUTES`.** `ROUTES.HANGAR_DOCS` and `ROUTES.HANGAR_DOCS_PATH(...)` are used everywhere; the only stringy comparisons are against `ROUTES.HANGAR_DOCS` and the legitimate `/handbook-asset/` literal in the link rewriter (worth a constant later, but out of scope).
- **No `any` / no `!` non-null assertions** in the .svelte files. The one `(data.tree as ReadonlyArray<FileTreeNode>)` cast in the layout is the cross-lib row-shape narrowing -- acceptable, since `LayoutData` types it as the BC's `DocsTreeNode` and the UI component's `FileTreeNode` shape is structurally identical.
- **Server-only code in `.server.ts`.** Filesystem reads (`node:fs/promises`, `node:path`) live in `+page.server.ts` / `+layout.server.ts` / the BC, never in `+page.svelte`. The browser bundle stays clean.
- **`requireRole` on every load + the JSON endpoint.** The auth gate is correctly re-applied in `search.json/+server.ts` (which doesn't walk the layout), matching the pattern docs.
- **Hydration safety.** `FileTree` SSRs with `openDirs = new Set()` (everything closed) and the `$effect` populates from `localStorage` after mount, with `typeof window === 'undefined'` guards. No SSR/CSR mismatch.
- **Search-result XSS.** `{@html hit.snippet}` is the only `@html` in the new code; it consumes Postgres `ts_headline` output, which HTML-escapes the source body and only injects `<mark>` / `</mark>` literally per `StartSel` / `StopSel`. The comment in the file documents the contract. Safe.
- **Markdown link rewrite.** `rewriteDocsLinks` is a `$derived` of `data.body`/`data.repoRelPath`, pure, no DOM access, deterministic on SSR + client.
- **`docs-tree.ts`** correctly stays under `libs/bc/hangar/` (server-only) so its `node:fs/promises` import doesn't reach the browser bundle. The `isDocsPathAllowed` predicate is pure and tested.
