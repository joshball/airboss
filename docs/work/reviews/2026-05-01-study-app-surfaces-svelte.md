---
feature: study-app-surfaces
category: svelte
date: 2026-05-01
branch: main
issues_found: 8
critical: 0
major: 4
minor: 3
nit: 1
status: unread
review_status: pending
---

## Status as of 2026-05-04

Re-greped main. 2 of 8 closed. The route-level CSS proliferation MAJOR remains the dominant follow-up; the effect-mirror anti-pattern also still in place.

| Severity | Finding | Verdict | Evidence |
| -------- | ------- | ------- | -------- |
| MAJOR    | Pervasive heavy visual CSS in route files (65 files affected) | STILL OPEN | partial relief via the memory/[id] (-1100 lines) and session/start (-800 lines) `_panels/` extractions; calibration / memory/review / knowledge / sessions still ship 270-628 lines of `<style>`. Next: scope a follow-up work package to extract Card / Toast / ScoreMeta / BadgeStatus / IdentityMenu primitives into `libs/ui` (token migration runs LAST per project rule) |
| MAJOR    | $effect mirrors props/server data into $state (effect-should-be-derived) | STILL OPEN | `apps/study/src/routes/(app)/+layout.svelte:30-40` still has the two mirror effects on `appearancePref` / `themePref`. Next: replace with optimistic-override `$derived(pendingPref ?? data.pref)` pattern |
| MAJOR    | $effect side-effects URL based on state seeded from URL | STILL OPEN | the `state_referenced_locally` suppressed pattern recurs in `memory/[id]` panels, `sessions/[id]`, and `knowledge/[slug]/learn`. Next: prefer event-driven URL writes over reactive sync (handler calls `replaceState` directly) |
| MAJOR    | $effect missing cleanup on setTimeout (memory/[id] shareToastTimer) | CLOSED (by refactor) | `memory/[id]/+page.svelte` shrunk to 49 lines; toast logic absorbed by panels. Pattern persists in `memory/review/[sessionId]/+page.svelte:75,84` (undo + share toasts) -- both are module-scoped `let` outside `$effect`. Tracked under the related MINOR |
| MINOR    | Forward reference of `selection` inside $effect at top of layout | STILL OPEN | `(app)/+layout.svelte` still has the hoisted-const dependency. Cosmetic |
| MINOR    | Module-scoped mutable timer outside $effect | STILL OPEN | `memory/review/[sessionId]/+page.svelte:75,84` -- module-scoped `let undoTimer` and `let shareToastTimer`. Next: move into `$effect` cleanup |
| MINOR    | `state_referenced_locally` suppression recurs 3+ times | STILL OPEN | tied to the second MAJOR (effect-should-be-derived); fix together |
| NIT      | Mixed h2 selector grouping in calibration CSS | STILL OPEN | tied to the route-level CSS extraction MAJOR |

## Summary

Reviewed all `.svelte` and `.svelte.ts` files under `apps/study/src/routes/**` and `apps/study/src/lib/**`. The app is fully on Svelte 5 idioms: zero `$:` reactive labels, zero `export let`, zero `<slot>`, zero Svelte 4 stores, zero `createEventDispatcher`, zero `$app/stores` imports. Snippets and `{@render}` are used throughout, `$app/state.page` everywhere, `{#each ... (key)}` keys are present in every iterated block I checked.

The systemic problem is route-level CSS. 65 of ~70 route files ship multi-screen `<style>` blocks containing reusable visual treatments (cards, toasts, badges, panels, chart cards, undo bars, identity menus, score meta dl/dt/dd styling, plan banners, etc.) instead of routing those through `libs/ui/` driven by tokens. This violates the rubric explicitly: "if >5 lines of CSS in a route -> extract." The five worst offenders alone hold 2300+ lines of `<style>` content. Tokens are used (good), but the components themselves should not live in routes.

Two smaller reactivity issues: the `(app)` layout uses `$effect` to mirror server data (`data.appearance`, `data.theme`) into local `$state`, which is the canonical "effect-that-should-be-derived" pattern; and a couple of effects fire side effects in the wrong direction (writing the URL from a state that itself comes from the URL, with guard rails added).

## Issues

### MAJOR: Pervasive heavy visual CSS in route files (65 files affected)

File: `apps/study/src/routes/**/*.svelte` (top offenders below)

Problem: Per CLAUDE.md and the Svelte rubric, route files should hold layout/flow CSS only; visual CSS belongs in `libs/ui/` components driven by tokens. A grep of every route file found 65 with `<style>` blocks larger than 5 lines, and the heaviest five carry hundreds of lines each:

```text
628  apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte
455  apps/study/src/routes/(app)/calibration/+page.svelte
438  apps/study/src/routes/(app)/session/start/+page.svelte
432  apps/study/src/routes/(app)/memory/[id]/+page.svelte
414  apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte
366  apps/study/src/routes/(app)/memory/+page.svelte
346  apps/study/src/routes/(app)/+layout.svelte
279  apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte
270  apps/study/src/routes/(app)/sessions/[id]/+page.svelte
246  apps/study/src/routes/(app)/credentials/[slug]/+page.svelte
```

The blocks are not chrome-only layout. Sampled content includes:

- `apps/study/src/routes/(app)/calibration/+page.svelte` -> `.chart-card / .domains-card / .trend-card / .interpretation-card`, score-meta `dl/dt/dd` typography, hint text, badge wash + edge tokens.
- `apps/study/src/routes/(app)/memory/review/[sessionId]/+page.svelte` -> `.undo-toast`, `.undo-btn`, `.undo-link`, `.undo-dismiss`, `@keyframes undo-fade-in`, `@media (prefers-reduced-motion)` carve-out, plus a chicklet/hd component.

These are reusable components (Card, Toast, ScoreMeta, Banner, ChickletGroup, etc.), not page-specific layout.

Fix: open a follow-up work package to extract the recurring patterns into `libs/ui` components. First-pass extraction targets, ordered by hit count across the 65 files: `Card` (chart-card / domains-card / trend-card / interpretation-card / panel-card variants), `Toast` (undo-toast, edit-success toast in plans/[id], share toast in memory/[id]), `ScoreMeta` dl block, `BadgeStatus` (plan status badge, session phase badge, area-completion badge), `IdentityMenu` (the 200+ lines in `(app)/+layout.svelte`), animated `keyframes` set. Each route file then drops to layout-only flow CSS (page grid, section gaps). This is convergent across reviewers - hold for a single root-cause pass per the project rule, don't do 65 piecemeal fixes.

### MAJOR: $effect used to mirror props/server data into $state (effect-should-be-derived)

File: `apps/study/src/routes/(app)/+layout.svelte` lines 30-40

Problem: `appearancePref` and `themePref` are declared as `$state` and then synced from `data.appearance` / `data.theme` via two effects:

```typescript
let appearancePref = $state<AppearancePreference>(DEFAULT_APPEARANCE_PREFERENCE);
let themePref = $state<ThemePreference>(DEFAULT_THEME_PREFERENCE);

$effect(() => {
  appearancePref = data.appearance;
});

$effect(() => {
  themePref = data.theme;
});
```

`data.appearance` and `data.theme` are server-loaded; this is the canonical Svelte 5 "delete the effect, use $derived" anti-pattern. The seed values (`DEFAULT_*`) are dead -- the effect overwrites them on first run.

Complication: `setAppearance` and `setTheme` (lines 63-91) write the local state optimistically before the cookie round-trip resolves, so the values are technically two-way. That is fine, but the right shape is a `$derived` that prefers the optimistic override:

```typescript
let pendingAppearance = $state<AppearancePreference | null>(null);
const appearancePref = $derived(pendingAppearance ?? data.appearance);
// setAppearance: pendingAppearance = value; await fetch(...); pendingAppearance = null;
```

Fix: replace the two mirror effects with `$derived` over `data.*`, and represent the optimistic override as a separate nullable `$state` cleared once invalidation finishes. Removes two effect runs per render and aligns with Svelte 5 idiom.

### MAJOR: $effect side-effects URL based on state seeded from URL (race + extra writes)

File: `apps/study/src/routes/(app)/memory/[id]/+page.svelte` lines 47, 55-66

Problem: `editing` is seeded from `?edit=1` (line 47, with `state_referenced_locally` ignored), then an effect reads `editing` and writes `replaceState` if the URL doesn't already match. Because `page.url` is itself reactive (`$app/state`), this effect re-runs on any navigation and on its own writes -- the early-return guards do prevent loops, but the structure is fragile: if a future contributor adds another effect that touches `page.url.searchParams`, they'll hit a feedback loop.

Same pattern in `apps/study/src/routes/(app)/sessions/[id]/+page.svelte` lines 63-73 (writes `?step=` and `?item=` from state seeded from `data.initialStep`).

Same pattern in `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte` lines 40-46.

Fix: prefer event-driven URL writes (toggle handler calls `replaceState` directly) over reactive sync. The state and URL are co-owned, so the source-of-truth direction should be: user action -> mutate state + URL together; URL change on back/forward -> read into state via `$derived(page.url...)`. The current pattern only works because of the manual "needsUpdate" guard.

### MAJOR: $effect missing cleanup on setTimeout

File: `apps/study/src/routes/(app)/memory/[id]/+page.svelte` lines 75-101 (`shareToastTimer`)

Problem: `shareToastTimer` is created in an event handler, not an effect, and is module-scoped state. There is no `$effect` cleanup that clears it on component destroy. If the component unmounts mid-toast (navigation, route teardown), the callback fires after teardown trying to mutate `shareToastVisible`. Svelte will warn and the write is dropped, but it's a real leak.

Compare to `apps/study/src/routes/(app)/plans/[id]/+page.svelte` line 56-64 which correctly uses `$effect` with a returned cleanup:

```typescript
$effect(() => {
  // ...
  const timer = setTimeout(() => { editToastVisible = false; }, 3000);
  return () => clearTimeout(timer);
});
```

The memory toast version doesn't follow that pattern.

Fix: move the toast-timer logic into `$effect` keyed off `shareToastMessage` (or a dedicated `shareToastTick` $state counter), and return `() => clearTimeout(timer)` for cleanup. Same review applies to any other handler-owned `setTimeout` with a write to `$state`. Grep:

```bash
grep -rn 'setTimeout' apps/study/src/routes apps/study/src/lib --include='*.svelte'
```

### MINOR: Forward reference of `selection` inside $effect at top of file

File: `apps/study/src/routes/(app)/+layout.svelte` lines 56-61, 129-136

Problem: the effect that writes `data-theme` / `data-appearance` / `data-layout` to `document.documentElement` references `selection`, which is declared 70+ lines below. It works because `const` declarations are hoisted in Svelte 5 closure scope, but it's confusing to read top-to-bottom and a refactor to plain `let` would silently break it.

Fix: move the `selection` declaration above the effect, or move the effect below the declaration. Group in dependency order: pref state -> system listener -> selection derived -> document mirror effect.

### MINOR: Module-scoped mutable timer outside $effect

File: `apps/study/src/routes/(app)/memory/[id]/+page.svelte` line 77 (`let shareToastTimer: ReturnType<typeof setTimeout> | null = null;`)

Problem: this is plain mutable module state inside the `<script>` body, not a `$state` rune. It works because Svelte 5 still allows imperative `let` for non-reactive locals, but the mixed style ("some locals are runes, some aren't, with no obvious rule") makes ownership unclear.

Fix: when a value is purely a handle (timer id, AbortController, RAF id), prefer `$effect` cleanup over a module-scoped `let`. If the handle truly must escape the effect, name and comment it explicitly.

### MINOR: `state_referenced_locally` suppression appears 3 times for the same shape

Files:

- `apps/study/src/routes/(app)/memory/[id]/+page.svelte` line 46
- `apps/study/src/routes/(app)/sessions/[id]/+page.svelte` line 39
- `apps/study/src/routes/(app)/session/start/SessionLegend.svelte` line 34
- `apps/study/src/routes/(app)/plans/[id]/+page.svelte` line 66

Problem: the comment is `seed once from URL/data; effect keeps in sync`. This is the same anti-pattern flagged in the second MAJOR -- a value derived from a reactive source (`page.url`, `data.*`) being copied into local `$state` so it can be "owned" locally. Each occurrence carries a `svelte-ignore` to mute the warning. The warning is correct: the pattern wants `$derived`.

Fix: revisit as a group when the layout effect-mirror is reworked. They share a root cause and should be fixed together (one converging pass, not four), per CLAUDE.md "convergent findings get fixed at the root, once."

### NIT: Mixed h2 selector grouping in calibration CSS

File: `apps/study/src/routes/(app)/calibration/+page.svelte` (in the `<style>` block)

Problem: `.chart-card h2, .domains-card h2, .trend-card h2 { ... }` sets card-title styling. Once the cards are extracted into a shared `Card` component (per the first MAJOR), the heading should be a slot/snippet inside the component, not a route-side selector reaching into descendant elements. Same pattern repeats inside `(app)/credentials/[slug]/+page.svelte` and `(app)/dashboard/_panels/*.svelte`.

Fix: same as the heavy-CSS extraction follow-up; flagging here so it isn't lost when the work package is scoped.
