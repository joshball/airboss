# ADR 013: URL state taxonomy for sub-page locations

Status: **Accepted**.

Date proposed: 2026-04-22. Date accepted: 2026-04-23.

Supersedes: nothing. Informs: every page with in-page state, every route maker in `libs/constants/src/routes.ts`, every browse filter server load.

## Context

Many study-app pages hold meaningful sub-state that until recently lived only in client `$state`: the phase within a stepper (KG `/knowledge/[slug]/learn` has 7), the item within a session, the card within a review queue, the edit-mode flag on a detail page. Refresh the page and you lose your spot. Share the URL and the recipient lands on the first step. The KG learn page was the canonical example: a seven-phase discovery flow with zero URL awareness.

At the same time, browse pages already used query params (`?domain=`, `?page=`, etc.) but the naming had drifted:

- `/knowledge` used `?lifecycle=`
- `/memory/browse` used `?type=` for card type
- `/reps/browse` used `?phase=` for phase-of-flight

Introducing `?phase=` to the KG learn page meaning "content phase" would collide with the existing rep-browse `?phase=` meaning "phase-of-flight." Inline string keys in route handlers made the collision easy to miss and hard to rename safely.

We needed a single taxonomy covering every sub-state shape the app produces, a constants-backed naming convention so no literal string keys leak into code, and a rule for how component state round-trips to the URL without polluting history.

## Decision

Adopt a five-type taxonomy for sub-page state and route every query-param key through the `QUERY_PARAMS` constants in `libs/constants/src/routes.ts`. Route makers that take optional sub-state build their URLs via a shared `buildQuery` helper so `encodeURIComponent` and empty-value handling live in exactly one place.

### The five sub-state types

| Type                | Shape                                            | Example                          | URL form                                                 |
| ------------------- | ------------------------------------------------ | -------------------------------- | -------------------------------------------------------- |
| Stepper             | 1..N ordered stages, fixed names                 | KG learn phases, session-item    | `?step=<slug>` (named, not index; survives reordering)   |
| Item index          | 0-based position in a frozen queue               | Session item N of M, review card | `?item=<n>` (index; queue is frozen per-session)         |
| Tab                 | 1-of-N full-section view                         | Plan detail sections             | `?tab=<slug>`                                            |
| Filter              | Multiple independent narrowings                  | Browse filters                   | Keyed individually: `?domain=&cert=&status=`             |
| Mode flag           | Boolean sub-mode                                 | Card edit mode                   | `?edit=1` (or `?mode=<slug>` for >2 states)              |
| One-shot banner     | Post-action feedback dropped on navigation       | "Plan created"                   | `?created=1`                                             |

The one-shot banner shape isn't a sixth taxonomic type so much as a pattern: a boolean flag a server load consumes then drops.

### Naming rules

1. Query-param keys are always one of the `QUERY_PARAMS` constants. No inline string literals in route handlers, server loads, or route makers.
2. Query-param values come from `libs/constants/` enum sets when the space is closed (phases, tabs, filter enums). `buildQuery` applies `encodeURIComponent` so callers never hand-roll it.
3. Step names are lowercase-kebab slugs that match the spec constants. KG learn uses `context | problem | discover | reveal | practice | connect | verify`, which are the string values of `KNOWLEDGE_PHASES`.
4. Item indices are 0-based in the URL to match code. The 1-based "Item 3 of 10" UI label stays in the component.
5. Path vs query: query for view-within-page state. Path segments are reserved for fundamentally different pages (`/plans/[id]/edit` would be its own page, not a query flag on `/plans/[id]`).

### Collision rename

`?phase=` on `/reps/browse` meant phase-of-flight. It now reads from `QUERY_PARAMS.FLIGHT_PHASE` (`?flight-phase=`), freeing `?phase=` / `?step=` for stepper usage elsewhere. The old key is rejected. Pre-alpha data is disposable, so there's no legacy surface to keep supporting.

### Sync pattern

Server load reads the URL param, validates and narrows to an enum, defaults cleanly on missing-or-invalid. Client binds component state to the URL via `replaceState` from `$app/navigation` so there's no history entry per step, and the user's back button still goes up a level rather than back through the stepper.

Reference stepper pattern:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { QUERY_PARAMS } from '@ab/constants';
  import { KNOWLEDGE_PHASE_ORDER, type KnowledgePhase } from '@ab/constants';

  let { data } = $props();

  const initial = (page.url.searchParams.get(QUERY_PARAMS.STEP) as KnowledgePhase | null)
    ?? KNOWLEDGE_PHASE_ORDER[0];
  let currentPhase = $state<KnowledgePhase>(initial);

  $effect(() => {
    const url = new URL(page.url);
    url.searchParams.set(QUERY_PARAMS.STEP, currentPhase);
    replaceState(url, {});
  });
</script>
```

For item-index: identical shape with `QUERY_PARAMS.ITEM` and a number.

### Route maker surface

`libs/constants/src/routes.ts` exposes typed makers for every linkable sub-location. Representative shape:

```typescript
export const ROUTES = {
  KNOWLEDGE_LEARN: (slug: string) => `/knowledge/${slug}/learn` as const,
  KNOWLEDGE_LEARN_AT: (slug: string, phase: KnowledgePhase) =>
    `/knowledge/${slug}/learn?${QUERY_PARAMS.STEP}=${encodeURIComponent(phase)}` as const,

  SESSION: (id: string) => `/sessions/${id}` as const,
  SESSION_AT: (id: string, itemIndex: number) =>
    `/sessions/${id}?${QUERY_PARAMS.ITEM}=${itemIndex}` as const,

  MEMORY_CARD: (id: string) => `/memory/${id}` as const,
  MEMORY_CARD_EDIT: (id: string) => `/memory/${id}?${QUERY_PARAMS.EDIT}=1` as const,
};
```

## Consequences

- Every new page with sub-state picks one of five shapes and reaches for the already-named `QUERY_PARAMS` entry. No debate, no new key invented ad hoc.
- Browse filters, stepper position, and edit mode are deep-linkable. Refresh-resilience is the default; share-by-URL lands a recipient at the exact sub-state the sender was at.
- Route makers centralize URL construction, so a future schema change (say, renaming `?step=` to `?phase=` after a cert reshuffle) is one constant edit plus a test run.
- `replaceState` semantics keep stepper navigation out of the browser history. Back-button behavior stays intuitive: back goes up a level, not back-through-the-stepper.
- The `FLIGHT_PHASE` rename is a breaking URL change but affects only bookmarks at the browse page. No real users yet, no migration.
- Tests: Playwright e2e per stepper/item URL navigates directly and asserts the rendered section. Vitest unit tests exercise `buildQuery` and the route-maker matrix.

## Alternatives considered

### Index-based stepper keys (`?step=3`)

Shorter URLs, but a reordering of phases (likely as KG pedagogy evolves) silently points everyone's bookmarks at a different section. Named slugs are self-describing and survive phase reordering. Rejected in favor of named.

### 1-based item indices in the URL

Matches the "Item 3 of 10" UI label, but diverges from the 0-based array indexing everywhere else in the code. The internal invariant wins over the user-facing number; the UI adds +1 at render time. Rejected.

### Path move for edit mode (`/memory/[id]/edit`)

More bookmark-friendly and URL-conventional. But an edit toggle on a detail page doesn't justify a full route; if the edit form grows into its own page later, a path move is a refactor. `?edit=1` today, revisit if scope grows. Accepted the query flag.

### Deep-linking `/memory/review`

The review queue is ephemeral: the set of cards in the queue can change between sessions, so a `?card=<id>` pin can land on a card that's no longer scheduled. Skipped until user feedback identifies a need.

### Inline string keys in route handlers

Keeps each page self-contained. But that's exactly how `?phase=` collided with itself across two pages. Centralizing via `QUERY_PARAMS` makes collisions unrepresentable. Rejected.

### History entries per sub-state transition

Would let the back button walk back through stepper phases. But then back-from-the-session-page traverses N items before leaving, which is intrusive. `replaceState` is the right call; explicit "prev step" buttons exist in the UI when reversibility is needed.
