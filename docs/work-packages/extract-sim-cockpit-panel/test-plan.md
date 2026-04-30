# Test plan -- extract-sim-cockpit-panel

This is a mechanical move. The high-confidence test is "every consumer renders identically before and after." No new behaviour to cover.

## Automated

- [ ] `bun run check` -- 0 errors, 0 warnings on touched files.
- [ ] Theme-lint -- clean (the moved files already use tokens; the move shouldn't change a single declared colour or radius).
- [ ] Existing Vitest suite under `libs/bc/sim/` -- unchanged. The panel has no logic, so no unit coverage is added or removed in this WP.
- [ ] Existing Playwright suite under `tests/` -- unchanged. If any spec asserts on a CockpitPanel selector, confirm the selector is markup-derived (class names from the panel's `.cockpit-panel`, `.row`, `.engine-row`, `.readouts` styles), not import-path-derived. CSS selectors don't move with the file rename, so this passes by construction.

## Manual smoke -- before / after

Run the dev server twice: once on `main` (or before the move commits) and once on the WP branch. Capture screenshots on both and diff visually. Diffs should be empty pixel-for-pixel; if anything moves, the rewire missed an import.

| Route                                          | What to verify                                                                                                                                              |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sim` (home)                                  | Scenario list renders. No console errors. Click into a scenario.                                                                                            |
| `/sim/[scenarioId]` (cockpit)                  | Six-pack + tach + engine cluster + annunciator strip render. Time / Alpha+AOA / AGL readouts line up above the top row. Stall horn warning class still toggles when alpha exceeds the stall threshold. ControlInput keyboard still works (W/S elevator, A/D aileron, etc.). |
| `/sim/[scenarioId]/dual`                       | 3D horizon left, full panel right. Same gauge values as cockpit. Keyboard input still flows through ControlInput.                                            |
| `/sim/[scenarioId]/window`                     | 3D horizon full-bleed; panel docked at the bottom as a translucent HUD. Six-pack still legible against the horizon.                                          |
| `/sim/[scenarioId]/debrief`                    | EngineCluster renders inside the debrief layout. No layout shift vs. before.                                                                                |
| `/sim/_dev/instruments`                        | Instrument gallery renders every instrument the panel depends on (Asi, Altimeter, AttitudeIndicator, HeadingIndicator, Tachometer, TurnCoordinator, Vsi, EngineCluster). |
| `/sim/_dev/instruments` -- interactive sliders | If the dev gallery has sliders / fault toggles, every slider still drives its instrument. (The gallery imports the instruments directly; this is the canary that the import rewire is complete.) |

## Console / network checks

- [ ] DevTools console: zero errors, zero warnings on every route above. (Pre-existing warnings unrelated to this WP can be left and called out in the PR body.)
- [ ] Network tab: every chunk loads. No 404 on any `.svelte` chunk path.

## Regression guards

- [ ] `git log --follow libs/activities/src/cockpit-panel/CockpitPanel.svelte` shows commits from before the rename. If history is broken, the move was a copy + delete, not a `git mv`. Re-run from Phase 2.
- [ ] `git log --follow libs/activities/src/cockpit-panel/Asi.svelte` shows the same. (Spot-check at least one instrument in addition to the panel.)
- [ ] `grep -rn '$lib/instruments/\|$lib/panels/AnnunciatorStrip\|$lib/cockpit/CockpitPanel' apps/sim/src` -> empty.
- [ ] `grep -rn '$lib/' libs/activities/src/cockpit-panel/` -> empty.

## Sign-off

User runs through the manual smoke, captures any visual regression, marks the user-controlled `status` on this WP from `active` -> `done` once the smoke passes and the PR merges.
