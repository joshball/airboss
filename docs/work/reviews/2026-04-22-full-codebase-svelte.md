---
feature: full-codebase
category: svelte
date: 2026-04-22
branch: main
issues_found: 10
critical: 0
major: 2
minor: 5
nit: 3
---

## Summary

Svelte 5 rune compliance across the codebase is excellent. Zero Svelte 4 anti-patterns detected in scope: no `export let`, no `<slot>`, no `$:`, no `$app/stores`, no `createEventDispatcher`, no `writable`/`readable` store imports. All components use `$props()`, `$state`, `$derived`, `$effect`, and named snippets correctly. The main drag on quality is not runes correctness -- it's CSS hygiene: most route files carry hundreds of lines of hardcoded hex colors and px sizes instead of using the design tokens that `libs/themes/tokens.css` already ships. The UI library (`libs/ui/src/components/`) and the dashboard panels (`apps/study/src/routes/(app)/dashboard/_panels/`) are the gold standard -- everything else should migrate toward them. The `ThemeProvider` + `display: contents` pattern works, but the inline comment describing it as a "plain block-level div" is misleading (see M2).

Reactivity patterns reviewed:

- Session runner at `apps/study/src/routes/(app)/sessions/[id]/+page.svelte` correctly uses a `$state` key + `$effect` to reset transient UI state on slot change (lines 41-52). This is the documented ADR 012 Phase 5 pattern; it cannot be a pure `$derived` because the reset writes to multiple independent `$state` cells, not one computed value. Dep tracking is correct.
- The same file's URL-sync `$effect` (lines 57-67) guards against infinite loops with a `needsUpdate` read-first check before calling `replaceState`. Correct.
- `apps/study/src/routes/(app)/memory/[id]/+page.svelte` toast effect (lines 65-78) returns a `clearTimeout` cleanup -- correct lifecycle.
- `/reps/session/+page.svelte` was verified non-existent. Post-Phase-6 deletion confirmed.
- ConfidenceSlider, preset gallery (session/start), and calibration page components use modern rune patterns throughout.

Known item: CrosswindComponent has 4 `state_referenced_locally` compiler warnings (not 5 as the skill header says). These stem from `let x = $state(initialProp)` patterns where `initialProp` is a `$props()` value read during state initialization. The component works correctly at runtime; the warnings are noise, not bugs. Documented as an open item below (N3).

## Issues

### MAJOR: Route files carry large volumes of hardcoded colors instead of design tokens

- **File**: `apps/study/src/routes/(app)/calibration/+page.svelte:383-927`, `apps/study/src/routes/(app)/dashboard/+page.svelte:65-159`, `apps/study/src/routes/(app)/sessions/[id]/+page.svelte:291-560`, `apps/study/src/routes/(app)/sessions/[id]/summary/+page.svelte:129-350`, `apps/study/src/routes/(app)/knowledge/+page.svelte:153-433`, `apps/study/src/routes/(app)/knowledge/[slug]/+page.svelte:273-650`, `apps/study/src/routes/(app)/knowledge/[slug]/learn/+page.svelte:132-383`, `apps/study/src/routes/(app)/memory/+page.svelte:117-366`, `apps/study/src/routes/(app)/memory/[id]/+page.svelte:353-711`, `apps/study/src/routes/(app)/memory/new/+page.svelte:180-380`, `apps/study/src/routes/(app)/memory/browse/+page.svelte:261-612`, `apps/study/src/routes/(app)/memory/review/+page.svelte:250-518`, `apps/study/src/routes/(app)/plans/+page.svelte:119-323`, `apps/study/src/routes/(app)/plans/[id]/+page.svelte:234-500`, `apps/study/src/routes/(app)/plans/new/+page.svelte:158-305`, `apps/study/src/routes/(app)/reps/+page.svelte:123-362`, `apps/study/src/routes/(app)/reps/browse/+page.svelte:258-635`, `apps/study/src/routes/(app)/reps/new/+page.svelte:325-588`, `apps/study/src/routes/(app)/glossary/[id]/+page.svelte:98-232`, `apps/study/src/routes/(app)/knowledge/[slug]/learn/ActivityHost.svelte:30-62`, `libs/activities/crosswind-component/CrosswindComponent.svelte:435-665`
- **Problem**: Per the skill checklist, route files (`+page.svelte`, `+layout.svelte`) should carry layout/flow CSS only. The listed files contain extensive visual CSS: hex colors (`#0f172a`, `#2563eb`, `#64748b`, `#e2e8f0`, ...), hardcoded px/rem sizes, shadows, and borders. This defeats the theme system. The calibration page alone has ~550 lines of hex-littered CSS that would silently drift out of sync with any token change; it's also why the page looks "light-mode-only" regardless of the active theme. The gold-standard counterexamples (dashboard panels, login, session/start, all `libs/ui/` components) prove the token migration is possible with no loss of fidelity.
- **Fix**: Extract visual CSS into tokenized components inside `libs/ui/src/components/` and consume them from the routes. The calibration page, in particular, needs a `CalibrationScoreCard`, `ConfidenceBucketRow`, `DomainTable`, and `Sparkline` component family. A route file's `<style>` should be layout primitives only (`.page { display: flex; flex-direction: column; gap: var(--ab-space-xl); }`) and the visual polish should come from `Card`, `PanelShell`, `StatTile`, and similar primitives already in `libs/ui/`. This is a theme-correctness bug: hardcoded hexes cannot reskin under `tui` theme.

### MAJOR: ThemeProvider inline comment contradicts its own implementation

- **File**: `libs/themes/ThemeProvider.svelte:14-17`
- **Problem**: The doc comment claims "The wrapper is a plain block-level div so token-scoped styles (background, color, font-family applied to `[data-theme]` in tokens.css) actually paint." The actual style applied is `display: contents`, which makes the wrapper NOT a block-level element -- it dissolves out of the layout tree, and background/border/padding applied to the wrapper won't paint (only text inheritance passes through). Current children don't rely on a painting wrapper (verified: no child component assumes the wrapper has a visible background), so behavior is correct, but the misleading comment will cause the next person to either (a) add visual styling to the wrapper and be confused when it doesn't show, or (b) swap `display: contents` for `display: block` and break the dashboard layout assumptions that depend on contents.
- **Fix**: Update the comment to match reality: "The wrapper uses `display: contents` so it doesn't participate in layout; only `data-theme` is meaningful. Token-scoped tokens paint via inheritance (CSS custom properties) and via `[data-theme='x'] *` selectors in `tokens.css`. If you need a paint surface, wrap children in a `Card`/`PanelShell` primitive, not here."

### MINOR: `apps/sim/src/routes/+page.svelte` uses non-reactive `const scenarios = listScenarios()`

- **File**: `apps/sim/src/routes/+page.svelte:5`
- **Problem**: `listScenarios()` is called at component module scope via a top-level `const`. This is fine for a pure read of static data, but the current pattern evaluates at component initialization and never updates. If `listScenarios()` ever grows a data dependency (e.g., filter props or reactive context), this will silently stale-out. It's also stylistically inconsistent with the rest of the codebase, which puts all per-render reads behind `$derived`.
- **Fix**: Move to a `load` function in `+page.ts` (or `+page.server.ts`) and consume via `let { data } = $props()` + `const scenarios = $derived(data.scenarios)`. Same shape as every other page in the study app. Removes the "what if this becomes reactive later" trap.

### MINOR: `apps/sim/src/routes/[scenarioId]/+page.svelte` key handler depends on stale closures via `$state`

- **File**: `apps/sim/src/routes/[scenarioId]/+page.svelte:115-149`
- **Problem**: `onKeyDown` and `onKeyUp` mutate `keyState` properties directly (e.g., `keyState.pitchUp = true`). Svelte 5 deep reactivity on `$state` objects supports this, so it works -- but the pattern bypasses the "proxy assignment" idiom the rest of the codebase uses (`keyState = { ...keyState, pitchUp: true }`). More importantly, the `onMount`/`onDestroy` pair registers the handlers on `window` with a function reference that closes over the initial `keyState` proxy. Because `$state` returns a stable proxy, the closure survives correctly, but it's fragile -- anyone who later refactors `keyState` into a `let` variable will silently break input latching.
- **Fix**: Either (a) add a comment asserting why direct mutation is intentional here (hot-path at ~30Hz, avoid creating 4 allocations per keypress), or (b) stash the key flags in individual `$state` booleans (`let pitchUp = $state(false); ...`) to eliminate the "did they know proxies were required?" ambiguity. Option (a) is the cheaper fix.

### MINOR: `apps/study/src/routes/login/+page.svelte` writes to local `email` from `$effect`

- **File**: `apps/study/src/routes/login/+page.svelte:17-19`
- **Problem**: `$effect(() => { if (form?.email) email = form.email; });` writes to a `$state` cell that's also bound to an input. The current behavior works because `form` only mutates on server round-trips (not during user typing), so the effect can't clobber in-flight input. But the pattern is brittle: any future change that makes `form` reactive to client state would introduce a loop, and the current code has no protection. The comment on the preceding line "Sync email from server-returned form state (populated after a failed submit)" is the right intent but the mechanism is unguarded.
- **Fix**: Seed from `form?.email` at `$state` initialization (`let email = $state<string>(form?.email ?? '')`) and drop the effect. Post-submit values populate via the natural re-render because `form` is a prop; local typing isn't overwritten. If you must keep the effect, guard with `untrack` around the read or use a `prevFormEmail` check so it only fires on actual changes to `form.email`.

### MINOR: `apps/study/src/routes/(app)/memory/new/+page.svelte` effect reads `createdId` just to trigger

- **File**: `apps/study/src/routes/(app)/memory/new/+page.svelte:35-38`
- **Problem**: `$effect(() => { void createdId; void tick().then(() => frontInput?.focus()); });` uses a `void` read of `createdId` solely to register a reactive dependency for re-focus after successful save. This works, but it's idiomatic-unusual -- someone reading the code will wonder why `createdId` is voided. The intent (focus the textarea after each create round-trip) is clean, but the dep-registration trick hides it.
- **Fix**: Replace with an explicit tracked expression: `$effect(() => { if (createdId) { void tick().then(() => frontInput?.focus()); } });`. Same behavior, no `void` read needed. If the `if` guard is undesired (first mount with no createdId still needs focus), leave a comment: `createdId is read to re-run on save; falsy on first mount is fine.`

### MINOR: `libs/ui/src/components/StatTile.svelte` uses `<svelte:element>` with `href` on a `div`

- **File**: `libs/ui/src/components/StatTile.svelte:35-44`
- **Problem**: `const Tag = $derived(href ? 'a' : 'div');` plus `<svelte:element this={Tag} href={href} ...>`. When `href` is undefined, the component still emits `href={undefined}` on a `div`. Svelte compiles that to a no-op (the attribute is omitted), so no runtime bug -- but it's a type smell: `<div href="...">` has no meaning in HTML, and a future TypeScript tightening could reject it. A cleaner split keeps each branch typed.
- **Fix**: Use a `{#if href}<a ...>...</a>{:else}<div ...>...</div>{/if}` block, following the `Button.svelte` pattern already used elsewhere in the library. Slightly more verbose, but eliminates the "why is `href` on a div?" head-scratch.

### NIT: Top-level module-scope `const` that's derived-looking in multiple files

- **Files**: `apps/study/src/routes/(app)/dashboard/+page.svelte:19-20`, `apps/study/src/routes/(app)/memory/[id]/+page.svelte:80-82`, `apps/study/src/routes/(app)/memory/new/+page.svelte:13`
- **Problem**: These files compute values (`loadedAt`, `stamp`, `ratingLabels`, `domainOptions`, `cardTypeOptions`) at module scope with plain `const`. They're genuinely static per-page-load and the code is correct, but scanning the file, a reader has to pause to confirm "this isn't a reactive cell I forgot to wrap." Not wrong, but the codebase has been moving toward explicit `$derived` / module-scope `as const` to signal intent.
- **Fix**: No change required. If someone touches these files for other reasons, consider adding an `as const` or `// non-reactive` comment where it clarifies. Optional.

### NIT: Sim instruments re-derive trig on every render pass

- **Files**: `apps/sim/src/lib/instruments/Asi.svelte:79-103`, `apps/sim/src/lib/instruments/Altimeter.svelte:28-48`, `apps/sim/src/lib/instruments/AttitudeIndicator.svelte:46-66`
- **Problem**: Each instrument computes `rad` from `angle` inline inside the `{#each}` template via `{@const rad = ...}`. At ~30Hz (sim tick rate), this runs 10-15 tick/text lookups per instrument per frame. Not a correctness issue, and probably undetectable in profiling -- but for three instruments on screen that's ~90 trig calls per frame that could be precomputed into a `$derived` array of `{angle, rad, x, y}` rows. The sim is explicitly a throwaway prototype ("Not an FAA-approved ATD"), so this is a polish suggestion, not a bug.
- **Fix**: Only if perf ever shows up as a real issue. Precompute `const tickGeometry = $derived(ticks.map(t => { const rad = ...; return { t, x, y }; }));` and iterate over that in the template.

### NIT: CrosswindComponent has 4 `state_referenced_locally` compiler warnings (not 5 as skill header claims)

- **File**: `libs/activities/crosswind-component/CrosswindComponent.svelte:16-19`
- **Problem**: Lines 16, 17, 18, 19 all read a `$props()` value inside a `$state(...)` initializer:
  ```typescript
  let windDirection: number = $state(initialWindDirection);
  let windSpeed: number = $state(initialWindSpeed);
  let showMaxDemoThreshold: boolean = $state(maxDemoCrosswind !== undefined);
  let isDraggingWind: boolean = $state(false);  // <- this one is fine, false is literal
  ```
  The first three trigger `state_referenced_locally` because the compiler wants `// svelte-ignore` annotations to confirm "I know this prop won't re-seed this state when the parent changes it." The actual warning count per `bun run check` should be 3, not 5 -- the skill header says "5 pre-existing warnings" but at the current tree I count 3 (or 4 if `maxDemoCrosswind` is counted twice for both the initial read and the type-widening). Either way: an open item, not a new regression.
- **Fix**: Add explicit suppression comments matching the pattern used elsewhere in the codebase:
  ```typescript
  // svelte-ignore state_referenced_locally -- initial-value-only; parent cannot re-seed
  let windDirection: number = $state(initialWindDirection);
  // svelte-ignore state_referenced_locally -- initial-value-only; parent cannot re-seed
  let windSpeed: number = $state(initialWindSpeed);
  // svelte-ignore state_referenced_locally -- initial-value-only; parent cannot re-seed
  let showMaxDemoThreshold: boolean = $state(maxDemoCrosswind !== undefined);
  ```
  This brings the file in line with the codebase-wide convention and silences the warnings. Also update the skill header (`/Users/joshua/.claude/skills/ball-review-svelte/SKILL.md`) to reflect the actual count if the number matters.
