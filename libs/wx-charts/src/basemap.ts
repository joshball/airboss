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

import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

/** FIPS state codes that are NOT in CONUS. */
export const NON_CONUS_FIPS: ReadonlySet<string> = new Set(['02', '15', '60', '66', '69', '72', '78']);

/**
 * Numeric ISO 3166-1 codes for the surrounding-country context outlines
 * (Canada + Mexico). Matches the `id` strings carried by
 * `data/references/basemaps/north-america-context-50m.json`. See
 * [ADR 027](../../../docs/decisions/027-wx-charts-artifact-layout/decision.md).
 */
export const NORTH_AMERICA_CONTEXT_COUNTRY_IDS: ReadonlySet<string> = new Set(['124', '484']);

interface StateProperties {
	name?: string;
}

interface ContextCountryProperties {
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
	/**
	 * Surrounding-country context outlines (Canada + Mexico). Empty when
	 * no context TopoJSON is supplied. Drawn below the CONUS basemap fill
	 * to anchor the Lambert Conformal cone curvature visually -- per ADR
	 * 027 Option A.
	 */
	northAmericaContext: FeatureCollection<Polygon | MultiPolygon, ContextCountryProperties>;
}

type GetBuiltinModule = (spec: string) => unknown;
type NodeFs = {
	readFileSync: (p: string, enc: 'utf8') => string;
	promises: { readFile: (p: string, enc: 'utf8') => Promise<string> };
};

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
 * Async lazy read of a basemap TopoJSON file via the canonical lazy
 * `node:fs` pattern. Renderers use this for both the CONUS states file
 * and the Canada + Mexico context file. Browser-safe: the `node:fs`
 * import is hidden inside the function body so Vite's static analyzer
 * cannot externalize it.
 *
 * `label` is a short string included in the error message when the
 * runtime has no `process.getBuiltinModule` (i.e., the function was
 * called from a browser bundle where it should never reach).
 */
export async function readBasemapTopoJson(label: string, path: string): Promise<string> {
	const proc = (typeof process !== 'undefined' ? process : undefined) as
		| (NodeJS.Process & { getBuiltinModule?: GetBuiltinModule })
		| undefined;
	const getBuiltin = proc?.getBuiltinModule;
	if (typeof getBuiltin !== 'function') {
		throw new Error(`${label}: cannot read basemap file -- no process.getBuiltinModule available`);
	}
	const fs = getBuiltin('node:fs') as NodeFs;
	return fs.promises.readFile(path, 'utf8');
}

/**
 * Read a us-atlas TopoJSON file and build the CONUS basemap shapes.
 * `nationPath` is optional; pass `null` to skip the nation outline.
 * `contextPath` is optional; pass a path to the Canada + Mexico context
 * TopoJSON (per ADR 027 Option A) to fill the Lambert Conformal cone
 * curve with surrounding-country outlines.
 */
export function loadConusBasemap(
	statesPath: string,
	nationPath: string | null = null,
	contextPath: string | null = null,
): BasemapData {
	const fs = nodeFs();
	const statesTopoJson = fs.readFileSync(statesPath, 'utf8');
	const nationTopoJson = nationPath !== null ? fs.readFileSync(nationPath, 'utf8') : null;
	const contextTopoJson = contextPath !== null ? fs.readFileSync(contextPath, 'utf8') : null;
	return loadConusBasemapFromString(statesTopoJson, nationTopoJson, contextTopoJson);
}

/**
 * Build the CONUS basemap from in-memory TopoJSON strings. Useful for
 * tests and any consumer that already has the bytes in memory.
 */
export function loadConusBasemapFromString(
	statesTopoJson: string,
	nationTopoJson: string | null = null,
	contextTopoJson: string | null = null,
): BasemapData {
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

	let northAmericaContext: FeatureCollection<Polygon | MultiPolygon, ContextCountryProperties> = {
		type: 'FeatureCollection',
		features: [],
	};
	if (contextTopoJson !== null) {
		const contextTopo = JSON.parse(contextTopoJson) as Topology;
		const countriesGeom = contextTopo.objects.countries as GeometryCollection;
		// Defensive filter: in case a future drop carries extra geometries,
		// keep only the canonical Canada + Mexico IDs.
		const contextGeometries = countriesGeom.geometries.filter((g) => {
			const id = String(g.id ?? '');
			return NORTH_AMERICA_CONTEXT_COUNTRY_IDS.has(id);
		});
		const filteredCountriesGeom: GeometryCollection = {
			...countriesGeom,
			geometries: contextGeometries,
		};
		northAmericaContext = feature(contextTopo, filteredCountriesGeom) as unknown as FeatureCollection<
			Polygon | MultiPolygon,
			ContextCountryProperties
		>;
	}

	return { states, nation, stateBordersInterior, conusOuter, northAmericaContext };
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

/** Canonical stroke for the Canada + Mexico context outlines (ADR 027 Option A). */
export const NORTH_AMERICA_CONTEXT_STROKE = '#bdb9ac';
/** Canonical fill for the context polygons -- one shade darker than the CONUS fill. */
export const NORTH_AMERICA_CONTEXT_FILL = '#efece4';
/** Stroke width for the context outlines -- thinner than CONUS state borders. */
export const NORTH_AMERICA_CONTEXT_STROKE_WIDTH = 0.7;

/**
 * Render the Canada + Mexico context features as an SVG fragment, suitable
 * for the `north-america-context` layer band. Returns an empty string when
 * no context features are available (the default when `contextBasemapPath`
 * is unset).
 *
 * The renderer must already hold a `geoPath(projection)` bound to the
 * same projection used for the CONUS basemap; pass it in via the
 * `pathSerializer` so context polygons project into the same screen space.
 */
export function renderNorthAmericaContextLayer(
	basemap: BasemapData,
	pathSerializer: (feature: Feature<Polygon | MultiPolygon, ContextCountryProperties>) => string | null,
): string {
	const features = basemap.northAmericaContext.features;
	if (features.length === 0) return '';
	return features
		.map((f) => {
			const d = pathSerializer(f) ?? '';
			if (d.length === 0) return '';
			return `<path d="${d}" fill="${NORTH_AMERICA_CONTEXT_FILL}" stroke="${NORTH_AMERICA_CONTEXT_STROKE}" stroke-width="${NORTH_AMERICA_CONTEXT_STROKE_WIDTH}" />`;
		})
		.filter((s) => s.length > 0)
		.join('\n');
}
