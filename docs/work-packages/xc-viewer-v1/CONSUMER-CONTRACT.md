# `:::xc-viewer` directive -- consumer contract

The XC viewer mounts inside a course step via a markdown directive:

```text
:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"
:::
```

This document defines the **data contract** the directive resolver
consumes. The resolver itself lives in the course-reader-and-editor
consumer (a separate work package); `xc-viewer-v1` ships the data the
resolver reads and the `<XcViewer>` component it mounts.

Same shape as the wx-engine `:::chart` directive contract -- a slug
reference resolves to a filesystem-backed artifact; no cross-lib code
dependency.

## What the directive ships

| Field | Value                                         |
| ----- | --------------------------------------------- |
| name  | `xc-viewer`                                   |
| slug  | one of `XC_SCENARIO_VALUES` (`@ab/constants`) |

## Data sources the resolver reads

The build step (`bun run xc-scenario build <slug>`) writes a per-scenario
directory at `data/xc-scenarios/<slug>/`:

| File               | Contents                                                                      |
| ------------------ | ----------------------------------------------------------------------------- |
| `bundle.json`      | The serialized `ScenarioBundle` -- geography + flight + weather + performance |
| `route.geojson`    | The route as a GeoJSON FeatureCollection (LineString + Points)                |
| `performance.json` | The per-leg performance table (also embedded in `bundle.json`)                |

The resolver needs only `bundle.json`. `route.geojson` and
`performance.json` are convenience exports for other consumers.

## Resolver behavior

1. Read `data/xc-scenarios/<slug>/bundle.json`.
2. Parse it as a `ScenarioBundle` (the type is exported from
   `@ab/spatial-engine`).
3. Mount `<XcViewer bundle={...} />` from `@ab/spatial-ui` inside the
   course step at the step's natural width.
4. The viewer renders at a fixed `16 / 10` aspect ratio with a
   performance band below it.
5. Click affordances (waypoint, leg) open side panels rendered at the
   course-step level (drawer, not modal).

## Browser-safety contract

- The resolver reads `bundle.json` server-side (a SvelteKit
  `+page.server.ts` data load -- the same pattern the wx-engine
  `:::chart` directive uses). It never imports `@ab/spatial-engine` from
  a `.svelte` file.
- `<XcViewer>` from `@ab/spatial-ui` is browser-safe: it imports
  `type ScenarioBundle` from `@ab/spatial-engine` (a type-only import,
  erased at compile time) and renders the value passed as a prop.

## Failure modes

| Condition                            | Resolver behavior                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| slug not in `XC_SCENARIO_VALUES`     | Render a placeholder: "scenario not found: `<slug>`". The course-step lint surfaces the unresolved slug at `bun run check` time. |
| `bundle.json` missing                | Render a placeholder: "scenario not built -- run `bun run xc-scenario build <slug>`".                                            |
| `bundle.json` fails schema parse     | Render an error placeholder; do not crash the course page.                                                                       |
| `<XcViewer>` throws (e.g. SVG limit) | The course-reader's error boundary catches it and renders a placeholder.                                                         |

## Status

v1 ships the data contract + the `<XcViewer>` component + the
`data/xc-scenarios/kmem-kmkl-kolv-frontal-march/` bundle. The course
step `s2-airmasses-fronts-stability.yaml` carries the
`:::xc-viewer slug="kmem-kmkl-kolv-frontal-march"` directive as the
documented mount point. Until the course-reader-and-editor consumer
ships the `:::xc-viewer` resolver, the directive is an inert placeholder
in the rendered course step -- the data it points at is real and built.

A follow-on item for the course-reader-and-editor consumer WP: implement
the `:::xc-viewer` resolver per this contract.
