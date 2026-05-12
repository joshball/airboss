# Context: ADR 027 -- wx-charts and wx-engine artifact layout

## How we got here

The May 2026 chart-layout overhaul started from a visual problem and grew into a layout-organization problem.

### The hunchback

Joshua was reviewing a `surface-analysis` chart rendered against the 2024-12-23 12Z reference fixture and noticed the United States outline looked deformed along the top and bottom edges -- a "hunchback" appearance. The Lambert Conformal projection was assumed correct at the time (33/45 parallels, rotate `[-96, -39]`), so the diagnosis read the curvature as projection behavior on a tightly cropped extent, not as the country shape itself being wrong. **This assumption was incorrect.** The `-39` latitude rotation in fact was the root cause. See the "Root-cause projection fix" section below for the full chain of misdiagnoses across PRs #922, #923, #924, and the unmerged viewport-clip workaround before the projection itself was finally measured.

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

## PR 3 landed

PR 3 flipped the helpers from the flat layout to the nested two-family layout:

- `referenceFixtureChartSlug(kind, date)` now returns `reference-fixtures/wx-<kind>-<date>`.
- `wxScenarioChartSlug(scenarioId, kind)` now returns `wx-scenarios/<scenarioId>/<kind>`.
- `wxScenarioArtifactPath(...)` resolves to the disambiguated `<scenarioId>-<kind>-<artifact>` filename inside the per-chart directory; reference fixtures keep the flat `spec.yaml` / `chart.svg` / `meta.json` filenames inside the slug-named directory.
- `chartSpecFilename(slug)` + `chartArtifactFilename(slug, artifact)` are the per-family resolvers consumers use without case-splitting at the call site.
- `WX_CHART_FAMILIES` is the shared literal source for the three subdirectory names (`reference-fixtures`, `wx-scenarios`, `mockups`).
- `WX_CHART_SLUG_REGEX` is widened to accept the two new family shapes; the regex now rejects the legacy flat slugs.

`scripts/charts/lib.ts:listChartSlugs` walks both production families and emits the path-shaped slug per chart; `loadSpec` resolves the per-family spec filename.

The 20 reference-fixture directories moved into `data/charts/wx/reference-fixtures/` via `git mv` (filenames unchanged). The 102 wx-scenario directories moved into `data/charts/wx/wx-scenarios/<scenarioId>/<chartKind>/` and the three artifact files inside each were renamed to the disambiguated form. `bun run wx-scenario build --all` regenerated the wx-scenario specs (slug field updated) and the commentary bundles. SVG bytes are unchanged in this PR; PR 2's basemap fix is a separate regeneration on main once both PRs land.

The Option A/B/C basemap exploration mockups generated 2026-05-12 were committed under `data/charts/wx/mockups/2026-05-12-conus-basemap-shape/` as design history alongside a README explaining the role of each option. Option A was selected; B and C retained as design history.

Bundle-side per-chart subdirectories under `data/wx-scenarios/<id>/charts/` are now keyed by the chart-kind tail segment (not the full slug). The slug verbatim would create a doubly-nested subdirectory; the chart-kind key keeps the bundle flat-keyed under the scenario id, honoring the ADR's "bundle tree unaffected" rule.

One follow-on chore for main: after PR 2 (basemap fix) merges, run `bun run wx-scenario build --all` and commit the regenerated SVGs so the wx-scenarios family carries the new basemap. Single small commit, no plumbing changes.

## PR follow-on: vector-symbology clip to CONUS

PR 2 (Option A basemap, merged 2026-05-12 in #923) anchored the country shape with Canada + Mexico outlines, but the visible "hunchback" arc above the US-Canada border on the surface-analysis chart did not fully disappear. The remaining source of the curvature was not the basemap -- it was the scalar-field contour layer. Every CONUS scalar-field renderer computes contours over the full grid extent (`lon -130..-65`, `lat 22..52`), which crosses the border. Without a clip, the contour algorithm draws fragments above lat 49N, which produced the visible cue.

The corrective follow-on adds:

- `BasemapData.conusPolygon: Feature<MultiPolygon>` built via `topojson-client`'s `merge` over the CONUS state geometries (the same filter set used for `conusOuter`, returned as a closed polygon instead of a polyline).
- `libs/wx-charts/src/symbology/clip.ts` -- one helper, `buildConusClipPath({ id, conusPolygon, projection })`, that returns the `<defs><clipPath /></defs>` block + the matching `clip-path="url(#id)"` attribute string.
- Every CONUS scalar-field renderer (`surface-analysis`, `prog-chart`, `freezing-level`, `icing-cip` / `icing-fip` via the shared body, `turbulence-gtg`) wraps its vector-symbology (and raster-overlay where applicable) layer band content in `<g clip-path="url(#id)">`, with a chart-namespaced clipPath id so multiple charts inlined onto the same page do not collide.
- Polygon-overlay charts (`airmet-sigmet`, `convective-outlook`, `cva`, `gfa`, `g-airmet-icing`, `g-airmet-turbulence`, `icing-gairmet`) draw explicit polygons that never extended past CONUS in the first place; they are not clipped.
- Raster bitmaps (`radar-mosaic`, `satellite-ir` / `vis` / `wv`) carry their own legitimate Canada / coastal coverage and are not clipped.

`libs/wx-charts/package.json` bumps `0.2.0 -> 0.3.0` because every CONUS scalar-field chart's `content_hash` changes with the clipPath wrap. All 20 reference-fixture SVGs + 102 wx-scenario SVGs regenerate end-to-end. This closes out the basemap visual-correction work begun in PR 2.

## Root-cause projection fix

The PR 2 / PR 3 / PR 4 work above improved the CONUS rendering, but it never solved the actual cause of the warped country outline. Every chart-spec emitter authored during the spike lift inlined `rotate: [-96, -39]` as the Lambert Conformal Conic projection rotation. The correct value is `rotate: [-96, 0]`.

The 39-degree latitude rotation tilts the projection's "north pole" from 90 N down to 51.6 N (= 90 + (-39 + 0.6 spherical-correction)), which places the projection's central parallel at the visible US-Canada border latitude and produces:

- The "hunchback" arc above the northern states (the projection's equator now passes through them).
- Warped Great Lakes geometry (the lakes sit on the now-tilted central meridian).
- Curved southern coastline that drifted further from CONUS extent.

The projection helper at `libs/wx-charts/src/projection.ts` was correct the entire time: `CONUS_CENTRAL_MERIDIAN = -96`, `CONUS_REFERENCE_LAT = 38`, and `buildConusProjection` passes `rotate: [-96, 0]` + `center: [0, 38]` directly. The bug lived only in the chart-spec emitter literals (13 source files in `libs/wx-engine/src/charts/` plus 20 reference-fixture `spec.yaml` files), which inlined the rotation instead of importing the constant.

### How the bug evaded four PRs

- PR #922 (artifact layout migration) -- moved files; did not render anything new.
- PR #923 (Option A basemap context, Canada + Mexico outlines) -- improved the chart's framing. The added Canadian context made the projection's wrong arc look like Canadian terrain instead of a US deformity, masking the cue.
- PR #924 (vector-symbology clip to CONUS polygon) -- clipped the contour-leakage symptom. The underlying basemap geometry was still being projected with the wrong rotation; the clip just hid the spillover.
- The unmerged viewport-rect clip workaround -- wrapped every layer in a 1200x780 rectangular clip. Equivalent to masking the symptom; the SVG paths still ran out to wrong coordinates underneath.

Each PR addressed a real adjacent issue but did not measure the projection itself. The diagnosis that exposed the root cause was a single invertibility check on a known geographic point: `proj.invert([600, 84])` (the canvas centerline at the top of the basemap viewport) returned `[-96, 51.6]` -- i.e., the chart was placing latitude 51.6 N at the visible US-Canada border, when the correct projection should have placed 49 N there.

### The fix

A single-character change in 33 places:

- 13 wx-engine chart-spec emitter `.ts` files in `libs/wx-engine/src/charts/` now import `CONUS_CENTRAL_MERIDIAN` from `@ab/wx-charts` and emit `rotate: [CONUS_CENTRAL_MERIDIAN, 0]`. The latitude `0` is inlined as a math invariant (the Lambert Conformal Conic projection for CONUS is non-oblique by definition; any non-zero latitude rotation is wrong).
- 20 reference-fixture `spec.yaml` files updated to `rotate: [-96, 0]`.
- 18 wx-charts unit-test fixtures + 1 `scripts/charts/lib.test.ts` fixture updated to match.
- One regression test at `libs/wx-engine/src/__tests__/chart-spec-projection.test.ts` drives `generateScenario` across all six registered wx-engine scenarios and asserts `spec.projection.rotate === [CONUS_CENTRAL_MERIDIAN, 0]` on every emitted chart, plus a coverage assertion that all 13 chart kinds are exercised. New emitters added in the future will be covered automatically.

`libs/wx-charts/package.json` bumps `0.3.0 -> 0.3.1` so `content_hash` invalidates and `bun run charts build` rebuilds every chart. All 122 chart SVGs (20 reference-fixture + 102 wx-scenario) regenerate with the corrected geography.

### Lesson

Visual regressions need visual verification at every step. The four prior PRs each ran `bun run check`, each passed full Zod-schema validation, each saved the right files in the right places, and each looked like progress in the chart. None of them inverted a projected point or compared a known coordinate to the canvas pixel it landed on. A 2-line manual sanity check on any chart's projection would have caught this at PR 2.

## Reference-fixture filename disambiguation (follow-on)

A symmetry gap surfaced after PRs #922/#923/#924/#926 settled: wx-scenarios filenames already carried the slug tail prefix (`<scenario-id>-<chart-kind>-{spec.yaml, chart.svg, meta.json}`), but reference-fixtures still used the bare names (`spec.yaml`, `chart.svg`, `meta.json`). One stray spec.yaml file from a reference-fixture dir was not self-identifying.

The follow-on PR applies the same rule to reference-fixtures: 20 directories x 3 artifacts = 60 files renamed via `git mv` to `wx-<chart-kind>-<date-zulu>-{spec.yaml, chart.svg, meta.json}`. `referenceFixtureArtifactPath` + `chartArtifactFilename` in `libs/constants/src/wx-charts-paths.ts` updated to compute the disambiguated filename; `scripts/charts/lib.ts:listChartSlugs` continues to route through the helper and picks up the change for free. `bun run charts list` enumerates 122 slugs and `bun run charts validate --all` runs green on the renamed files.

Centralization-rule payoff: the disambiguation pass was a one-line helper change plus the rename batch. No grep-and-replace across the codebase.
