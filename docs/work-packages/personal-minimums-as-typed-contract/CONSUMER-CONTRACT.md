---
title: 'personal-minimums -- consumer contract for the personal-minimums lens'
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-13
owner: agent
---

# Consumer contract: the personal-minimums lens

This WP authors the typed primitive; future consumer WPs (xc-viewer overlay, decision-debrief replay, logbook ingestion) bind to the lens. This document is what those consumers read.

## Scope

When a future consumer wants to display "does this observation conform to the pilot's stated personal minimums?" -- the consumer calls a single pure function (`projectAgainstPersonalMinimums`) with two arguments (the active minimums row + an observation shape) and gets back a structured `ConformanceResult`. The consumer renders the result however it likes.

The lens is the only public touch-point for projecting against personal minimums. The BC functions (`getActivePersonalMinimums`, `getPersonalMinimumsHistory`) are the only public touch-points for reading the persisted record. Together they form the entire surface a consumer needs.

The lens never reaches into the DB, never touches the filesystem, never imports `node:*`. It is safe to call from a `.svelte` file at hydration time.

## Imports

```typescript
// Server-only (the consumer's +page.server.ts):
import {
  getActivePersonalMinimums,
  getPersonalMinimumsHistory,
  type PersonalMinimums,
} from '@ab/bc-study/server';

// Browser-safe (the consumer's .svelte component or pure helper):
import { projectAgainstPersonalMinimums } from '@ab/bc-study';

// Type-only (anywhere):
import type {
  PersonalMinimums,
  PersonalMinimumsFloors,
  PersonalMinimumsObservation,
  ConformanceResult,
} from '@ab/bc-study';
```

The runtime barrel `@ab/bc-study` re-exports the lens (value) and every relevant type. The server barrel `@ab/bc-study/server` carries the BC functions (which touch postgres and must stay off the client bundle).

## Data shapes

### `PersonalMinimums`

The record shape the BC returns. The BC normalises the Drizzle `$inferSelect` of `study.personal_minimums` -- in particular `visibilitySm` (a `numeric(4,1)` column Drizzle hands back as a `string`) is parsed to a `number`, so every consumer reads a uniform shape:

```typescript
interface PersonalMinimums {
  id: string;                          // `pmin_<lowercase ulid>`
  userId: string;
  ceilingFt: number;                   // AGL
  visibilitySm: number;                // statute miles (numeric(4,1), parsed)
  windTotalKt: number;
  crosswindTotalKt: number;
  nightRequiredRecencyLandings: number;
  imcRequiredRecencyApproaches: number;
  paxMax: number;
  terrainBufferAgl: number;
  notes: string | null;                // markdown body, may be null
  isActive: boolean;                   // always true for getActivePersonalMinimums result
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  seedOrigin: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Consumers usually only read `ceilingFt`, `visibilitySm`, `windTotalKt`, `crosswindTotalKt` (for the lens projection) plus `effectiveFrom` / `effectiveUntil` (for history binding). The rest is informational metadata.

### `PersonalMinimumsFloors`

The minimal floor set the lens actually reads. A full `PersonalMinimums` record satisfies this shape structurally, so a consumer normally just passes the BC's record straight to the lens -- the narrower interface exists so pure unit tests can pass a lightweight literal:

```typescript
interface PersonalMinimumsFloors {
  ceilingFt: number;
  visibilitySm: number;
  windTotalKt: number;
  crosswindTotalKt: number;
}
```

### `PersonalMinimumsObservation`

The observation shape the consumer constructs and feeds to the lens:

```typescript
interface PersonalMinimumsObservation {
  ceilingFtAgl: number;
  visibilitySm: number;
  windTotalKt: number;
  crosswindKt: number;
  isNight: boolean;
}
```

The observation is the consumer's projection of "the conditions in question" -- whether those are a wx-engine truth-model sample, a parsed METAR, a TAF forecast, or a logbook entry. The lens does not care where the observation comes from; it cares that the shape matches.

Field meanings:

- `ceilingFtAgl` -- the lowest BKN/OVC layer in feet above ground level at the station / waypoint in question. For a clear-skies observation, pass a very large number (e.g. 99999) -- the lens treats higher as more permissive.
- `visibilitySm` -- horizontal visibility in statute miles. For "clear" / "unlimited," pass 10 (or higher); the lens does not cap.
- `windTotalKt` -- the wind speed (steady or gust peak; consumer chooses) in knots.
- `crosswindKt` -- the crosswind component for the runway / leg in question. If unknown (no runway specified), the consumer may pass 0 and ignore the crosswind field in the result.
- `isNight` -- whether the observation is at night (civil twilight or darker). v1 lens reads this field but uses the same numeric floors for day and night; future day/night split (see OUT-OF-SCOPE.md) will use this field meaningfully.

### `ConformanceResult`

The lens output:

```typescript
interface ConformanceResult {
  pass: 'within' | 'below' | 'unknown';
  fields: {
    ceiling:    { observed: number; floor: number; withinFloor: boolean };
    visibility: { observed: number; floor: number; withinFloor: boolean };
    windTotal:  { observed: number; floor: number; withinFloor: boolean };
    crosswind:  { observed: number; floor: number; withinFloor: boolean };
  };
  notes: string[];                     // human-readable per-violation messages
}
```

Top-level `pass`:

- `'within'` -- every field's `withinFloor: true`. Safe to render a "within your floor" badge.
- `'below'` -- at least one field's `withinFloor: false`. Render a "below your floor" indicator; the `notes[]` array carries human-readable messages for the violating fields.
- `'unknown'` -- the caller passed a `null` minimums row (or the function detected the row's required fields were absent). Consumers should treat as "no opinion" and render neutrally.

Per-field `{ observed, floor, withinFloor }` -- the observed value, the pilot's floor, and the boolean conformance. Consumers that want per-field rendering use this; consumers that just want pass/fail use the top-level `pass`.

`notes[]` -- a deterministic array of human-readable strings, one per below-floor field, formatted as e.g. `"ceiling 800 ft AGL below your 1500 ft floor"`. Stable across calls with the same input. Consumers can render the notes directly, or substitute their own per-field rendering.

## The three functions

### `getActivePersonalMinimums(userId)` (server-only)

```typescript
function getActivePersonalMinimums(userId: string): Promise<PersonalMinimums | null>;
```

Returns the user's currently-active record, or null if the user has never set personal minimums (or has just deactivated). The BC enforces "at most one active row per user" via a partial unique index, so the result is unambiguous.

Recommended consumer pattern:

```typescript
// +page.server.ts in a consuming WP (e.g. the xc-viewer):
export const load: PageServerLoad = async ({ locals }) => {
  const minimums = await getActivePersonalMinimums(locals.user.id);
  // ... load the rest of the page data, pass minimums through to the .svelte component
  return { minimums, /* ... */ };
};
```

If `minimums` is null, the consumer should render its own page neutrally -- do not call the lens with null. The lens itself will return `pass: 'unknown'` if called with null, but the cleaner pattern is to guard at the consumer.

### `getPersonalMinimumsHistory(userId)` (server-only)

```typescript
function getPersonalMinimumsHistory(userId: string): Promise<PersonalMinimums[]>;
```

Returns every revision for the user, ordered by `effective_from DESC`. The first row is the most recent (and is the active row, if any). Use this when binding to a flight date or a debrief moment -- pick the revision whose effective window contains the date in question:

```typescript
function pickRevisionAt(
  history: PersonalMinimums[],
  at: Date,
): PersonalMinimums | null {
  return (
    history.find(
      (rev) =>
        rev.effectiveFrom <= at && (rev.effectiveUntil === null || rev.effectiveUntil > at),
    ) ?? null
  );
}
```

The decision-debrief-replay consumer uses this pattern to find "what your minimums were on the day of this flight" rather than "what your minimums are right now."

### `projectAgainstPersonalMinimums(minimums, observation)` (browser-safe)

```typescript
function projectAgainstPersonalMinimums(
  minimums: PersonalMinimums,
  observation: PersonalMinimumsObservation,
): ConformanceResult;
```

Pure function. Same input -> same output. No DB, no fs, no node:*. Importable from a `.svelte` file.

Recommended consumer pattern:

```svelte
<!-- A .svelte component in the xc-viewer overlay: -->
<script lang="ts">
  import { projectAgainstPersonalMinimums } from '@ab/bc-study';
  import type { PersonalMinimums, PersonalMinimumsObservation } from '@ab/bc-study';

  let { minimums, observation }: { minimums: PersonalMinimums; observation: PersonalMinimumsObservation } = $props();

  const conformance = $derived(projectAgainstPersonalMinimums(minimums, observation));
</script>

{#if conformance.pass === 'below'}
  <div class="below-floor-badge">below your floor</div>
  <ul>
    {#each conformance.notes as note}
      <li>{note}</li>
    {/each}
  </ul>
{:else if conformance.pass === 'within'}
  <div class="within-floor-badge">within your floor</div>
{/if}
```

The `$derived` rune is the right Svelte 5 pattern for re-running the lens whenever the inputs change; the function is cheap enough that running it on every render is fine.

## Recommended consumer-by-consumer binding

### xc-viewer-personal-minimums-overlay

Server-side: `+page.server.ts` calls `getActivePersonalMinimums(locals.user.id)` once on page load. Passes the row through `data.minimums`.

Client-side: `<WaypointWxChip>` accepts the minimums row + the per-waypoint observation. Calls the lens via `$derived`. Renders a "below your floor" badge on chips that don't conform.

The implications subpanel in the personal-minimums page in THIS WP becomes redundant for waypoint-level details once the overlay ships -- it stays around as a fallback for users who haven't yet visited the xc-viewer.

### decision-debrief-replay

Server-side: `+page.server.ts` calls `getPersonalMinimumsHistory(locals.user.id)`. Constructs the flown observation from the debrief data (per-leg conditions). For each leg, picks the revision active on the leg's date via `pickRevisionAt`, calls the lens, attaches the conformance to the leg.

Client-side: renders the conformance beside each leg's data with discovery-first framing ("you said your night ceiling was 3000 ft; you flew with 1500 ft; what did you decide in the moment?"). The framing is pedagogy, not the contract -- the consumer's WP designs the framing; the contract just delivers the data.

### logbook-ingestion

Server-side: for each ingested flight, calls `getPersonalMinimumsHistory(userId)` once and pre-computes per-flight conformance during ingest. Stores the result on the flight row (or computes on read; the WP's choice).

Replaces the "night currency could not be verified" placeholder in THIS WP's implications subpanel with a real check using the ingested night-landing data.

## Guarantees

1. **The lens is pure.** Same inputs -> same outputs. No mutation of inputs. No DB / fs / node:* dependency. Safe to call from any context.
2. **The lens is browser-safe.** `check-browser-globals.ts` walks the runtime barrel and validates the transitive import chain. Future agents adding to the lens module must keep it clean.
3. **The BC enforces one active record per user.** Both at the BC transactional level AND at the storage layer (partial unique index). A consumer reading `getActivePersonalMinimums` gets exactly one row or null -- never two.
4. **History is append-only.** Every save inserts a new row; existing rows are never deleted (except via user-deletion cascade). Consumers binding to a specific date can rely on the historical record being available.
5. **Field rename / addition policy.** When new fields are added to `personal_minimums` (e.g. the future day/night split, or per-aircraft variants), the lens function signature grows by accepting the new fields as optional on `PersonalMinimumsObservation`. Consumer code that passes only the v1 fields continues to compile and produce sane results. The lens does not break old callers when new fields land.
6. **Stable IDs.** `pmin_<lowercase ulid>` format never changes. The xc-viewer's per-flight binding can store `personal_minimums_id` as a foreign key safely.

## Lifecycle notes

- `bun run check` enforces the schema discipline. Any change to `study.personal_minimums` that breaks the type contract surfaces in the consuming WPs' `bun run check` runs.
- The lens never gets a "v2" that changes the existing contract; new behavior is additive (new optional observation fields, new optional fields in `ConformanceResult`). A breaking change would require a new WP and a coordinated consumer migration.
- The implications subpanel in this WP is a stop-gap. As consumers ship (xc-viewer overlay, logbook ingestion), the subpanel can shrink or be removed. The lens itself never goes away.

## Example: end-to-end binding for a hypothetical consumer

A future consumer building a "next 7 days forecast against your minimums" page:

```typescript
// apps/study/src/routes/(app)/forecast/+page.server.ts
import { getActivePersonalMinimums } from '@ab/bc-study/server';
import { loadForecast } from './_lib/forecast';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const minimums = await getActivePersonalMinimums(locals.user.id);
  const forecast = await loadForecast(/* user's saved home airport, etc. */);
  return { minimums, forecast };
};
```

```svelte
<!-- apps/study/src/routes/(app)/forecast/+page.svelte -->
<script lang="ts">
  import { projectAgainstPersonalMinimums } from '@ab/bc-study';
  let { data } = $props();
</script>

{#if data.minimums === null}
  <p>Set your <a href="/personal-minimums">personal minimums</a> to see forecast conformance.</p>
{:else}
  {#each data.forecast.days as day}
    {@const conformance = projectAgainstPersonalMinimums(data.minimums, day.observation)}
    <article>
      <h3>{day.date}</h3>
      {#if conformance.pass === 'below'}
        <p>Below your floor:</p>
        <ul>
          {#each conformance.notes as note}<li>{note}</li>{/each}
        </ul>
      {:else}
        <p>Within your floor.</p>
      {/if}
    </article>
  {/each}
{/if}
```

The consumer touches the lens twice (once per day in `$each`), passes the BC's row through the page data, never imports anything from `@ab/db`. The example is illustrative -- it's not a planned WP -- but it shows that a new consumer can land in a single small PR once this WP ships.
