/**
 * Basemap loader: reads us-atlas TopoJSON (states + nation), filters to
 * CONUS (drops Alaska/Hawaii/Puerto Rico FIPS codes), returns GeoJSON
 * FeatureCollections ready for projection.
 *
 * us-atlas IDs are FIPS state codes (strings like "06" for California).
 * CONUS = all states EXCEPT 02 (AK), 15 (HI), 60 (AS), 66 (GU), 69 (MP),
 * 72 (PR), 78 (VI).
 */

import { readFileSync } from 'node:fs';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, MultiLineString } from 'geojson';

const NON_CONUS_FIPS = new Set(['02', '15', '60', '66', '69', '72', '78']);

interface StateProperties {
	name: string;
}

export interface BasemapData {
	states: FeatureCollection<Polygon | MultiPolygon, StateProperties>;
	nation: Feature<Polygon | MultiPolygon>;
	stateBordersInterior: Feature<MultiLineString>;
	conusOuter: Feature<MultiLineString>;
}

export function loadBasemap(statesPath: string, nationPath: string): BasemapData {
	const statesTopo = JSON.parse(readFileSync(statesPath, 'utf8')) as Topology;
	const nationTopo = JSON.parse(readFileSync(nationPath, 'utf8')) as Topology;

	// us-atlas exposes objects.states and objects.nation
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

	// Interior state borders (mesh) -- sharper than overlapping polygons
	// when stroking. Filter so we only keep boundaries between two CONUS
	// states, not the outer coastline.
	const stateBordersInterior = mesh(statesTopo, conusStatesGeom, (a, b) => a !== b) as Feature<MultiLineString>;

	// Outer boundary: edges shared by exactly one CONUS state (a === b).
	// This gives the CONUS coastline + Canada/Mexico borders without the
	// AK/HI/PR pieces that the us-atlas nation file includes.
	const conusOuter = mesh(statesTopo, conusStatesGeom, (a, b) => a === b) as Feature<MultiLineString>;

	const nationFeatureCollection = feature(nationTopo, nationTopo.objects.nation as GeometryCollection) as unknown as
		| FeatureCollection<Polygon | MultiPolygon>
		| Feature<Polygon | MultiPolygon>;

	const nation: Feature<Polygon | MultiPolygon> =
		'features' in nationFeatureCollection
			? (nationFeatureCollection.features[0] as Feature<Polygon | MultiPolygon>)
			: nationFeatureCollection;

	return { states, nation, stateBordersInterior, conusOuter };
}
