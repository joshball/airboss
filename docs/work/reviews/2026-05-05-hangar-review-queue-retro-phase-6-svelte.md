---
title: 'Retro Phase 6 Svelte Review: Hangar Review Queue'
reviewer: svelte
date: 2026-05-05
scope: phase 6 (TOC + knowledge node + ad-hoc tasks) -- merged in PR #611 squash 1310d0ec
---

# Retro Phase 6 Svelte Review: Hangar Review Queue

## Summary

- Files reviewed: 9
- Critical: 0
- Major: 1
- Minor: 6
- Nit: 4

Overall the Phase 6 surfaces stay on the runes-only path: no `$:`, no `export let`, no Svelte 4 stores, snippets used everywhere a slot would have been, `$app/state` for the page URL. The TOC view correctly mirrors the Phase 5 walker's optimistic merge contract (skip in-flight rows on server-truth sync) and re-uses the same keyboard shortcut constants. The ad-hoc edit form has one real bug (validation failure discards the user's edits) and the rest is small stuff: a couple of magic strings the constants module already exports, a hack-pattern to silence an unused-prop lint, and a path-traversal guard that runs on the action path but not on the load path.

## Findings

### Critical

(none)

### Major

#### M1. Edit form discards user input on validation failure

- **File**: `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.svelte:127-174`
- **Problem**: Every input/select/textarea sources its value from `data.task.*`, not from `form.values`. When `?/update` fails validation it returns `fail(400, { update: 'invalid', errors })` -- but no `values` -- and on rerender the user's typed input is replaced by the saved `data.task.title` etc. The new-task form handles this correctly via `initialValues?.title ?? ''`; the edit form was not given the same treatment.
- **Why it matters**: Reviewer types a long description, picks the wrong product area, hits Save, sees the error -- and their description is gone. The same fail also doesn't echo the offending values back, so even if the UI did read `form.values` there would be nothing to read.
- **Fix**: Mirror the create form. Have `?/update` return `values` alongside `errors` on validation failure, then in the Svelte file derive `initialValues` from `form.values` and fall back to `data.task.*` when `form` is absent. Apply to all six form fields.

### Minor

#### m1. `loadKnowledgeNode` reads `item.ref` without `assertWithinRepoRoot`

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:192-193`
- **Problem**: The action `?/markKnowledgeNodeReviewed` calls `assertWithinRepoRoot(absPath)` before writing, but the load path (`absPath = resolve(REPO_ROOT, item.ref)` -> `safeReadFile(absPath)`) does not. `loadWpSpec` has the same gap on its `safeReadFile` calls. `item.ref` is loader-controlled, but the spec's defense-in-depth comment around `assertWithinRepoRoot` argues that a corrupted DB row could resolve outside `REPO_ROOT` via `..` segments -- if that's the threat model on writes, the same threat applies to reads.
- **Fix**: Run `assertWithinRepoRoot(absPath)` immediately after every `resolve(REPO_ROOT, item.ref)` in the loader (knowledge node + wp_spec test-plan + per-tab build), throwing a 500 rather than letting a `..`-laden ref read arbitrary files.

#### m2. `finishTocSession` uses magic strings for outcome validation

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:516`
- **Problem**: `if (outcomeRaw !== 'pass' && outcomeRaw !== 'fail' && outcomeRaw !== 'abandoned')` hand-rolls the session outcome enum. `libs/constants/src/review.ts` already exports `SESSION_OUTCOME_VALUES = ['pass', 'fail', 'abandoned'] as const` and a matching `SessionOutcome` type. CLAUDE.md is explicit: "no magic strings."
- **Fix**: Add an `isSessionOutcome` guard alongside `isReviewOutcome` and use `(SESSION_OUTCOME_VALUES as readonly string[]).includes(outcomeRaw)`. Pass the narrowed `SessionOutcome` to `finishSession`.

#### m3. Task `kindId` literals not routed through `REVIEW_KINDS`

- **File**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:108`, `apps/hangar/src/routes/(app)/review/tasks/[taskId]/edit/+page.server.ts:107,132`
- **Problem**: Both files write `kindId: 'ad_hoc'` as a string literal in the `upsertItem` / `findItemByRef` calls. `REVIEW_KINDS.AD_HOC` already exists in `libs/constants/src/review.ts:35-46` and is the canonical reference everywhere else in this file (`+page.server.ts` uses `REVIEW_KINDS.WP_SPEC`, etc.).
- **Fix**: Import `REVIEW_KINDS` and replace the three `'ad_hoc'` literals with `REVIEW_KINDS.AD_HOC`.

#### m4. Task-create action conflates `redirect()` exception handling with the catch-all

- **File**: `apps/hangar/src/routes/(app)/review/tasks/new/+page.server.ts:115-124`
- **Problem**: `redirect(303, ...)` is thrown inside the `try`, caught by the bare `catch (err)`, and then re-thrown via a duck-typed check (`'status' in err && 'location' in err`). SvelteKit ships `isRedirect()` from `@sveltejs/kit`; the duck-type works but is fragile (a non-redirect error that happens to carry both keys would bypass the error handler).
- **Fix**: Move `throw redirect(303, ...)` outside the `try`/`catch`. The `try` should wrap `createTask` + `upsertItem` only; on success break out and call `redirect()` after the block. Removes the need to special-case the redirect throw.

#### m5. ReferenceTocView: `await applyAction(result)` followed by `await invalidateAll()` triggers a duplicate load

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:214-215, 263-264`
- **Problem**: `applyAction(result)` already runs the SvelteKit invalidation pipeline (it's how form-action successes refresh load data). The follow-up `await invalidateAll()` then triggers a second `fetch` of the route's load function. Two server round-trips per outcome flip is twice what the page needs.
- **Fix**: Drop the `invalidateAll()` calls in `recordEntry` and `finishWith`. `applyAction` is sufficient. The Phase 5 walker's `+page.svelte` has the same redundancy worth removing as a convergent fix.

#### m6. `parseToc` lives in `libs/bc/hangar` but its hashing function uses `node:crypto` -- the lib also exports it for browser-bundled callers

- **File**: `libs/bc/hangar/src/review-toc.ts:19`
- **Problem**: `import { createHash } from 'node:crypto'` is a top-level static import in `libs/bc/hangar`. `libs/bc/hangar` is bound to server code today, but CLAUDE.md's browser-bundled-libs rule lists `libs/bc/study` and `libs/bc/sim` as bundled and the hangar BC is moving in the same direction (the upcoming hangar admin UI imports from `@ab/bc-hangar`). If the dispatcher route ever does `import { type TocEntry } from '@ab/bc-hangar'` from a `+page.svelte` -- the dispatcher already does this in `ReferenceTocView.svelte:2` for the type alone, which is fine -- a future value import will pull `node:crypto` into the client bundle and crash Vite.
- **Fix**: Either gate the import per the cache pattern (`process.getBuiltinModule('node:crypto')` lazily inside `hashEntryRef`), OR add `libs/bc/hangar` to Biome's `noNodejsModules` allowlist boundary now and document that the hangar BC is server-only. Prefer the lazy gate; matches the canonical pattern in `libs/constants/src/source-cache.ts`.

### Nit

#### n1. `itemTitle === ''` markup hack in `ReferenceTocView`

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:533`
- **Problem**: `{#if itemTitle === ''}<!-- silence unused-prop lint -->{/if}` emits dead markup to silence an unused-prop lint warning. Either the prop is actually wanted (use it as a visible heading inside the view, e.g., the `Card` header above the reference paraphrase) or it should be renamed `_itemTitle` like `_itemId` is on line 52.
- **Fix**: Render `itemTitle` as the H1 of the view (the dispatcher's H1 stays in `+page.svelte` so the H1 here would be the second-level heading inside the section), or rename the prop to `_itemTitle` and drop the line-533 trick.

#### n2. ReferenceTocView toggles `confirmFinish` between two roles (current-selection + confirm-open)

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/ReferenceTocView.svelte:74,377-438`
- **Problem**: `confirmFinish` is `null` when the panel is closed and a `SessionOutcome` when open, also doubling as the radio-group selection. Clicking Pass/Fail/Abandoned both opens the panel (initial set via `suggestedFinish()`) and updates the selection. Reads are clear from the markup but the variable's two roles aren't typed apart.
- **Fix**: Split into `panelOpen: boolean` and `selectedFinishOutcome: SessionOutcome | null`. Worth doing because the test plan calls out the keyboard flow and a stricter state model is easier to reason about there.

#### n3. KnowledgeNodeView's frontmatter scan accepts both `discovery_review` and `review_status`

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/_views/KnowledgeNodeView.svelte:54`
- **Problem**: `frontmatter.find((e) => e.key === 'discovery_review' || e.key === 'review_status')` reads either key. The action only writes `discovery_review`. If a node has both keys (legacy + new), order in `parsed.entries` decides which displays. Spec calls out `discovery_review` as the canonical field for knowledge nodes, and the loader / spec sources pages should agree.
- **Fix**: Read only `discovery_review`. If older nodes still carry `review_status`, that's a one-time migration concern; surface it explicitly rather than silently aliasing.

#### n4. AdHoc dispatch path could 303 server-side

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.server.ts:222-240`, `_views/AdHocView.svelte`
- **Problem**: `loadAdHoc` returns a stub; the rendered view is two action links pointing to the editor and the board. Nobody lands on `/review/ad_hoc/[itemId]` deliberately -- it's only reachable through dispatcher links the board emits. A server-side `throw redirect(303, ROUTES.HANGAR_REVIEW_TASK_EDIT(item.ref))` on the load would skip the placeholder render.
- **Fix**: Replace the stub return with a 303 to the task editor. Saves a render and a click.

## Areas verified clean

- Svelte 5 runes used exclusively: `$state`, `$derived`, `$derived.by`, `$effect`, `$props`. No `$:`, no `export let`, no `<slot>`, no `$app/stores`. (`+page.svelte`, all three `_views/`, both `tasks/` pages.)
- Snippets (`{#snippet}` + `{@render}`) used for `Card` headers, `Tabs` panel content, `Toast` actions throughout.
- `$app/state` (`page.url`) used in the dispatcher; no `$app/stores` import anywhere in the Phase 6 set.
- Form actions on `+page.svelte` (`?/markSpecRead`, `?/flipReviewStatus`) use `use:enhance` with proper `loading`/`finally` reset of `savingMarkRead` / `savingFlip`. The KnowledgeNodeView confirm-flip uses the same pattern for `?/markKnowledgeNodeReviewed`. The TaskEdit page wires `?/update` and `?/delete` similarly.
- The TOC view correctly uses `fetch` + `deserialize` + `applyAction` from `$app/forms` for inline outcome flips (the right pattern when posting from inside a child component without re-rendering its parent's form prop).
- `recordTocStep` re-fetches the open session and rejects when `open.id !== sessionId` (`+page.server.ts:491-494`); `finishTocSession` does the same (line 524-527). Tamper guard in place.
- Soft-delete on `?/delete`: the mirror `review_item` row is soft-deleted via `softDeleteItem` before the `board_task` hard-delete (`tasks/[taskId]/edit/+page.server.ts:129-133`). Spec accepts the hard-delete on the underlying task because there is no session history for ad-hoc.
- Optimistic merge: ReferenceTocView mirrors the walker's "skip in-flight rows when reconciling server truth" rule (`_views/ReferenceTocView.svelte:79-92`). Recorded outcome flips revert via `revertOptimistic` on action failure and surface a per-row error.
- Keyboard shortcut handler ignores `<input>` / `<textarea>` and modifier-keyed presses; uses `WALKER_KEYBOARD_SHORTCUTS` for the bindings (`_views/ReferenceTocView.svelte:287-313`). No conflict with the walker since the two routes can't be active simultaneously.
- Routes flow through `ROUTES`: `ROUTES.HANGAR_REVIEW`, `ROUTES.HANGAR_REVIEW_TASK_NEW`, `ROUTES.HANGAR_REVIEW_TASK_EDIT(id)`, `ROUTES.HANGAR_DOCS_PATH(...)`. No inline path strings observed in the Phase 6 files.
- `parseToc` test coverage: 12 cases cover null root, array-root rejection, all three accepted shapes (`toc[]`, `kind=toc + items[]`, legacy `tableOfContents`), nested children with continuous index, missing-label error path, plain-string entries, hash stability across calls, hash divergence across `referenceId`, unknown-shape error, and `kind=toc` with non-array items. No `.toBeTruthy()` -- assertions use `.toEqual`, `.toMatchObject`, `.toMatch`, `.toHaveLength`, `.toBe`. Compliant with `tools/test-lint`.
- Cross-lib imports use `@ab/*` aliases throughout (no relative cross-lib paths); intra-lib imports inside `libs/bc/hangar` use relative paths as the rule allows.
- No `any`, no `!` non-null assertions, no implicit types in any of the reviewed files. Server load/action types are the imported `PageServerLoad` / `Actions` from `./$types`, and the explicit return-type annotations on `loadReferenceToc` / `loadKnowledgeNode` / `loadAdHoc` keep the discriminator union honest at the call site in `load`.
