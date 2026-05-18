---
id: personal-minimums-as-typed-contract
title: 'Design: Personal Minimums as a Typed Contract'
product: study
category: feature
status: draft
agent_review_status: done
human_review_status: pending
created: 2026-05-13
owner: agent
tags:
  - design
  - personal-minimums
  - lens
  - go-nogo
legacy_fields:
  feature: personal-minimums-as-typed-contract
  type: design
---

# Design: Personal Minimums as a Typed Contract

WP-specific design notes. The conceptual foundation is the existing [`wx-personal-minimums` knowledge node](../../../course/knowledge/weather/personal-minimums/node.md); the architectural pattern is the existing lens primitives in `libs/bc/study/src/lenses.ts` (per ADR 016); the persistence pattern is the existing `card` / `review` / `cardState` triad in `libs/bc/study/src/schema.ts`. Read those first; this doc adds the design choices specific to this WP.

## The load-bearing decision: revision history, not in-place mutation

The pilot's personal minimums change over time. Twenty hours of currency lower the floor; a long lay-off raises it; a near-miss tightens it; the annual IPC review recalibrates it. A naive design would carry a single `study.personal_minimums` row per user and mutate it on every edit. That would lose the history the rest of the platform needs.

Two future consumers depend on history:

- **Decision-debrief replay.** "Last March you said your night-VFR ceiling was 5000 ft. Last month you flew with 2000 ft. Did your minimums actually loosen, or did you violate them?" -- a question the platform can only answer if the prior record still exists.
- **Logbook ingestion.** "Your last 5 flights, overlaid on the minimums you had set on those dates." The minimums at the time of the flight matter, not today's minimums.

So the table is shaped as an append-only revision log: every save inserts a new row, the prior row flips `is_active = false` and stamps `effective_until = now()`. The active row is the one with `is_active = true` (enforced at the storage layer by a partial unique index). The history is the entire set of rows for the user, ordered by `effective_from DESC`.

This is the same shape the cert-syllabus-goal-composer WP uses for `study.goal` revisions (per ADR 016). The pattern is proven; reuse over invention.

## Why a partial unique index and not a CHECK

Postgres partial unique indexes are the cleanest way to enforce "at most one row matching `is_active = true` per `user_id`" without forcing a status enum or a separate "active" table. The index is `CREATE UNIQUE INDEX ... ON personal_minimums (user_id) WHERE is_active = true`. Insert / update conflicts surface as constraint violations the BC can catch and surface as a 409 to the form action.

A CHECK constraint can't express "global uniqueness within a partition" -- CHECKs are per-row. A trigger could, but triggers add operational complexity the rest of the schema avoids. The partial unique index is the idiomatic Postgres shape.

The BC's `createPersonalMinimumsRevision` wraps the update + insert in a transaction; the partial index serializes concurrent writers naturally. Two browser tabs racing to save resolve cleanly: one wins, one gets a unique-constraint failure that the form action translates into "your minimums changed in another tab -- reload."

## Why the lens is browser-safe and the BC isn't

The BC (`getActivePersonalMinimums`, `createPersonalMinimumsRevision`, etc.) touches `@ab/db/connection` (the postgres driver). It is server-only by construction; it lives in the `/server` barrel and never re-exports from the runtime barrel.

The lens (`projectAgainstPersonalMinimums`) takes pre-loaded values and returns a pure computation. It has no DB / fs / node:* dependencies. It lives in the runtime barrel and is importable from any `.svelte` file.

The split matters because the xc-viewer (and every future consumer) needs to display "your minimums vs this observation" in the browser. A consumer can pre-load the active minimums in its `+page.server.ts` and pass them to a `.svelte` component, which then calls the lens inline as the user pans the chart or selects different stations. The lens runs in the browser; the BC stays on the server.

The discipline mirrors the `summarizeDeckSpec` / `getCalibration` split documented in CLAUDE.md "Critical Rules" -- pure helpers ship through the runtime barrel; DB-touching helpers ship through `/server`.

## Why notes are markdown

The numbers carry the floor; the notes carry the rationale. A pilot writing "I'm tightening the night-VFR ceiling for the next 30 days because I haven't flown at night since November" is capturing context the numbers alone don't.

Markdown gives the pilot a way to write that context with structure (headings, lists, bold) without inventing a new mini-DSL. The existing course-step / knowledge-node markdown pipeline (DOMPurify on the rendered HTML) handles sanitization; we don't need a new layer.

The cap is 4000 chars -- matches the existing `card.body_md` discipline -- enough for several paragraphs of context without being a place to drop a journal entry.

## Why the form is page-level, not a modal

Personal minimums are a deliberate, infrequent decision. The pilot is meant to come to the page, sit with the numbers, write notes, and save -- not click a quick-edit modal between other tasks. The page-level form reinforces the discipline by making the edit a destination, not a glanceable affordance.

This is the same reasoning the goal-composer page uses (per ADR 016): goals are deliberate; they get a dedicated page, not a modal.

A side benefit: the page-level form lets the "implications" subpanel sit below the saved record, so editing and seeing implications are one continuous experience. A modal would break that.

## Why the "implications" subpanel exists at v1

The minimums on their own are abstract. "1500 ft ceiling" tells the pilot nothing about whether their planned weekend trip is in or out of their floor. The subpanel translates the abstract numbers into concrete consequences against data the platform already has -- wx-engine scenarios -- so the pilot sees the impact of their floor without having to do the comparison by hand.

The subpanel is intentionally bounded for v1: it only reads wx-engine scenarios (the only realistic weather data the platform owns). When logbook ingestion ships, the subpanel grows a "your last 5 flights against these minimums" section. When the xc-viewer ships its overlay, the subpanel shrinks because the overlay carries the same information at a higher fidelity in a more natural surface. The subpanel is a stop-gap that proves the lens contract is useful, not a permanent fixture.

The "night currency could not yet be verified" placeholder is deliberate: it pre-wires the UX seam for the logbook consumer. A future agent reading the page sees "this is where night-currency check goes; the BC just doesn't have data yet" without having to invent the section from scratch.

## Why no AI-suggested minimums in v1

The personal-minimums knowledge node teaches that the numbers are a pre-commitment -- a deliberate decision the pilot makes when not under pressure. Outsourcing the decision to an AI shortcuts the deliberation, which is the whole point.

A future enhancement could surface "pilots with similar hours and recency typically set X" as a calibration anchor -- but that's a separate WP with its own design surface (and its own pedagogical scrutiny). v1 holds the line: the pilot writes the numbers.

## API shapes

### BC functions (server-only)

```typescript
// libs/bc/study/src/personal-minimums.ts -- re-exported from @ab/bc-study/server only.

export interface PersonalMinimumsRow {
  id: string;
  userId: string;
  ceilingFt: number;
  visibilitySm: string; // numeric(4,1) -- comes back as string from pg, parse on read
  windTotalKt: number;
  crosswindTotalKt: number;
  nightRequiredRecencyLandings: number;
  imcRequiredRecencyApproaches: number;
  paxMax: number;
  terrainBufferAgl: number;
  notes: string | null;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  seedOrigin: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function getActivePersonalMinimums(userId: string): Promise<PersonalMinimumsRow | null>;

export function getPersonalMinimumsHistory(userId: string): Promise<PersonalMinimumsRow[]>;

export function createPersonalMinimumsRevision(
  userId: string,
  input: PersonalMinimumsInput,
): Promise<PersonalMinimumsRow>;

export function deactivatePersonalMinimums(userId: string): Promise<void>;
```

`visibilitySm` arrives from pg-node as a string (Drizzle's default `numeric` handling). The BC normalizes via the existing `numeric` post-processor used elsewhere in the schema; consumers see a `number` after the BC's pass. (Implementation detail; v1 picks the existing pattern.)

### Lens function (browser-safe)

```typescript
// libs/bc/study/src/personal-minimums-lens.ts -- re-exported from @ab/bc-study (runtime barrel).

export function projectAgainstPersonalMinimums(
  minimums: PersonalMinimumsRow,
  observation: PersonalMinimumsObservation,
): ConformanceResult;
```

See [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md) for the full per-field shape, the night-handling discipline, and the recommended binding pattern for future consumers.

### Form action surface

```typescript
// apps/study/src/routes/(app)/personal-minimums/+page.server.ts

export const load: PageServerLoad = async ({ locals }) => {
  const active = await getActivePersonalMinimums(locals.user.id);
  const history = await getPersonalMinimumsHistory(locals.user.id);
  const implications = active === null ? null : await computeImplications(active);
  return { active, history: history.slice(0, 5), implications };
};

export const actions: Actions = {
  save: async ({ request, locals }) => {
    const form = await request.formData();
    const parsed = personalMinimumsInputSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(400, { errors: parsed.error.flatten() });
    try {
      await createPersonalMinimumsRevision(locals.user.id, parsed.data);
    } catch (err) {
      if (isUniqueConstraintError(err)) return fail(409, { conflict: true });
      throw err;
    }
    return { saved: true };
  },
  deactivate: async ({ locals }) => {
    await deactivatePersonalMinimums(locals.user.id);
    return { deactivated: true };
  },
};
```

The action shape mirrors the existing study-app form actions (the card editor at `apps/study/src/routes/(app)/memory/[id]/`). No new patterns are introduced.

## Page layout (v1)

```text
+-----------------------------------------------------------+
| Personal Minimums                       [edit] [history]  |
+-----------------------------------------------------------+
|                                                           |
|  Ceiling (day)              1500 ft                       |
|  Visibility                 5 SM                          |
|  Wind (total)               20 kt                         |
|  Crosswind                  12 kt                         |
|  Night currency             3 landings within 90 days     |
|  IMC currency               6 approaches within 6 months  |
|  Passenger max              3                             |
|  Terrain buffer             1000 ft AGL                   |
|                                                           |
|  Notes:                                                   |
|  > I'm tightening the night ceiling for 30 days...        |
|                                                           |
|  Effective since 2026-04-15.                              |
|                                                           |
+-----------------------------------------------------------+

+-- Implications -------------------------------------------+
|                                                           |
|  Weather scenarios:                                       |
|    * frontal-xc-march -- KMLI: ceiling 800 ft AGL below   |
|      your 1500 ft floor.                                  |
|    * winter-icing-great-lakes -- KCLE: visibility 3 SM    |
|      below your 5 SM floor.                               |
|                                                           |
|  Night currency:                                          |
|    Could not yet be verified. Once logbook ingestion      |
|    ships, this will check your last night-landing date.   |
|                                                           |
+-----------------------------------------------------------+

+-- Recent history (5 most recent) -------------------------+
|  active        2026-04-15 ->            ceiling 1500 ft   |
|  2026-02-01 -> 2026-04-15               ceiling 2000 ft   |
|  2025-11-10 -> 2026-02-01               ceiling 2500 ft   |
|                                                           |
|  [view full history]                                      |
+-----------------------------------------------------------+
```

The Edit mode replaces the read-mode active record block with an inline form using the same per-field labels and the same vertical rhythm; per-field `<input type="number" min={..} max={..}>` controls are the v1 inputs. The notes field becomes a `<textarea>` with a 4000-char counter.

The "view full history" link goes to `/personal-minimums/history` -- the chronological read-only view of every revision.

## Browser-safety contract

Per CLAUDE.md "Critical Rules":

- `libs/bc/study/src/personal-minimums-lens.ts` is browser-safe. Zero `node:*` imports, zero `@ab/db/connection` reach, no `process.env.X` outside a `typeof process !== 'undefined'` guard, no bare `Buffer`. The file ships through the runtime barrel `@ab/bc-study` as a value re-export.
- `libs/bc/study/src/personal-minimums.ts` is server-only. Touches `@ab/db/connection` and `@ab/audit`. Ships only through `@ab/bc-study/server`. The runtime barrel `@ab/bc-study` re-exports its types as `type` re-exports only.
- The `check-browser-globals.ts` lint walks the runtime barrel and confirms the transitive import chain from `personal-minimums-lens.ts` stays clean.
- The page at `apps/study/src/routes/(app)/personal-minimums/+page.svelte` imports `projectAgainstPersonalMinimums` from `@ab/bc-study` (the runtime barrel) for any inline computations the page does client-side. Server-side data load uses `+page.server.ts` and imports from `@ab/bc-study/server`.

## Test seams

- **Zod schema unit tests** (Phase A): per-field acceptance + per-field rejection paths.
- **BC API unit tests** (Phase B): the active-revision invariant + the partial-unique-index serialization + the history-ordering guarantee. Tests use a transactional rollback wrapper so the dev DB stays clean between cases.
- **Lens unit tests** (Phase B): all-within / per-field-below cases + purity test (call twice, deep-equal output).
- **Browser-safety lint** (Phase B): `bun run scripts/check-browser-globals.ts` walks the runtime barrel and confirms the lens module is leak-free.
- **Playwright e2e** (Phase C/D): the full pilot journey -- empty state, initial save, edit, validation, history, implications subpanel, concurrent-edit conflict.
- **Manual walk-through** (Phase E): PMIN-60 through PMIN-61 in [test-plan.md](./test-plan.md). The user signs off after walking these end-to-end.

## Consumer-contract handoff

This WP unblocks three named follow-on WPs. Each of them gets its own WP authored separately:

- `xc-viewer-personal-minimums-overlay` -- pulls active minimums via `getActivePersonalMinimums(locals.user.id)` in `+page.server.ts`, passes the row + per-waypoint observation to `projectAgainstPersonalMinimums` inside `<WaypointWxChip>`, renders a "below your floor" badge on chips that don't conform. The overlay is the natural permanent surface for "implications"; the subpanel in this WP is the v1 stopgap.
- `decision-debrief-replay` -- pulls history via `getPersonalMinimumsHistory(locals.user.id)`, picks the revision that was active on the flight's date, runs the lens against the flown observation, surfaces the per-field conformance in the debrief view.
- `logbook-ingestion` -- consumes the lens once it knows per-flight conditions. The "night currency could not yet be verified" placeholder in this WP's subpanel becomes a real conformance check once logbook data is available.

The contract is detailed in [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md). Every future consumer reads that doc; this WP does not change after the consumers ship.

## Open questions resolved during spec authoring

- **Do we store day-vs-night ceiling and visibility separately?** Resolved: no, v1 stores one ceiling / visibility floor and the lens accepts `isNight` as an observation field but uses the same numeric floors. The split would double the column count and most pilots think about night as a margin multiplier, not as a separate floor. Day/night split moves to [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).
- **Should the lens carry "soft" floors (warning) vs "hard" floors (block)?** Resolved: no, v1 reports `pass: 'within' | 'below' | 'unknown'` only. The pilot decides what to do with the conformance result; the platform doesn't enforce a block. Soft/hard distinction is a consumer-side concern.
- **Do we surface a "tighter than legal" check?** Resolved: implicit. The constraint table allows values at or above the legal floor; the platform doesn't compare against 14 CFR 91.155 etc. directly. The knowledge node teaches the legal-vs-personal distinction; the typed primitive captures the personal floor; the legal floor lives in a separate (existing) airspace knowledge node.
- **Where does "currency" live -- on the personal-minimums row or on a separate currency-tracking table?** Resolved: on the personal-minimums row as `night_required_recency_landings` + `imc_required_recency_approaches`. The fields capture the pilot's FLOOR for currency, not their CURRENT currency state. The actual currency tracking (when did they last fly at night) is logbook-ingestion's responsibility.
