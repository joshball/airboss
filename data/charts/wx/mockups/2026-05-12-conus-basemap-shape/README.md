# CONUS basemap shape mockups -- 2026-05-12

Three HTML mockups generated 2026-05-12 to evaluate approaches for the
"hunchback" appearance of the Lambert Conformal 33/45 CONUS basemap on
wx-chart renders.

The hunchback symptom: without context to the north and south, the
projection's natural curvature on the top and bottom edges reads as a
deformation of the United States outline rather than a property of the
projection.

## Options

- `option-a-canada-mexico.html` -- extends the basemap with Canada + Mexico
  outlines. Provides projection context above and below CONUS so the
  Lambert curvature reads naturally. **Selected** (see ADR 027).

- `option-b-tighter-fit.html` -- crops tighter to CONUS, hiding the curved
  edges. Rejected: hides the projection's nature rather than presenting
  it honestly, and crops information density on edge states.

- `option-c-different-parallels.html` -- recomputes the standard parallels
  to flatten the curve. Rejected: harms great-circle distance fidelity
  across the rest of the chart, and the parallels chosen (33 deg N /
  45 deg N) are aviation-canonical.

## Lifecycle

These mockups are agent-owned design exploration. They are committed
under `data/charts/wx/mockups/` per ADR 027 as design history. They are
not addressed via slug helpers and `bun run charts list` does not
enumerate them.

ADR 027 PR 2 lands the Option A implementation in the basemap pipeline.
