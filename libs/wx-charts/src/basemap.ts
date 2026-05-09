/**
 * Basemap loader: reads us-atlas TopoJSON (states + nation), filters to
 * CONUS (drops Alaska/Hawaii/Puerto Rico FIPS codes), returns GeoJSON
 * features ready for projection.
 *
 * us-atlas IDs are FIPS state codes (strings like "06" for California).
 * CONUS = all states EXCEPT 02 (AK), 15 (HI), 60 (AS), 66 (GU), 69 (MP),
 * 72 (PR), 78 (VI).
 *
 * # Browser safety
 *
 * `loadConusBasemap(path)` uses `node:fs` lazily via the
 * `process.getBuiltinModule(...)` pattern from `libs/constants/src/source-cache.ts`.
 * Vite's static analyzer cannot follow the runtime call, so the bundler
 * never tries to externalize `node:fs` for the browser. The browser
 * loads this module but never invokes `loadConusBasemap` -- only server
 * code (CLI, tests) calls it. For tests / consumers that already have
 * the topojson string in memory, use `loadConusBasemapFromString`.
 *
 * Ported from `spikes/wx-charts/01-surface-analysis/src/basemap.ts` with
 * the relative `node:fs` import replaced by the lazy pattern.
 */

import { feature, mesh } from 'topojson-client';
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** FIPS state codes that are NOT in CONUS. */
export const NON_CONUS_FIPS: ReadonlySet<string> = new Set(['02', '15', '60', '66', '69', '72', '78']);

interface StateProperties {
	name?: string;
}

export interface BasemapData {
	/** CONUS-only state polygons. Useful for state fills + as the projection fit target. */
	states: FeatureCollection<Polygon | MultiPolygon, StateProperties>;
	/** Optional us-atlas nation outline (kept for raster overlay re-stroking). */
	nation: Feature<Polygon | MultiPolygon> | null;
	/** Interior state borders (mesh between two distinct CONUS states). */
	stateBordersInterior: Feature<MultiLineString>;
	/**
	 * Outer boundary of the CONUS states union (coastline + Canada/Mexico
	 * borders). Built from the states topology with `(a, b) => a === b`,
	 * giving edges shared by exactly one CONUS state -- avoids the
	 * AK/HI/PR pieces the us-atlas `nation` file otherwise carries.
	 */
	conusOuter: Feature<MultiLineString>;
}

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = { readFileSync: (p: string, enc: 'utf8') => string };

let cachedFs: NodeFs | null = null;

function nodeFs(): NodeFs {
	if (cachedFs !== null) return cachedFs;
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error('basemap: node:fs unavailable in this runtime (no process.getBuiltinModule)');
	}
	cachedFs = getBuiltin('node:fs') as NodeFs;
	return cachedFs;
}

/**
 * Read a us-atlas TopoJSON file and build the CONUS basemap shapes.
 * `nationPath` is optional; pass `null` to skip the nation outline.
 */
export function loadConusBasemap(statesPath: string, nationPath: string | null = null): BasemapData {
	const fs = nodeFs();
	const statesTopoJson = fs.readFileSync(statesPath, 'utf8');
	const nationTopoJson = nationPath !== null ? fs.readFileSync(nationPath, 'utf8') : null;
	return loadConusBasemapFromString(statesTopoJson, nationTopoJson);
}

/**
 * Build the CONUS basemap from in-memory TopoJSON strings. Useful for
 * tests and any consumer that already has the bytes in memory.
 */
export function loadConusBasemapFromString(statesTopoJson: string, nationTopoJson: string | null = null): BasemapData {
	const statesTopo = JSON.parse(statesTopoJson) as Topology;
	const allStatesGeom = statesTopo.objects.states as GeometryCollection;
	const conusGeometries = allStatesGeom.geometries.filter((g) => {
		const id = String(g.id ?? '');
		return !NON_CONUS_FIPS.has(id);
	});
	const conusStatesGeom: GeometryCollection = {
		...allStatesGeom,
		geometries: conusGeometries,
	};

	const states = feature(statesTopo, conusStatesGeom) as unknown as FeatureCollection<
		Polygon | MultiPolygon,
		StateProperties
	>;

	// Interior state borders -- sharper than overlapping polygons when stroking.
	const stateBordersInteriorGeom = mesh(statesTopo, conusStatesGeom, (a, b) => a !== b);
	const stateBordersInterior: Feature<MultiLineString> = {
		type: 'Feature',
		geometry: stateBordersInteriorGeom as MultiLineString,
		properties: {},
	};

	// Outer boundary: edges shared by exactly one CONUS state.
	const conusOuterGeom = mesh(statesTopo, conusStatesGeom, (a, b) => a === b);
	const conusOuter: Feature<MultiLineString> = {
		type: 'Feature',
		geometry: conusOuterGeom as MultiLineString,
		properties: {},
	};

	let nation: Feature<Polygon | MultiPolygon> | null = null;
	if (nationTopoJson !== null) {
		const nationTopo = JSON.parse(nationTopoJson) as Topology;
		const nationFeatureCollection = feature(nationTopo, nationTopo.objects.nation as GeometryCollection) as unknown as
			| FeatureCollection<Polygon | MultiPolygon>
			| Feature<Polygon | MultiPolygon>;
		nation =
			'features' in nationFeatureCollection
				? (nationFeatureCollection.features[0] as Feature<Polygon | MultiPolygon>)
				: nationFeatureCollection;
	}

	return { states, nation, stateBordersInterior, conusOuter };
}

/**
 * Helper for callers that want the raw mesh between two distinct
 * states (interior borders only). Re-exposed for charts that compose
 * borders differently from the canonical surface-analysis stack.
 */
export function conusStateMesh(basemap: BasemapData): Feature<MultiLineString> {
	return basemap.stateBordersInterior;
}

/**
 * Helper for callers that want the CONUS outer boundary alone.
 */
export function conusBorderMesh(basemap: BasemapData): Feature<MultiLineString> {
	return basemap.conusOuter;
}
