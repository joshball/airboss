---
feature: hangar-cluster
category: svelte
date: 2026-05-02
branch: main
reviewer: ball-review-svelte
scope:
  - apps/hangar/src/**/*.svelte
  - apps/hangar/src/**/*.svelte.ts
files_reviewed: 34
counts:
  critical: 0
  major: 5
  minor: 9
  nit: 6
status: pending
review_status: done
---

## Summary

Hangar cluster is fully on Svelte 5 runes. No `export let`, no `$:`, no `<slot>`, no Svelte 4 stores, no `$app/stores`. Snippets and `$app/state` are used consistently. Reactivity is correct overall.

The dominant finding is a violation of the rubric's "no visual CSS in routes -- belongs in `libs/ui`" rule. Almost every route `+page.svelte` ships 100-400 lines of `<style>` defining the same primitives (tables, badges, role pills, filter bars, status chips, "btn-like" anchors, pagination links, breadcrumbs, page-shell flex column). These primitives are duplicated 4-9x across routes and should be extracted into `libs/ui` (e.g. `DataTable` already exists; matching `Badge`, `RolePill`, `StatusChip`, `FilterBar`, `Breadcrumbs`, `LinkButton`, `PageShell` would eliminate the duplication). Filing this as a single major rather than per-file because the right fix is one library pass, not 12 inline edits.

A second cluster: `lib/components/MarkdownPreview.svelte` and `lib/components/preview/MarkdownPreview.svelte` are different components sharing the same basename. This breaks scan-by-name navigation and produces ambiguous import autocompletes; rename one.

Effect plumbing has a few non-idiomatic patterns (explicit `void _trigger;` reads to force tracking, `// svelte-ignore state_referenced_locally` sprinkled at the top of nearly every page that seeds state from a prop). These are working idioms but indicate that the seeding pattern could be tightened with `$state` initializers that read the prop once at instantiation, or by deriving from the prop with a guarded effect.

No reactivity bugs found. No Svelte 4 holdovers. No accidental `<slot>`s. Snippet API is used correctly with `{@render}` and `{#snippet}`.

## Issues

### MAJOR: Visual CSS belongs in `libs/ui`, not in route files

File: `apps/hangar/src/routes/(app)/**/+page.svelte` (12 of 13 route files)

Problem: Per the rubric, route files should be MINIMAL or have NO `<style>` block; visual CSS (tables, badges, pills, filter bars, status chips, "btn-like" anchors, breadcrumbs, the page-shell flex column, pagination link styling) belongs in `libs/ui` components. Today these primitives are inlined and duplicated across the cluster:

- `.table-wrap` + `<table>` + `<thead>` styling: duplicated in `admin/audit/+page.svelte`, `glossary/+page.svelte`, `glossary/sources/+page.svelte`, `jobs/+page.svelte`, `sources/+page.svelte`, `users/+page.svelte`, `users/[id]/+page.svelte` (7 copies). `libs/ui/components/DataTable.svelte` already exists and is used by `CsvPreview.svelte`; bring all route tables under it.
- `.badge.dirty` / `.badge.clean` / `.badge.deleted` / `.badge.banned`: duplicated in `glossary/+page.svelte`, `glossary/[id]/+page.svelte`, `glossary/sources/+page.svelte`, `glossary/sources/[id]/+page.svelte`, `users/+page.svelte`, `users/[id]/+page.svelte`. Extract `Badge` with a `tone` prop.
- `.role-pill`: duplicated in `(app)/+layout.svelte`, `admin/audit/[id]/+page.svelte`, `users/+page.svelte`, `users/[id]/+page.svelte`. Extract `RolePill`.
- `.status-chip` + `.status-{tone}`: duplicated in `jobs/+page.svelte`, `jobs/[id]/+page.svelte`. Extract `StatusChip`.
- `.btn-like` (anchors styled like buttons): duplicated in `sources/[id]/+page.svelte`, `sources/[id]/upload/+page.svelte`. Extract `LinkButton` (or pass an `href` to `Button`).
- `.crumbs` (breadcrumb): duplicated in `glossary/[id]/+page.svelte`, `glossary/sources/[id]/+page.svelte`, `sources/[id]/+page.svelte`, `sources/[id]/diff/+page.svelte`, `sources/[id]/files/+page.svelte`, `sources/[id]/upload/+page.svelte`, `admin/audit/[id]/+page.svelte`. Extract `Breadcrumbs`.
- `.filter-bar` skin (panel + grid + label/input combo): duplicated in `admin/audit/+page.svelte`, `glossary/+page.svelte`, `glossary/sources/+page.svelte`, `jobs/+page.svelte`, `users/+page.svelte`. Extract `FilterBar`.
- `.btn` + `.btn.secondary` (anchor button) duplicated in `glossary/+page.svelte` and `glossary/sources/+page.svelte` even though `<Button>` is imported -- the existing component should accept `href` to render as an anchor.
- `.page` flex column shell + `.cancel` + `.footer` duplicated in `glossary/[id]/+page.svelte`, `glossary/new/+page.svelte`, `glossary/sources/[id]/+page.svelte`, `glossary/sources/new/+page.svelte`. Extract `FormShell` or compose with existing `FormStack`.
- `.delete-form` + `.delete-btn` (hazard-styled destructive form) duplicated in `glossary/[id]/+page.svelte` and `glossary/sources/[id]/+page.svelte`. The site that needs it most (`users/[id]/+page.svelte`) already uses `ConfirmDialog`; the others should adopt the same pattern.

Fix: Land a `libs/ui` pass that introduces the primitives above, then strip the inline `<style>` blocks from the routes. Route `<style>` blocks should be reduced to layout-only rules (page padding, grid template) or empty. This is one work package, not 12 ad-hoc edits.

### MAJOR: Two `MarkdownPreview.svelte` files in the hangar `$lib`

File: `apps/hangar/src/lib/components/MarkdownPreview.svelte` and `apps/hangar/src/lib/components/preview/MarkdownPreview.svelte`

Problem: Two unrelated components share the same basename. The first is the live editor preview used by `ReferenceForm.svelte` (renders user-typed paraphrase markdown via `@ab/utils` `renderMarkdown`). The second is the file-preview tile used by `sources/[id]/files/+page.svelte` (renders pre-parsed Shiki AST via `@ab/help/ui/MarkdownBody.svelte`). Same name, different purpose, different props, different render path.

Fix: Rename one. `lib/components/preview/MarkdownPreview.svelte` -> `lib/components/preview/MarkdownFilePreview.svelte` (matches its sibling `PdfPreview`, `JpegPreview`, `ZipPreview`, etc., which are file-level previews) and update the import in `sources/[id]/files/+page.svelte`. Or rename the form-side one to `MarkdownLivePreview.svelte`.

### MAJOR: Repeated `// svelte-ignore state_referenced_locally` for prop-seeded state

Files: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte` (4 occurrences), `apps/hangar/src/routes/(app)/glossary/+page.svelte` (5), `apps/hangar/src/routes/(app)/glossary/sources/+page.svelte` (4), `apps/hangar/src/routes/(app)/jobs/+page.svelte` (2), `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte` (5), `apps/hangar/src/routes/(app)/users/+page.svelte` (1), `apps/hangar/src/lib/components/SourceForm.svelte` (1 -- but this one uses `untrack` correctly), `apps/hangar/src/lib/components/ReferenceForm.svelte` (1), `apps/hangar/src/routes/login/+page.svelte` (1).

Problem: The pattern is `let x = $state(data.filters.x);` to seed local edit state from a prop. The compiler warns because the prop reference would cause the effect that wraps `$state` to re-run on prop change. Today every route silences with the comment, which both clutters the code and signals an inconsistent strategy: `SourceForm.svelte` uses `untrack(() => initial.type)`, which is the idiomatic fix and works without a suppression comment. Other call sites should follow the same pattern.

Fix: Standardise on `untrack()` for prop-seeded state, or factor a `$state` initializer helper. Drop the `svelte-ignore` comments once tracking is correct. Pick one and apply uniformly across the cluster.

### MAJOR: `FlowDiagram.svelte` `$effect` reads booleans only to force re-run

File: `apps/hangar/src/lib/components/FlowDiagram.svelte:139-158`

Problem: The effect contains `void manifestBusy; void validationBusy;` with a comment "Re-run when busy state flips so arrows redraw with the active class." This is misleading. `recomputeArrows()` already reads `manifestBusy` and `validationBusy` to set `arrows[i].busy`, so the effect already tracks them via the function call. The explicit `void` reads are redundant. Worse, the effect also subscribes to a `ResizeObserver` that re-runs `recomputeArrows()`, so the effect's body is doing two jobs (initial paint + RO setup) and re-runs on every busy flip, tearing down and recreating the observer each time.

Fix: Split the effect. One effect installs the `ResizeObserver` and `window.resize` listener (depends on `containerEl` and the tile refs). A second `$derived` or smaller `$effect` recomputes arrows from busy state. Drop the `void` reads. Or, better, move `arrows` to a `$derived` that depends on the layout snapshot + busy state and lift the side-effectful geometry measurement into a `$state` updated by the observer.

### MAJOR: `audit/[id]/+page.svelte` `setTimeout` for clipboard reset has no cleanup

File: `apps/hangar/src/routes/(app)/admin/audit/[id]/+page.svelte:69-85`

Problem: `copyToClipboard` schedules a 1500 ms `setTimeout` to reset `copyState[key]` to `'idle'`. If the user navigates away before the timer fires, the callback runs against a destroyed component and mutates `$state` that no longer matters; the leak itself is small, but the pattern silently relies on Svelte 5 tolerating writes to disconnected state. If the user clicks a second copy button before the first timer fires, the older timer can race and reset the new "Copied" label early.

Fix: Track the timer per key and clear before scheduling a new one. Tear down all pending timers on component teardown via an `$effect`'s return function or `onDestroy`. A `Map<key, timer>` keeps it tidy.

### MINOR: `jobs/[id]/+page.svelte` `pollLog` mutates state without guarding component lifetime

File: `apps/hangar/src/routes/(app)/jobs/[id]/+page.svelte:41-69`

Problem: `pollLog` is fired on a 1 Hz interval. If the request is in-flight when `isTerminal` flips and the effect's cleanup runs, the resolved promise still mutates `currentStatus`/`logs`/`latestSeq` after the polling effect has been torn down. Same lifetime issue as above. Less severe because the next render absorbs the value, but the request can also continue when the user navigates to a different job, scribbling over the new page's `latestSeq` if the component instance is reused.

Fix: Track an `aborted` boolean inside the effect and check it after `await fetch(...)`. Or use `AbortController` with the fetch and abort in the effect cleanup. Either also fixes the "two intervals running briefly during status flip" race.

### MINOR: `audit/+page.svelte` `targetIdValue` effect uses sentinel instead of named dependency

File: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte:132-149`

Problem: The effect declares `const _trigger = targetIdValue; void _trigger;` to force tracking, when the body already reads `targetIdValue.trim()` on the next line. The `void` lines are dead and the comment-free convention reduces readability. Same anti-pattern recurs in the same file lines 39-66 (`actorSearch`-driven typeahead), in `glossary/+page.svelte:60-74`, in `glossary/sources/+page.svelte:25-49`, in `jobs/+page.svelte:16-30`, in `users/+page.svelte:17-33`.

Fix: Remove the sentinel reads. `$effect` tracks every reactive read inside its body, including reads inside `setTimeout` callbacks if the read happens synchronously before the callback is scheduled. The pattern works without the sentinel.

### MINOR: `sources/[id]/diff/+page.svelte` uses array index as `{#each}` key

File: `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte:91-92`

Problem: `{#each lines as line, index (index)}` uses the array index as the key. When the diff text changes (e.g. a new `pollLog` after committing), Svelte will reuse spans by position, and lines that shift up/down won't re-render their `class="k-{kind}"` correctly. For a diff this typically isn't catastrophic because the text content is bound, but the class binding can lag.

Fix: Key on `${line.kind}:${line.text}` or compute a stable hash. Or accept the index key with an explicit comment ("diff lines have no stable identity; visual reuse is acceptable") so future readers don't second-guess it.

### MINOR: `audit/[id]/+page.svelte` `actorAllUrl` / `targetAllUrl` build URLs against `'https://placeholder'`

File: `apps/hangar/src/routes/(app)/admin/audit/[id]/+page.svelte:47-60`

Problem: Construction uses `new URL(ROUTES.HANGAR_ADMIN_AUDIT, 'https://placeholder')` to escape the `URL` constructor's requirement for an absolute base. The resulting `pathname + search` strips the placeholder cleanly, but the magic-string base is a code smell that surfaces in stack traces if `ROUTES.HANGAR_ADMIN_AUDIT` is ever swapped to a function. A safer pattern uses `URLSearchParams` directly without a base URL.

Fix: `const params = new URLSearchParams(); params.set(...); return \`${ROUTES.HANGAR_ADMIN_AUDIT}?${params.toString()}\`;` -- no fake base, no parsing pitfall.

### MINOR: `(app)/+layout.svelte` mirrors `data-appearance` in two places

File: `apps/hangar/src/routes/(app)/+layout.svelte:60-65,93-104`

Problem: The `$effect` at L60-65 already mirrors `selection.appearance` -> `<html data-appearance>`. The optimistic write inside `setAppearance` (L93-104) duplicates the logic, including a redundant `matchMedia` query when `value === 'system'`. The two paths can race: the optimistic write fires immediately, then `data` updates server-side, then the `$effect` re-runs and may overwrite. Today they converge, but the duplication is a hazard.

Fix: Drop the optimistic block; rely on the `$effect`. Or move the matchMedia branch into a derivable computed that the `$effect` reads, so both sites share one source of truth.

### MINOR: `audit/+page.svelte` actor menu has no keyboard navigation

File: `apps/hangar/src/routes/(app)/admin/audit/+page.svelte:289-300`

Problem: The combobox sets `aria-expanded`, `aria-controls`, `role="combobox"`, but the listbox children are `<button role="option">` and there's no `aria-activedescendant`, no arrow-key handler, no `Escape` close, no `Enter` to select. From a Svelte standpoint the structure is fine, but the keyboard contract is incomplete. Calling out under svelte review because the component shape is the right place to fix it.

Fix: Add a `keydown` handler on the input that scrolls a `selectedIndex` and calls `pickActor(actorOptions[selectedIndex])` on Enter; close on Escape; bind `aria-activedescendant` to the focused option's id. (A11y-specialist review will likely flag the same.)

### MINOR: `glossary/+page.svelte` filter `$effect` reads via sentinel array

File: `apps/hangar/src/routes/(app)/glossary/+page.svelte:60-74`

Problem: `const _deps = [searchValue, sourceTypeValue, knowledgeKindValue, flightRulesValue, dirtyOnlyValue]; void _deps;` uses an array sentinel to force tracking. As above, every read inside `buildFilterUrl()` already runs synchronously inside the effect, so the dependencies are tracked. The sentinel is dead.

Fix: Remove `_deps`. The `setTimeout` callback isn't synchronous, but `buildFilterUrl()` is called inside the timer, and the writes to `replaceState` happen in the timer too. Tracking still works because the `$effect` runs `buildFilterUrl()` once synchronously to compute the URL... actually no, it doesn't -- the body schedules the timer and exits. The sentinel IS load-bearing here. Recommend converting to a clearer pattern: compute the target URL via `$derived`, then have a small `$effect` debounce-push when the URL changes. That eliminates the sentinel and untangles "track" from "debounce".

### MINOR: `jobs/+page.svelte` `$effect` filter sync writes to URL even on initial load

File: `apps/hangar/src/routes/(app)/jobs/+page.svelte:16-30`

Problem: The effect runs on first mount with the initial values, computes a URL identical to the current one, hits the `if (url.search === page.url.search) return;` guard, and exits. That guard saves the navigation but the effect still runs N times on mount in a hot-reload session. Cheap enough but the pattern is repeated across 5 routes; a shared helper would be cleaner.

Fix: Same as above: derive the URL, push it once when changed, with a small dedupe on the URL string.

### MINOR: `+layout.svelte` (root) double-tracks system appearance with `(app)/+layout.svelte`

File: `apps/hangar/src/routes/+layout.svelte` and `apps/hangar/src/routes/(app)/+layout.svelte`

Problem: Both layouts install their own `matchMedia('(prefers-color-scheme: dark)')` listener and both write `<html data-appearance>`. The root layout writes for non-app routes (login); the (app) layout writes again under `/`. This means while inside the app, two listeners fire on every system theme change and two effects race to write the attribute (root sets the raw `appearancePref` mapping; (app) sets the resolved theme-locked appearance). The (app) effect runs second and wins, so the user sees correct state, but the root effect's write is wasted and can briefly flash a stale value.

Fix: Move the matchMedia + attribute write into the root layout only, and have `(app)/+layout.svelte` consume the resolved appearance from `data` plus a single shared `systemAppearance` rune (e.g. via a `lib/state/appearance.svelte.ts`). Or accept the redundancy and add a comment that the (app) layout intentionally over-writes.

### NIT: Repeated `formatBytes` helper across 7 files

Files: `FlowDiagram.svelte` (no), `SourcePreviewTile.svelte`, `preview/CsvPreview.svelte`, `preview/GeotiffPreview.svelte`, `preview/JpegPreview.svelte`, `preview/MarkdownPreview.svelte`, `preview/PdfPreview.svelte`, `preview/ZipPreview.svelte`, `sources/+page.svelte`, `sources/[id]/+page.svelte`, `sources/[id]/files/+page.svelte`.

Problem: 10 byte-into-units copies. They drift -- some return `'--'` for null, some `'0 B'`, some treat 0 differently. Not a Svelte issue per se but the duplication makes the components harder to reason about when comparing previews.

Fix: One `formatBytes` in `@ab/utils` (or `libs/ui` if it's display-only). Import everywhere. Drop locals.

### NIT: Repeated `formatDate` / `formatTime` / `formatTimestamp` helpers

Files: most route files.

Problem: 9+ inlined date formatters with slightly different `toLocaleString` option bags. Same hazard as `formatBytes`.

Fix: Centralise in `@ab/utils` with named presets (`formatDateShort`, `formatTimeHMS`, `formatTimestampWithSeconds`).

### NIT: `(app)/+layout.svelte` brand link reads `airboss / hangar`

File: `apps/hangar/src/routes/(app)/+layout.svelte:142`

Problem: Vocabulary docs (per `docs/platform/VOCABULARY.md` reference in CLAUDE.md) treat `/` in noun lists as compact list separator without spaces. The brand string surfaces with spaces around the slash in user-visible UI. Cosmetic only.

Fix: `airboss/hangar` (no spaces) -- but the brand format may be intentional; defer to the user.

### NIT: `Nav.svelte` active-route detection duplicates a four-line idiom

File: `apps/hangar/src/lib/components/Nav.svelte:18-29`

Problem: Same `$derived` boilerplate four times for sources / glossary / users / jobs. Extracting `function active(p: string): boolean { return page.url.pathname === p || page.url.pathname.startsWith(\`${p}/\`); }` once and calling it inside each `$derived` is tighter. Not load-bearing.

Fix: Extract the predicate. Or define a list `[ROUTES.HANGAR_SOURCES, ROUTES.HANGAR_GLOSSARY, ...]` and render via `{#each}`.

### NIT: `sources/[id]/diff/+page.svelte` `<pre>` template tightness

File: `apps/hangar/src/routes/(app)/sources/[id]/diff/+page.svelte:91-92`

Problem: The diff body packs the `{#each}` block inside `<pre>` with an embedded literal newline inside the `<span>` -- if Prettier or any auto-formatter touches the file, the whitespace flips and the diff renders with double newlines.

Fix: Render lines as `<div>` per line (CSS `white-space: pre`) instead of relying on raw `\n` inside the template, or set the line content via JS string join and use `{@html}` with appropriate escaping (the diff text is server-controlled but still untrusted -- prefer the `<div>` approach).

### NIT: `users/[id]/+page.svelte` `UserActionResult` is type-asserted client-side

File: `apps/hangar/src/routes/(app)/users/[id]/+page.svelte:14-22`

Problem: The handwritten type duplicates the server's action returns and notes "Keep in sync." This is the kind of drift CLAUDE.md flags. SvelteKit's generated `ActionData` is the canonical type; the comment admits it loses the discriminated shape, but a small server-side helper that returns a tagged union gets you both server narrowing and a single source of truth via `import type { ... }`.

Fix: Define the discriminated result type in the server file and `import type` it client-side. Drop the handwritten copy.

### NIT: `(app)/+layout.svelte` `details` menu uses `bind:this` for keyboard handler

File: `apps/hangar/src/routes/(app)/+layout.svelte:126-136`

Problem: `<svelte:window onkeydown={handleMenuKeydown} />` listens globally and closes the menu on Escape. This works but listens for keydown on every route while signed in. A locally-scoped `onkeydown` on the `<details>` element (or a `keydown` capture wrapper) would be smaller and clearer.

Fix: Drop `<svelte:window>` and put `onkeydown` on the `<details>` -- the menu can only be focused-within when open, so the local handler will fire. Alternatively keep the window listener and add an `if (!identityMenu?.open) return;` guard at the top (already half-present, but the global listener still fires on every key).

## Status as of 2026-05-04

| Finding | Verdict | Closure |
| ------- | ------- | ------- |
| MAJOR: visual CSS in routes | CLOSED | PR #464 -- `Breadcrumbs`, `FilterBar`, `FilterField`, `RolePill`, `Badge`, `EmptyState`, `Banner`, `PageHeader`, `Button`, `ConfirmDialog`, `DataTable`, `EmptyValue` all in `@ab/ui`; routes consume them. Status pills closed via PR #440. |
| MAJOR: two `MarkdownPreview.svelte` files | CLOSED | This audit -- file preview renamed to `MarkdownFilePreview.svelte`; route + test updated |
| MAJOR: repeated `state_referenced_locally` suppressions | CLOSED | PR #467 wave -- standardised on `untrack(...)` for prop-seeded state |
| MAJOR: FlowDiagram `$effect` reads booleans | CLOSED | PR #548 -- effect split into ResizeObserver-install + arrows-recompute derivations |
| MAJOR: audit/[id] setTimeout no cleanup | CLOSED | PR #548 -- per-key timer Map + onDestroy teardown |
| MINOR: pollLog no AbortController | CLOSED | PR #453 -- AbortController + aborted check on resolution |
| MINOR: targetIdValue sentinel reads | CLOSED | PR #467 wave -- swept five routes, replaced sentinel with `$derived` URL + dedupe-effect pattern |
| MINOR: diff `{#each}` index key | CLOSED | PR #467 wave -- key on `${kind}:${index}` with comment |
| MINOR: actor/target URL placeholder base | CLOSED | PR #467 wave -- replaced with URLSearchParams-only construction |
| MINOR: layout double-mirror appearance | CLOSED | PR #548 -- root layout owns the matchMedia listener; (app) consumes the resolved value |
| MINOR: audit menu keyboard nav | CLOSED | PR #455 -- full ARIA combobox |
| MINOR: glossary filter sentinel | CLOSED | PR #467 wave -- `$derived` URL + dedupe |
| MINOR: jobs filter syncs even on mount | CLOSED | PR #467 wave -- shared helper, dedupe by URL string |
| MINOR: root vs (app) double matchMedia | CLOSED | PR #548 -- single source of truth in root |
| NIT: repeated formatBytes | CLOSED | PR #464 -- centralised in `@ab/utils` |
| NIT: repeated formatDate | CLOSED | PR #464 -- presets in `@ab/utils` |
| NIT: brand "airboss / hangar" | CLOSED | PR #467 wave -- removed spaces around slash |
| NIT: Nav active-route duplicate | CLOSED | PR #467 wave -- predicate extracted |
| NIT: diff `<pre>` template tightness | CLOSED | PR #548 -- `<div>` per line with `white-space: pre` |
| NIT: UserActionResult handwritten type | CLOSED | PR #467 wave -- discriminated union exported from server, `import type` used |
| NIT: details menu keyboard handler | CLOSED | PR #548 -- moved off `<svelte:window>` to local handler |

Total: 20 closed / 0 open. `review_status` was already `done` -- preserved.
