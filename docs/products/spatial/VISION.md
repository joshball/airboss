# Spatial -- product surface vision

`apps/spatial/` is the pre-flight planning surface. It holds the
route / airport / airspace / map-based products -- the products that
share map rendering and aeronautical data, grouped by rendering surface
rather than content theme (see
[MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)).

The first product on the surface is the **XC Viewer** -- the universal
pre-flight stage. It composes four layers (geography, flight, weather,
scenario events) into a `ScenarioBundle` the renderer consumes; the
killer feature is layered truth-awareness, where every claim the viewer
makes about a flight traces back to a layer. See the
[XC Viewer vision](../../vision/products/pre-flight/xc-viewer/VISION.md)
for the full thesis and the
[xc-viewer-v1 work package](../../work-packages/xc-viewer-v1/) for the
first slice.

## Next products on this surface

- **Route walkthrough** -- a guided, step-through narration of an XC
  route built on the same `ScenarioBundle`.
- **Airport cards** -- a per-airport reference surface (runways,
  frequencies, procedures) deep-linkable from any app.
- **Airspace navigator** -- an interactive airspace explorer that
  isolates and explains each class.

All three reuse the `libs/spatial-engine/` composition pipeline and the
`libs/spatial-ui/` renderer. They are created when needed, not
speculatively.
