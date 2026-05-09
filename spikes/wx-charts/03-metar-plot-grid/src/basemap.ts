/**
 * Basemap loader -- adapted unchanged from Spikes 1+2.
 *
 * Reads us-atlas TopoJSON, filters out non-CONUS FIPS codes, returns
 * FeatureCollections + meshes ready for projection.
 *
 * Identical to Spike 2's basemap.ts. Third reuse confirmation: this is
 * a stable primitive ready for the symbology library.
 */

import { readFileSync } from 'node:fs';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon } from 'geojson';

const NON_CONUS_FIPS = new Set(['02', '15', '60', '66', '69', '72', '78']);

interface StateProperties {
	name: string;
}

export interface BasemapData {
	states: FeatureCollection<Polygon | MultiPolygon, StateProperties>;
	stateBordersInterior: Feature<MultiLineString>;
	conusOuter: Feature<MultiLineString>;
}

export function loadBasemap(statesPath: string): BasemapData {
	const statesTopo = JSON.parse(readFileSync(statesPath, 'utf8')) as Topology;

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

	const stateBordersInterior = mesh(statesTopo, conusStatesGeom, (a, b) => a !== b) as Feature<MultiLineString>;
	const conusOuter = mesh(statesTopo, conusStatesGeom, (a, b) => a === b) as Feature<MultiLineString>;

	return { states, stateBordersInterior, conusOuter };
}
