---
id: personal-minimums-as-typed-contract
title: 'Spec: Personal Minimums as a Typed Contract'
product: study
category: feature
status: draft
agent_review_status: pending
human_review_status: pending
created: 2026-05-13
owner: agent
depends_on: []
unblocks:
  - xc-viewer-personal-minimums-overlay
  - decision-debrief-replay
  - logbook-ingestion
tags:
  - personal-minimums
  - weather
  - decision-making
  - typed-primitive
  - lens
  - go-nogo
legacy_fields:
  feature: personal-minimums-as-typed-contract
  type: spec
---

# Spec: Personal Minimums as a Typed Contract

A new persisted primitive in the study BC -- `study.personal_minimums` -- that lets a pilot record their self-imposed go/no-go floors (ceiling, visibility, winds, recency, passenger count, terrain buffer, notes) as structured data with a revision history. v1 ships the schema, the Zod validation, a form-based editor surface under the study app, the BC read API, and a "personal minimums lens" projection that any future scenario / weather product / logbook view can subscribe to.

Personal minimums today live as content -- the [`wx-personal-minimums` knowledge node](../../../course/knowledge/weather/personal-minimums/node.md) teaches the discipline well. But the platform has no typed primitive for the learner to actually persist their own numbers. Every consumer that should be able to ask "does this scenario / forecast / planned flight violate the pilot's stated minimums?" has to make up its own representation. This WP fixes that by promoting personal minimums from prose to a typed contract.

## Why this WP exists

Personal minimums are load-bearing for several in-flight and on-the-roadmap surfaces, but the lack of a typed primitive blocks every one of them:

- The [xc-viewer](../../vision/products/pre-flight/xc-viewer/VISION.md) wants to overlay the pilot's minimums alongside a wx-engine scenario ("this Tuesday forecast violates your night-VFR ceiling at KMKL by 700 ft"). Without a structured record, the overlay has nothing to compare against.
- A future decision-debrief replay WP wants to compare what the pilot said their minimums were before the flight against what they actually flew. Without a persisted history (with `effective_from` / `effective_until`), there's no version to compare against.
- A future logbook-ingestion WP wants to surface "your last 5 flights overlaid on your stated personal mins" so the learner can see drift in their own discipline. Same problem: no structured record to overlay.
- The [goal-composer / cert-syllabus](../cert-syllabus-and-goal-composer/spec.md) wants to support goals shaped like "tighten personal minimums for IMC entry over six months" -- which needs a measurable, queryable, time-series primitive, not a markdown file in a notebook.

This WP unblocks all four by shipping the underlying primitive once, with a CONSUMER-CONTRACT.md the future consumers bind to.

The pedagogy of *what personal minimums are* and *why they matter* is content -- it stays in `course/knowledge/weather/personal-minimums/node.md` per ADR 011. This WP doesn't touch that. What it ships is the **mechanism** by which a learner records the numbers the content teaches them to set.

## Killer-feature framing

The killer feature is **pre-commitment that the system can enforce**. The personal-minimums knowledge node teaches that the discipline lives in writing the numbers down when you are not under decision pressure. A typed contract takes that one step further: the number is not just written down in a notebook a pilot might fail to consult, it is persistable, queryable, and -- once consumers bind to the lens -- automatically surfaced beside every scenario / forecast / planned flight the platform shows. The pilot cannot "forget what they said" because the platform remembers and overlays.

Pre-commitment becomes plumbing. The pilot's earlier, unpressured self speaks every time they view a forecast.

## Scope

### In

- One new Drizzle table `study.personal_minimums` in `libs/bc/study/src/schema.ts` per the schema below, with the audit `...timestamps()` helper plus a `seedOrigin: text` column for dev-seed integration.
- One Zod schema `personalMinimumsInputSchema` in `libs/types/src/personal-minimums.ts` validating user input. Default-vs-min-vs-max constraints follow the **constraint shape** below; specific numeric defaults are tuned in v1 implementation, not prescribed by this spec.
- ID generator `generatePersonalMinimumsId` in `libs/utils/src/ids.ts` -- prefix `pmin_` per the repo's prefix-ULID convention.
- Constants: `PERSONAL_MINIMUMS_DEFAULTS`, `PERSONAL_MINIMUMS_CONSTRAINTS` in `libs/constants/src/personal-minimums.ts`. Routes: `ROUTES.STUDY_PERSONAL_MINIMUMS`, `ROUTES.STUDY_PERSONAL_MINIMUMS_HISTORY` in `libs/constants/src/routes.ts`.
- BC API in `libs/bc/study/src/personal-minimums.ts` (server-only): `getActivePersonalMinimums(userId)`, `getPersonalMinimumsHistory(userId)`, `createPersonalMinimumsRevision(userId, input)`, `deactivatePersonalMinimums(userId)` (clears `is_active`; does NOT delete history). Re-exported from `@ab/bc-study/server`. Browser-safe types only on `@ab/bc-study`.
- One reader / editor surface at `apps/study/src/routes/(app)/personal-minimums/+page.svelte` (form-based v1). The page renders the active record in read mode by default with an "edit" affordance that opens an inline form. Saving a change writes a new revision (does not mutate the existing one); the prior revision flips `is_active = false` and `effective_until = now()` via a transactional bump.
- One "implications" subpanel on the same page: "Show what these minimums imply" -- given the active minimums, surface concrete consequences against currently-available scenario / forecast data. v1 implications are bounded: list each wx-engine scenario whose `truth.airMasses[*]` violates the active ceiling / visibility floor; flag night-currency gap if `night_required_recency_landings > 0` and the BC has no record of recent night landings (the latter is a soft "could not verify" until logbook ingestion ships -- shown as informational, not as a violation claim).
- A "personal minimums lens" projection in `libs/bc/study/src/personal-minimums-lens.ts` -- a small, pure function `projectAgainstPersonalMinimums(minimums, observation) -> ConformanceResult` that any consumer can call with an observation shaped like `{ ceilingFtAgl, visibilitySm, windTotalKt, crosswindKt, isNight }`. Returns a `ConformanceResult` shape (per-field `withinFloor: boolean` + an overall `pass: 'within' | 'below' | 'unknown'`). The lens is the only contact surface a future consumer needs.
- Audit logging via `@ab/audit`: every revision write emits an `audit_log` row with the prior and next record shapes.
- A short course-step nudge that points from the existing `wx-personal-minimums` knowledge node to `/personal-minimums` ("now that you understand why -- record yours here"). Authored in the existing weather-comprehensive course; no new course content.
- `bun run check` step (existing schema validators + the existing lint): no new pipeline steps are required; the existing `bun run check` suite picks up the new table via the standard Drizzle generation pass.
- Phasing: five phases (A through E). Each ships its own PR.

### Out

See [OUT-OF-SCOPE.md](./OUT-OF-SCOPE.md).

## Anchor docs

- [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) -- the pedagogical foundation; what the primitive persists.
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- discovery-first pedagogy; the prose stays in the knowledge node, the mechanism lives here.
- [ADR 016](../../decisions/016-cert-syllabus-goal-model/decision.md) -- goal / syllabus / lens primitives; the personal-minimums lens is a sibling shape to the cert / goal lenses already shipped.
- [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) -- source-artifact policy. Personal minimums are user data; they live in the DB, not in `data/` or in the cache. Cited for completeness.
- [ADR 025](../../decisions/025-wp-frontmatter-contract/decision.md) -- WP frontmatter contract.
- [xc-viewer VISION.md](../../vision/products/pre-flight/xc-viewer/VISION.md) -- names personal-minimums as a planned second consumer beyond the weather-course step. This WP unblocks that.
- [wx-engine spec](../wx-engine/spec.md) -- truth-aware weather scenarios this WP's lens reads against.
- [cert-syllabus-and-goal-composer spec](../cert-syllabus-and-goal-composer/spec.md) -- goal primitive that future "tighten personal minimums" goals will hang on.
- FAA Pamphlet **P-8740-25** -- Personal Minimums Checklist. Canonical paper artifact this primitive's shape mirrors.
- FAA-H-8083-2 **Risk Management Handbook**, Chapter 6 -- SRM framework the discipline derives from.

## Architecture overview

```text
libs/bc/study/src/                      study BC (server-only writes)
  schema.ts                             + personal_minimums table
  personal-minimums.ts                  + BC API (server-only)
  personal-minimums-lens.ts             + lens projection (browser-safe; pure function)
  server.ts                             re-exports BC API
  index.ts                              type re-exports + lens fn (lens is browser-safe)

libs/types/src/
  personal-minimums.ts                  + Zod input schema + ConformanceResult + lens types

libs/constants/src/
  personal-minimums.ts                  + PERSONAL_MINIMUMS_DEFAULTS / _CONSTRAINTS
  routes.ts                             + ROUTES.STUDY_PERSONAL_MINIMUMS(_HISTORY)

libs/utils/src/
  ids.ts                                + generatePersonalMinimumsId() -> pmin_<ULID>

apps/study/src/routes/(app)/personal-minimums/
  +page.server.ts                       reads active record + history; form actions write revisions
  +page.svelte                          form-based editor with "implications" subpanel
  history/+page.svelte                  read-only revision history view

docs/work-packages/personal-minimums-as-typed-contract/
  spec.md                               this file
  tasks.md                              phased implementation plan
  test-plan.md                          manual + automated test plan
  design.md                             UI / API shape detail
  user-stories.md                       per-role stories
  OUT-OF-SCOPE.md                       deferred items per ADR-025 / OOS discipline
  CONSUMER-CONTRACT.md                  the lens projection contract future consumers bind to
```

The lens is the load-bearing seam: future consumers call `projectAgainstPersonalMinimums(activeMinimums, observation)` rather than reaching into the DB or the BC. The BC owns the persistence; the lens owns the projection; the consumers only know about the lens.

## Behavior

### Editing flow

1. Pilot navigates to `/personal-minimums` in the study app.
2. The page renders the current active record (or an "you haven't set yours yet -- here's a starter template" empty state if no row exists). The empty state seeds the form with `PERSONAL_MINIMUMS_DEFAULTS` -- the FAA P-8740-25 baseline for a 200-hour PPL, used as a starting shape only. The pilot is invited to tune.
3. Pilot clicks "edit." Form opens inline with the current values pre-filled.
4. Pilot tunes the values. Inline validation surfaces constraint failures (ceiling < 0, visibility > 100 SM, etc.) before submit per the Zod schema.
5. On save: a form action calls `createPersonalMinimumsRevision(userId, input)`. The BC transactionally (a) flips the existing active row's `is_active = false` and stamps `effective_until = now()`, (b) inserts the new row with `is_active = true`, `effective_from = now()`, `effective_until = null`, (c) writes an audit_log row referencing both. The page re-renders showing the new active record.
6. The pilot can view full revision history at `/personal-minimums/history`. The history view is read-only and chronological (newest first).

### "Show what these minimums imply" subpanel

A small panel below the active record that turns the abstract numbers into concrete consequences. v1 implication checks (bounded; future consumers extend this):

- For each registered wx-engine scenario (read from `WX_SCENARIO_VALUES`): does any `truth.airMasses[*]` carry a ceiling or visibility under the pilot's floor? If yes, name the scenario + the violating station(s).
- Night-currency check: if `night_required_recency_landings > 0`, attempt to find the pilot's most recent night-currency-eligible landings in the BC. v1 says "we can't yet check this -- once logbook ingestion ships, this panel will tell you" (the implication is visible but informational, not a violation). The "we can't yet check this" affordance is a deliberate piece of pre-wired UX so the future logbook consumer can drop in.
- Crosswind check: list each wx-engine scenario where the projected wind at any route station produces a crosswind component exceeding `crosswind_total_kt` for the most common runway alignment in the scenario. v1 uses the wx-engine truth model; the lens itself accepts any observation that conforms to the input shape.

The subpanel is informational. It does NOT block flight planning or hide scenarios -- it surfaces conformance and lets the pilot decide.

### Read API

Three BC functions cover the consumer-side reads:

```typescript
// Lives in libs/bc/study/src/personal-minimums.ts (server-only).
export function getActivePersonalMinimums(userId: string): Promise<PersonalMinimumsRow | null>;
export function getPersonalMinimumsHistory(userId: string): Promise<PersonalMinimumsRow[]>;

// Lives in libs/bc/study/src/personal-minimums-lens.ts (browser-safe pure function).
export function projectAgainstPersonalMinimums(
  minimums: PersonalMinimumsRow,
  observation: PersonalMinimumsObservation,
): ConformanceResult;
```

`getActivePersonalMinimums` is the consumer entrypoint. It returns the row a future scenario / forecast / planned-flight surface compares against, or `null` if the pilot has not yet set any.

`getPersonalMinimumsHistory` is the audit / debrief entrypoint. Future decision-debrief replay reads from it to compare "what you said before the flight" against the flown record.

`projectAgainstPersonalMinimums` is the pure projection function (the lens). It takes the active minimums plus an observation shape and returns conformance. The shape is documented in detail in [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md).

## Data model

### `study.personal_minimums`

Columns:

| Column                            | Type                   | Notes                                                                              |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| `id`                              | `text` PK              | `pmin_<lowercase ulid>` per `generatePersonalMinimumsId`                           |
| `user_id`                         | `text` notNull FK      | -> `bauthUser.id`. ON DELETE CASCADE (user removal cascades through their history) |
| `ceiling_ft`                      | `integer` notNull      | AGL. >= 0; <= 30000                                                                |
| `visibility_sm`                   | `numeric(4,1)` notNull | Statute miles. >= 0.0; <= 99.9                                                     |
| `wind_total_kt`                   | `integer` notNull      | >= 0; <= 99                                                                        |
| `crosswind_total_kt`              | `integer` notNull      | >= 0; <= 99; also <= `wind_total_kt` (validator)                                   |
| `night_required_recency_landings` | `integer` notNull      | default 3 (legal floor). >= 0; <= 50                                               |
| `imc_required_recency_approaches` | `integer` notNull      | default 6 (legal floor). >= 0; <= 50                                               |
| `pax_max`                         | `integer` notNull      | >= 0; <= 19 (cap by typical light-aircraft realism)                                |
| `terrain_buffer_agl`              | `integer` notNull      | >= 0; <= 10000                                                                     |
| `notes`                           | `text` nullable        | Markdown allowed; rendered server-side via the existing markdown pipeline          |
| `is_active`                       | `boolean` notNull      | default true. Only one TRUE per `user_id` (partial unique index)                   |
| `effective_from`                  | `timestamptz` notNull  | default `now()`                                                                    |
| `effective_until`                 | `timestamptz` nullable | NULL while active; stamped when superseded                                         |
| `seed_origin`                     | `text` nullable        | Dev-seed marker per project convention                                             |
| `created_at` / `updated_at`       | via `...timestamps()`  | Standard audit pair                                                                |

Constraints:

- Partial unique index `personal_minimums_one_active_per_user_uidx` on `(user_id)` WHERE `is_active = true`. Enforces "at most one active record per user" at the storage layer.
- CHECK `personal_minimums_crosswind_le_wind_check`: `crosswind_total_kt <= wind_total_kt`.
- CHECK `personal_minimums_effective_window_check`: `effective_until IS NULL OR effective_until > effective_from`.
- CHECK on every numeric range column matching the constraints table above (per Drizzle / repo discipline).

Indexes:

- `personal_minimums_user_idx` on `user_id` -- the active read.
- `personal_minimums_user_effective_idx` on `(user_id, effective_from DESC)` -- the history read.

### Constants (`libs/constants/src/personal-minimums.ts`)

The constraint shape is constants; specific numeric values for `_DEFAULTS` are tuned at implementation time, not prescribed by the spec. The shape:

```typescript
export const PERSONAL_MINIMUMS_DEFAULTS = {
  CEILING_FT: 1500,
  VISIBILITY_SM: 5.0,
  WIND_TOTAL_KT: 20,
  CROSSWIND_TOTAL_KT: 12,
  NIGHT_REQUIRED_RECENCY_LANDINGS: 3,
  IMC_REQUIRED_RECENCY_APPROACHES: 6,
  PAX_MAX: 3,
  TERRAIN_BUFFER_AGL: 1000,
} as const;

export const PERSONAL_MINIMUMS_CONSTRAINTS = {
  CEILING_FT: { min: 0, max: 30000 },
  VISIBILITY_SM: { min: 0, max: 99.9, decimalPlaces: 1 },
  WIND_TOTAL_KT: { min: 0, max: 99 },
  CROSSWIND_TOTAL_KT: { min: 0, max: 99 },
  NIGHT_REQUIRED_RECENCY_LANDINGS: { min: 0, max: 50 },
  IMC_REQUIRED_RECENCY_APPROACHES: { min: 0, max: 50 },
  PAX_MAX: { min: 0, max: 19 },
  TERRAIN_BUFFER_AGL: { min: 0, max: 10000 },
} as const;
```

The `_DEFAULTS` values shown are the v1 starting shape -- they match the body of the [`wx-personal-minimums` knowledge node](../../../course/knowledge/weather/personal-minimums/node.md) "Reveal" column for Solo / VFR, which is itself drawn from FAA P-8740-25. Implementation phase A may tune these numbers based on the spec content review pass; the constraint table (min/max) is frozen.

### Zod schema (`libs/types/src/personal-minimums.ts`)

```typescript
import { z } from 'zod';
import { PERSONAL_MINIMUMS_CONSTRAINTS as C } from '@ab/constants';

export const personalMinimumsInputSchema = z
  .object({
    ceilingFt: z.number().int().min(C.CEILING_FT.min).max(C.CEILING_FT.max),
    visibilitySm: z.number().min(C.VISIBILITY_SM.min).max(C.VISIBILITY_SM.max),
    windTotalKt: z.number().int().min(C.WIND_TOTAL_KT.min).max(C.WIND_TOTAL_KT.max),
    crosswindTotalKt: z.number().int().min(C.CROSSWIND_TOTAL_KT.min).max(C.CROSSWIND_TOTAL_KT.max),
    nightRequiredRecencyLandings: z
      .number()
      .int()
      .min(C.NIGHT_REQUIRED_RECENCY_LANDINGS.min)
      .max(C.NIGHT_REQUIRED_RECENCY_LANDINGS.max),
    imcRequiredRecencyApproaches: z
      .number()
      .int()
      .min(C.IMC_REQUIRED_RECENCY_APPROACHES.min)
      .max(C.IMC_REQUIRED_RECENCY_APPROACHES.max),
    paxMax: z.number().int().min(C.PAX_MAX.min).max(C.PAX_MAX.max),
    terrainBufferAgl: z.number().int().min(C.TERRAIN_BUFFER_AGL.min).max(C.TERRAIN_BUFFER_AGL.max),
    notes: z.string().max(4000).nullable().optional(),
  })
  .refine((v) => v.crosswindTotalKt <= v.windTotalKt, {
    message: 'crosswindTotalKt must be <= windTotalKt',
    path: ['crosswindTotalKt'],
  });

export type PersonalMinimumsInput = z.infer<typeof personalMinimumsInputSchema>;

export interface PersonalMinimumsObservation {
  ceilingFtAgl: number;
  visibilitySm: number;
  windTotalKt: number;
  crosswindKt: number;
  isNight: boolean;
}

export interface ConformanceResult {
  pass: 'within' | 'below' | 'unknown';
  fields: {
    ceiling: { observed: number; floor: number; withinFloor: boolean };
    visibility: { observed: number; floor: number; withinFloor: boolean };
    windTotal: { observed: number; floor: number; withinFloor: boolean };
    crosswind: { observed: number; floor: number; withinFloor: boolean };
  };
  notes: string[];
}
```

### Routes (`libs/constants/src/routes.ts`)

```typescript
STUDY_PERSONAL_MINIMUMS: '/personal-minimums' as const,
STUDY_PERSONAL_MINIMUMS_HISTORY: '/personal-minimums/history' as const,
```

## Validation

| Field / rule                                       | Rule                                                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `PersonalMinimumsInput`                            | Validates through `personalMinimumsInputSchema` on every write. Surfaces per-field path on failure                              |
| `crosswind_total_kt <= wind_total_kt`              | Both Zod-refinement + DB CHECK                                                                                                  |
| `effective_until > effective_from` (when not NULL) | DB CHECK; the BC's revision flow always stamps `now()` so this only fires on manual mis-edits                                   |
| One active record per user                         | Partial unique index `(user_id) WHERE is_active = true`. The BC's transactional bump enforces atomicity at the app layer too    |
| `notes` length cap                                 | 4000 chars in Zod; matches the existing pattern on `card.body_md`                                                               |
| ID format                                          | Always emitted via `generatePersonalMinimumsId()`; never call `ulid()` direct                                                   |
| Lens projection                                    | `projectAgainstPersonalMinimums` is pure; same input -> same output; no DB / fs access; importable from a `.svelte` file safely |

## Edge cases

- **Pilot has never set minimums.** `getActivePersonalMinimums` returns `null`. Consumers must treat `null` as "no opinion." The lens returns `pass: 'unknown'` if invoked with a null minimums row (which is illegal at the type level -- the consumer is expected to guard before calling).
- **Pilot saves the same values twice.** The BC still writes a new revision (the timestamps differ). Callers wanting "no-op on identical save" can compare client-side; the BC does not dedupe. Rationale: the history is an audit trail; a pilot deliberately re-affirming their floor at the start of a new training block is a legitimate event.
- **Pilot deactivates without replacing.** `deactivatePersonalMinimums(userId)` flips `is_active = false` and stamps `effective_until = now()` without inserting a new row. Active reads after this return `null`. Used for "I'm intentionally retracting these and will think about it" rather than for delete.
- **Crosswind > wind total.** Rejected at Zod-refinement time AND at the DB CHECK level. The form surfaces the error inline before submit.
- **Zero passenger floor with a child pilot.** Legitimate (pilots flying solo set `pax_max: 0` to indicate "I will not carry passengers right now"). The schema accepts it.
- **Notes with markdown injection.** Rendered server-side via the existing course-step markdown pipeline (DOMPurify on the rendered HTML); same surface as knowledge-node bodies. No new sanitization is required.
- **Concurrent revisions from two devices.** The partial unique index serializes; the second writer's transactional bump fails the index, the form action returns a 409 with "your minimums changed in another tab -- reload." The UX is documented in [design.md](./design.md).
- **`is_active = true` row with `effective_until` non-NULL.** The CHECK `effective_until > effective_from` doesn't prevent this directly; the BC enforces "active means effective_until IS NULL" in `createPersonalMinimumsRevision`. A future cleanup could add a partial CHECK; v1 relies on the BC invariant.
- **User deletion.** ON DELETE CASCADE removes every history row. The audit_log emits a final "user deleted -- N revisions removed" event for the audit trail.

## Acceptance

V1 ships when:

- `bun run check` is clean across the new schema, lens, BC, and form.
- A pilot can navigate to `/personal-minimums`, see the empty state, fill the form, save, and see their saved record render in read mode.
- Editing the active record creates a new revision; the previous revision shows in `/personal-minimums/history` with the correct `effective_from` / `effective_until` window.
- `getActivePersonalMinimums(userId)` returns exactly one row (or null); `getPersonalMinimumsHistory(userId)` returns all revisions ordered by `effective_from DESC`.
- The "implications" subpanel surfaces at least one concrete violation when the user's saved ceiling is below a wx-engine scenario's `truth.airMasses[*].surfaceCeilingFtAgl` somewhere on the registered scenario set (using `frontal-xc-march` as the canonical test scenario).
- `projectAgainstPersonalMinimums` is a pure function importable from a `.svelte` file without bundle-leak warnings; the `check-browser-globals.ts` lint passes.
- The CONSUMER-CONTRACT.md is published and links from the xc-viewer follow-on backlog so the next consumer can bind without re-reading this WP.
- The knowledge-node nudge points learners from the existing `wx-personal-minimums` content to the new editor surface.
- Every WP file in this directory carries `agent_review_status: done` after a clean `/ball-review-full` pass; `human_review_status` stays `pending` until the user walks the test plan.
