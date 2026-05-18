---
id: personal-minimums-as-typed-contract
title: 'Test Plan: Personal Minimums as a Typed Contract'
product: study
category: feature
status: draft
agent_review_status: done
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
  - test-plan
legacy_fields:
  feature: personal-minimums-as-typed-contract
  type: test-plan
---

# Test Plan: Personal Minimums as a Typed Contract

Manual acceptance tests for [spec.md](./spec.md). Prefix `PMIN-`. Scenarios grouped by phase (foundation -> BC + lens -> editor surface -> implications -> close).

## Setup

- `bun install` clean.
- `bun run check` passes on the branch.
- Dev DB reset + seeded: `bun run db reset && bun run db seed`.
- Abby is the seeded test user (`abby@airboss.test`); log in as Abby for every manual test unless stated.
- The wx-engine spike output is available at `data/wx-scenarios/frontal-xc-march/` so the implications subpanel has at least one scenario to read against.
- A modern browser (Chromium / Firefox) is available for manual walk-through.

---

## Phase A -- constants + types + ID + Zod schema

### PMIN-1: defaults match the FAA P-8740-25 Solo / VFR column

1. Open `libs/constants/src/personal-minimums.ts`.
2. **Expected:** `PERSONAL_MINIMUMS_DEFAULTS.CEILING_FT === 1500`, `VISIBILITY_SM === 5.0`, `WIND_TOTAL_KT === 20`, `CROSSWIND_TOTAL_KT === 12`, `NIGHT_REQUIRED_RECENCY_LANDINGS === 3`, `IMC_REQUIRED_RECENCY_APPROACHES === 6`, `PAX_MAX === 3`, `TERRAIN_BUFFER_AGL === 1000`.
3. Cross-check against [course/knowledge/weather/personal-minimums/node.md](../../../course/knowledge/weather/personal-minimums/node.md) "Reveal" section, Solo / VFR column. **Expected:** equal.

### PMIN-2: constraint table covers every field

1. Open `libs/constants/src/personal-minimums.ts`.
2. **Expected:** `PERSONAL_MINIMUMS_CONSTRAINTS` has an entry with `{ min, max }` for every field defined in `PERSONAL_MINIMUMS_DEFAULTS`.
3. **Expected:** `VISIBILITY_SM` carries `decimalPlaces: 1` (the only non-integer field).

### PMIN-3: ID generator emits `pmin_<lowercase ulid>`

1. Import `generatePersonalMinimumsId` from `@ab/utils`. Call it 100 times.
2. **Expected:** every ID matches `/^pmin_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/`. No collisions (probability vanishingly small).

### PMIN-4: Zod schema accepts the defaults shape

1. Import `personalMinimumsInputSchema` and `PERSONAL_MINIMUMS_DEFAULTS`.
2. Call `personalMinimumsInputSchema.safeParse(PERSONAL_MINIMUMS_DEFAULTS)`.
3. **Expected:** `success: true`, `data` equals the defaults.

### PMIN-5: Zod schema rejects per-field violations with path

1. Call `personalMinimumsInputSchema.safeParse({ ...PERSONAL_MINIMUMS_DEFAULTS, ceilingFt: -1 })`. **Expected:** `success: false`; `error.issues[0].path` includes `'ceilingFt'`.
2. Call with `visibilitySm: 150`. **Expected:** path includes `'visibilitySm'`.
3. Call with `crosswindTotalKt: 25, windTotalKt: 20`. **Expected:** path includes `'crosswindTotalKt'`; message references the wind-total ceiling.
4. Call with `notes: 'x'.repeat(4001)`. **Expected:** path includes `'notes'`.

### PMIN-6: route constants present

1. Open `libs/constants/src/routes.ts`.
2. **Expected:** `ROUTES.STUDY_PERSONAL_MINIMUMS === '/personal-minimums'`, `ROUTES.STUDY_PERSONAL_MINIMUMS_HISTORY === '/personal-minimums/history'`.

---

## Phase B -- DB schema + BC API + lens projection

### PMIN-10: table exists with the right shape

1. `bun run db reset && bun run db seed`.
2. Connect to the dev DB; `\d study.personal_minimums`.
3. **Expected:** every column from spec.md "Data model" present with the documented type and not-null discipline; partial unique index `personal_minimums_one_active_per_user_uidx` exists; CHECK constraints `personal_minimums_crosswind_le_wind_check` and `personal_minimums_effective_window_check` exist.

### PMIN-11: getActivePersonalMinimums returns null for fresh user

1. Open a Bun REPL: `bun -e "..."` importing `getActivePersonalMinimums` from `@ab/bc-study/server`.
2. Call `getActivePersonalMinimums('<fresh-user-id-that-has-no-rows>')`.
3. **Expected:** returns `null`.

### PMIN-12: createPersonalMinimumsRevision (initial)

1. Call `createPersonalMinimumsRevision(abbyId, PERSONAL_MINIMUMS_DEFAULTS)`.
2. **Expected:** returns a row with `id` starting `pmin_`, `is_active: true`, `effective_from` near now, `effective_until: null`, every field matching the input.
3. `getActivePersonalMinimums(abbyId)`. **Expected:** returns the same row.

### PMIN-13: createPersonalMinimumsRevision (replacement)

1. Continuing from PMIN-12, call `createPersonalMinimumsRevision(abbyId, { ...PERSONAL_MINIMUMS_DEFAULTS, ceilingFt: 2500 })`.
2. **Expected:** returns a new row with `ceilingFt: 2500`, `is_active: true`, `effective_until: null`.
3. Query the table directly. **Expected:** the prior row now has `is_active: false` and `effective_until` non-null (within the last second).
4. `getActivePersonalMinimums(abbyId)`. **Expected:** returns the new row.

### PMIN-14: getPersonalMinimumsHistory ordering

1. Continuing from PMIN-13, call `getPersonalMinimumsHistory(abbyId)`.
2. **Expected:** returns 2 rows ordered by `effective_from DESC` -- the newest (active) first, the original second.

### PMIN-15: deactivatePersonalMinimums

1. Continuing from PMIN-14, call `deactivatePersonalMinimums(abbyId)`.
2. **Expected:** the previously-active row now has `is_active: false` and `effective_until` non-null. No new row inserted (history count unchanged).
3. `getActivePersonalMinimums(abbyId)`. **Expected:** returns `null`.

### PMIN-16: partial unique index rejects two active rows

1. Try to INSERT a row directly into `study.personal_minimums` for `abbyId` with `is_active: true` while an active row already exists (skip the BC -- this tests the storage-layer guarantee).
2. **Expected:** the insert fails with a unique-constraint violation on `personal_minimums_one_active_per_user_uidx`.

### PMIN-17: lens projection -- all within

1. Import `projectAgainstPersonalMinimums`.
2. Call with `minimums = { ceiling_ft: 1500, visibility_sm: 5, wind_total_kt: 20, crosswind_total_kt: 12, ... }` and `observation = { ceilingFtAgl: 3000, visibilitySm: 10, windTotalKt: 8, crosswindKt: 4, isNight: false }`.
3. **Expected:** `pass: 'within'`, every `fields.*.withinFloor: true`, `notes: []`.

### PMIN-18: lens projection -- ceiling below floor

1. Call with the same minimums but `observation.ceilingFtAgl = 800`.
2. **Expected:** `pass: 'below'`, `fields.ceiling.withinFloor: false`, `fields.ceiling.observed: 800`, `fields.ceiling.floor: 1500`, `notes` contains a per-field message (e.g., "ceiling 800 ft AGL below your 1500 ft floor").

### PMIN-19: lens projection is pure

1. Call `projectAgainstPersonalMinimums` twice with the same inputs.
2. **Expected:** both calls return deep-equal results; the input `minimums` and `observation` objects are unmodified between calls.

### PMIN-20: lens is browser-safe (no Node imports)

1. Run `bun run scripts/check-browser-globals.ts`.
2. **Expected:** 0 errors; the lens module is listed as walked and clean.

---

## Phase C -- editor surface

### PMIN-30: empty-state navigation

1. Log in as a freshly-created user (no personal_minimums row).
2. Navigate to `/personal-minimums`.
3. **Expected:** page renders the empty state with a form pre-seeded with `PERSONAL_MINIMUMS_DEFAULTS` values; explanatory copy points at the [wx-personal-minimums knowledge node](../../../course/knowledge/weather/personal-minimums/node.md) for context.

### PMIN-31: initial save

1. Continuing from PMIN-30: leave the defaults, click Save.
2. **Expected:** the page re-renders in read mode showing the saved record; a banner / toast says "saved at HH:MM".

### PMIN-32: edit flow

1. As Abby (with a saved record from PMIN-12): navigate to `/personal-minimums`.
2. **Expected:** active record renders in read mode.
3. Click "Edit." **Expected:** form opens inline with the active values pre-filled.
4. Change `ceilingFt` to 3000. Click Save.
5. **Expected:** the page re-renders showing `ceilingFt: 3000` as the active record; the prior record moves to history.

### PMIN-33: inline validation

1. Click Edit. Set `crosswindTotalKt: 25`, `windTotalKt: 20`. Submit.
2. **Expected:** the form does NOT submit; an inline error surfaces "crosswindTotalKt must be <= windTotalKt" beside the crosswind field.

### PMIN-34: history page

1. After at least 2 edits, navigate to `/personal-minimums/history`.
2. **Expected:** the page lists every revision newest-first; each row shows `effective_from` -> `effective_until` (or "active" for the current one) and the per-field values; notes (if present) render as markdown.

### PMIN-35: concurrent edit (two tabs)

1. Open `/personal-minimums` in two browser tabs simultaneously.
2. In Tab A, edit ceiling to 2000 and save.
3. In Tab B (without reloading), edit ceiling to 2500 and save.
4. **Expected:** Tab A's save succeeds; Tab B's save fails with a 409 banner ("your minimums changed in another tab -- reload"); Tab B reloads to show 2000 as active.

### PMIN-36: deactivate

1. Click "Deactivate" (or equivalent control).
2. **Expected:** the page re-renders showing the empty state; the previously-active row is now in history with `effective_until` stamped.

---

## Phase D -- implications subpanel + course nudge

### PMIN-40: implications subpanel renders for set minimums

1. As Abby with an active record (ceiling 1500, visibility 5 SM): navigate to `/personal-minimums`.
2. **Expected:** below the active record, an "Implications" subpanel renders. Because the `frontal-xc-march` wx-engine scenario carries an IFR hazard zone, at least one violation entry surfaces ("frontal-xc-march -- KMLI: ceiling 800 ft AGL below your 1500 ft floor").

### PMIN-41: implications subpanel empty state

1. Edit the record to a very high ceiling (5000 ft) and visibility (10 SM). Save.
2. **Expected:** the Implications subpanel shows "no scenarios violate your stated floor" (or equivalent empty state).

### PMIN-42: night-currency placeholder is always visible

1. With any active record visible: scroll to the Implications subpanel.
2. **Expected:** the "night currency could not yet be verified -- once logbook ingestion ships this will say something" placeholder is rendered as an informational block. It does NOT block the page or surface as an error.

### PMIN-43: course-step nudge points at the editor

1. Open the weather-comprehensive course step that teaches `wx-personal-minimums` (the step that links the node).
2. **Expected:** a trailing paragraph nudges the learner to `/personal-minimums` ("Now that you understand why -- record yours here") with a working link.

### PMIN-44: implications subpanel when minimums are null

1. As a fresh user with no saved record: navigate to `/personal-minimums`.
2. **Expected:** the empty-state form is shown; the Implications subpanel either is suppressed entirely or renders a placeholder ("Set your minimums to see what they imply"). It does NOT show stale violations from a default-seeded value.

---

## Phase E -- close

### PMIN-50: `bun run check` clean

1. From the branch tip: run `bun run check all`.
2. **Expected:** 0 errors, 0 warnings. Every step in `.cache/check/` exits 0.

### PMIN-51: e2e suite clean

1. Run `bun test:e2e tests/e2e/personal-minimums.spec.ts`.
2. **Expected:** all spec entries pass. Playwright surfaces no flaky retries.

### PMIN-52: lens import test from a `.svelte` consumer

1. Inside an arbitrary existing `.svelte` file (e.g., a placeholder card detail page), add `import { projectAgainstPersonalMinimums } from '@ab/bc-study';` temporarily.
2. Run `bun run dev` on apps/study and open the page in a real browser. Check devtools console.
3. **Expected:** the page hydrates cleanly with no `Buffer is not defined` / `process is not defined` / postgres-driver imports. Revert the test import after verifying.

### PMIN-53: WP CLI consistency

1. `bun run wp show personal-minimums-as-typed-contract`. **Expected:** the WP loads, frontmatter validates, every required file is present in the directory.
2. `bun run wp list --status draft --product study`. **Expected:** this WP appears in the listing.

---

## End-to-end walk-through (manual sign-off)

### PMIN-60: full pilot journey

1. Log in as Abby.
2. Navigate from the dashboard to the [wx-personal-minimums knowledge node](../../../course/knowledge/weather/personal-minimums/node.md) (via the existing course / knowledge nav).
3. Read the node end-to-end. **Expected:** the node teaches WHY personal minimums matter.
4. Follow the new "record yours here" link to `/personal-minimums`.
5. Fill the form with personal numbers (defaults are fine). Save.
6. Scroll to the Implications subpanel. **Expected:** at least one scenario violation is named, with the specific station + the gap (in ft / SM).
7. Edit the record (raise the ceiling significantly). Save.
8. **Expected:** the Implications panel re-renders; the previously-named violations may disappear depending on the new ceiling. The history page shows two revisions.
9. Deactivate. **Expected:** the page returns to the empty state; the history page still shows both revisions with `effective_until` stamped.

### PMIN-61: future-consumer readiness (informational)

1. Open [CONSUMER-CONTRACT.md](./CONSUMER-CONTRACT.md).
2. **Expected:** the doc explains what `getActivePersonalMinimums(userId)` returns, what `PersonalMinimumsObservation` looks like, what `projectAgainstPersonalMinimums` returns, and which future WPs (xc-viewer overlay, decision-debrief replay, logbook ingestion) bind to which call. A future consumer reading the doc alone could implement an overlay without needing to re-read this WP.
