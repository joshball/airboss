// @browser-globals: server-only -- never imported by client .svelte
/**
 * Scenario-bundle writer.
 *
 * `writeScenarioBundle` serializes a composed `ScenarioBundle` to the
 * canonical per-scenario output directory `data/xc-scenarios/<slug>/`:
 *  - `bundle.json` -- the full serialized bundle
 *  - `route.geojson` -- the route as a GeoJSON FeatureCollection
 *  - `performance.json` -- the per-leg performance table
 *
 * The course-step `:::xc-viewer` directive consumer reads these files at
 * runtime (no cross-lib code dependency on `@ab/spatial-engine`).
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Architecture overview".
 */

import { XC_SCENARIO_BUNDLE } from '@ab/constants';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { joinPath, REPO_ROOT, writeJsonFile } from './fs-util';
import type { ScenarioBundle } from './scenario/types';

/** Options for `writeScenarioBundle`. */
export interface WriteOpts {
	/** Override the output root (default `data/xc-scenarios/`). */
	outputRoot?: string;
}

/** The directory a scenario's output lands in. */
export function xcScenarioDir(slug: string, opts: WriteOpts = {}): string {
	const root = opts.outputRoot ?? joinPath(REPO_ROOT, 'data', 'xc-scenarios');
	return joinPath(root, slug);
}

/** Build the route GeoJSON FeatureCollection for a bundle. */
export function routeGeoJson(bundle: ScenarioBundle): FeatureCollection {
	const waypoints = bundle.flight.route.waypoints;
	const lineFeature: Feature<LineString> = {
		type: 'Feature',
		geometry: {
			type: 'LineString',
			coordinates: waypoints.map((w) => [w.lon, w.lat]),
		},
		properties: { kind: 'route-line', routeId: bundle.flight.route.id },
	};
	const pointFeatures: Feature<Point>[] = waypoints.map((w) => ({
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [w.lon, w.lat] },
		properties: {
			kind: 'waypoint',
			id: w.id,
			label: w.label,
			waypointKind: w.kind,
			airportIcao: w.airportIcao ?? null,
		},
	}));
	return {
		type: 'FeatureCollection',
		features: [lineFeature, ...pointFeatures],
	};
}

/**
 * Write a composed bundle to `data/xc-scenarios/<slug>/`. Returns the
 * directory written. Deterministic: re-running with the same bundle
 * produces byte-identical files.
 */
export async function writeScenarioBundle(bundle: ScenarioBundle, opts: WriteOpts = {}): Promise<string> {
	const dir = xcScenarioDir(bundle.scenarioId, opts);
	writeJsonFile(joinPath(dir, XC_SCENARIO_BUNDLE.BUNDLE), bundle);
	writeJsonFile(joinPath(dir, XC_SCENARIO_BUNDLE.ROUTE_GEOJSON), routeGeoJson(bundle));
	writeJsonFile(joinPath(dir, XC_SCENARIO_BUNDLE.PERFORMANCE), bundle.performance);
	return dir;
}
