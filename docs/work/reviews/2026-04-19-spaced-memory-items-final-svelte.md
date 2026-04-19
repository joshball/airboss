---
title: 'Final Svelte Review: spaced-memory-items'
date: 2026-04-19
category: svelte
---

# Final Svelte Review

Scope: every `.svelte` file introduced or modified by branch
`build/spaced-memory-items` (diff base `docs/initial-migration..HEAD`). The
focus is Svelte 5 runes correctness, reactivity boundaries, idiomatic
patterns, and compliance with the "no Svelte 4 patterns" rule in CLAUDE.md.

Files reviewed:

- `apps/study/src/routes/+layout.svelte`
- `apps/study/src/routes/(app)/+layout.svelte`
- `apps/study/src/routes/(app)/+page.svelte`
- `apps/study/src/routes/(app)/memory/+page.svelte`
- `apps/study/src/routes/(app)/memory/new/+page.svelte`
- `apps/study/src/routes/(app)/memory/browse/+page.svelte`
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte`
- `apps/study/src/routes/(app)/memory/review/+page.svelte`
- `apps/study/src/routes/login/+page.svelte`

Note: `(app)/logout/` only has a `+page.server.ts` (action-only route), no
`.svelte` file exists, so nothing to review there.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 0     |
| Minor    | 4     |
| Nit      | 5     |

No Svelte 4 patterns detected. No `$:`, no `export let`, no `<slot>`, no
`$app/stores`, no legacy stores. All `{#each}` blocks are keyed. `$state`,
`$derived`, `$effect`, and `$props` are used correctly on the hot path.
All `svelte-ignore` directives are justified. `svelte:window` and
`svelte:head` are used correctly. Snippet-typed `children` prop is
consistent across layouts. The feature ships clean from a Svelte 5
correctness standpoint.

## Findings

### [Minor] `$effect` uses `void` read trick for dependency tracking

**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:35-38`

**Issue:**

```typescript
$effect(() => {
  void createdId;
  void tick().then(() => frontInput?.focus());
});
```

The `void createdId;` statement exists solely to register `createdId` as a
dependency so the effect re-runs when the URL's `?created=` param changes
(after the "Save and add another" redirect). This pattern works but is a
code smell -- it reads as dead code to anyone who does not know the
reactive-tracking semantics, and Biome/future linters may flag it.

**Impact:** Non-idiomatic. Future maintainers may delete the `void`
statement believing it is a no-op, breaking the re-focus behaviour.

**Fix:** Use an explicit untracked pattern, or make the dependency the
point of the effect:

```typescript
$effect(() => {
  if (createdId) {
    void tick().then(() => frontInput?.focus());
  }
});
```

This reads as "when `createdId` becomes truthy, refocus." Same reactive
semantics, clearer intent. Also eliminates the unnecessary re-focus when
`createdId` is null on initial mount. Note that on initial mount there is
also no redirect case, so this branch-guarded version is strictly more
correct.

### [Minor] `$effect` in login may clobber in-progress user edits

**File:** `apps/study/src/routes/login/+page.svelte:13-15`

**Issue:**

```typescript
$effect(() => {
  if (form?.email) email = form.email;
});
```

The effect tracks `form?.email` and writes to the two-way-bound `email`
state. Today this only runs when a form submission fails, because `form`
is only updated by SvelteKit on action response. However, if a user
submits a failed login, then starts editing the email field before the
response arrives (unlikely on localhost, possible in production), the
effect will overwrite the user's in-progress input the moment `form`
arrives.

**Impact:** Marginal; race window is small. But the pattern is fragile.

**Fix:** Populate the initial `email` state from `form?.email` once, not
via effect:

```typescript
let email = $state(form?.email ?? '');
```

If form-driven re-population is needed after a failed submit (it is --
server returns the email back), use the enhance callback's `update`
lifecycle to set `email` explicitly after the submit round-trips. That
way the write is causally tied to the submit, not to a reactive graph
that could fire at any time.

### [Minor] `domainOptions`/`cardTypeOptions` recomputed instead of using exported constants

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:37-38`

**Issue:**

```typescript
const domainOptions = Object.values(DOMAINS);
const cardTypeOptions = Object.values(CARD_TYPES);
```

The constants module already exports `DOMAIN_VALUES` and
`CARD_TYPE_VALUES` as pre-computed arrays. `browse/+page.svelte` and
`new/+page.svelte` already use the `_VALUES` exports. This file
deviates and re-derives the arrays locally.

**Impact:** Inconsistent import style across the three card pages;
trivial redundant work on every module load.

**Fix:** Replace with `DOMAIN_VALUES` / `CARD_TYPE_VALUES` imports.

### [Minor] `formData.set('cardId', current.id)` inside `use:enhance` relies on `current` being stable

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:213`

**Issue:** The submit handler reads `current` (a `$derived` of
`batch[index]`) and calls `formData.set('cardId', current.id)` inside
the `use:enhance` submit function. This runs synchronously at submit
time. At that point `phase` is about to be set to `'submitting'`, but
`index` has not yet advanced, so `current` is indeed the card the user
rated. This works today but is fragile: any future code that advances
`index` before the enhance handler runs will post the wrong `cardId`.

**Impact:** Silent data corruption risk if the handler ordering changes.

**Fix:** Capture `current.id` at the moment the user clicks a rating
button, not inside `use:enhance`. One approach: add a hidden input
that binds to `current.id` so the form carries it directly:

```svelte
<form ...>
  <input type="hidden" name="cardId" value={current.id} />
  ...
```

Then delete the `formData.set('cardId', ...)` line. The hidden input
is re-rendered whenever `current` changes, removing the temporal
coupling.

### [Nit] `editValues.tags?.join?.(', ')` has redundant optional chaining

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:183`
**File:** `apps/study/src/routes/(app)/memory/new/+page.svelte:31`

**Issue:** `editValues.tags` is typed `string[] | undefined`. The
`?.join?.(', ')` double-guards: first to skip when `tags` is undefined,
second as if `join` might not exist on arrays. Arrays always have
`join`; the second `?.` is dead defence.

**Fix:** Drop the second `?.`: `editValues.tags?.join(', ')`.

### [Nit] Skip-link target `:focus { outline: none; }` removes focus outline

**File:** `apps/study/src/routes/(app)/+layout.svelte:60-62`

**Issue:**

```css
main:focus {
  outline: none;
}
```

Strictly speaking this is an a11y concern, not a Svelte one, but it
pairs with `tabindex="-1"` / skip-link navigation. Keyboard users who
activate the skip link will land on `<main>` with no visible focus ring.
Consider `outline: none` + an alternative cue, or rely on UA defaults.

### [Nit] `ratingLabels` inline array re-allocates each render

**File:** `apps/study/src/routes/(app)/memory/review/+page.svelte:228`

**Issue:**

```svelte
{#each [REVIEW_RATINGS.AGAIN, REVIEW_RATINGS.HARD, REVIEW_RATINGS.GOOD, REVIEW_RATINGS.EASY] as r (r)}
```

The four-element array is re-allocated on every render. Pull it out to
a module-scope constant to avoid the churn (though keyed `{#each}`
reconciles correctly either way).

**Fix:**

```typescript
const RATING_ORDER = [
  REVIEW_RATINGS.AGAIN,
  REVIEW_RATINGS.HARD,
  REVIEW_RATINGS.GOOD,
  REVIEW_RATINGS.EASY,
] as const;
```

Then `{#each RATING_ORDER as r (r)}`.

### [Nit] `recentReviews` table rows lack semantic roles for screen readers

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:278-302`

**Issue:** Not a Svelte issue per se; flagging because it lives in a
Svelte component. The `<table>` is straightforward and should expose
row/cell semantics to AT. No fix needed for Svelte correctness.

### [Nit] `humanize` / `domainLabel` / `cardTypeLabel` duplicated across four files

**File:** four sites under `apps/study/src/routes/(app)/memory/`

**Issue:** Identical `humanize`, `domainLabel`, and `cardTypeLabel`
helpers are inlined in every page. Not a Svelte bug, but worth
extracting to `libs/ui/` or a small `apps/study/src/lib/format.ts` to
avoid drift (e.g., if someone updates one site's `humanize` to handle
acronyms).

**Fix:** Extract to a shared helper. Low priority until the deck of
pages grows.

## Clean

The following Svelte 5 concerns were verified as correct across all
files in scope:

- No `$:` reactive statements anywhere in the branch.
- No `export let` -- all props use `$props()` destructuring with typed
  interfaces or inline type annotations.
- No `<slot>` -- layouts render `children` via `{@render children()}`
  after typing it as `Snippet`.
- No `$app/stores` imports -- `$app/state` is used (`page.url` in
  `new/+page.svelte:23`).
- No Svelte 4 `writable` / `readable` stores.
- All `{#each}` blocks are keyed with stable identifiers (`.id`,
  `.email`, `.domain`, or the primitive value itself where values are
  unique).
- `$props()` destructuring matches type annotations in all six page
  components and both layout components.
- `children: Snippet` typing is used consistently in both layout files.
- `$derived` is used for pure projections of `data`, `form`, and other
  `$state`; no `$derived` writes back into state.
- `$state` is used for genuinely local, component-owned state (loading
  flags, edit mode, DOM element refs, batch snapshot in review).
- `$effect` is used only for DOM-side effects that cannot be expressed
  declaratively (focus management in `new` and `[id]`, form-driven
  field sync in `login`). No `$effect` is simulating `$derived`.
- `bind:this` is typed (`HTMLTextAreaElement | null`, `HTMLFormElement |
  null`) and gated with optional chaining at call sites.
- Form handlers use `use:enhance` with the modern
  `() => { return async ({ update, result, formData, cancel }) => {...} }`
  signature; no legacy `({ form, data, action, cancel })` callback
  shape.
- The two `svelte-ignore state_referenced_locally` comments in
  `review/+page.svelte` are both justified -- both initialize a `$state`
  from another reactive source (`data.batch`, then `batch.length`) where
  only the initial value is wanted, never reactive re-reads.
- The single `svelte-ignore a11y_no_noninteractive_element_interactions`
  in `new/+page.svelte:86` is justified and documented with a comment
  explaining the Cmd/Ctrl+Enter shortcut.
- `svelte:window onkeydown` in `review/+page.svelte:139` is at the top
  level (not inside a conditional) and correctly dispatches per-phase.
- `svelte:head` is used correctly (title only, no layout or script
  pollution) in all five page components that use it.
- Deep `$state` mutation patterns (`tally.again++`) work correctly under
  Svelte 5's proxy-based reactivity.
- `invalidateAll()` + re-reading `data.batch` in
  `review/+page.svelte:99-107` is the canonical "reload with fresh server
  state" pattern.
- `use:enhance` cancel pattern in `[id]/+page.svelte:222-230` correctly
  gates the archive-confirm before network commit.
- Form `method="POST"` + typed `action="?/update"` / `action="?/submit"`
  / `action="?/setStatus"` with `satisfies Actions` on the server side.
- No non-null assertions (`!`) in any of the `.svelte` files.
- No `any` in any of the `.svelte` files.
