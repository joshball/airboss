---
title: 'Test Plan: Flight Dynamics Sim'
product: sim
feature: flight-dynamics-sim
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Flight Dynamics Sim

What we test, where, and how. Companion to [spec.md](spec.md), [design.md](design.md), [user-stories.md](user-stories.md), [tasks.md](tasks.md).

## Goals

1. **Catch regressions** in pure FDM logic, fault transforms, scenario-runner state machine, and replay-tape determinism with **fast unit tests**.
2. **Catch integration breakage** between worker, scenario runner, and cockpit with **focused integration tests**.
3. **Catch UX breakage** with a small **e2e suite** at golden paths (one per shipped scenario).
4. **Catch fidelity drift** in the JSBSim port with **trim + step-response validation tests** against desktop reference values.
5. **Catch a11y regressions** with **automated audits + manual screen-reader passes**.
6. **Catch user-zero feel issues** with **manual scripted flights** before each phase ships.

Not all phases need all six. The matrix at the bottom maps phases to which test types apply.

## Test pyramids per phase

### Phase 2 -- JSBSim FDM port

Trim + step-response validation matters more than coverage here. The port is correct or the airplane flies wrong; nothing in between.

| Type | Where | What |
| ---- | ----- | ---- |
| Unit | `tools/jsbsim-port/__tests__/` | Binding-generator output stable; FGFDMExec init/dispose lifecycle leak-free |
| Integration | `libs/engine/src/sim/__tests__/` | Worker host exercises set-state -> advance -> get-state -> dispose without WASM panics |
| Trim validation | `libs/sim-fdm/__tests__/trim.test.ts` | C172 1G straight-and-level at Vno + Vy. Compare airspeed (within 2%), AoA (within 1 deg), pitch (within 1 deg) to desktop JSBSim reference values shipped as a fixture |
| Step response | `libs/sim-fdm/__tests__/step.test.ts` | Apply +5 deg pitch step, hold 5 sec; capture pitch and AoA traces; compare to fixture within tolerance |
| Determinism | `libs/sim-fdm/__tests__/determinism.test.ts` | Same `(inputs, seed, initial)` produces identical trajectories across two runs and across page reloads |
| Manual | Browser | Take off, climb, level cruise, gentle turns, full-stall, full-stall recovery, pattern entry, landing flare. "Feels like a 172." |

**Ship gate:** all four automated test types green. Manual pass by the user.

### Phase 3 -- Fault model + instruments

The fault model is a pure transform; tests are dense and fast.

| Type | Where | What |
| ---- | ----- | ---- |
| Unit | `libs/bc/sim/src/faults/__tests__/transform.test.ts` | One test per `(FaultKind, instrument)` pair. E.g., pitot-block at 1000 ft + climb to 2000 ft -> ASI reads 0 then descends |
| Property | `libs/bc/sim/src/faults/__tests__/property.test.ts` | `applyFaults(truth, [])` -> truth (identity); `applyFaults` is order-independent for orthogonal faults |
| Visual regression | `apps/sim/src/routes/_dev/instruments/+page.svelte` | Storybook gallery snapshot under Playwright with each instrument in each fault state. Diff visual baselines per PR |
| a11y | `apps/sim/__tests__/a11y/instrument-aria.test.ts` | Each instrument exposes a parseable `aria-label`; live region narrates at 1 Hz; values match the SVG state |
| Manual | Browser | Trigger each fault during a scenario, eyeball the gauge behavior, confirm it matches POH-failure descriptions |

**Ship gate:** unit + property tests green. Visual regression baselines accepted. Manual pass on each fault.

### Phase 4 -- Scenario engine + replay + debrief

Replay determinism is the load-bearing test. If `scenarioHash + inputs + seed + initial` does not produce a byte-identical tape, the debrief lies.

| Type | Where | What |
| ---- | ----- | ---- |
| Unit | `libs/bc/sim/src/scenarios/__tests__/runner.test.ts` (extends existing) | Fault triggers fire on the right tick; step ladder + crash detection unaffected |
| Unit | `libs/bc/sim/src/replay/__tests__/` | Ring buffer wrap-around; serialize round-trip; hash function stable across Node versions |
| Integration | `apps/sim/__tests__/replay-determinism.test.ts` | Run scenario in worker; capture tape; replay tape; assert identical truth-state at each frame |
| Integration | `apps/sim/__tests__/scenario-attempt.test.ts` | Run scenario to outcome; assert `RepAttempt` written to study BC with correct grade |
| e2e | `e2e/sim/debrief.spec.ts` | Fly a scenario to outcome; debrief auto-opens; scrubber works keyboard-first; "Run Again" returns to cockpit |
| Manual | Browser | Departure stall, EFATO, vacuum failure end-to-end; debrief tells the story |

**Ship gate:** all automated tests green. Tape determinism proven on two browsers. Manual pass on three seed scenarios.

### Phase 5 -- Sound (already shipped, follow-up only)

Most tests already exist in [libs/bc/sim/src/audio-mapping.test.ts](../../../libs/bc/sim/src/audio-mapping.test.ts). Follow-up wiring (5.3, 5.4) extends them.

| Type | Where | What |
| ---- | ----- | ---- |
| Unit | `audio-mapping.test.ts` | Each predicate (`shouldSoundGearWarning`, `flapsChanged`, `altitudeAlertCrossed`) over its threshold matrix |
| Integration | `apps/sim/__tests__/cue-wiring.test.ts` | Cue classes activate/silence on the right snapshot transitions; mute toggle covers every cue |
| Manual | Browser | Each cue audibly fires when expected, mutes correctly, captions render in `aria-live` region |

**Ship gate:** unit + integration green. Manual pass per cue.

### Phase 6 -- PA28 + remaining MVP scenarios

PA28 is a second instance of the Phase 2 validation; remaining scenarios are content tests.

| Type | Where | What |
| ---- | ----- | ---- |
| Trim validation | `libs/sim-fdm/__tests__/trim-pa28.test.ts` | PA28 1G straight-and-level at Vno + Vy matches desktop JSBSim reference within tolerance |
| Unit | `libs/bc/sim/src/scenarios/__tests__/<scenario>.test.ts` | One test file per scenario; success / failure / timeout transitions exercised |
| e2e | `e2e/sim/<scenario>.spec.ts` | Each scenario flyable to outcome via Playwright (scripted inputs); debrief opens; rep-attempt written |
| Manual | Browser | User flies each scenario; rates "feels right" on a 1-5 |

**Ship gate:** trim test green for PA28. Each new scenario has unit + e2e green. Manual pass on each scenario by the user.

### Phase 7 -- Horizon (optional)

| Type | Where | What |
| ---- | ----- | ---- |
| Unit | `apps/sim/src/lib/horizon/__tests__/scene-state.test.ts` | Scene state derived from FDM truth; pitch/roll/heading round-trip |
| Performance | `apps/sim/__tests__/horizon-perf.test.ts` | 60 fps sustained at 1280x800 with the horizon on; 30 fps with reduce-motion |
| Manual | Browser | Visual: sky color shifts with pitch; runway tracks heading; bank produces correct horizon roll; reduce-motion drops parallax |

**Ship gate:** perf test green. Manual pass on the VFR maneuver scenario the horizon enables.

## Cross-cutting test layers

### Type-checking and lint

- `bun run check` must pass with 0 errors and 0 warnings before any merge.
- Biome organize-imports + format runs on every PR via `bunx biome check`.
- Svelte-check runs against every shipped Svelte component.

### Reference + content validators

- `bun scripts/references.ts validate` runs as part of `bun run check`.
- Help-id validator (`scripts/validate-help-ids.ts`) covers any `<InfoTip>` / `<PageHelp>` IDs we add.

### Determinism

- Every PR that touches the FDM, the worker host, or the scenario runner re-runs `replay-determinism.test.ts`.
- Drift in the deterministic baseline gets a regression PR before any new feature lands on top.

### Accessibility

- `axe-core` integrated into Playwright e2e tests; runs against the cockpit + briefing + debrief routes.
- Keyboard-only walkthrough: every interactive element reachable via tab; focus rings visible; Esc closes overlays.
- Screen-reader manual passes (VoiceOver on macOS) at each phase ship gate.

### Performance budget

- FDM tick: 120 Hz sustained (8.33 ms budget per tick).
- Snapshot post: 30 Hz max; throttled to 1 Hz when document hidden.
- Cockpit render: 60 fps target on 1280x800; degrade gracefully under reduce-motion.
- Replay tape: <= 5 MB compressed for a 3-minute scenario.
- WASM bundle: <= 4 MB compressed; first byte <= 500 ms after cockpit route mount.

Lighthouse CI runs on the cockpit + debrief routes per PR.

## Manual test scripts

These are the canonical "user-zero" walkthroughs. The user runs them before each phase ships.

### MT-1 -- Departure stall (post-Phase 2)

1. Pick "Departure Stall" from the home page.
2. Brake on, throttle full. Take off at Vr (~55 KIAS).
3. Pitch up aggressively past Vy. Let the trim drift (scripted). Stall warning should fire ~5 KIAS before stall break.
4. At stall break, recover: stick forward, full power, level wings. Recover within 100 ft of stall altitude.
5. Climb to 1500 AGL. Outcome: SUCCESS.

**Pass criteria:** Numbers match POH (Vs1 ~ 44 KIAS, stall warning ~ 49 KIAS, 100 ft recovery loss feels right).

### MT-2 -- EFATO (post-Phase 4)

1. Pick "EFATO" from the home page.
2. Take off at full power; climb past 400 ft AGL.
3. Engine fails (scripted). Pitch for best glide (Vbg ~ 65 KIAS).
4. Choose a landing spot in the windshield. Commit and fly the spot.
5. Touchdown within an envelope: vertical speed > -3 m/s, bank < 30 deg, pitch sane. Outcome: SUCCESS.

**Pass criteria:** Decision visible in the input tape; debrief shows the spot-commit moment; grade reflects how soon the decision was made.

### MT-3 -- Vacuum failure (post-Phase 3 + Phase 4)

1. Pick "Vacuum Failure" from the home page.
2. Cruise straight-and-level at 3000 ft, heading 090.
3. Vacuum fails at 60 sec. AI starts drifting at 1 deg/sec.
4. Recognize the drift; transition scan to T/B + compass + ASI + altimeter.
5. Hold heading 090 +/- 10 deg, altitude 3000 +/- 100 ft for 60 sec. Outcome: SUCCESS.

**Pass criteria:** AI drift smooth, not jumpy. Recognition possible within ~15 sec. Grade reflects time-to-recognize and hold accuracy.

### MT-4 -- Partial panel (post-Phase 6)

1. Pick "Partial Panel" from the home page.
2. AI + HI failed from t=0. Use turn coordinator + compass + ASI + altimeter.
3. Climb to 4000, turn to 270, descend to 2000, turn to 090. All on T/B scan.
4. Outcome: SUCCESS if all three altitudes + headings hit within tolerance.

**Pass criteria:** Failure rendering looks correct on both AI and HI. Compass lag and turning-error feel right.

### MT-5 -- VMC-into-IMC (post-Phase 6 + Phase 7 if shipping horizon in MVP)

1. Pick "VMC-into-IMC" from the home page.
2. Cruise VFR at 2500 ft, heading 270, with horizon visible.
3. At 60 sec, IMC arrives (horizon goes solid gray).
4. Execute 180-degree turn back to clear air without exceeding 30 deg bank or losing 200 ft.
5. Outcome: SUCCESS if turn completes within tolerance and no loss-of-control.

**Pass criteria:** Visual transition dramatic but not jarring. Turn possible on instruments.

## Coverage matrix

| Phase | Unit | Property | Integration | e2e | Visual | Validation | a11y | Perf | Manual |
| ----- | ---- | -------- | ----------- | --- | ------ | ---------- | ---- | ---- | ------ |
| 2 | yes | -- | yes | -- | -- | yes (trim + step + determinism) | -- | yes (perf budget) | MT-1 |
| 3 | yes | yes | yes | -- | yes (gallery snapshots) | -- | yes | -- | each fault |
| 4 | yes | -- | yes | yes | -- | yes (replay determinism) | yes | -- | MT-2, MT-3 |
| 5 | yes | -- | yes | -- | -- | -- | yes (captions) | -- | each cue |
| 6 | yes | -- | yes | yes | -- | yes (trim PA28) | yes | -- | MT-4 |
| 7 | yes | -- | -- | yes | -- | -- | yes (reduce-motion) | yes | MT-5 |

## When tests fail in CI

1. Determinism failure -> stop. The replay tape is the system's memory; if it lies, debrief lies. Treat as a P0 regression.
2. Trim validation drift > tolerance -> investigate the JSBSim port commit; if upstream JSBSim moved, decide pin-vs-bump deliberately.
3. Visual regression -> review the diff; accept new baseline only if intentional design change. Otherwise revert.
4. a11y -> fix in the same PR. Accessibility regressions do not ship.

## What we are NOT testing

- Real-world weather model (out of scope until weather phase).
- Multi-player tape sharing (post-MVP).
- HID yoke (post-MVP).
- FAA-approved time logging (out of scope, no certification path).
- Mobile touch flying (post-MVP; banner on mobile suffices).
- Cross-browser parity beyond latest Chrome + Safari + Firefox + the latest Edge.
