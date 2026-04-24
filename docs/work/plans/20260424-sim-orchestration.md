---
date: 2026-04-24
machine: Joshua-MBP
branch: orchestrate/sim-phases
revision: 1
prompt: >
  "create a worktree to orchestrate. First, update tasks.md. Then come up with
   a plan to do all the work for the flight sim. trust you to come up with a
   good plan. break up the work correctly so things can be run in parallel.
   When things are finished, create and merge pr, and just keep going."
context: >
  User has directed the agent to push the flight sim forward through the
  staged plan. This doc captures the orchestration approach -- which PRs
  run sequentially, which run in parallel, what the hand-off interfaces
  are between them. Living doc; revise as the work lands.
---

# Flight Sim Orchestration Plan

Companion to [docs/products/sim/TASKS.md](../../products/sim/TASKS.md) and [docs/work/plans/20260422-flight-dynamics-sim-plan.md](20260422-flight-dynamics-sim-plan.md).

## Goal

Drive the flight sim from Phase 0.8 (shipped: spring-centered stick) through Phase 7 (optional horizon view). Execute in parallel where the dependency graph allows; sequentially where it does not. Land each tranche as a reviewed, squashed PR.

## Dependency graph

```text
                 Phase 1 (work package / sign-off)
                 /        |         \
            Phase 2      Phase 3   Phase 5
            (FDM port)   (fault    (warning
                         model)     cues)
                 \        |         /
                  \       |        /
                 Phase 4 (scenarios + debrief)
                           |
                        Phase 6 (PA28 + MVP scenarios)
                           |
                        Phase 7 (Three.js horizon, optional)
```

Phase 1 is a sign-off gate. Everything downstream depends on the decisions it locks. But the work inside Phases 2, 3, and 5 is **independent of each other** -- they don't share files, interfaces, or runtime state -- so they can run in parallel once Phase 1 signs off.

Phase 4 depends on all three: Phase 2 gives it the real FDM (though Phase 4 can develop against the hand-rolled FDM interface that already exists, and swap later), Phase 3 gives it the display state to record in replay, Phase 5 gives it the warning cues to fire from scripted events.

Phase 6 depends on Phase 2 (PA28 needs the real FDM) and Phase 4 (scenarios need the engine).

Phase 7 is fully independent and can run anywhere after Phase 1 if we want it.

## Parallelism strategy

One orchestrator worktree (this one, `.claude/worktrees/sim-orchestrator`). One child worktree per track. Each track lands a single squashed PR; orchestrator pulls main after each merge so subsequent tracks start from the latest state.

Child worktree naming: `.claude/worktrees/sim-<phase>-<track>/`. Examples:

- `.claude/worktrees/sim-phase1-wp/`
- `.claude/worktrees/sim-phase2-jsbsim/`
- `.claude/worktrees/sim-phase3-fault-interface/`
- `.claude/worktrees/sim-phase3-instrument-ai/`
- `.claude/worktrees/sim-phase5-cues/`

## Sprints

### Sprint 0 -- Housekeeping (this PR)

- [x] Create orchestrator worktree
- [x] Archive pre-pivot TASKS.md to `.archive/`
- [x] Rewrite [docs/products/sim/TASKS.md](../../products/sim/TASKS.md) as the flight-sim backlog
- [x] Write this orchestration plan

**Exit:** TASKS + plan land as a single docs PR; orchestrator is ready to spawn child worktrees.

### Sprint A -- Parallel kick-off (2 tracks)

Runs immediately after Sprint 0 lands. Both tracks are independent of Phase 1 sign-off.

- **A1 -- Phase 5 warning cue library.** Stall horn already exists (`libs/bc/sim/src/audio-mapping.ts` + friends). Add gear warning, flap motor, marker beacons, altitude alert, AP disconnect. Each is a procedural or sample-based cue wired to truth-state triggers. Visible captions for a11y. Share the existing `SIM_STORAGE_KEYS.MUTE` toggle.
- **A2 -- Phase 1 work package.** Pure doc sprint. Author spec, tasks, test-plan, design, user-stories using `/ball-wp-spec flight-dynamics-sim`. Input from PRD + plan doc + research doc + shipped 0.5/0.6/0.7/0.8. Locks MVP aircraft/scenarios/controls/surface/FDM path/BC layout. User sign-off at the end.

**Why these two:** A1 is tiny and tested in isolation (audio mapping has test coverage), so it's safe to run before Phase 1 signs off. A2 is the sign-off itself -- running it in parallel with A1 means we don't wait idle for the doc sprint before shipping audio cues.

### Sprint B -- Capability waves (up to 4 tracks)

Kicks off once A2 signs off. A1 may or may not be merged by then; doesn't matter.

- **B1 -- Phase 3 fault-model interface.** Pure interface + storybook scaffold. Defines `TruthState -> DisplayState` contract, per-instrument fault type, fault-registry. No instrument implementations yet. Ships as its own PR so the interface is locked before fan-out.
- **B2 -- Phase 2 JSBSim port.** Sequential, long-running. `tools/jsbsim-port/`, Emscripten build, worker wrapper, integration test, determinism test.
- **B3 -- Phase 4 scenario format.** Define the scenario JSON/YAML schema, migrate the three current scenarios to it, add input capture. Runs in parallel with B2 because it reads from `FdmTruthState` which is already stable.
- **B4 -- Phase 7 Three.js horizon.** Fully independent. Adds a toggleable outside view driven by FDM pitch/roll/heading.

**Sprint B fan-out after B1 lands:** Phase 3 per-instrument fault implementations can all run in parallel (one agent per instrument). That is Sprint B.5: `sim-phase3-instrument-{ai,asi,alt,hi,tc,vsi}` each owning fault logic for one gauge.

### Sprint C -- Scenario + aircraft completion

Kicks off once B2 + B3 land.

- **C1 -- Phase 6 PA28 config + aircraft picker.** PA28 aircraft config in `libs/bc/sim/src/fdm/pa28.ts`, per-scenario aircraft pin, picker for free mode.
- **C2 -- Phase 6 remaining MVP scenarios.** Aft-CG slow flight, unusual attitudes, partial panel, VMC-into-IMC. Ships as one PR per scenario, parallel.

### Sprint D -- Debrief + polish

- **D1 -- Phase 4 debrief page + scrub replay.** Timeline scrubber, truth-vs-display dual display, input tape, study spaced-rep wiring.
- **D2 -- Standing polish backlog** -- engine cluster gauges, configurable keybindings, InfoTip / PageHelp for the cockpit route.

## Exit for the whole run

All Phase 1-6 items checked on [TASKS.md](../../products/sim/TASKS.md). Phase 7 shipped or explicitly deferred by user. User-zero manual test passes green.

## Execution rules

- **One PR per track.** Small enough to review in a sitting, large enough to be meaningful. Squash-merge, delete branch, remove child worktree.
- **Pull main between merges.** Orchestrator does `git fetch origin main --quiet && git update-ref refs/heads/main origin/main` after every merge so the next child worktree starts fresh.
- **No commits to `orchestrate/sim-phases` except this plan and TASKS.md updates.** Orchestrator is a planning branch; all implementation lives in child branches.
- **Ghost-reversion guard.** Before committing to any worktree, `git status --short` and verify we aren't staging reverts of work already on main.
- **If the work reveals a pre-existing bug that blocks progress, fix it in the same PR.** Don't open a bug ticket and wait; fix it and keep going.
- **Stop and ask only when a decision is genuinely ambiguous.** Aircraft scope, scenario list, FDM path, BC layout -- already settled in the plan doc. Don't re-ask.

## Living status

Sprint 0 underway in orchestrator worktree. Next: PR to land TASKS.md + this plan. Then Sprint A kicks off.
