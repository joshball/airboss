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
 * Component families:
 *  - layer-1 sectional: SectionalCanvas, AirspaceLayer, AirportLayer,
 *    NavaidLayer, ZoomPanControls, LayerToggle
 *  - layer-2 route: RouteOverlay, LegLabel
 *  - layer-3 weather: WaypointWxChip, AirmetPolygon, WaypointDetailDrawer,
 *    PlateStub
 *  - layer-2 performance: PerformanceBand, LegDetailDrawer
 *  - top-level: XcViewer
 */

export { default as AirmetPolygon } from './AirmetPolygon.svelte';
export { default as AirportLayer } from './AirportLayer.svelte';
export { default as AirspaceLayer } from './AirspaceLayer.svelte';
export { default as LayerToggle } from './controls/LayerToggle.svelte';
export type { CanvasTransform } from './controls/types';
export { default as ZoomPanControls } from './controls/ZoomPanControls.svelte';
export { default as LegDetailDrawer } from './LegDetailDrawer.svelte';
export { default as LegLabel } from './LegLabel.svelte';
export { default as NavaidLayer } from './NavaidLayer.svelte';
export { default as PerformanceBand } from './PerformanceBand.svelte';
export { default as PlateStub } from './PlateStub.svelte';
export { default as RouteOverlay } from './RouteOverlay.svelte';
export { default as SectionalCanvas } from './SectionalCanvas.svelte';
export { SPATIAL_LAYER_KEYS, SPATIAL_LAYER_LABELS, type SpatialLayerKey } from './styles/tokens';
export type { LegLabelData } from './types';
export { default as WaypointDetailDrawer } from './WaypointDetailDrawer.svelte';
export { default as WaypointWxChip } from './WaypointWxChip.svelte';
export { default as XcViewer } from './XcViewer.svelte';
