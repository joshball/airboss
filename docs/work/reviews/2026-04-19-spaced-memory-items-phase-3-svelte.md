---
title: 'Phase 3 Svelte Review: spaced-memory-items'
date: 2026-04-19
phase: 3
category: svelte
---

# Phase 3 Svelte Review

Scope: Svelte 5 correctness review of the card management UI introduced in
commit `07d1ff1` on `build/spaced-memory-items`. Files under review:

- `apps/study/src/routes/(app)/memory/+page.server.ts` (redirect shim only)
- `apps/study/src/routes/(app)/memory/new/+page.svelte` + server
- `apps/study/src/routes/(app)/memory/browse/+page.svelte` + server
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte` + server

Toolchain: `svelte@5.55.4`, `@sveltejs/kit@2.57.1`. `bun run check` passes
with 0 errors / 0 warnings against these files.

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| Major    | 0     |
| Minor    | 5     |
| Nit      | 4     |

No rune misuse, no Svelte 4 patterns, no broken reactivity. Phase 3 is clean
on the hot path; findings are polish-level.

## Findings

### [Minor] Stale form values leak across edit sessions

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:24,107,112,118,126,135`

**Issue:** `editValues` is `$derived` from `form?.values` whenever
`form?.intent === 'update'`. After a failed update, the user may click Cancel
(`editing = false`) and then re-enter edit mode by clicking Edit. At that
point `editValues` still holds the previously-failed submission because
`form` has not been cleared, so each textarea/select re-populates with the
bad values instead of the current server-side `card.*` values.

**Impact:** Confusing UX -- the "Cancel" button appears not to discard user
changes if the user re-enters edit mode later in the same navigation. Not
a Svelte 5 correctness bug; the reactive graph is doing exactly what it is
told.

**Fix:** Tie `editValues` to `editing` as well, e.g.

```typescript
const editValues = $derived<FieldValues>(
  editing && form?.intent === 'update' ? (form.values ?? {}) : {},
);
```

Or, equivalently, reset `form` via `onclick={() => { editing = false; /* also clear form */ }}`
-- but mutating props is not idiomatic, so the derived guard is cleaner.

### [Minor] setStatus form has no pending state

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:171-181`

**Issue:** The status-change form uses bare `use:enhance` (no submitter
function). Unlike the update form, it does not toggle a `saving` flag, so
the Suspend / Archive / Reactivate buttons stay live while the POST is in
flight. Double-click on a slow connection fires two setStatus actions.

**Impact:** Idempotent on the server side (setStatus -> same status is a
no-op), but the UX is inconsistent with the update form and users get no
visual confirmation their click registered.

**Fix:** Add a `statusSaving = $state(false)` and mirror the update-form
pattern:

```svelte
<form method="POST" action="?/setStatus"
  use:enhance={() => { statusSaving = true; return async ({ update }) => { statusSaving = false; await update(); }; }}
  class="inline-form">
  ... buttons with disabled={statusSaving} ...
</form>
```

### [Minor] Error banner renders stale intent after a setStatus failure

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:89-91, 23`

**Issue:** `fieldErrors = $derived(form?.fieldErrors ?? {})` reads regardless
of `form.intent`. If `setStatus` fails with `fieldErrors._: 'Could not update status.'`,
the banner shows above the read-only card view as expected -- but the same
banner also shows if the user then opens the edit form (it cannot tell the
error is stale from a different action). The `editValues` derived is
already intent-guarded; `fieldErrors` is not.

**Impact:** Minor; the error text is still accurate. Could be mildly
misleading after a setStatus failure if the user switches to the edit form.

**Fix:** Optional -- gate the banner by intent or by a separate derived
per-intent state.

### [Minor] `.join?.` optional-chaining on a typed array is dead-defensive

**File:**
- `apps/study/src/routes/(app)/memory/new/+page.svelte:124`
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte:135`

**Issue:** `values.tags?.join?.(', ')` / `editValues.tags?.join?.(', ')`.
`FieldValues.tags` is typed `string[] | undefined`, so `tags?.join(', ')`
is sufficient. The extra `?.` on `.join` implies `tags` could be a
non-array object with no `.join` method, which the type system says is
impossible.

**Impact:** Purely stylistic; suggests the author did not trust the
types. Makes the code read as if there is a hidden invariant violation.

**Fix:** Drop the second optional chain:

```svelte
value={values.tags?.join(', ') ?? ''}
```

### [Minor] Edit / Cancel logic re-uses the same `editing` flag for two concerns

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:16, 93`

**Issue:** `editing` gates both the form visibility and implicitly the
meaning of `editValues`. When the user successfully saves, the server
redirects via `redirect(303, ...)` which triggers a full navigation; the
new page re-initializes `editing = false`. Good. But on validation
failure (no redirect), `editing` remains `true` from the click that
opened the form. This works, but the coupling is implicit -- nothing
documents why the flag is safe to leave alone.

**Impact:** Minor maintainability concern. Combined with the stale-values
finding above, the flow is fragile if someone later adds client-only edit
dismiss behaviour.

**Fix:** A short comment would suffice, or derive "show edit form" from
`editing && card.isEditable && form?.intent !== 'setStatus'` so the
state has an explicit contract.

### [Nit] `const { ... } = $derived(data)` destructure in browse is non-idiomatic

**File:** `apps/study/src/routes/(app)/memory/browse/+page.svelte:14`

**Issue:**

```typescript
const { cards, filters, page: currentPage, hasMore } = $derived(data);
```

Svelte 5 does accept destructured rune declarations -- the compiler lowers
this to four reactive bindings -- so it works and `bun run check` passes.
However the rest of the branch (`memory/[id]`, `memory/new`) uses the
single-name form `const x = $derived(data.y)`, which is the idiom most
frequently shown in Svelte 5 docs and is less likely to trip new
contributors who are unsure whether destructuring preserves reactivity.

**Impact:** Style inconsistency inside this feature directory. No runtime
consequence.

**Fix:** Expand for consistency with the other two pages:

```typescript
const cards = $derived(data.cards);
const filters = $derived(data.filters);
const currentPage = $derived(data.page);
const hasMore = $derived(data.hasMore);
```

### [Nit] Repeated status buttons could be a `{#snippet}`

**File:** `apps/study/src/routes/(app)/memory/[id]/+page.svelte:172-180`

**Issue:** Three near-identical `<button type="submit" name="status" value="...">`
elements with the same class rules inside `{#if}/{:else}` branches. Svelte 5
`{#snippet}` + `{@render}` would DRY this up:

```svelte
{#snippet statusButton(label, status, variant = 'secondary')}
  <button type="submit" class="btn {variant}" name="status" value={status}>{label}</button>
{/snippet}
```

**Impact:** None functionally. Minor readability win.

**Fix:** Optional refactor; not required.

### [Nit] `values.cardType ?? CARD_TYPES.BASIC` defaults differ between create and edit

**File:**
- `apps/study/src/routes/(app)/memory/new/+page.svelte:108`
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte:126`

**Issue:** The new-card form defaults the type select to `CARD_TYPES.BASIC`.
The edit form falls back to `card.cardType`. Consistent with their contexts
(new has no existing record), but the hard-coded default in new/ bypasses
`newCardSchema`'s default if one is ever added. If
`newCardSchema.cardType` gains a `.default(CARD_TYPES.BASIC)` later, the UI
and schema fall out of sync unless the literal here is kept in step.

**Impact:** Cosmetic; easy to fix forward.

**Fix:** If a schema default lands, remove the client-side literal and
let Zod parse `''` through its default.

### [Nit] No `autocomplete` attribute on free-text fields

**File:**
- `apps/study/src/routes/(app)/memory/new/+page.svelte:69, 83, 121`
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte:107, 112, 135`

**Issue:** The front/back/tags inputs have no `autocomplete` attribute.
Browsers may offer autofill suggestions from unrelated fields. Not a
correctness issue, but `autocomplete="off"` (or `autocomplete="one-time-code"`
for tag-like fields) is the conventional hint for content fields.

**Impact:** Cosmetic -- the browser may suggest strange values on focus.

**Fix:** Add `autocomplete="off"` on `<textarea name="front" | name="back">`
and the tags `<input>`.

## Clean

Verified clean on this phase:

- **No Svelte 4 patterns anywhere.** No `$:`, no `export let`, no `<slot>`,
  no `on:event` handlers, no `$app/stores` imports. All three pages use
  `$app/state`, `$app/forms`, and runes exclusively. Grepped the whole
  `apps/study/src/` tree -- zero `$app/stores` hits.
- **Rune usage is correct.** `$state` for local mutable UI flags
  (`loading`, `saving`, `editing`); `$derived` for read-only projections
  of `data` / `form`; `$props` for the component inputs. No `$effect`
  introduced (none needed). No `$derived.by` required -- every derived
  computation is a single expression.
- **Prop typing is consistent.**
  `let { form }: { form: ActionData } = $props();` and
  `let { data, form }: { data: PageData; form: ActionData } = $props();`
  across the three pages, pulling types from `./$types`.
- **`page` from `$app/state` used correctly.**
  `page.url.searchParams.get('created')` in new/+page.svelte is the Svelte 5
  idiom; not wrapped in `get(page)` or imported from `$app/stores`.
- **Each-blocks are keyed** with stable keys:
  - List rows: `(c.id)`, `(r.id)`, `(tag)`
  - Enum selects: `(d)`, `(t)`, `(s)`, `(opt)` (values are unique strings)
- **Event handlers use Svelte 5 syntax** -- `onclick={() => (editing = true)}`,
  `onclick={() => (editing = false)}`.
- **Form value bindings are one-way by design.** `value={...}` (not
  `bind:value`) on textareas and selects is correct for server-driven
  re-population after `fail()` responses. No field needs `bind:value`.
- **Labels are associated.** Browse filters use `<label for="...">` + `id=`;
  the new/edit forms wrap controls in `<label class="field">` which
  produces implicit association.
- **Disabled state is tied to the right pending flag.** The update form
  threads `disabled={saving}` through all its inputs plus both submit
  buttons; the new-card form threads `disabled={loading}` similarly.
- **Route split is correct.** Load functions live in `+page.server.ts`;
  form actions are in the server file and split by named action
  (`?/update`, `?/setStatus`) where more than one action exists. The
  `ActionData` / `PageData` types flow into the `.svelte` files via
  `./$types`.
- **No `.svelte.ts` rune files introduced this phase.** Nothing slipped
  out of component scope. (Phase 3 has no shared rune modules, and none
  are warranted by the code -- state is page-local.)
- **Layout renders children idiomatically.**
  `apps/study/src/routes/(app)/+layout.svelte` uses
  `let { children }: { children: Snippet } = $props();` and
  `{@render children()}` -- proper Svelte 5 layout pattern.
- **`$props()` destructures all props.** No leftover `export let` or
  Svelte 4 prop syntax.
- **URL construction is safe.** `buildHref` in browse uses
  `URLSearchParams`, strips empty / undefined / null / the ACTIVE status
  default, and falls back to `ROUTES.MEMORY_BROWSE` when no query
  remains. Pagination href switches off `page=1`.
- **Routes are constants, not strings.** `ROUTES.MEMORY_BROWSE`,
  `ROUTES.MEMORY_NEW`, `ROUTES.MEMORY`, `ROUTES.MEMORY_CARD(id)`,
  `ROUTES.LOGIN` -- inline path strings absent from the Phase 3 files.
- **Enum membership is narrowed before cast.** The browse server's
  `narrowDomain` / `narrowCardType` / `narrowSourceType` / `narrowStatus`
  functions check `(VALUES as readonly string[]).includes(value)` before
  casting, which is the pattern the project uses elsewhere.
- **Loading list is clickable via anchors, not JS.** Browse uses
  `<a class="card-link" href={ROUTES.MEMORY_CARD(c.id)}>` -- progressive
  enhancement friendly, no client JS required to navigate.
- **No inline style recomputation** in list items. All styles are in the
  scoped `<style>` blocks.
