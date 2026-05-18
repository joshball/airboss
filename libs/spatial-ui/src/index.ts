/**
 * `@ab/spatial-ui` -- runtime / browser-safe barrel.
 *
 * The XC viewer's renderer component family. Every export here is a
 * Svelte component or a pure type -- browser-safe. The components render
 * a `ScenarioBundle` value into SVG; they never touch the filesystem or
 * the DB. The bundle is loaded server-side (`+page.server.ts` via
 * `@ab/spatial-engine/server`) and passed to `<XcViewer>` as data.
 *
 * Source of truth: `docs/work-packages/xc-viewer-v1/design.md` "Per-layer
 * module layout (`libs/spatial-ui/src/`)".
 *
 * Phase A ships the styling tokens + the scaffold. Phase B ships the
 * sectional renderer; Phase C the route renderer; Phase D the weather
 * overlay; Phase E the performance band. Each phase appends its
 * components here.
 */

// ----------------------------------------------------------------------
// Layer-3 weather overlay (Phase D).
// ----------------------------------------------------------------------
export { default as AirmetPolygon } from './AirmetPolygon.svelte';
// ----------------------------------------------------------------------
// Layer-1 sectional renderer (Phase B).
// ----------------------------------------------------------------------
export { default as AirportLayer } from './AirportLayer.svelte';
export { default as AirspaceLayer } from './AirspaceLayer.svelte';
export { default as LayerToggle } from './controls/LayerToggle.svelte';
export type { CanvasTransform } from './controls/types';
export { default as ZoomPanControls } from './controls/ZoomPanControls.svelte';
export { default as LegLabel } from './LegLabel.svelte';
export { default as NavaidLayer } from './NavaidLayer.svelte';
export { default as PlateStub } from './PlateStub.svelte';
// ----------------------------------------------------------------------
// Layer-2 route renderer (Phase C).
// ----------------------------------------------------------------------
export { default as RouteOverlay } from './RouteOverlay.svelte';
export { default as SectionalCanvas } from './SectionalCanvas.svelte';
// ----------------------------------------------------------------------
// Renderer styling tokens + the layer-toggle key enum.
// ----------------------------------------------------------------------
export { SPATIAL_LAYER_KEYS, SPATIAL_LAYER_LABELS, type SpatialLayerKey } from './styles/tokens';
export type { LegLabelData } from './types';
export { default as WaypointDetailDrawer } from './WaypointDetailDrawer.svelte';
export { default as WaypointWxChip } from './WaypointWxChip.svelte';
// ----------------------------------------------------------------------
// Top-level composition.
// ----------------------------------------------------------------------
export { default as XcViewer } from './XcViewer.svelte';
