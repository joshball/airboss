---
title: 'URL deep-linking for sub-page locations'
date: 2026-04-22
status: proposed
---

# URL deep-linking for sub-page locations

## Why

Right now, many pages have internal state (phase within a stepper, item within a session, card within a review, edit-mode on a detail page) that lives only in client `$state`. Refresh the page, you lose your spot. Share the URL, someone else lands on the first step. The KG learn page at `/knowledge/proc-engine-failure-after-takeoff/learn` is the canonical example — 7 phases, zero URL awareness.

At the same time, our browse pages already use query params (`?domain=`, `?page=`, etc.) but the naming isn't standardized — `/reps/browse` uses `?phase=` for phase-of-flight, `/memory/browse` uses `?type=` for card type, `/knowledge` uses `?lifecycle=`. If we add `?phase=` to the KG learn page meaning "content phase", we collide with the existing rep-browse `?phase=` meaning.

This plan: enumerate every sub-state, assign a consistent URL schema, extend `ROUTES` and `QUERY_PARAMS` to cover it, and sync component state to URL via `replaceState` (non-history-polluting).

## Inventory

### Pages with sub-state today

| Page | Sub-state lives in | Current URL handling | Needs URL? |
| ---- | ------------------ | -------------------- | ---------- |
| `/knowledge/[slug]/learn` | `stepIndex` ($state) over 7 phases | none | yes — primary case |
| `/sessions/[id]` | `phase` ($state) over read/confidence/answer per item; item index | none; item tracked server-side | yes — refresh-resilience |
| `/reps/session` | same shape as above | `?s=<sessionId>` (seed only) | yes |
| `/memory/review` | card-flow phase (front/back/rated) + card index in queue | none | probably no — queue is ephemeral; revisit |
| `/memory/[id]` | `editing` ($state) | none | yes — `?edit=1` |
| `/plans/[id]` | `editToastVisible` + one-shot banner via `?created=1` | partial (`?created=1` only) | yes — sections / edit mode |
| `/calibration` | single view, no sub-state | n/a | no |
| `/dashboard` | grid, no sub-state | n/a | no |

### Pages with existing URL filters (normalize)

| Page | Params today | Inconsistencies |
| ---- | ------------ | --------------- |
| `/knowledge` | `domain`, `cert`, `priority`, `lifecycle` | — |
| `/memory/browse` | `domain`, `type`, `source`, `status`, `q`, `page`, `created` | `type` = card type |
| `/reps/browse` | `domain`, `difficulty`, `phase`, `source`, `status`, `page`, `created` | `phase` = phase-of-flight |
| `/plans/new` + `/plans/[id]` | `?created=1` one-shot banner | one-shot pattern, keep |

**Collision:** `phase` means phase-of-flight on `/reps/browse` but would mean content-phase on `/knowledge/[slug]/learn`. Rename one.

## Taxonomy: 5 types of sub-state

| Type | Shape | Example | Proposed URL form |
| ---- | ----- | ------- | ----------------- |
| **Stepper** | 1..N ordered stages, fixed names | KG learn phases, session-item flow | `?step=<slug>` (named, not index — survives reordering) |
| **Item index** | 0-based position in a queue | Session item N of M, review card K of Q | `?item=<n>` (index; ok because queue is frozen per-session) |
| **Tab** | 1-of-N view, each is a full section | Maybe plan detail sections | `?tab=<slug>` |
| **Filter** | Multiple independent orthogonal narrowings | Browse filters | keyed individually: `?domain=&cert=&status=` |
| **Mode flag** | Boolean sub-mode | Card edit mode | `?edit=1` (or `?mode=edit` for >2 states) |
| **One-shot banner** | Post-action feedback, dropped on navigation | "Plan created" | `?created=1` (keep current; document) |

## Naming rules

1. **Query-param name** = one of the `QUERY_PARAMS` constants in `libs/constants/src/routes.ts`. Never inline string literals.
2. **Values** = enum constants from `libs/constants/` when the space is closed (phases, tabs, filter enums). `encodeURIComponent` everywhere you build a URL by hand (or use the maker).
3. **Rename collision:** `?phase=` on `/reps/browse` becomes `?flight-phase=` (or `?pof=` for brevity). `?phase=` is freed for stepper usage. Flagged in constants as `QUERY_PARAMS.FLIGHT_PHASE`.
4. **Step names** = lowercase-kebab slugs matching the spec constants. KG learn uses `context | problem | discover | reveal | practice | connect | verify` (already the string values of `KNOWLEDGE_PHASES`).
5. **Item indices** are always 0-based. 1-based display (the "Item 3 of 10" text) stays in the component.
6. **Path vs query:** query for view-within-page state. Path segments reserved for fundamentally different pages (e.g. `/plans/[id]/edit` would be a different page from `/plans/[id]`; that's a path move, not a query toggle).

## URL maker API additions

Extend `libs/constants/src/routes.ts`:

```ts
export const QUERY_PARAMS = {
  // existing
  NODE_ID: 'node',
  SESSION_MODE: 'mode',
  SESSION_FOCUS: 'focus',
  SESSION_CERT: 'cert',
  SESSION_SEED: 'seed',

  // new: sub-state
  STEP: 'step',          // stepper position (named slug)
  ITEM: 'item',          // item index within a queue (0-based)
  TAB: 'tab',            // tabbed view selection
  EDIT: 'edit',          // mode flag, value='1' means edit mode
  CREATED: 'created',    // one-shot banner

  // new: renamed to avoid collision
  FLIGHT_PHASE: 'flight-phase', // browse filter for phase-of-flight

  // existing filter keys (document them formally)
  DOMAIN: 'domain',
  CERT: 'cert',
  PRIORITY: 'priority',
  LIFECYCLE: 'lifecycle',
  DIFFICULTY: 'difficulty',
  SOURCE: 'source',
  STATUS: 'status',
  CARD_TYPE: 'type',
  SEARCH: 'q',
  PAGE: 'page',
} as const;
```

Extend `ROUTES` with sub-location makers:

```ts
export const ROUTES = {
  // ... existing ...

  KNOWLEDGE_LEARN: (slug: string) => `/knowledge/${slug}/learn` as const,
  KNOWLEDGE_LEARN_AT: (slug: string, phase: KnowledgePhase) =>
    `/knowledge/${slug}/learn?${QUERY_PARAMS.STEP}=${encodeURIComponent(phase)}` as const,

  SESSION: (id: string) => `/sessions/${id}` as const,
  SESSION_AT: (id: string, itemIndex: number) =>
    `/sessions/${id}?${QUERY_PARAMS.ITEM}=${itemIndex}` as const,

  MEMORY_CARD: (id: string) => `/memory/${id}` as const,
  MEMORY_CARD_EDIT: (id: string) => `/memory/${id}?${QUERY_PARAMS.EDIT}=1` as const,

  // Existing MEMORY_REVIEW_FOR_NODE already uses query; align to QUERY_PARAMS.NODE_ID
};
```

Add a small helper `libs/utils/src/url.ts`:

```ts
/**
 * Build a query string from a record, dropping undefined/null/empty values.
 * Every caller routes through here so URL construction stays consistent.
 */
export function buildQuery(params: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
```

Every route maker that takes optional sub-state uses `buildQuery` so we don't sprinkle `encodeURIComponent` calls.

## Sync patterns

**Server load** reads the URL param, validates + narrows to an enum, defaults cleanly when missing or invalid. Already the pattern on browse pages; extend to stepper/item pages.

**Client** binds component state to URL via `replaceState` (does NOT create a history entry per step — user's back button still goes up a level, not back-through-the-stepper). Use `$app/navigation`'s `replaceState` or SvelteKit's `pushState`/`replaceState` helpers.

Reference pattern for steppers:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { QUERY_PARAMS, ROUTES } from '@ab/constants';
  import { KNOWLEDGE_PHASES, KNOWLEDGE_PHASE_ORDER, type KnowledgePhase } from '@ab/constants';

  let { data } = $props();

  // Init from URL; fall back to first phase
  const initialPhase = (page.url.searchParams.get(QUERY_PARAMS.STEP) as KnowledgePhase | null)
    ?? KNOWLEDGE_PHASE_ORDER[0];
  let currentPhase = $state<KnowledgePhase>(initialPhase);

  // Sync state → URL
  $effect(() => {
    const url = new URL(page.url);
    url.searchParams.set(QUERY_PARAMS.STEP, currentPhase);
    replaceState(url, {});
  });
</script>
```

For item-index (session): identical shape with `QUERY_PARAMS.ITEM` and a number.

## Per-page implementation

| Page | Changes |
| ---- | ------- |
| `/knowledge/[slug]/learn` | replace `stepIndex` ($state number) with `currentPhase` ($state KnowledgePhase). Server load narrows `?step=` against KNOWLEDGE_PHASE_VALUES. Svelte syncs via $effect + replaceState. Add `ROUTES.KNOWLEDGE_LEARN_AT(slug, phase)`. |
| `/sessions/[id]` | add `?item=<n>` (0-based index) + `?step=<slug>` (read/confidence/answer). Server narrows + clamps to 0..length-1. Add `ROUTES.SESSION_AT(id, item)`. |
| `/reps/session` | mirror of sessions/[id] pattern. Keep existing `?s=<sessionId>` (session seed). Add `?item=` + `?step=`. |
| `/memory/review` | skip for now. Queue is ephemeral and refreshing to a specific card in a queue that may have changed is a footgun. Revisit after user uses it. |
| `/memory/[id]` | add `?edit=1` mode flag. `ROUTES.MEMORY_CARD_EDIT(id)`. |
| `/plans/[id]` | keep `?created=1` one-shot. Skip section/tab URL unless user identifies need. |
| `/reps/browse` | rename `?phase=` → `?flight-phase=` (backwards-compat shim: read both, prefer new) |
| All browse pages | introduce `QUERY_PARAMS.*` constants; delete inline string literals |

## Rollout

Ordered so each step is independently mergeable and testable:

1. **Constants-only PR** — add new `QUERY_PARAMS` entries, rename `FLIGHT_PHASE`, add `buildQuery` helper. No behavior change yet. Small.
2. **Browse-page cleanup PR** — replace inline `'domain'`/`'page'`/`'phase'`/etc. with `QUERY_PARAMS.*`. Add backwards-compat shim on `/reps/browse` to accept both `?phase=` and `?flight-phase=` (log a console.warn on the old form). Small.
3. **KG learn stepper PR** — the flagship case. Server load narrows `?step=`, component syncs via `replaceState`, `KNOWLEDGE_LEARN_AT` maker added. Includes a Playwright test that navigates to `?step=verify` and asserts the verify section is rendered.
4. **Session stepper PR** — same pattern for `/sessions/[id]` and `/reps/session`. Adds `SESSION_AT`. More involved because the `phase` state interacts with the submit flow.
5. **Misc PR** — `?edit=1` on `/memory/[id]`, any small cleanups.

## Tests

- **Unit:** `buildQuery` helper. ROUTES maker functions with full param combos.
- **Integration (Playwright e2e):** for each stepper/item URL, navigate directly via URL + assert rendered section. For browse pages, navigate with filters set + assert results.

## Open questions for you

1. **`?phase=` rename:** `flight-phase` or `pof` (phase-of-flight)? `flight-phase` is clearer; `pof` is shorter. I'd pick `flight-phase`.
2. **Step name convention:** named slug (`?step=discover`) or index (`?step=3`)? Named is more readable + survives phase-reordering. I'd pick named.
3. **Item index 0-based or 1-based in URL?** 0-based matches code; 1-based matches "item 3 of 10" UI. I'd pick 0-based — internal invariant beats user-facing number.
4. **`/memory/review` deep-link:** skip for now (queue is ephemeral), or pin current card via `?card=<id>`? I'd skip.
5. **Path vs query for `/memory/[id]/edit`:** query flag (`?edit=1`) or path move (`/memory/[id]/edit`)? Query is cheaper; path is more bookmark-friendly. I'd pick query for now, revisit if the edit form grows into its own page.

Nothing to do until you answer these five. Plan document committed to this branch; no code changes.
