---
title: 'Phase 4 Svelte Review: Hangar Review Queue'
reviewer: svelte
date: 2026-05-04
diff: d0dea9b9...0d5c3428
---

# Phase 4 Svelte Review: Hangar Review Queue

## Summary

- Files reviewed: 14
- Critical: 1
- Major: 2
- Minor: 6
- Nit: 3

Phase 4 ships clean Svelte 5 runes throughout: `$state` / `$derived` / `$props` are used correctly, no `$:`, no `export let`, no `<slot>`, no Svelte 4 stores. `$app/state` is correctly imported (Nav). Component contracts via `$props()` destructuring are typed and idiomatic. The `BoardColumn` / `BucketCard` / `ItemCard` split is clean and reuses snippets via `children`. The one critical bug is in the drag-drop submission path: `performMove` raw-fetches `?/move` without the SvelteKit form-action contract (`Accept: application/json` + `x-sveltekit-action: true` headers + `deserialize()` on the response), so action results never round-trip as JSON and the success / failure branches behave incorrectly. A few minor reactivity-discipline / lifecycle gaps around the "Move to..." menu, drag-leave flicker, and column-name magic strings round out the list.

## Findings

### Critical

#### C1. `performMove` bypasses the SvelteKit form-action contract (drag-drop is broken)

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:140-161`
- **Problem**: The function POSTs directly with `fetch('?/move', { method: 'POST', body: fd })`, then `await res.json()` and inspects `result.type`. SvelteKit form actions only return JSON when the request sends both `Accept: application/json` AND `x-sveltekit-action: 'true'` (see `node_modules/@sveltejs/kit/src/runtime/server/page/actions.js:14-21` -- `is_action_json_request` requires the negotiated accept header to be `application/json`). Without those headers, SvelteKit treats the POST as a navigation form submission and responds with an HTML page or a 303 redirect, not a JSON `ActionResult`. So:
  - Successful moves: server returns the rendered page (HTML), `await res.json()` throws SyntaxError -> the `.catch` branch sets `lastError = 'Unexpected token <...'`, even though the move succeeded.
  - Failed moves: same -- the user sees a parse error toast on top of an unrelated server error.
  - Even if a JSON response happened to come back, the data shape `result.data` is a devalue-encoded string, not a plain object -- `JSON.parse` would not give you `{ move: 'ok' }` directly. The canonical decoder is `deserialize(await response.text())` from `$app/forms`.
- **Why it matters**: Drag-drop is the primary affordance of Phase 4 ("Acceptance: ... drag a `wp_spec` from Backlog -> In Progress"). Today the database update succeeds, the `invalidateAll()` re-fetches and the board updates, but the user always sees a red "Move failed: Unexpected token..." toast. The "Move to..." kbd-alt button in `ItemCard` calls the same broken function, so the kbd path has the same failure.
- **Fix**: Use SvelteKit's form-action machinery. Either (a) wrap each card in a real `<form method="POST" action="?/move" use:enhance>` with hidden `itemId` + `toColumnId` inputs and submit via `formElement.requestSubmit()` from the drag handler, or (b) keep the imperative path but use `deserialize` and the right headers:

  ```ts
  import { deserialize } from '$app/forms';
  import { applyAction } from '$app/forms';

  async function performMove(itemId: string, toColumnId: string) {
  	const fd = new FormData();
  	fd.append('itemId', itemId);
  	fd.append('toColumnId', toColumnId);
  	const res = await fetch('?/move', {
  		method: 'POST',
  		headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
  		body: fd,
  	});
  	const result = deserialize(await res.text()) as ActionResult;
  	if (result.type === 'failure') {
  		const data = result.data as { move?: string } | undefined;
  		lastError = data?.move ?? 'Move failed.';
  	} else if (result.type === 'error') {
  		lastError = result.error instanceof Error ? result.error.message : 'Move failed.';
  	} else {
  		lastError = null;
  	}
  	await applyAction(result); // also updates `form` so the page re-renders the right state
  	await invalidateAll();
  }
  ```

  Option (a) is more idiomatic and gives free progressive enhancement.

### Major

#### M1. `BoardColumn` `dragleave` flickers because it fires on every child boundary crossing

- **File**: `libs/ui/src/components/BoardColumn.svelte:43-45`
- **Problem**: `onDragLeave` sets `active = false` whenever the drag pointer exits any descendant of the column (every `<article class="card">` and `<button>` inside fires its own `dragleave` as the pointer moves between them). The next frame, `dragover` resets `active = true`, but the visible result is the drop highlight stuttering on / off as the user moves the card across the column's children -- and in some browser timing scenarios the pointer leaves the column body without the highlight clearing because the last `dragover` fired on a child first. This is the well-known HTML5 dnd footgun.
- **Why it matters**: The "drop here" affordance is the most important visual cue during a drag. Flicker erodes confidence and on slower frames may leave the highlight stuck on after the user has dragged out of the column.
- **Fix**: Either gate `active = false` on `event.relatedTarget` not being a descendant, or maintain an enter/leave depth counter:

  ```ts
  let dragDepth = $state(0);

  function onDragEnter() {
  	dragDepth++;
  	active = true;
  }
  function onDragLeave() {
  	dragDepth = Math.max(0, dragDepth - 1);
  	if (dragDepth === 0) active = false;
  }
  function onDropEvent(event: DragEvent) {
  	event.preventDefault();
  	dragDepth = 0;
  	active = false;
  	const id = event.dataTransfer?.getData('application/x-airboss-card-id') ?? '';
  	if (id !== '') onDrop(id);
  }
  ```

  And bind `ondragenter={onDragEnter}` on the column. The depth counter naturally handles the child-crossing case because each child enter/leave pair cancels.

#### M2. `ItemCard` "Move to..." menu has no Escape / outside-click / focus-management

- **File**: `libs/ui/src/components/ItemCard.svelte:48,89-121`
- **Problem**: `menuOpen` is a `$state` boolean toggled by clicking the trigger or selecting an item. There is no:
  - Escape-key handler to close the menu while focus is inside it.
  - Outside-click handler -- once open, the menu stays open if the user clicks anywhere else (including another card's trigger; you can have multiple menus open simultaneously).
  - Focus management -- on open, focus stays on the trigger button, not the first menu item; on close, focus is not restored.
  - First-item / last-item arrow-key navigation (`role="menu"` implies `aria-orientation` semantics that screen-reader users will expect).
- **Why it matters**: This menu is the documented kbd-accessible alternative to drag-drop ("a11y rubric: drag-drop must always have a kbd alt"). Without Escape + focus restore + outside-close, kbd-only users can open it but can't dismiss it without picking an item; multi-card boards leak open menus when clicking around.
- **Fix**: Add an `$effect` while `menuOpen` is true that wires `keydown` (Escape -> close, ArrowDown/ArrowUp -> move focus among `menuitem`s) and a `pointerdown` listener on `document` that closes when the click is outside the `.move-row`. Cleanup the listeners in the effect's return. Restore focus to the trigger on close. If the project has a shared `Menu` / `Popover` / `DropdownMenu` primitive in `libs/ui/`, route through that instead -- the ad-hoc menu here will be the third or fourth such primitive.

### Minor

#### m1. Column-name magic strings sprinkled across three files

- **File**: `apps/hangar/src/routes/(app)/review/+page.server.ts:51-58`, `apps/hangar/src/routes/(app)/review/+page.svelte:104`, `libs/bc/hangar/src/review.ts:541-550`
- **Problem**: The literal column names `'Backlog'`, `'In Progress'`, `'Review'`, `'Done'` are duplicated (a) in `frontmatterTargetFor()`'s switch (server.ts), (b) as the `homeName` fallback in `buildColumnsGrouped` (page.svelte:104), and (c) in `getDerivedColumnName`'s return type and body (review.ts). Project rule: "All literal values in `libs/constants/`." These names are already canonicalised in `REVIEW_BOARD_DEFAULT_COLUMNS` -- the surrounding code does not import them through that constant, so a future rename ("In Progress" -> "Doing") would silently break the frontmatter mapping AND the bucket-home derivation.
- **Why it matters**: These are exactly the magic strings the project rule was written to avoid. `getDerivedColumnName` returns a literal-string union typed against the same names -- a constant-derived type would make the wiring authoritative.
- **Fix**: Type the column names as a discriminated union over `REVIEW_BOARD_DEFAULT_COLUMNS[number]` and use the constant array for comparisons:

  ```ts
  // libs/constants/src/review.ts
  export const REVIEW_BOARD_COLUMN_NAMES = {
  	BACKLOG: 'Backlog',
  	IN_PROGRESS: 'In Progress',
  	REVIEW: 'Review',
  	DONE: 'Done',
  } as const satisfies Record<string, ReviewBoardDefaultColumn>;
  ```

  And import that into the three callers. (Or leave the array and use `REVIEW_BOARD_DEFAULT_COLUMNS[0]` etc. -- the array index is canonical via `sortOrder`.)

#### m2. `BucketCard` "Show full list" branch is dead code

- **File**: `libs/ui/src/components/BucketCard.svelte:63-71`
- **Problem**: The first branch is `{#if overflow}` where `overflow = $derived(count > drawerItems.length)`. The else-if is `{:else if drawerItems.length > 0 && drawerLimit < count}`. The page passes `drawerItems = matching.slice(0, drawerLimit)` -- so `drawerItems.length = min(matching.length, drawerLimit)`. If `drawerLimit < count`, then `drawerItems.length = drawerLimit < count`, which means `count > drawerItems.length`, which is exactly `overflow`. The first branch always wins; the else-if is unreachable.
- **Why it matters**: Confusing dead code. A future maintainer trying to fix a "Show full list" link bug would chase the wrong branch.
- **Fix**: Drop the else-if. If the design intent was to show "Show full list" when the drawer is exactly full but no remainder (e.g., `count === drawerLimit`), restate the condition explicitly. Otherwise delete.

#### m3. `lastError` is sticky across actions

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:32,140-161,170-180`
- **Problem**: `lastError` is set by `performMove` on failure, cleared only on a subsequent successful `performMove`. If the user fails a move, then runs `Refresh`, the move error stays in the alert region. The Refresh form does not touch `lastError`.
- **Why it matters**: Stale error toasts confuse the user about what's currently broken.
- **Fix**: Clear `lastError = null` in the Refresh `use:enhance` submit callback, and on every fresh `performMove` call (currently it's only cleared in the success path -- set it to null at the top of the function so it clears on retry).

#### m4. Layout calls seeders on every request

- **File**: `apps/hangar/src/routes/(app)/review/+layout.server.ts:36-38`
- **Problem**: `seedReviewKinds()` and `seedDefaultBuckets(board.id)` run on every layout request to the `/review` subtree. The comment claims "Idempotent seeders -- they no-op when the rows already exist" -- which is true, but each call still issues a SELECT against `hangarReviewKind` and `hangarReviewBucket` to compute the diff. That's two extra round-trips per page navigation, even after the first boot. The comment frames "self-healing" as a feature, but a "rows truncated externally via SQL" is an operator scenario, not a normal request path.
- **Why it matters**: Adds DB latency to every `/review` navigation (and bucket detail navigation). For a single-user app this is fine; for the overall pattern it's an avoidable per-request load. `getOrCreateBoard()` already calls `seedReviewKinds(db)` on the existing-board branch (review.ts:97); the layout's redundant call is double work.
- **Fix**: Drop the layout's explicit `seedReviewKinds` / `seedDefaultBuckets` -- fold the bucket seed into `getOrCreateBoard` if it really needs to be self-healing, or move both to a one-shot boot hook. At minimum, remove the duplication: `seedReviewKinds` is already called inside `getOrCreateBoard`.

#### m5. `passingSet` and `kindFilterOptions` recompute on every keystroke

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:35,131-134`
- **Problem**: `passingSet = $derived(new Set(data.passingItemIds))` -- the set is rebuilt whenever ANY `$derived` upstream of it changes. In practice, `data.passingItemIds` only changes after `invalidateAll()`, but Svelte will recompute the derived whenever the parent rerun is triggered (which happens on every text-filter keystroke too, because `buildColumnsGrouped` is `$derived` and inspects `passingSet` indirectly via `filterItemsByCriteria`). With ~100 passing items the cost is trivial; with 1000+ it bites.
- **Why it matters**: Filter responsiveness on a large board. More importantly, `kindFilterOptions` is rebuilt as a fresh array on every recompute, which makes the `{#each kindFilterOptions as opt (opt.value)}` re-key-match correctly but still allocates each render.
- **Fix**: Memo the Set on `data.passingItemIds` identity (Svelte 5 rerun detection on `data` getters means a fresh array reference each load triggers recompute, which is correct; what you want is to skip recompute on text-filter keystrokes since they don't touch `data`). One option:

  ```ts
  let passingSet = $state<ReadonlySet<string>>(new Set());
  $effect(() => {
  	passingSet = new Set(data.passingItemIds);
  });
  ```

  An effect is fine here because the assignment to `passingSet` is from `data.passingItemIds` only, no read-write loop. Same shape for `kindFilterOptions`.

#### m6. Item dispatcher 404s for kinds that haven't shipped landing pages

- **File**: `apps/hangar/src/routes/(app)/review/items/[itemId]/+page.server.ts:21`, `apps/hangar/src/routes/(app)/review/+page.svelte:117,137,259`
- **Problem**: The dispatcher unconditionally `throw redirect(303, ROUTES.HANGAR_REVIEW_KIND(item.kindId, item.id))`. There are no `/review/[kind]/[itemId]/+page.svelte` routes shipped in Phase 4 (per the file's own comment). So clicking ANY item card from the board sends the user to a 404. Bucket cards drawer items go through `ROUTES.HANGAR_REVIEW_ITEM(item.id)` -> dispatcher -> 404. The board itself uses the same `hrefForItem`.
- **Why it matters**: Per the plan, this is documented as a Phase 4 limitation ("Phase 4 ships the redirect; the per-kind landing pages... land in subsequent phases"). But Phase 4's acceptance criteria says "/review shows the seed buckets... opens to a bucket drawer with item rows, dispatches to the right per-kind view on click" -- the dispatch is wired, but every dispatch terminates in a 404 today, which means a manual tester walking the board cannot get past the click.
- **Fix**: Either land a fallback `/review/[kind]/[itemId]/+page.svelte` that renders a "this kind's review view ships in Phase N" placeholder with a "Back to board" link, or make the dispatcher detect the missing kind and redirect to `/docs/{ref}` for `wp_spec` / `knowledge_node` items where the ref is a markdown path (a graceful default until Phase 5/6 land). The dispatcher already has `item.ref`; it could feature-detect ` (.md)` and route through `/docs` as a stopgap.

### Nit

#### n1. `getDerivedColumnName` accepts `string` but documents only the four valid `frontmatterStatus` values

- **File**: `libs/bc/hangar/src/review.ts:541-551`
- **Problem**: The input type is `string | null` but the function only branches on `'reading'`, `'done'` -- everything else (`'unread'`, `null`, an unknown string) maps to Backlog. The test asserts `'unread'`, `null`, and unknown all go to Backlog, which is correct, but the input type lets garbage through silently.
- **Fix**: Type the parameter as the canonical union: `frontmatterStatus: FrontmatterStatus | null` (already exported from `@ab/constants`). Same for `reviewStatus: FrontmatterReviewStatus | null`. Callers already have those union values; the test would still pass. The cast in `filterItemsByCriteria` (`item.frontmatterStatus as 'unread' | 'reading' | 'done'`) goes away.

#### n2. `BoardColumn` declares `isDropTarget` prop but no caller uses it

- **File**: `libs/ui/src/components/BoardColumn.svelte:13,33,57`
- **Problem**: Prop is declared and OR-combined into `class:drop-active={active || isDropTarget}` but the page does not pass it anywhere. It looks like an extension point for an external "drop hover" signal that never got wired.
- **Fix**: Either drop the prop (and the OR) or document why it exists. If it's reserved for keyboard-drop hover signaling later, leave a `// reserved for kbd-drop hover state -- see ADR/spec` comment.

#### n3. `kindFilterOptions` cast pattern leaks `as ReviewKind` into the page

- **File**: `apps/hangar/src/routes/(app)/review/+page.svelte:131-134`
- **Problem**: `data.kinds` comes back from the DB typed as `HangarReviewKindRow[]` (string `id`). The page does `value: k.id as ReviewKind` to bridge to the typed enum. Same cast on line 246, 257. These casts are accurate (kinds are seeded from `REVIEW_KIND_VALUES`) but are scattered across the page.
- **Fix**: Either narrow `listKinds()` in the BC to return `readonly { id: ReviewKind; label: string }[]` (cast once at the BC boundary, or validate via `REVIEW_KIND_VALUES.includes`), or expose a small `toReviewKind(id: string): ReviewKind` helper that throws on garbage. Keeps the page clean and gives a single funnel for any future DB-row-shape drift.

## Areas verified clean

- **No Svelte 4 leakage anywhere**. Zero `$:`, zero `export let`, zero `<slot>`, zero `writable`/`readable`/`derived` from `svelte/store`, zero `$app/stores`. `$app/state` correctly used in `Nav.svelte`. ([apps/hangar/src/lib/components/Nav.svelte:3](apps/hangar/src/lib/components/Nav.svelte))
- **Snippet/render correctness**. `BoardColumn` accepts `children: Snippet` from `'svelte'` and renders via `{@render children()}`. The `+layout.svelte` does the same. No misuse. ([libs/ui/src/components/BoardColumn.svelte:14,69](libs/ui/src/components/BoardColumn.svelte))
- **`$props()` destructuring** with defaults (`isDropTarget = false`, `frontmatterStatus = null`) is idiomatic and typed via exported `*Props` interfaces.
- **`$state` / `$derived` discipline**. `$state` is used for the actually-mutable flags (`topFilter`, `kindFilter`, `textFilter`, `runningLoader`, `lastError`, `menuOpen`, `open`, `active`); `$derived` for pure computations (`filteredItems`, `columnsGrouped`, `moveTargets`, `kindFilterOptions`, `passingSet`, `crumbs`, `kindLabel`, `drawerId`, `overflow`, `otherColumns`, `sourcesActive` and friends). No effects-that-should-be-deriveds, no read-after-write loops.
- **`use:enhance` on the loader form**. `runningLoader` is set inside the submit callback and reset in the `finally` of the returned async update handler. Correct pattern. ([apps/hangar/src/routes/(app)/review/+page.svelte:170-180](apps/hangar/src/routes/(app)/review/+page.svelte))
- **Form actions return `fail()` for errors and typed shapes for success.** `?/move` returns `'ok' as const` / typed `move:` failure messages; `?/runLoader` discriminates on `ok: true | false as const`. The page's `form?.ranLoader` / `form.ok` narrowing works.
- **Server load functions in `+page.server.ts` / `+layout.server.ts`** -- not in `+page.ts`, so DB access stays server-side. `requireRole` gates every load. `Promise.all` parallelizes the five queries in the layout load.
- **`ROUTES` used everywhere.** No inline path strings on the board. `HANGAR_REVIEW`, `HANGAR_REVIEW_BUCKET`, `HANGAR_REVIEW_ITEM`, `HANGAR_REVIEW_KIND` are all routed through `@ab/constants`.
- **`@ab/*` aliases used for cross-lib imports.** No relative-path leaks across lib boundaries in the changed files.
- **No `any`, no `!` non-null assertions** in the Svelte / page files. Generic on `filterItemsByCriteria` keeps the call site typed without casts.
- **Test file is well-shaped.** `review-derive.test.ts` uses `.toBe(...)` / `.toEqual(...)` / `.toThrow()` -- no `.toBeTruthy()`. 18 test cases cover the derive + resolve + filter helpers including edge cases (empty board, missing column, null frontmatter, passing-session set).
- **CSS in route files is layout-only.** `+page.svelte` has flex/grid/gap rules + the obligatory `.visually-hidden` block; no hardcoded hex / px sizes. `+layout.svelte` is a minimal flex shell. All visual styling lives in components driven by tokens (`--surface-panel`, `--ink-body`, `--space-md`, etc.).
- **Hydration safety.** All drag handlers are property-handler bound (`ondragstart={...}`); they only fire on client events, no SSR concerns. `event.dataTransfer` is null-guarded in both `onDragStart` and `onDropEvent`.
