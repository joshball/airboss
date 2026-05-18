/**
 * Synthetic test fixtures for the spatial-ui component tests.
 *
 * Small hand-built `Geography` + `ScenarioBundle` shapes -- enough to
 * drive a renderer test without loading the real Memphis geometry.
 */

import type {
	AirportRecord,
	AirspacePolygon,
	Geography,
	NavaidRecord,
	ScenarioBundle,
	WxBundleView,
} from '@ab/spatial-engine';

/** A synthetic three-polygon airspace set: one B, one D, one MOA. */
export const fixtureAirspace: AirspacePolygon[] = [
	{
		id: 'asp-b',
		airspaceClass: 'B',
		label: 'Test Class B',
		floorFtMsl: 0,
		ceilingFtMsl: 10000,
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[-90.1, 35.0],
					[-89.8, 35.0],
					[-89.8, 35.2],
					[-90.1, 35.2],
					[-90.1, 35.0],
				],
			],
		},
	},
	{
		id: 'asp-d',
		airspaceClass: 'D',
		label: 'Test Class D',
		floorFtMsl: 0,
		ceilingFtMsl: 3400,
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[-89.0, 35.5],
					[-88.8, 35.5],
					[-88.8, 35.7],
					[-89.0, 35.7],
					[-89.0, 35.5],
				],
			],
		},
	},
	{
		id: 'asp-moa',
		airspaceClass: 'MOA',
		label: 'Test MOA',
		floorFtMsl: 5000,
		ceilingFtMsl: 18000,
		geometry: {
			type: 'Polygon',
			coordinates: [
				[
					[-91.0, 34.0],
					[-90.5, 34.0],
					[-90.5, 34.5],
					[-91.0, 34.5],
					[-91.0, 34.0],
				],
			],
		},
	},
];

/** Two synthetic airports: one hard-surface attended, one soft-surface. */
export const fixtureAirports: AirportRecord[] = [
	{
		icao: 'KTST',
		name: 'Test International',
		lon: -89.95,
		lat: 35.05,
		elevationFtMsl: 300,
		attended: true,
		airspaceClass: 'B',
		runways: [
			{
				designator: '18/36',
				headingDegMagnetic: 180,
				lengthFt: 9000,
				widthFt: 150,
				surface: 'concrete',
				hasPrecisionApproach: true,
			},
		],
		frequencies: [{ label: 'Tower', mhz: 118.3 }],
		fbos: [],
	},
	{
		icao: 'KSFT',
		name: 'Test Grass Strip',
		lon: -88.9,
		lat: 35.6,
		elevationFtMsl: 420,
		attended: false,
		airspaceClass: 'E',
		runways: [
			{
				designator: '9/27',
				headingDegMagnetic: 90,
				lengthFt: 2500,
				widthFt: 60,
				surface: 'turf',
				hasPrecisionApproach: false,
			},
		],
		frequencies: [{ label: 'CTAF', mhz: 122.8 }],
		fbos: [],
	},
];

/** A synthetic navaid set: one VOR, one NDB, one fix. */
export const fixtureNavaids: NavaidRecord[] = [
	{ id: 'TST', kind: 'VORTAC', name: 'Test VORTAC', lon: -89.9, lat: 35.07, frequencyMhz: 117.5 },
	{ id: 'NDX', kind: 'NDB', name: 'Test NDB', lon: -89.4, lat: 34.8, frequencyMhz: null },
	{ id: 'FIXAA', kind: 'FIX', name: 'FIXAA intersection', lon: -89.5, lat: 35.3, frequencyMhz: null },
];

/** A synthetic basemap with one water line + one city + one state outline. */
export const fixtureBasemap: Geography['basemap'] = {
	type: 'FeatureCollection',
	features: [
		{
			type: 'Feature',
			geometry: {
				type: 'LineString',
				coordinates: [
					[-90.0, 34.5],
					[-90.1, 35.5],
				],
			},
			properties: { kind: 'water', name: 'Test River' },
		},
		{
			type: 'Feature',
			geometry: { type: 'Point', coordinates: [-89.95, 35.05] },
			properties: { kind: 'city', name: 'Testville' },
		},
		{
			type: 'Feature',
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[-91.5, 34.99],
						[-87.5, 34.99],
						[-87.5, 35.01],
						[-91.5, 35.01],
						[-91.5, 34.99],
					],
				],
			},
			properties: { kind: 'state-outline', name: 'Test state line' },
		},
	],
};

/** A synthetic Memphis-region geography. */
export const fixtureGeography: Geography = {
	regionSlug: 'memphis',
	bounds: { minLon: -91.5, minLat: 33.5, maxLon: -87.5, maxLat: 36.7 },
	airports: fixtureAirports,
	airspace: fixtureAirspace,
	navaids: fixtureNavaids,
	basemap: fixtureBasemap,
};

/** A synthetic sectional-only `ScenarioBundle` (no route / weather yet). */
export const fixtureBundle: ScenarioBundle = {
	scenarioId: 'kmem-kmkl-kolv-frontal-march',
	label: 'Test Scenario',
	validAt: '2026-03-19T19:00:00Z',
	geography: fixtureGeography,
	flight: {
		scenarioId: 'kmem-kmkl-kolv-c172n-skyhawk',
		route: {
			id: 'kmem-kmkl-kolv',
			label: 'Test Route',
			waypoints: [
				{ id: 'wp-a', label: 'KTST', lon: -89.95, lat: 35.05, airportIcao: 'KTST', kind: 'airport' },
				{ id: 'wp-b', label: 'KSFT', lon: -88.9, lat: 35.6, airportIcao: 'KSFT', kind: 'airport' },
			],
			altitudeProfile: [{ altitudeFtMsl: 4500 }],
			speedProfile: [{ tasKt: 110 }],
			plannedDepartureUtc: '2026-03-19T19:00:00Z',
		},
		aircraft: {
			id: 'c172n-skyhawk',
			model: 'Cessna 172N Skyhawk',
			perfPolar: {
				climb: { rateFpm: 700, kiasIas: 75 },
				cruise: {
					points: [
						{ pressureAltitudeFtMsl: 2000, tasKt: 109, gph: 8.4 },
						{ pressureAltitudeFtMsl: 8000, tasKt: 116, gph: 7.8 },
					],
				},
				descent: { rateFpm: 500, kiasIas: 110 },
				serviceCeilingFtMsl: 14200,
			},
			fuelBurnCurve: { cruise: { defaultGph: 8 }, climb: { gph: 10 }, taxi: { gph: 1.4 } },
			fuelCapacityGal: 40,
			wbEnvelope: {
				maxGrossWeightLb: 2300,
				minWeightLb: 1500,
				envelope: [
					{ weightLb: 1500, fwdCgIn: 33, aftCgIn: 47.3 },
					{ weightLb: 2300, fwdCgIn: 38.5, aftCgIn: 47.3 },
				],
			},
			equipment: {
				nav: ['vor'],
				com: ['comm-1'],
				transponder: 'mode-c',
				adsbOut: false,
				autopilot: false,
				ifrCertified: false,
			},
		},
	},
	weather: {
		wxScenarioSlug: 'frontal-xc-march',
		truthValidAt: '2026-03-19T19:00:00Z',
		byWaypoint: {},
		airmets: [],
		charts: [],
	},
	events: [],
	performance: { legs: [], totalFuelGal: 0, totalEteMin: 0, reserveGal: 0 },
};

/** A synthetic AIRMET set: one Sierra, one Tango, one Zulu. */
export const fixtureAirmets: WxBundleView['airmets'] = [
	{
		id: 'airmet-sierra-test',
		family: 'airmet-sierra',
		label: 'AIRMET SIERRA\nIFR Conditions',
		rings: [
			[
				[-90.5, 34.5],
				[-89.0, 34.5],
				[-89.0, 36.0],
				[-90.5, 36.0],
				[-90.5, 34.5],
			],
		],
		validFrom: '2026-03-19T19:00:00Z',
		validTo: '2026-03-20T01:00:00Z',
	},
	{
		id: 'airmet-tango-test',
		family: 'airmet-tango',
		label: 'AIRMET TANGO\nModerate Turbulence',
		rings: [
			[
				[-91.0, 35.5],
				[-88.5, 35.5],
				[-88.5, 36.5],
				[-91.0, 36.5],
				[-91.0, 35.5],
			],
		],
		validFrom: '2026-03-19T19:00:00Z',
		validTo: '2026-03-20T01:00:00Z',
	},
	{
		id: 'airmet-zulu-test',
		family: 'airmet-zulu',
		label: 'AIRMET ZULU\nIcing',
		rings: [
			[
				[-91.0, 33.7],
				[-89.5, 33.7],
				[-89.5, 34.7],
				[-91.0, 34.7],
				[-91.0, 33.7],
			],
		],
		validFrom: '2026-03-19T19:00:00Z',
		validTo: '2026-03-20T01:00:00Z',
	},
];

/** A weather-populated `ScenarioBundle` -- chips at each waypoint + AIRMETs. */
export const fixtureBundleWithWeather: ScenarioBundle = {
	...fixtureBundle,
	weather: {
		wxScenarioSlug: 'frontal-xc-march',
		truthValidAt: '2026-03-19T19:00:00Z',
		byWaypoint: {
			'wp-a': {
				waypointId: 'wp-a',
				metar: {
					station: 'KCPS',
					raw: 'KCPS 191953Z 20014KT 10SM BKN045 17/13 A2970',
					flightCategory: 'VFR',
					stationDistanceNm: 210,
				},
				taf: {
					station: 'KCPS',
					raw: 'FM192000 32020G30KT 5SM VCSH OVC025',
					arrivalFlightCategory: 'MVFR',
					stationDistanceNm: 210,
				},
				windsAloft: [
					{ altitudeFtMsl: 3000, directionDeg: 220, speedKt: 22, temperatureC: null },
					{ altitudeFtMsl: 6000, directionDeg: 240, speedKt: 30, temperatureC: 0 },
				],
				airmetIds: ['airmet-sierra-test', 'airmet-tango-test'],
			},
			'wp-b': {
				waypointId: 'wp-b',
				metar: {
					station: 'KCPS',
					raw: 'KCPS 191953Z 20014KT 3SM BR OVC015 04/M03 A2963',
					flightCategory: 'IFR',
					stationDistanceNm: 230,
				},
				taf: {
					station: 'KCPS',
					raw: 'FM192000 32020G30KT 3SM OVC015',
					arrivalFlightCategory: 'IFR',
					stationDistanceNm: 230,
				},
				windsAloft: [{ altitudeFtMsl: 3000, directionDeg: 320, speedKt: 20, temperatureC: 4 }],
				airmetIds: ['airmet-sierra-test'],
			},
		},
		airmets: fixtureAirmets,
		charts: [],
	},
};
