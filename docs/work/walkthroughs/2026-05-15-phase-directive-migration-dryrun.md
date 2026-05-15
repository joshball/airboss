# Phase Directive Migration Dry-Run -- 2026-05-15

Author: Phase 2 of the markdown-directive cleanup.
Branch: feat/phase-directive
Script: scripts/migrations/2026-05-h2-phases-to-directive.ts

## Summary

- 76 `course/knowledge/**/node.md` files scanned
- 76 files would migrate (every authored node has at least one phase block)
- 0 illegal-heading rewrites across 0 files (the corpus already uses `###` as the highest level inside phase bodies)
- 7 phase blocks per node (Context / Problem / Discover / Reveal / Practice / Connect / Verify)

## Notes on the heuristic

Inside each `:::phase` body, the highest legal heading is `###`. The
migration only rewrites headings that violate that rule:

- `^#` -> `###` (illegal H1 inside phase body)
- `^##` -> `###` (illegal H2 inside phase body)

Headings already at `###` or deeper (`### Worked example`, `### Q1...`,
`### Cards (spaced memory items)`, `#### Sub-bullet`) are left alone.

The corpus today contains zero illegal headings inside phase bodies, so
this run is a structural-wrap-only pass. The rewrite logic is defensive
against future authoring that accidentally introduces `## Foo` inside a
phase body, and against any author who hand-writes a `:::phase` block
without going through the migration.

## Bug fix vs. prior run

A prior version of this script downgraded EVERY heading inside a wrapped
slice by one level (`### Worked example` -> `#### Worked example`,
`### Q1` -> `#### Q1`). That over-applied the contract: the rule is
"no `##` survives inside a phase body," not "shift every heading down."
The prior dry-run reported 680 spurious downgrades across 33 files;
applying it would have visibly demoted sub-section headings on every
learn page. The fix replaces `downgradeHeading()` with
`normaliseIllegalHeading()` that rewrites ONLY illegal-level headings
(`^#` or `^##`) to `###`. See the script's `normaliseIllegalHeading`
implementation for the contract.

## Full dry-run output

```text
H2 phases -> :::phase directive migration (dry-run)

  76 node.md files scanned.
  76 files would migrate.
  0 total illegal-heading rewrites across 0 files.

Per-file:

  course/knowledge/aerodynamics/angle-of-attack-and-stall/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/cg-and-stability/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/coordination-rudder/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/four-forces/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/load-factor-and-bank-angle/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/rate-radius-of-turn/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/slow-flight/node.md
    phases: 7
    no illegal headings.

  course/knowledge/aerodynamics/uncoordinated-flight/node.md
    phases: 7
    no illegal headings.

  course/knowledge/airspace/classes-and-dimensions/node.md
    phases: 7
    no illegal headings.

  course/knowledge/airspace/special-use/node.md
    phases: 7
    no illegal headings.

  course/knowledge/airspace/vfr-weather-minimums/node.md
    phases: 7
    no illegal headings.

  course/knowledge/flight-planning/ifr-cross-country/node.md
    phases: 7
    no illegal headings.

  course/knowledge/flight-planning/vfr-cross-country/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/circling-approach/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/gps-rnav-concepts/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/holding-pattern-entries/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/instrument-approach-structure/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/localiser-and-glide-slope-tracking/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/marker-beacon-recognition/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/missed-approach-procedure/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/partial-panel/node.md
    phases: 7
    no illegal headings.

  course/knowledge/navigation/vor-tracking/node.md
    phases: 7
    no illegal headings.

  course/knowledge/performance/crosswind-component/node.md
    phases: 7
    no illegal headings.

  course/knowledge/performance/takeoff-landing-distance/node.md
    phases: 7
    no illegal headings.

  course/knowledge/performance/weight-and-balance/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/180-degree-turn/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/acs-tolerances/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/adm-hazardous-attitudes/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/alternate-static-source/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/attention-management/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/clear-the-area/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/collision-avoidance/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/emergency-authority/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/engine-failure-after-takeoff/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/execute-steep-turn/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/ground-reference-maneuvers/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/instrument-cross-check/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/maneuvering-airspeeds/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/overspeed-recovery/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/pitot-static-failures/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/spatial-disorientation/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/stall-recovery/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/traffic-pattern/node.md
    phases: 7
    no illegal headings.

  course/knowledge/procedures/unusual-attitude-recovery/node.md
    phases: 7
    no illegal headings.

  course/knowledge/regulations/currency-vs-proficiency/node.md
    phases: 7
    no illegal headings.

  course/knowledge/regulations/pilot-privileges-limitations/node.md
    phases: 7
    no illegal headings.

  course/knowledge/teaching/common-student-errors-stalls/node.md
    phases: 7
    no illegal headings.

  course/knowledge/teaching/evaluating-student-judgment/node.md
    phases: 7
    no illegal headings.

  course/knowledge/teaching/lesson-planning/node.md
    phases: 7
    no illegal headings.

  course/knowledge/teaching/the-learning-process/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/airmasses-and-fronts/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/briefing-execution/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/chart-type-surface-analysis/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/clouds-and-precipitation/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/data-sources/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/density-altitude/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/equipment-and-data-limitations/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/flight-deck-weather-displays/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/fog-and-visibility-obstructions/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/freezing-level/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/go-nogo-decision/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/icing-types-and-avoidance/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/personal-minimums/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-airmets/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-convective-outlook/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-gfa/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-pireps/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-sigmets/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-surface-analysis-and-cva/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/product-winds-aloft/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/reading-metars/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/reading-tafs/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/stability-and-instability/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/thunderstorm-hazards/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/turbulence-types/node.md
    phases: 7
    no illegal headings.

  course/knowledge/weather/wind-systems/node.md
    phases: 7
    no illegal headings.

Dry-run; pass --apply to rewrite every file.
```

## Apply run

Executed `bun run scripts/migrations/2026-05-h2-phases-to-directive.ts --apply`.

- 76 node.md files scanned
- 76 files migrated (every authored knowledge node rewritten)
- 0 illegal-heading rewrites (the corpus stayed structurally unchanged at heading level; only phase wrappers were added)
- 0 H2 headings remain inside any `course/knowledge/**/node.md` body
- Spot-check on `course/knowledge/aerodynamics/cg-and-stability/node.md` confirms:
  - Every `## Context`, `## Problem`, ..., `## Verify` H2 line is gone.
  - Each phase body is wrapped in `:::phase name="<lowercase>" ... :::`.
  - `### Q1...`, `### Cards (spaced memory items)`, `### Drills (time-pressured)`, etc. are still `###` (not downgraded).

Final line of apply output: `Wrote 76 files.`
