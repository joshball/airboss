---
title: 'Phase 5 Svelte Review: Hangar Review Queue'
reviewer: svelte
date: 2026-05-04
diff: d975adb2...3b523eff
---

# Phase 5 Svelte Review: Hangar Review Queue

## Summary

- Files reviewed: 5 Svelte / 5 TS
- Critical: 0
- Major: 5
- Minor: 9
- Nit: 4

Svelte 5 runes usage is correct throughout: no `$:`, no `export let`, no `<slot>`, no Svelte 4 stores. Snippets + `{@render}` are used for the Tabs panel content, callback props for outcome / note events on `WalkerStepRow`, `$bindable` is correctly used on the Tabs `active` prop. The walker's split (server load that hydrates from `listSteps`, client-side optimistic state, fetch + `applyAction` + `invalidateAll` for action submissions) follows the SvelteKit pattern. Tamper-guard re-fetches the open session before any step write. The biggest cluster of issues is the optimistic-state model in the walker (3 convergent bugs around in-flight typing being clobbered by `invalidateAll` re-renders) and a heavy CSS load on the route files that violates the "minimal CSS in routes" rubric. No critical Svelte 4 leakage; no infinite-loop risk; no bad lifecycle.

## Findings

### Critical

(none)

### Major

#### MAJOR: Walker optimistic-state effect wipes in-flight typing on sibling-step round-trip

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:39-43`
- **Problem**: `optimistic` is rebuilt wholesale from `recordedByRef` every time `data.recordedByRef` changes:

  ```typescript
  $effect(() => {
    const next = new Map<string, { outcome: ReviewOutcome | null; note: string }>();
    for (const [ref, rec] of recordedByRef) next.set(ref, rec);
    optimistic = next;
  });
  ```

  `recordStep()` calls `invalidateAll()` after a successful round-trip (line 121), which re-runs the load and updates `data.recordedByRef`, which re-derives `recordedByRef`, which fires this `$effect`. The effect overwrites the entire `optimistic` map. If the user clicks step B's outcome while step A's `?/recordStep` is still in flight, A's invalidation result lands BEFORE B's, and the effect rebuilds `optimistic` from server truth (which has A but no B), wiping B's optimistic outcome. The user sees the row revert until B's own round-trip completes.
  Same problem for in-flight notes the user typed in step B while step A was saving.
- **Why it matters**: This is the killer feature of the WP. Rapid clicks across rows are the expected UX (reviewer walks 10-30 steps), and the pass/fail/blocked button visibly reverting after a sibling click is the kind of bug that destroys trust in the feature.
- **Fix**: Merge server truth INTO the existing optimistic map instead of overwriting it. Track per-ref "saving" state in `savingByStep` (already there), and skip overwriting any ref that's currently in flight:

  ```typescript
  $effect(() => {
    const next = new Map(optimistic);
    for (const [ref, rec] of recordedByRef) {
      // If a save for this ref is in flight, our local state is fresher than the server's.
      if (savingByStep.get(ref) === true) continue;
      next.set(ref, rec);
    }
    // Drop any optimistic refs the server doesn't know about and that aren't saving (rare; e.g. reverted).
    for (const ref of next.keys()) {
      if (!recordedByRef.has(ref) && savingByStep.get(ref) !== true) next.delete(ref);
    }
    optimistic = next;
  });
  ```

  Or, better: stop using a top-level reset effect. Apply optimistic deltas locally inside `recordStep` (already done) and let `recordedByRef` be the read-only fallback (`recorded ?? recordedByRef.get(ref)`) without ever syncing one into the other.

#### MAJOR: WalkerStepRow note draft is reset on every prop refresh, losing in-flight typing

- **File**: `libs/ui/src/components/WalkerStepRow.svelte:55-58`
- **Problem**:

  ```typescript
  let noteDraft = $state('');
  $effect(() => {
    noteDraft = recordedNote;
  });
  ```

  This effect treats the prop as the source of truth and clobbers the local draft on every prop change. The walker page calls `invalidateAll()` after every successful `?/recordStep` (own row OR sibling row), which re-runs the server load, refreshes `recordedByRef`, refreshes `optimistic` (see prior finding), refreshes `recordedNote` prop -> the effect overwrites whatever the user was typing.
  Concrete failure: user types "verified plate identifier" into step 4's note. Step 3 finishes saving in the background. Step 4's note becomes blank or reverts to the previously saved value mid-keystroke.
- **Why it matters**: Same trust failure as above. Notes are how reviewers capture findings; losing them silently is worse than the outcome-revert visual bug.
- **Fix**: Only sync from prop on initial mount, not on every prop change. Either:

  ```typescript
  // Initialise once from prop; do NOT track recordedNote.
  let noteDraft = $state(recordedNote);
  // Reset only when the row identity changes (e.g. test plan re-parsed).
  $effect(() => {
    void stepRef; // explicit dep
    noteDraft = recordedNote;
  });
  ```

  Or guard the assignment behind a focus check (`if (document.activeElement === textareaEl) return`). Cleanest is to lift the draft into the parent's `optimistic` map -- single source of truth -- and pass it down as a prop without a local copy.

#### MAJOR: Outcome click discards unblurred note draft

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:340`
- **Problem**: `onPick={(outcome) => recordStep(step.stepRef, step.stepIndex, outcome, recorded?.note ?? '')}` reads `recorded?.note` from the optimistic map (which carries the last *committed* note, not the in-flight draft). The user can type 30 words into the textarea and click Pass without blurring; the click fires `recordStep` with the previously-saved note, the round-trip finishes, `invalidateAll()` runs, the WalkerStepRow effect resets `noteDraft` to the prop value, and the typed words are gone.
- **Why it matters**: Convergent with the two findings above -- all three drop the user's typing on the floor. Reviewers move fast: type, pass, type, fail. The expectation is "the click commits whatever I typed."
- **Fix**: `WalkerStepRow.onPick` must hand the parent the current `noteDraft` so the page can include it in the form post. Change the callback signature:

  ```typescript
  readonly onPick: (outcome: ReviewOutcome, currentNote: string) => void;
  // ...
  onclick={() => onPick(value, noteDraft)}
  ```

  Then in walker page: `onPick={(outcome, note) => recordStep(step.stepRef, step.stepIndex, outcome, note)}`.

#### MAJOR: Route files carry hundreds of lines of visual CSS that should live in components

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:256-560` (~305 lines of style); `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:347-533` (~190 lines of style)
- **Problem**: The skill rubric: "If a route file has more than ~5 lines of CSS, it's probably doing too much -- extract a component. No visual CSS in route files: colors, font styles, borders, shadows, backgrounds, padding on visual elements."
  The spec page styles toast surfaces, frontmatter tables, sidebar cards, session lists, badges, action buttons, walker progress UI, placeholder panels. The walker styles toast, missing-state, summary header, finish-form, action buttons. None of these are layout-only; they're all colored, bordered, shadow-bearing chrome.
  Notably, the toast surface is duplicated across both files (~30 lines each, identical-but-separate styling). The badge styles are defined inline in the spec page. The "card" container is reinvented inline.
- **Why it matters**: The rubric exists for a reason -- shared chrome drifts when each route owns a copy, and tokens migrate slower (the spec page uses `--ink-body`, `--surface-panel`, etc. correctly today, but two pages from now will quietly drift). The token migration sweep has to touch each route file separately.
- **Fix**: Extract:
  - `<Toast kind="success|error" {message} on:dismiss />` -> `libs/ui/components/Toast.svelte` (already exists per `frontend-design` skill, check `libs/ui/src/components/Toast.svelte`).
  - `<Card>` for the right-rail panels.
  - `<Badge variant="open|pass|fail|...">{label}</Badge>` -> `libs/ui/components/Badge.svelte` (also likely exists; the `BadgeStatus` extraction landed in #594).
  - `<MissingState heading="..." />` for the walker's "no test-plan" / "no steps" panels.
  - `<FrontmatterList entries={...} />` for the dl block.
  Then the route files keep only grid/flex layout to position these.

#### MAJOR: `tabsById` $derived widens to `Map<any, any>` on the placeholder branch

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:41`
- **Problem**:

  ```typescript
  const tabsById = $derived(data.view === 'wp_spec' ? new Map(data.tabs.map(...)) : new Map());
  ```

  The `else` branch is `new Map()` with no element types -- TypeScript infers `Map<any, any>`. The conditional widens the derived type to `Map<any, any>` (or in strict mode `Map<WpSpecTabId, ...> | Map<any, any>`). `tabsById.get(tabId)` then returns `any`. Project rule: `No any. No magic strings. No implicit types.`
- **Why it matters**: Project-rule violation; loses the inferred type at the panel snippet boundary.
- **Fix**: Type the empty Map explicitly:

  ```typescript
  const tabsById = $derived<Map<WpSpecTabId, WpTabPayload>>(
    data.view === 'wp_spec'
      ? new Map(data.tabs.map((t) => [t.id, t] as const))
      : new Map<WpSpecTabId, WpTabPayload>(),
  );
  ```

  Or skip building the Map entirely on the placeholder branch (the else branch never renders the panel anyway -- the `{:else}` block uses neither `tabItems` nor `tabsById`).

### Minor

#### MINOR: `parseInitialTab` duplicates `WP_SPEC_TABS` ids as inline literals

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:31-35`
- **Problem**:

  ```typescript
  const ids: ReadonlyArray<WpSpecTabId> = ['spec', 'tasks', 'test-plan', 'design', 'user-stories', 'review'];
  ```

  `WP_SPEC_TABS` already enumerates these ids (`libs/constants/src/review.ts:326`). Hand-writing the array creates a drift point: adding a tab to the constant won't enable it via deep-link until someone updates this list too.
- **Why it matters**: Project rule "No magic strings -- all literal values in libs/constants/." The fix is one line.
- **Fix**:

  ```typescript
  function parseInitialTab(value: string | null): WpSpecTabId {
    const ids = WP_SPEC_TABS.map((t) => t.id);
    if (value !== null && (ids as readonly string[]).includes(value)) return value as WpSpecTabId;
    return WP_SPEC_TABS[0].id; // safer than hardcoding 'spec'
  }
  ```

#### MINOR: Confirm-flip dialog closes even on action failure

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:212-223`
- **Problem**:

  ```typescript
  use:enhance={() => {
    savingFlip = true;
    return async ({ update }) => {
      try { await update(); await invalidateAll(); }
      finally { savingFlip = false; confirmFlip = false; }
    };
  }}
  ```

  `confirmFlip = false` runs in the `finally`, so a failed flip (frontmatter write 409) closes the confirm panel. The toast surfaces the error, but the user has to hunt for the "Flip review_status" button again to retry.
- **Why it matters**: Minor friction on the unhappy path. The user just confirmed; if it failed, the obvious affordance is "try again."
- **Fix**: Only close the confirm panel on success:

  ```typescript
  return async ({ update, result }) => {
    try { await update(); await invalidateAll(); }
    finally { savingFlip = false; }
    if (result.type === 'success') confirmFlip = false;
  };
  ```

#### MINOR: Walker Finish auto-default suggests "pass" when only blocked steps exist

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:293`
- **Problem**:

  ```typescript
  onclick={() => (confirmFinish = everyStepPassed ? 'pass' : totals.fail > 0 ? 'fail' : 'pass')}
  ```

  If totals are `{pass: 0, fail: 0, blocked: 5}`, this defaults to `'pass'`. That's misleading -- the reviewer just blocked 5 steps; the right closing outcome is `'fail'` or `'abandoned'`.
- **Why it matters**: A confirmed-by-default pass on a blocked walk is exactly the kind of misclick that loses information about a real test failure. Confirm dialog catches it but the suggestion shouldn't be wrong.
- **Fix**:

  ```typescript
  function suggestedFinish(t: typeof totals): SessionOutcome {
    if (everyStepPassed) return 'pass';
    if (t.fail > 0 || t.blocked > 0) return 'fail';
    return 'pass';
  }
  ```

  Or surface all three buttons explicitly (Pass / Fail / Abandon) instead of inferring.

#### MINOR: `?/pauseSession` action is a no-op round-trip

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.server.ts:182-185`
- **Problem**: The pause action does nothing on the server -- no DB write, no audit, just `requireRole` then `return { pauseSession: 'ok' }`. The client posts to it before navigating back. CSRF-token round-trip wasted.
- **Why it matters**: A no-op action is a known issue -- either it should record a pause timestamp (would help spec gap "session abandonment after N hours") or be removed entirely. Project rule: "Zero tolerance for known issues. A stub is a known issue."
- **Fix**: Either drop the action and the client-side fetch (just `goto(...)`), or wire it to write a `pausedAt` timestamp on the session row so the abandonment loader can use the gap.

#### MINOR: Walker `finishWith` clears `confirmFinish` and `finishing` BEFORE awaiting `goto`

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:197-201`
- **Problem**:

  ```typescript
  await invalidateAll();
  confirmFinish = null;
  finishing = false;
  await goto(ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id));
  ```

  Between clearing `finishing` and `goto` resolving, the Finish button is back in its enabled state with `confirmFinish === null`, so the user could re-click and start a new finish attempt against the now-closed session. Race window is small (one navigation tick) but real.
- **Why it matters**: Defensive correctness. The user is locked out of editing the session, but a stray click could fire a second `?/finishSession` against a closed session id (server returns 403 due to `getOpenSession` returning null, so it surfaces an error toast for the briefest moment, but the UX is jank).
- **Fix**: Clear state after the navigation:

  ```typescript
  await invalidateAll();
  await goto(ROUTES.HANGAR_REVIEW_KIND(REVIEW_KINDS.WP_SPEC, data.item.id));
  // No need to reset confirmFinish/finishing; the page unmounted.
  ```

  Or leave `finishing = true` until goto resolves so the button stays disabled.

#### MINOR: `describeActionFailure` shadows the page-level `data` const

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:132-141`
- **Problem**:

  ```typescript
  function describeActionFailure(result: ActionResult): string {
    if (result.type === 'failure') {
      const data = (result.data ?? {}) as { recordStep?: string; finishSession?: string };
      // ...
    }
  }
  ```

  `data` is the page's main load data (`let { data }: { data: PageData } = $props()`). Shadowing it inside this helper makes the function look like it's using load data when it's actually using action-result data. Trips up grep.
- **Why it matters**: Readability and maintainability. The bug class is "I edit `data.foo` somewhere thinking I'm reaching the load."
- **Fix**: Rename the local: `const failurePayload = (result.data ?? {}) as ...`

#### MINOR: `pauseSession` failure is silently swallowed; user proceeds to navigate even if backend rejected

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:204-215`
- **Problem**: Catch block has `// Pause is informational; even if the round-trip failed, we still route back...`. That's defensible, but combined with the no-op action above, it means: failed auth (e.g. session expired) silently navigates the user to a page that will also fail to load. The user sees nothing about the auth failure on this page.
- **Why it matters**: User confusion on session expiry. Tiny but real.
- **Fix**: Surface the failure as a toast before navigating (parallel to the `recordStep` / `finishSession` patterns), or drop the action entirely (same fix as the prior pause-action finding).

#### MINOR: Walker `<form onsubmit>` for Finish bypasses `use:enhance`

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:298-307`
- **Problem**:

  ```html
  <form
    class="finish-form"
    onsubmit={(e) => {
      e.preventDefault();
      const target = confirmFinish;
      if (target !== null) { void finishWith(target); }
    }}
  >
  ```

  The form does nothing on submit except prevent default and call a separate `fetch`-based handler. There's no progressive-enhancement story for this form -- if JS is disabled the Finish button still submits, but the action is `?/finishSession` (because there's no `action` attribute), which gets the page url + `?/method=POST`-style fallback that won't include the session id.
- **Why it matters**: Awkward and inconsistent with the spec view's `use:enhance` pattern. Either:
  - Use `<form method="POST" action="?/finishSession" use:enhance>` and let SvelteKit handle the submit (works without JS).
  - Or make the Finish trigger a plain `<button>` click, not a form submit.
  The current shape is "form that pretends to submit but actually fires a fetch under the hood" which is the worst of both worlds.
- **Fix**: Migrate to `use:enhance` so the form-submit path matches the spec page's pattern. Use `applyAction` from inside enhance instead of the bespoke `postAction` helper.

#### MINOR: Spec page's `tabItems` derived returns objects that lack `disabled` -- `Tabs.tabs` typed as `TabItem[]` mutable

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:37-39`; `libs/ui/src/components/Tabs.svelte:23`
- **Problem**: `Tabs` types `tabs: TabItem[]` (mutable). `tabItems` derived returns `{ id, label }[]` (no `disabled`). TS lets it through because `disabled` is optional, but the array type is `readonly` because of the `data.tabs.map(...)` source -- assignability into a mutable param means a TS error in strict mode.
- **Why it matters**: Future TS strict pass (or downstream consumers) will trip on this. The Tabs component shouldn't mutate its `tabs` prop, so it should accept `readonly TabItem[]`.
- **Fix**: Update Tabs prop type:

  ```typescript
  tabs: readonly TabItem[];
  ```

  And export `TabItem` with `readonly` fields if not already.

### Nit

#### NIT: Walker has a top-level `everyStepPassed` derived that shadows the imported BC name

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/walker/+page.svelte:65-67` vs `libs/bc/hangar/src/review.ts:834` BC export
- **Problem**: The page defines a local `everyStepPassed` $derived for the UI's "all steps passed?" hint while the BC exports `everyStepPassed` for the server-side decision. Different scopes, but identical name -- searching for either lands you in both files. Distinct names would help (e.g. `clientCleanPass` and `everyStepPassed`).
- **Fix**: Rename the page-local derived: `const isCleanPass = $derived(...)`.

#### NIT: `everyStepPassed` test coverage missing duplicate-stepRef case

- **File**: `libs/bc/hangar/src/review-derive.test.ts:122-182`
- **Problem**: 6 cases cover empty-plan, partial, mixed-fail, mixed-blocked, clean-pass, orphan-extras. Missing: same `stepRef` appearing twice in `recorded` (the function counts each occurrence; current implementation says "recorded is already deduped" per the comment, but the test doesn't lock that assumption in).
- **Why it matters**: Defensive. If a future refactor of `recordStep` ever leaves duplicate rows in `listSteps` output (BC bug), `everyStepPassed` may return true for a 1-step plan that has 2 pass rows + 1 missing step, depending on order. A test would catch the regression.
- **Fix**: Add a case asserting deduped vs non-deduped behavior matches expectation.

#### NIT: WalkerStepRow renders `data-step-ref={stepRef}` but the page uses `step.stepRef` as `each` key

- **File**: `libs/ui/src/components/WalkerStepRow.svelte:70`; walker page line 329
- **Problem**: Both reference `stepRef` -- redundant but not harmful. The `data-step-ref` attribute is for testing/debugging and matches the each key, so it's fine. Just noting.
- **Fix**: None; documenting that the patterns line up.

#### NIT: Spec page right-rail "Sessions" panel renders `session.outcome` for closed sessions but doesn't handle `'abandoned'` explicitly

- **File**: `apps/hangar/src/routes/(app)/review/[kind]/[itemId]/+page.svelte:163-172`
- **Problem**: Branches: `pass`, `fail`, then a generic `<span class="badge">{session.outcome ?? 'Closed'}</span>` for everything else. `SESSION_OUTCOME_VALUES` includes `'abandoned'` -- it falls through to the generic badge with raw value rendered. Workable, but the spec lists `abandoned` as a real outcome and a styled badge would match `pass` / `fail` parity.
- **Fix**: Add `{:else if session.outcome === 'abandoned'} <span class="badge badge-abandoned">Abandoned</span>` and a token-driven style.

## Areas verified clean

- **Svelte 5 runes:** `$state`, `$derived`, `$effect`, `$props`, `$bindable` used correctly throughout. No `$:`, `export let`, `<slot>`, `writable`, `readable`, `derived` from `svelte/store`, or `$app/stores`. `$app/state.page` used (line 9 of spec page).
- **Snippets/render:** `Tabs` panel content uses `{#snippet panel(tabId)}` with `{@render panel(resolvedActive)}` inside Tabs. Correct shape.
- **Component contracts (`WalkerStepRow`):** Props are read-only via `$props()`, `module` block exports the `WalkerStepRowProps` interface, callback props (`onPick`, `onNoteCommit`) match the contract described in the spec.
- **Action handler patterns:** Walker uses `fetch` -> `deserialize` -> `applyAction` -> `invalidateAll` (the canonical non-form-submit pattern); spec page uses `use:enhance` (the canonical form-submit pattern). Both correct, both with `Accept: application/json` + `x-sveltekit-action` headers.
- **Tamper guard server-side:** Both `?/recordStep` and `?/finishSession` re-fetch the open session for `(item, user)` and reject mismatched session ids (`fail(403, ...)`). No TOCTOU shortcut. The same guard is used in the recordStep path before write and the finishSession path before close. The `?/finishSession` action also re-reads the test plan + step rows fresh (not from load-time snapshot) before computing `cleanPass`, so a concurrent edit of test-plan.md can't trick the flip into firing prematurely.
- **Frontmatter flip atomicity:** `writeFrontmatterField` (Phase 2) is atomic via temp+rename; the action calls it after `finishSession` (so the session is closed even if the FM write fails) and surfaces the FM error separately to the client.
- **SSR safety:** All `window` / `document` access is inside `$effect` blocks (which run only client-side) or guarded by `typeof window === 'undefined'` (spec page line 50). Tabs uses `requestAnimationFrame` only on user interaction, never during initial render.
- **Routes via `ROUTES`:** Every navigation target uses `ROUTES.HANGAR_REVIEW`, `ROUTES.HANGAR_REVIEW_KIND(...)`, `ROUTES.HANGAR_REVIEW_WALKER(...)`. No inline `/review/...` strings.
- **CSS tokens (component side):** `WalkerStepRow.svelte` uses `var(--surface-panel)`, `var(--edge-default)`, `var(--signal-success-wash)`, etc. throughout -- no hex literals, no raw px font sizes. The route file styles also use tokens (the issue is volume, not raw values; see major finding above).
- **Server load functions:** Both load functions are in `+page.server.ts` (correct -- they touch DB + filesystem). Types correct (`PageServerLoad`, `Actions`). No `any`.
- **No `!` non-null assertions** in any of the changed files.
- **Tests:** No `.toBeTruthy()` (memory rule). All assertions use `.toBe(...)`, `.toEqual(...)`. The 6 new `everyStepPassed` tests cover the spec invariants this BC enables (empty plan, partial, fail/blocked mix, clean pass, orphan stale rows).
