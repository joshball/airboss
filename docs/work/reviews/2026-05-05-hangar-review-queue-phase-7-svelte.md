---
title: 'Phase 7 Svelte Review: Hangar Review Queue'
reviewer: svelte
date: 2026-05-05
diff: 371626fd...f95d5588
---

# Phase 7 Svelte Review: Hangar Review Queue

## Summary

- Files reviewed: 11 (.svelte + .svelte.ts + supporting .ts)
- Critical: 1
- Major: 4
- Minor: 6
- Nit: 4

Phase 7 is broadly Svelte-5-clean: every component uses `$props`/`$state`/`$derived`/`$effect`, no `<slot>`, no `$:`, no `export let`, snippets are used correctly (`{#snippet header()}`, `{#snippet actions()}`), `$app/state` is used over `$app/stores`, and `use:enhance` wraps every form action with proper `running` flag teardown in `finally`. The two confirmed theme-token violations in `Nav.svelte` are real and will fail `bun run check`. The bigger structural issue is the bucket edit page reimplementing a confirm-then-submit dance that the project already ships as `ConfirmAction.svelte` in `libs/ui/`, with focus trap and Escape-to-cancel that the bespoke version lacks.

## Findings

### Critical

#### CRITICAL: `Nav.svelte` references undefined token `--action-default-default`

- **File**: `apps/hangar/src/lib/components/Nav.svelte:102`
- **Problem**: The badge's `background: var(--action-default-default);` references a token that does not exist anywhere in `libs/themes/vocab.ts`, `legacy-aliases.ts`, or any emitted role-token family. The valid tokens are `--action-default`, `--action-default-hover`, `--action-default-active`, `--action-default-wash`, `--action-default-edge`, `--action-default-ink`, `--action-default-disabled`. `tools/theme-lint/rules.ts` will flag this as an unknown token reference and `bun run check` is currently failing on it (matches the dispatcher's pre-captured finding). At runtime the badge background falls back to `transparent`, so an active reviewer-sized count is invisible against the page surface.
- **Fix**: Use the canonical role-token. The badge is a "filled action surface with inverse ink" -- that's the `--action-default` + `--action-default-ink` pair:

  ```css
  .badge {
      background: var(--action-default);
      color: var(--action-default-ink);
  }
  ```

  And drop the now-redundant `color: var(--ink-inverse);` in favor of `--action-default-ink`, which is the role-token contract for ink on top of `--action-default` and tracks theme swaps automatically.

### Major

#### MAJOR: `Nav.svelte` raw length on `line-height`

- **File**: `apps/hangar/src/lib/components/Nav.svelte:99`
- **Problem**: `line-height: 1.25rem;` is a raw `rem` on a `LENGTH_BLOCKED_PROPERTIES` property (`line-height` is in the blocked set in `tools/theme-lint/rules.ts:217`). `bun run check` will fail. The intent is to keep the badge a fixed pill height equal to `min-width`, but a raw `rem` is the wrong way to express that.
- **Fix**: Either drop `line-height` and let the parent control alignment (`align-items: center` already does it on `.nav-sections`), or scale a typography token. Concretely, change the `<a>` to `display: inline-flex; align-items: center; gap: var(--space-3xs);` and remove `line-height` + `min-width: 1.25rem` from `.badge` -- the badge centers via the flex parent and stays a tidy pill via `padding: 0 var(--space-2xs)` + `border-radius: var(--radius-pill)`. If a fixed height is required, use the `--type-ui-caption-line-height` family token rather than a literal rem.

#### MAJOR: Bucket edit page reimplements `ConfirmAction.svelte`

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.svelte:164-190`
- **Problem**: The "Delete bucket" -> "Confirm delete / Cancel" pattern is hand-rolled with raw `<button>` + bespoke `.action-button.danger` styling and a manual `confirmDelete` `$state` flag. The project already exports `libs/ui/src/components/ConfirmAction.svelte` precisely for this case -- it supports `formAction`, `formMethod`, `loading`, `loadingLabel`, `confirmVariant`, AND ships a focus trap (focus moves to Confirm on open, Tab/Shift+Tab cycles, Escape cancels and returns focus to the trigger). The bespoke version has none of those a11y guarantees: focus stays on the now-removed "Delete bucket" button (focus loss), Escape doesn't dismiss the confirm row, and tab order is whatever DOM order produces. Beyond a11y, this is a convergent-finding signal -- if Phase 7 reinvents `ConfirmAction`, other Phase N pages probably do too.
- **Fix**: Delete the manual two-button-plus-flag block and use the shared component:

  ```svelte
  <ConfirmAction
      label="Delete bucket"
      confirmLabel="Confirm delete"
      cancelLabel="Cancel"
      confirmVariant="danger"
      loading={savingDelete}
      loadingLabel="Deleting..."
      formAction="?/delete"
  >
      {#snippet children()}
          <Banner tone="danger">
              This will permanently delete the bucket. Items remain on the board. Confirm?
          </Banner>
      {/snippet}
  </ConfirmAction>
  ```

  Drop `confirmDelete`, the `.action-button` and `.action-button.danger` rules, and the inline `<form use:enhance>` wrapper -- `ConfirmAction` handles them. The `enhance` wiring for `savingDelete` flag handling will need to move to a callback; check `ConfirmAction`'s API for the form-mode loading prop.

#### MAJOR: `BucketForm.svelte` reused on edit page with `autofocus` on Name field

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/BucketForm.svelte:52`
- **Problem**: `<input name="name" ... autofocus />` is unconditional. On the New page, this is fine; on the Edit page, the form is mounted as part of the page render and the autofocus steals focus from wherever the user was (e.g. they used keyboard nav from the buckets list -> Edit link, expecting focus to land on the link's destination heading or breadcrumbs). WCAG 2.4.3 (focus order) and 3.2.1 (on focus) both flag autofocus on data-edit forms as a problem. Since this component is shared by `new/+page.svelte` and `[bucketId]/edit/+page.svelte`, the prop needs to move to a caller-controlled flag.
- **Fix**: Add an `autofocus` prop to `BucketFormProps` defaulting to `false`, and apply it only on the new page:

  ```ts
  // BucketForm.svelte
  let { initial, errors, submitLabel, saving, autofocus = false }: BucketFormProps = $props();
  ```

  ```svelte
  <input name="name" ... {autofocus} />
  ```

  ```svelte
  <!-- new/+page.svelte -->
  <BucketForm {initial} errors={fieldErrors} submitLabel="Create bucket" action="" {saving} autofocus />
  ```

#### MAJOR: No Phase 7 tests in the diff

- **File**: (Phase 7 changeset, all paths)
- **Problem**: Phase 7 ships `~1,600` net lines of new admin sub-app and not one new test. The shared `bucket-form.ts` parser (101 lines of validation logic with branching on `advancedJson` vs structured fields, JSON.parse error surfacing, and three sets of enum membership checks) is precisely the kind of pure-function module that warrants a Vitest unit pass. The BC additions (`getBucket`, `deleteBucket`, `countReviewQueueOpen`, `getLastLoaderRun`/`setLastLoaderRun`) similarly have no co-located tests in this commit range -- only the existing `review.test.ts` suite. `tasks.md` updates for Phase 7 don't gate tests in or out, and the project rule "Automated tests alongside implementation: unit (Vitest) for BC/lib logic, e2e (Playwright) for user flows" is unambiguous.
- **Fix**: Add `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/bucket-form.test.ts` covering: empty name -> error; name > 200 -> error; valid kind + sortOrder -> parsed; advancedJson with non-object -> error; advancedJson with bad JSON -> error including `err.message`; structured filter with one bad fm-status -> error AND `fs.length !== filterFmStatuses.length` branch; structured filter with `filterNoPassing: true` -> draft contains `noPassingSession: true`. Add BC tests for `getBucket(unknown id)` -> null, `countReviewQueueOpen` returning 0 on empty board and N on a board with mixed-status items, and `getLastLoaderRun` returning `null` initially then the most-recent `setLastLoaderRun` payload.

### Minor

#### MINOR: `bucket-form.ts` magic strings for status enums

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/bucket-form.ts:102, 111`
- **Problem**: Type predicates `(v): v is 'unread' | 'reading' | 'done'` and `(v): v is 'pending' | 'done'` inline the literal union members. The constants `FRONTMATTER_STATUS_VALUES` and `FRONTMATTER_REVIEW_STATUS_VALUES` are imported at the top of the same file and the matching `FrontmatterStatus` / `FrontmatterReviewStatus` types live in `@ab/constants`. The repeated literals violate "no magic strings" and drift if the enum gains a new value (`needs-review`, `archived`, etc.) -- the type predicate would silently strip the new value rather than letting it through.
- **Fix**: Import the types and use them in the predicate:

  ```ts
  import {
      FRONTMATTER_REVIEW_STATUS_VALUES,
      FRONTMATTER_STATUS_VALUES,
      type FrontmatterStatus,
      type FrontmatterReviewStatus,
      REVIEW_KIND_VALUES,
      type ReviewKind,
  } from '@ab/constants';

  const fs = values.filterFmStatuses.filter((v): v is FrontmatterStatus =>
      (FRONTMATTER_STATUS_VALUES as readonly string[]).includes(v),
  );
  // ... and the same for reviewStatus
  ```

#### MINOR: `bucket-form.ts` redundant `kindId` re-validation

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/bucket-form.ts:72-74, 129-133`
- **Problem**: The function validates `kindId` at line 72 and writes `errors.kindId` on failure, then at line 129 re-validates the same value with the comment "narrow for the return". The second branch is dead -- if validation failed at line 72, the function returned at line 126 already. The re-check exists only to convince TypeScript it can narrow `string` to `ReviewKind`, but a single `as ReviewKind` after the first check is the clearer pattern (the project rule against `as any` doesn't apply to `as ReviewKind` over a verified-membership string).
- **Fix**: Delete lines 129-133 and assert the cast inline at the return:

  ```ts
  return {
      name: values.name,
      kindId: values.kindId as ReviewKind, // verified at line 72
      sortOrder,
      filterCriteria,
      values,
  };
  ```

#### MINOR: `bucket-form.ts` overwrites name error on length

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/bucket-form.ts:70-71`
- **Problem**: Both checks write to `errors.name`:

  ```ts
  if (values.name === '') errors.name = 'Name is required.';
  if (values.name.length > 200) errors.name = 'Name must be 200 characters or fewer.';
  ```

  An empty name has length 0, so only the first branch fires (good). But the second `if` runs regardless, and `''.length > 200` is `false`, so no real bug -- it's just a brittle pattern. If a future "max 0" or whitespace-trim check lands above this without an `else if`, the wrong message overrides.
- **Fix**: Make them mutually exclusive:

  ```ts
  if (values.name === '') {
      errors.name = 'Name is required.';
  } else if (values.name.length > 200) {
      errors.name = 'Name must be 200 characters or fewer.';
  }
  ```

#### MINOR: Loader page `Admin` breadcrumb points to Buckets, not the loader's parent

- **File**: `apps/hangar/src/routes/(app)/review/admin/loader/+page.svelte:27`
- **Problem**: Breadcrumb trail is `Review board / Admin / Loader`, but the `Admin` crumb's href is `ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS`. From the user's perspective, clicking "Admin" while on the Loader page lands them on Buckets -- it implies Admin == Buckets, but admin has two siblings (Buckets, Loader). The same crumb appears on the new bucket page (`ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS`, line 17 of `new/+page.svelte`) and the edit page (line 30 of edit `+page.svelte`).
- **Fix**: Either drop the `Admin` crumb (the admin sub-nav already shows "Buckets / Loader" tabs, so the breadcrumb is redundant), or define `ROUTES.HANGAR_REVIEW_ADMIN` as the admin landing (typically the buckets index but expressed semantically) and route the crumb through that name. Cleanest: omit the `Admin` step on Loader and Bucket pages -- the sub-nav is the IA, not breadcrumbs.

#### MINOR: Bucket edit page `update` success keeps user on page; New page redirects

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.server.ts:79`
- **Problem**: Successful create redirects to the buckets list (303 in `new/+page.server.ts:60`), but successful update returns `{ update: 'ok' }` without redirect, so the user remains on the edit page with a "Bucket updated." toast. This is a defensible UX pick (user is still mid-iteration on the predicate), but the asymmetry is undocumented and the toast copy doesn't tell the user the change is live or where to verify (the buckets list shows item-count effects of the new predicate). On a stale-form re-submit (no changes), the toast still says "Bucket updated." which is misleading.
- **Fix**: Either redirect to the buckets list to mirror create flow (simpler IA), or keep the in-place pattern and reword the toast to "Saved -- bucket predicate is live." plus add a "Back to buckets" link in the toast actions (`Toast` already supports the `actions` snippet -- the dismiss button is its current renderer, see loader/+page.svelte:97-101 for the pattern). Either way, document the choice in `tasks.md`.

#### MINOR: `Nav.svelte` `min-width: 1.25rem` is a raw rem, but it's not theme-lint blocked

- **File**: `apps/hangar/src/lib/components/Nav.svelte:95`
- **Problem**: `min-width` isn't in `LENGTH_BLOCKED_PROPERTIES`, so this passes lint. But it's still a bare rem next to the other `var(--space-*)`/`var(--radius-*)` references. The badge size implicitly couples to `1.25rem == 20px` at the default 16px root -- a typography family scale (`--type-ui-caption-line-height`, `--type-ui-control-size`, etc.) would be the consistent expression.
- **Fix**: After the line-height fix above, the badge's vertical extent is driven by parent flex alignment + caption font size + padding. The `min-width` exists so single-digit counts (`1`, `9`) don't render too narrow. Replace with `min-width: var(--space-md);` (~16px in default scale; visually equivalent on the typography family) or drop and accept slightly variable pill widths -- the latter is more honest for a count badge.

### Nit

#### NIT: `Nav.svelte` six near-identical `$derived` blocks for active-route highlighting

- **File**: `apps/hangar/src/lib/components/Nav.svelte:18-35`
- **Problem**: Six `$derived` declarations all of the form `page.url.pathname === X || page.url.pathname.startsWith(\`${X}/\`)`. Each new top-level surface adds another. Extract into a helper.
- **Fix**:

  ```ts
  function isActive(prefix: string): boolean {
      return page.url.pathname === prefix || page.url.pathname.startsWith(`${prefix}/`);
  }

  const sourcesActive = $derived(isActive(ROUTES.HANGAR_SOURCES));
  // ...
  ```

  Note: the helper is a pure function so it can be a plain `function`, not a `$derived`. Each `$derived` cell still re-runs when `page.url.pathname` changes.

#### NIT: Loader page constructs `tsFmt` outside `$derived` -- module-level locale is fine but not idiomatic

- **File**: `apps/hangar/src/routes/(app)/review/admin/loader/+page.svelte:31`
- **Problem**: `const tsFmt = new Intl.DateTimeFormat(undefined, { ... });` runs at component-script execution. That's correct (locale is set at parse time and cached), but the `formatTs` function then references it from a non-rune scope. Idiomatically, this is a candidate for module-scope (`<script module>`) since neither `tsFmt` nor `formatTs` references reactive state -- they're pure utilities. Pulling them out would let the new and edit pages reuse the same `formatTs`/`formatDurationMs` helpers (the edit page doesn't need them today, but Phase N will).
- **Fix**: Move `tsFmt`, `formatTs`, and `formatDurationMs` to a sibling `_lib/format.ts` (or `<script module>` if you want to keep them inline) and import where needed.

#### NIT: Edit page `liveAnnounce` runs an else-cascade where the delete branch can override an update branch

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/[bucketId]/edit/+page.svelte:90-106`
- **Problem**: Both `update` and `delete` action data are inspected in the same `$effect`, and both can write `liveAnnounce` and `toast`. SvelteKit only ever surfaces one `form` at a time per submission, so one of the branches will always be no-op for a given run -- but the effect reads `form` once and writes both, which means a delete success (which redirects, so `form` is `null`) followed by an update on the next mount could re-run weirdly. Practically this works; structurally it's two unrelated effects merged.
- **Fix**: Split into two `$effect` blocks, one per action:

  ```ts
  $effect(() => {
      if (!form || !('update' in form)) return;
      const value = form.update;
      // ...
  });

  $effect(() => {
      if (!form || !('delete' in form) || typeof form.delete !== 'string') return;
      // ...
  });
  ```

#### NIT: `BucketFormProps` declares `action: string` but `BucketForm` never reads it

- **File**: `apps/hangar/src/routes/(app)/review/admin/buckets/_lib/BucketForm.svelte:21-27, 40`
- **Problem**: The prop interface includes `readonly action: string;`, but the destructure on line 40 omits `action`, and the template never references it. Both call sites (new + edit) pass an `action="..."` that's silently dropped. The form's `action` URL is set by the surrounding `<form action="?/update">` in the parent, which is the right place -- so the prop is dead weight.
- **Fix**: Drop `action` from `BucketFormProps`, drop the call-site `action=""` (new page) and `action="?/update"` (edit page) -- they were misleading.

## Areas verified clean

- **Svelte 5 runes**: every component uses `$props`, `$state`, `$derived`, `$effect` correctly. No `$:`, no `export let`, no `<slot>`, no `$app/stores`. `+layout.svelte` correctly uses `Snippet` type and `{@render children()}`.
- **Form actions**: every `use:enhance` wraps in `try { await update(); } finally { running = false; }` so the loading flag clears on error paths. Every action calls `requireRole(event, ROLES.ADMIN)` (dual-gate honored). `fail(400, ...)` carries `values` for echo, `fail(500, ...)` carries an `_form` error key.
- **Routes**: every URL goes through `ROUTES` constants, including the param-typed `HANGAR_REVIEW_ADMIN_BUCKET_EDIT(b.id)`. No inline path strings.
- **Imports**: all cross-lib references use `@ab/*` aliases (`@ab/constants`, `@ab/auth`, `@ab/ui/components/...`, `@ab/bc-hangar`, `@ab/db/connection`, `@ab/utils`).
- **Types**: no `any`, no `!`, no implicit types. Action data inspected via `'key' in form &&` narrows. `as ReviewKind` only after a verified-membership check. `FilterCriteriaRecord` is a local interface (no `any` cast).
- **Theme tokens (Phase 7 except Nav)**: all 22 distinct tokens used across the admin pages resolve to valid `vocab.ts` entries (`--ink-muted`, `--ink-body`, `--surface-panel`, `--surface-sunken`, `--edge-default`, `--focus-ring`, `--link-default`, `--signal-warning-ink`, `--signal-danger-ink`, `--font-family-mono`, `--font-weight-medium`, `--letter-spacing-wide`, `--type-ui-control-size`, `--type-ui-control-weight`, `--type-ui-caption-size`, `--type-ui-label-size`, `--radius-sm`, `--space-3xs`, `--space-2xs`, `--space-sm`, `--space-md`, `--space-xl`).
- **Snippets**: `{#snippet header()}<h2>...</h2>{/snippet}` and `{#snippet actions()}...{/snippet}` are correctly defined and rendered via `Card`/`Toast`. No dangling snippet definitions.
- **Live regions**: both loader and edit pages render a `.visually-hidden` `aria-live="polite" role="status"` div for screen reader announcements; the `liveAnnounce` write is gated on action-data shape.
- **Server load/action separation**: every `load` and `action` is in `+page.server.ts` (DB and auth-bearing). No `+page.ts` was introduced. `Promise.all` parallelizes independent reads (loader page parallelizes `getLastLoaderRun()` + `countDocsIndex(db)`; buckets list parallelizes `listBuckets` + `listItems` + `listItemsWithPassingSession`).
- **`onDestroy`**: both pages with `setTimeout` toast dismiss timers register `onDestroy` cleanup of pending timers.
