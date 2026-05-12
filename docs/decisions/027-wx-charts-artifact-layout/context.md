# Context: ADR 027 -- wx-charts and wx-engine artifact layout

## How we got here

The May 2026 chart-layout overhaul started from a visual problem and grew into a layout-organization problem.

### The hunchback

Joshua was reviewing a `surface-analysis` chart rendered against the 2024-12-23 12Z reference fixture and noticed the United States outline looked deformed along the top and bottom edges -- a "hunchback" appearance. The Lambert Conformal projection (33/45 parallels, rotate -96/-39) is correct, but with the chart cropped tightly to CONUS the projection's natural curvature on the edges reads as if the country shape itself were wrong.

Three mockup agents were dispatched in parallel:

- **Option A.** Extend the basemap to show Canada and Mexico outlines. The U.S. shape sits in its geographical context; the curvature now reads as projection behavior, not deformation.
- **Option B.** Tighten the extent and crop. Smaller mistake-area; loses some of the surrounding atmospheric structure.
- **Option C.** Switch to an alternate projection (e.g., Albers Equal Area) that flattens the top/bottom edges. Larger blast radius -- every renderer's projection block changes -- and "correct" projection for weather data is itself a debate.

Option A was the clear winner. Minimal blast radius (basemap pipeline only), preserves the existing projection contract, fixes the visual issue everywhere because every CONUS chart uses the same basemap.

### The layout-organization issue

While reviewing the mockups, Joshua surfaced a separate concern: `data/charts/wx/` had 102 wx-engine scenario chart directories and 20 wx-charts reference-fixture directories all sitting at the same level. Adding more renderers or more scenarios would compound the problem.

Three families emerged from the inventory:

- **reference-fixtures**: 20 hand-traced charts (one per renderer) used as visual baselines for the wx-charts test suite. Lifecycle: rarely change; regenerate when the basemap or renderer changes.
- **wx-scenarios**: 102 charts (6 scenarios × ~17 chart kinds each) emitted by the wx-engine bundle writer. Lifecycle: regenerate on every engine change.
- **mockups**: ad-hoc design exploration like the basemap A/B/C run above. Not consumed by production code. Lifecycle: short-lived; promote or clean up.

The flat layout hid the family distinction. The new layout makes it explicit, and the slug shape (`reference-fixtures/...` vs `wx-scenarios/<id>/<kind>`) lets the consumer's call site reveal the family at a glance.

### Bundling the work

Three PRs proposed; the agent and Joshua converged on:

1. Helpers + inline-template removal. No file moves. This is the foundational refactor; once helpers exist, the directory rename in PR 3 is a one-line helper change instead of grep-and-replace.
2. Basemap fix (Option A). Regenerates the 20 reference-fixture SVGs. No layout change.
3. Layout migration. Moves the 122 directories into their new homes; updates the helpers; rebuilds.

### Centralization rule

The chart slug is the externally-visible identifier consumers use (`<CourseStepChart slug="..." />`). Today the 13 wx-engine chart-derivation files each carry an inline `\`wx-scenario-${scenarioId}-<kind>\`` template, and the 5 date-stamped wx-charts reference-fixture tests carry an inline `slug: 'wx-<kind>-<date-zulu>'` string. Moving the layout in PR 3 would mean rewriting every site by hand.

Pushing the slug + path construction into `libs/constants/` once means the migration is a single-file edit. Same trick we used for `chartsRootDir` -- one source of truth, every consumer reads from it.

### Mockups carveout

Joshua was clear that `data/charts/wx/mockups/` is not a permanent artifact family. It exists for design exploration; the agent that creates them owns the lifecycle. No helpers, no production consumers, no `<CourseStepChart>` references. If a mockup graduates to permanent reference material, it moves to `reference-fixtures/` and gets a proper slug.

## Why "no file moves" in PR 1

Two reasons:

1. **Scope.** PR 1 is mechanical refactor. Adding file moves doubles the review surface and risks tangling helper-shape bugs with disk-shape bugs.
2. **Reversibility.** If the helper shape needs adjustment after PR 1 lands, fixing it is a one-file change. If the directory move ran first, fixing the helper would also require moving directories back.

PR 1 helpers return the **current flat layout** identical to today's behavior. They're a refactor in name only -- byte-identical engine output, byte-identical test slugs. PR 3 is where the helpers change shape and the directories move in lockstep.
