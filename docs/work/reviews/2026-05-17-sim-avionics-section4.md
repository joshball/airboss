---
title: Section 4 review -- sim + avionics
date: 2026-05-17
scope: apps/sim, apps/avionics, libs/bc/sim, libs/bc/avionics, libs/bc/wx-practice, libs/activities
status: unread
review_status: done
---

# Section 4 review -- sim + avionics

Ten-angle review of the decision-rep / flight-sim surfaces, the glass-cockpit
trainer, and the domain-coupled visual components (~29k LOC). Baseline:
`bun run check` clean, 462 vitest tests pass.

## Findings

### Critical

None. The engine is pure and deterministic, persistence enforces ownership,
the worker protocol is exhaustively typed.

### Major

M1. **Worker drops fault-edge markers from the replay tape.**
`apps/sim/src/lib/fdm-worker.ts` lines 211-215 carry `evalResult.firedThisTick`
onto `state.lastFrame`, but the next ring write (`pushFrame` at the snapshot
branch) calls `captureFrame(state, [])` -- a fresh frame that ignores the
carried `lastFrame`. The terminal branch also builds a fresh frame. Net effect:
a fault that triggers on any non-snapshot, non-terminal FDM tick never reaches
the tape's `firedThisTick`, so the debrief scrubber cannot mark "fault fired
here" for those edges. The carry is dead code. Fixed: accumulate `firedThisTick`
between ring writes and pass the accumulated set to the next `pushFrame`.

M2. **Attempt endpoint stores an unbounded tape.**
`apps/sim/src/routes/[scenarioId]/attempt/+server.ts` validates `result` and
`grade` with size caps but accepts `tape: z.unknown()` and writes it straight
into a JSONB column. An authenticated user can POST a multi-hundred-MB tape and
bloat the table -- the schema comment itself bounds a real tape at ~1-5 MB.
Fixed: cap the serialized tape size at the boundary and reject oversized
payloads with a 413.

### Minor

m1. **`ringHasWrapped` and `drainFrames` disagree on the boundary.**
`libs/bc/sim/src/replay/ring-buffer.ts`: `drainFrames` treats
`totalWrites >= capacity` as wrapped; `ringHasWrapped` uses `> capacity`. At
exactly `totalWrites === capacity` the two disagree. Frame order is still
correct (`writeIdx === 0` there), but the telemetry is inconsistent. Fixed:
aligned both on `>= capacity` (a full ring has, by definition, wrapped its
write head).

m2. **`studyLoginUrl` duplicated verbatim across two route loaders.**
`apps/sim/src/routes/history/+page.server.ts` and
`apps/sim/src/routes/history/[attemptId]/+page.server.ts` carry an identical
`studyLoginUrl` helper. Fixed: hoisted to `apps/sim/src/lib/server/study-login.ts`.

m3. **`counterTranslateY` lacks the non-finite guard its siblings have.**
`libs/activities/src/pfd/pfd-math.ts`: `altitudeLowDigits`,
`normalizeHeadingForLabel`, and `clampVerticalSpeed` all guard
`Number.isFinite`; `counterTranslateY` did not, so a NaN altitude injected
`NaN` into an SVG transform. Fixed: added the same guard.

### Nit

n1. **Custom buttons in five sim files lacked the `:focus-visible` ring.**
`apps/sim/src/routes/[scenarioId]/+page.svelte` (icon-buttons, retry, reset),
`apps/sim/src/routes/[scenarioId]/debrief/+page.svelte`,
`apps/sim/src/lib/panels/KeybindingsHelp.svelte`,
`apps/sim/src/lib/panels/KeyboardCheatsheet.svelte`,
`apps/sim/src/lib/panels/ResetConfirm.svelte`. Per common-pitfalls every custom
button must declare a `:focus-visible` outline with the `--focus-ring` token;
the global app outline does not meet 3:1 on the colored panel backgrounds.
Fixed: added `:focus-visible` rules to every custom button.

## Verified clean

- FDM physics (`physics.ts`) -- pure RK4, no `Date.now`/`Math.random`,
  documented determinism. Confirmed.
- Scenario runner, fault triggers, grading evaluator -- pure, exhaustive
  switches, constants routed through `SIM_GRADING`.
- Browser-safety -- runtime barrels (`@ab/bc-sim`, `@ab/bc-wx-practice`) export
  only pure helpers + Drizzle metadata + type-only re-exports; DB-touching
  values live in `/persistence` and `/server`.
- wx-practice state machine, sampler, grader -- pure, deterministic seeded RNG.
- No `any`, no `!`, no Svelte 4 legacy, no `.toBeTruthy()`, no skipped tests.
</content>
</invoke>
