# Spatial -- product surface index

`apps/spatial/` is the pre-flight planning surface: route, airport, and
airspace products. Apps are grouped by rendering surface, not content
theme (see [MULTI_PRODUCT_ARCHITECTURE.md](../../platform/MULTI_PRODUCT_ARCHITECTURE.md)).

## v1 surface

| Product   | Route                               | Status                           |
| --------- | ----------------------------------- | -------------------------------- |
| XC Viewer | `/spatial/xc`, `/spatial/xc/<slug>` | v1 (work package `xc-viewer-v1`) |

The XC viewer is the universal pre-flight stage -- a cross-country
rehearsal surface that composes four layers (geography, flight, weather,
scenario events) into a `ScenarioBundle` the renderer consumes. v1 ships
one sectional region (Memphis), one route (KMEM -> KMKL -> KOLV), one
aircraft (C172N), and one weather scenario (`frontal-xc-march`).

## Libraries

| Library                | Role                                                            |
| ---------------------- | --------------------------------------------------------------- |
| `libs/spatial-engine/` | Server-only -- the four-layer composition pipeline + CLI engine |
| `libs/spatial-ui/`     | Browser-safe -- the SVG renderer component family               |

## Work packages

- [xc-viewer-v1](../../work-packages/xc-viewer-v1/) -- the first XC viewer slice

## Next on this surface

Route walkthrough, airport cards, and an airspace navigator are candidate
follow-on products. See [VISION.md](./VISION.md).
