---
title: Command palette Phase 2 -- Svelte 5 review
date: 2026-05-11
branch: ball/palette-phase2-f191fb12
pr: 831
reviewer: agent (close-pass synthesis)
category: svelte
status: pending
review_status: done
issues_found: 3
---

# Svelte 5 review

Runes, reactivity, component patterns, snippets, lifecycle.

## Findings

### Sv1. (Minor) `$effect` returns a cleanup that may not match the closure's intent

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (lines 109-139, server-fetch effect)

The fetch effect:

```ts
$effect(() => {
  const q = debouncedQuery.trim();
  if (q.length === 0) { ... return; }
  if (q === lastFetchedQuery) return;
  const controller = new AbortController();
  ...
  (async () => { ... })();
  return () => controller.abort();
});
```

Rune semantics: the cleanup runs when the effect re-fires OR the component unmounts. Two subtle issues:

1. The early-return paths (`q.length === 0` and `q === lastFetchedQuery`) return `undefined`, not a cleanup function. The previously registered cleanup (from the LAST fire of the effect) still runs when the effect re-fires -- that's correct -- but a new "do nothing" branch enters with no controller, so it can't cancel any newer in-flight request that started before the dependency settled. In practice this works because each fire creates a fresh controller AND aborts the previous one; the early-return cases are when there's nothing to abort anyway.
2. The IIFE `(async () => { ... })()` is fire-and-forget. If `serverInjected = data.results;` writes happen AFTER the cleanup ran (i.e., a race between `controller.abort()` arriving and the fetch promise settling), the state write still lands. `if (!res.ok) return;` won't catch this -- the response object exists, but the controller has been aborted. The body parse usually throws AbortError before resolving, but it's not guaranteed.

**Fix:** capture the controller's signal in a stable reference and check `controller.signal.aborted` before the state writes:

```ts
const res = await fetch(...);
if (controller.signal.aborted) return;
if (!res.ok) return;
const data = ...;
if (controller.signal.aborted) return;
serverInjected = data.results;
```

This is the canonical "guard state writes against stale promise" pattern in Svelte 5. Today's code passes vitest but can race in the browser.

### Sv2. (Minor) `$derived` recomputes `searchGrouped` on every reactive change of any dependency

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (line 89)

```ts
const grouped = $derived<GroupedResults>(searchGrouped(debouncedQuery, host, mergedInjected));
```

`searchGrouped` is pure but not cheap (parses query, runs 3 in-process loaders, builds clusters, computes banner, dedupes synonyms). Every time `host.userId` changes (login/logout) or `mergedInjected` changes (server fetch settles) it re-runs the entire pipeline.

For Phase 2 with corpora of ~250 references this is fine. But `host` is constructed inside a `$derived` that allocates a new object every page-state read:

```ts
const host: PaletteHost = $derived<PaletteHost>({
  surface: surface ?? APP_SURFACES.GLOBAL,
  userId: page.data?.user?.id,
});
```

The object identity changes on every `page.data` mutation even when `surface` and `userId` are stable. `$derived` performs structural equality on its return value but the `host` reference change cascades into `grouped`. Today's load is small enough that this is invisible; document so Phase 3 doesn't be surprised when the detail pane's data binds add cost.

**Fix:** memoize `host` by its constituent values, or pass `surface` and `userId` separately into `searchGrouped`. Minor. Skip if no profiler signal.

### Sv3. (Nit) `panelEl` typed as `HTMLDivElement | null` but bound to a `bind:this` ref

**File:** `libs/help/src/ui/HelpSearchPalette.svelte` (line 151)

```ts
let panelEl = $state<HTMLDivElement | null>(null);
```

Then `bind:this={panelEl}` on the dialog div. Svelte 5's `bind:this` initializes to `undefined`, then assigns the DOM node on mount; the `null` initial value is fine but `HTMLDivElement | null` is the right TS type to make explicit nullability checks work (`if (panelEl)`). Verified.

The same pattern on `input` (line 72): `let input = $state<HTMLInputElement | null>(null);` -- also correct.

Not a finding. Noted because the patterns are easy to get wrong with Svelte 5's `bind:this`.

## Out of scope (verified compliant)

- All runes used correctly: `$state`, `$derived`, `$effect`, `$props`. No `export let`, no `$:`, no `<slot>`.
- `$app/state` used, not `$app/stores`. Correct per project rule.
- Snippets pattern not needed in Phase 2 (no children prop indirection).
- `untrack` correctly used to avoid effect-reads-state-it-writes (line 146, 157).
- `tick().then()` after-mount focus is the right escape hatch (line 160).
