# Tasks -- extract-sim-cockpit-panel

Phased to keep the working tree compilable at every commit. Each phase ends with `bun run check` clean and the touched routes manually smoked.

## Phase 1 -- Boundary check + branch prep

- [ ] Re-read [spec.md](./spec.md) and [design.md](./design.md). Confirm the file list under "Scope: what moves" still matches the working tree.
- [ ] Confirm `@ab/activities` alias is wired in `apps/sim/svelte.config.js` (it is, per PR #328) and in the root `tsconfig.json`. If either is missing, fix before touching anything else.
- [ ] Branch: `wp/extract-sim-cockpit-panel` (already created for the spec commit).
- [ ] Verify no other consumer reaches into `$lib/instruments/*` or `$lib/panels/AnnunciatorStrip` outside the routes named in [spec.md](./spec.md):
  - `grep -rn '$lib/instruments/' apps/sim/src`
  - `grep -rn '$lib/panels/AnnunciatorStrip' apps/sim/src`
  - `grep -rn '$lib/cockpit/CockpitPanel' apps/sim/src`
  - If anything else shows up, surface it before continuing.

## Phase 2 -- `git mv` the panel and its dependencies

Move every file under one commit so the rename graph is clean. Use `git mv`, never copy + delete.

- [ ] `mkdir -p libs/activities/src/cockpit-panel/cluster`
- [ ] `git mv apps/sim/src/lib/cockpit/CockpitPanel.svelte libs/activities/src/cockpit-panel/CockpitPanel.svelte`
- [ ] `git mv apps/sim/src/lib/panels/AnnunciatorStrip.svelte libs/activities/src/cockpit-panel/AnnunciatorStrip.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/Altimeter.svelte libs/activities/src/cockpit-panel/Altimeter.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/Asi.svelte libs/activities/src/cockpit-panel/Asi.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/AttitudeIndicator.svelte libs/activities/src/cockpit-panel/AttitudeIndicator.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/HeadingIndicator.svelte libs/activities/src/cockpit-panel/HeadingIndicator.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/Tachometer.svelte libs/activities/src/cockpit-panel/Tachometer.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/TurnCoordinator.svelte libs/activities/src/cockpit-panel/TurnCoordinator.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/Vsi.svelte libs/activities/src/cockpit-panel/Vsi.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/cluster/ClusterGauge.svelte libs/activities/src/cockpit-panel/cluster/ClusterGauge.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/cluster/EngineCluster.svelte libs/activities/src/cockpit-panel/cluster/EngineCluster.svelte`
- [ ] `git mv apps/sim/src/lib/instruments/cluster/FuelGauge.svelte libs/activities/src/cockpit-panel/cluster/FuelGauge.svelte`
- [ ] Confirm `apps/sim/src/lib/instruments/cluster/` is empty, then `rmdir` it. Same for `apps/sim/src/lib/instruments/` once empty. `apps/sim/src/lib/cockpit/` stays (still hosts `ControlInput.svelte`).
- [ ] Working tree is broken at this point (imports stale). That's expected -- next phase fixes them. Don't commit yet.

## Phase 3 -- Rewire imports inside the moved panel

CockpitPanel imports its siblings via `$lib/...`. Inside the lib those become relative paths.

- [ ] In `libs/activities/src/cockpit-panel/CockpitPanel.svelte`:
  - `$lib/instruments/Altimeter.svelte` -> `./Altimeter.svelte`
  - `$lib/instruments/Asi.svelte` -> `./Asi.svelte`
  - `$lib/instruments/AttitudeIndicator.svelte` -> `./AttitudeIndicator.svelte`
  - `$lib/instruments/HeadingIndicator.svelte` -> `./HeadingIndicator.svelte`
  - `$lib/instruments/Tachometer.svelte` -> `./Tachometer.svelte`
  - `$lib/instruments/TurnCoordinator.svelte` -> `./TurnCoordinator.svelte`
  - `$lib/instruments/Vsi.svelte` -> `./Vsi.svelte`
  - `$lib/instruments/cluster/EngineCluster.svelte` -> `./cluster/EngineCluster.svelte`
  - `$lib/panels/AnnunciatorStrip.svelte` -> `./AnnunciatorStrip.svelte`
- [ ] In `libs/activities/src/cockpit-panel/cluster/EngineCluster.svelte`: rewrite any sibling imports to relative (e.g. `./ClusterGauge.svelte`, `./FuelGauge.svelte`). Verify by grep.
- [ ] In every moved instrument: confirm it still uses `@ab/bc-sim`, `@ab/constants`, `@ab/themes` (cross-lib imports use the alias). No `$lib/*` should remain.
- [ ] `grep -rn '$lib/' libs/activities/src/cockpit-panel/` -> empty. Fix any stragglers before moving on.

## Phase 4 -- Rewire app consumers

Every consumer listed in [spec.md](./spec.md) gets one line edited. Touch nothing else.

- [ ] `apps/sim/src/routes/[scenarioId]/+page.svelte`: `import CockpitPanel from '@ab/activities/cockpit-panel/CockpitPanel.svelte';`
- [ ] `apps/sim/src/routes/[scenarioId]/dual/+page.svelte`: same.
- [ ] `apps/sim/src/routes/[scenarioId]/window/+page.svelte`: same.
- [ ] `apps/sim/src/routes/[scenarioId]/debrief/+page.svelte`: `import EngineCluster from '@ab/activities/cockpit-panel/cluster/EngineCluster.svelte';`
- [ ] `apps/sim/src/routes/_dev/instruments/+page.svelte`: same -- and any direct instrument imports it has (Asi, Altimeter, AttitudeIndicator, etc.) repointed to `@ab/activities/cockpit-panel/<Name>.svelte`. Read the file end-to-end; the dev gallery imports several.

## Phase 5 -- Verify clean state

- [ ] `bun run check` passes with 0 errors, 0 warnings on touched files.
- [ ] `bunx biome format --write` on staged files.
- [ ] `grep -rn '$lib/cockpit/CockpitPanel' apps/sim/src` -> empty.
- [ ] `grep -rn '$lib/instruments/' apps/sim/src` -> empty.
- [ ] `grep -rn '$lib/panels/AnnunciatorStrip' apps/sim/src` -> empty.
- [ ] `git log --follow libs/activities/src/cockpit-panel/CockpitPanel.svelte` shows the original cockpit-page-extraction commits (history preserved).
- [ ] Theme-lint clean.

## Phase 6 -- Manual smoke

Per [test-plan.md](./test-plan.md). Cockpit, dual, window, debrief, `_dev/instruments` all render identically. Visual diff at every consumer is empty.

## Phase 7 -- Ship

- [ ] Commit messages, in order:
  1. `docs(wp): author extract-sim-cockpit-panel work package` (this commit, already authored)
  2. `refactor(activities,sim): promote CockpitPanel to libs/activities/cockpit-panel`
- [ ] Stage individual files. Never `git add -A`.
- [ ] Open PR. Body links the spec, the test-plan, and PR #328 as the precedent.
- [ ] Update [docs/products/sim/PRD.md](../../products/sim/PRD.md) and [docs/products/sim/ROADMAP.md](../../products/sim/ROADMAP.md): mark "Cockpit panel extraction" as shipped, link this WP. Remove the ADR 015 follow-up bullet from ROADMAP next-up.
- [ ] Mark this WP `status: done` with the PR URL.
