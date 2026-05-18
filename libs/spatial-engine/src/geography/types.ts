/**
 * Layer-1 (geography) types.
 *
 * Field sets match the FAA NASR (National Airspace System Resource) shape
 * so that a v2 full-ingest substitution is mechanical. Pure type module --
 * safe at any tier; re-exported `type`-only from the runtime barrel.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Data model".
 */

import type { XcRegion } from '@ab/constants';
import type { Feature, FeatureCollection, LineString, MultiPolygon, Point, Polygon } from 'geojson';

/** A `[longitude, latitude]` pair in signed decimal degrees (GeoJSON order). */
export type LonLat = readonly [number, number];

/** Geographic bounding box for a region. */
export interface RegionBounds {
	minLon: number;
	minLat: number;
	maxLon: number;
	maxLat: number;
}

/** Airspace class discriminator per FAA convention. */
export type AirspaceClass = 'B' | 'C' | 'D' | 'E' | 'MOA' | 'RESTRICTED' | 'PROHIBITED';

/** A single airspace polygon with its FAA class + display metadata. */
export interface AirspacePolygon {
	/** Stable id, unique within the region. */
	id: string;
	/** FAA airspace class. */
	airspaceClass: AirspaceClass;
	/** Human label (e.g. "Memphis Class B"). */
	label: string;
	/** Lower limit in feet MSL (SFC encoded as 0). */
	floorFtMsl: number;
	/** Upper limit in feet MSL. */
	ceilingFtMsl: number;
	/** Closed ring(s); first ring is the outer boundary. */
	geometry: Polygon | MultiPolygon;
}

/** Runway end + physical characteristics. */
export interface RunwayRecord {
	/** Designator pair, e.g. "18L/36R". */
	designator: string;
	/** Magnetic heading of the lower-numbered end, [0, 360). */
	headingDegMagnetic: number;
	/** Length in feet. */
	lengthFt: number;
	/** Width in feet. */
	widthFt: number;
	/** Surface composition. */
	surface: 'asphalt' | 'concrete' | 'turf' | 'gravel' | 'water';
	/** Whether the runway has a precision approach (ILS / GLS). */
	hasPrecisionApproach: boolean;
}

/** A radio frequency the airport publishes. */
export interface FrequencyRecord {
	/** Service label, e.g. "ATIS", "Tower", "Ground", "CTAF", "Approach". */
	label: string;
	/** Frequency in MHz. */
	mhz: number;
}

/** A fixed-base operator declared at the airport. */
export interface FboRecord {
	name: string;
	/** Fuel types available. */
	fuel: ReadonlyArray<'100LL' | 'JET-A' | 'MOGAS'>;
}

/** Full airport record. Field set mirrors NASR. */
export interface AirportRecord {
	/** ICAO identifier (e.g. "KMEM"). */
	icao: string;
	/** Common name. */
	name: string;
	/** Longitude in signed decimal degrees. */
	lon: number;
	/** Latitude in signed decimal degrees. */
	lat: number;
	/** Field elevation in feet MSL. */
	elevationFtMsl: number;
	/** Towered / attended status. */
	attended: boolean;
	/** Class of the controlling airspace at the surface. */
	airspaceClass: AirspaceClass;
	/** Runway list. */
	runways: RunwayRecord[];
	/** Published frequencies. */
	frequencies: FrequencyRecord[];
	/** Declared FBOs. */
	fbos: FboRecord[];
}

/** Navaid kind discriminator. */
export type NavaidKind = 'VOR' | 'VORTAC' | 'VOR-DME' | 'NDB' | 'FIX';

/** A navaid or named fix. */
export interface NavaidRecord {
	/** Identifier (e.g. "MEM" for the Memphis VORTAC). */
	id: string;
	/** Navaid kind. */
	kind: NavaidKind;
	/** Common name. */
	name: string;
	/** Longitude in signed decimal degrees. */
	lon: number;
	/** Latitude in signed decimal degrees. */
	lat: number;
	/** Tuned frequency in MHz (null for FIX / NDB without a published freq). */
	frequencyMhz: number | null;
}

/** Basemap feature properties carried on each GeoJSON feature. */
export interface BasemapFeatureProperties {
	/** Feature kind drives the renderer's per-feature styling. */
	kind: 'state-outline' | 'water' | 'road' | 'city';
	/** Display name (city label, state name, road name). */
	name?: string;
}

/** GeoJSON feature collection for the basemap layer. */
export type BasemapFeatureCollection = FeatureCollection<
	Polygon | MultiPolygon | LineString | Point,
	BasemapFeatureProperties
>;

/** A region's static metadata. */
export interface Region {
	regionSlug: XcRegion;
	bounds: RegionBounds;
	/** FAA dCS cycle the vector geometry was extracted from. */
	sourceCycle: string;
	/** Standard parallels for the regional Lambert projection. */
	parallels: readonly [number, number];
}

/** The fully-loaded layer-1 geography for a region. */
export interface Geography {
	regionSlug: XcRegion;
	bounds: RegionBounds;
	airports: AirportRecord[];
	airspace: AirspacePolygon[];
	navaids: NavaidRecord[];
	basemap: BasemapFeatureCollection;
}

/** A single GeoJSON basemap feature (convenience alias). */
export type BasemapFeature = Feature<Polygon | MultiPolygon | LineString | Point, BasemapFeatureProperties>;
