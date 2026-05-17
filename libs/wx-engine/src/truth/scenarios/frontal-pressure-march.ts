/**
 * `frontal-pressure-march` -- the TruthModel v2 temporal pilot scenario.
 *
 * The user's motivating scenario from
 * `docs/work/plans/2026-05-14-truth-model-v2-temporal.md`:
 *
 *   A pilot is under pressure to reach a destination and sees a cold front
 *   moving at a reported speed. The front then accelerates and produces
 *   storms ahead of the boundary. The scenario declares the weather over
 *   time -- hour by hour -- and the engine derives every initial and future
 *   METAR / TAF across the route's stations.
 *
 * Synoptic setting: a March cold front sweeping ESE across Kansas. At 1200Z
 * the front lies along a NW-SE line west of the route; the warm sector (mT)
 * covers the eastern stations, the cold sector (cP) trails behind. The front
 * starts at 15 kt, accelerates to 22 kt at 1500Z and 28 kt at 1800Z, and
 * intensifies from moderate to strong at 1600Z. Pre-frontal convection
 * appears 60 nm ahead of the boundary starting at 1500Z.
 *
 * The static v1 snapshot fields describe the world at 1200Z (= `validAt` =
 * `evolution.start`); the `evolution` block describes how it changes through
 * 2000Z. `sampleTruthAt` consults the block to derive a v1-shape snapshot for
 * any timestamp inside the window.
 *
 * Route: KDDC -> KICT -> KFOE, with KMHK / KTOP / KJLN as regional context.
 *
 * The Zod schema (`./truth/schema.ts`) gates this literal:
 * `loadScenario('frontal-pressure-march')` must validate cleanly.
 */

import type { TruthModel } from '../types';

/**
 * Cold-front polyline at 1200Z (scenario start). NW-SE oriented, west of the
 * route's eastern stations. The `evolution.fronts[0].pointsAtStart` mirrors
 * these vertices exactly so the temporal projection starts from the same
 * boundary the v1 snapshot draws.
 */
const COLD_FRONT_INITIAL_POINTS: [number, number][] = [
	[-100.4, 40.0],
	[-100.0, 38.5],
	[-99.6, 37.0],
	[-99.2, 35.5],
];

export const FRONTAL_PRESSURE_MARCH: TruthModel = {
	scenarioId: 'frontal-pressure-march',
	// March morning, 06:00 local CST = 12:00 UTC -- the scenario window start.
	validAt: '2026-03-14T12:00:00Z',
	primaryTimeZone: 'America/Chicago',
	narrative:
		'Accelerating cold front under pilot time pressure, central Kansas. A March cold front sweeps ESE across the route; it starts at 15 kt, accelerates to 22 then 28 kt, and intensifies from moderate to strong by 1600Z. Pre-frontal convection appears 60 nm ahead of the boundary at 1500Z. The TAF issued before the window forecasts the front at its slower initial speed, so the actual METARs show the front arriving earlier than predicted.',

	stations: {
		KICT: { icao: 'KICT', lon: -97.43, lat: 37.65, elevationFt: 1333, name: 'Wichita Dwight D. Eisenhower' },
		KMHK: { icao: 'KMHK', lon: -96.67, lat: 39.14, elevationFt: 1057, name: 'Manhattan Regional' },
		KTOP: { icao: 'KTOP', lon: -95.62, lat: 39.07, elevationFt: 881, name: 'Topeka Philip Billard' },
		KJLN: { icao: 'KJLN', lon: -94.5, lat: 37.15, elevationFt: 981, name: 'Joplin Regional' },
		KFOE: { icao: 'KFOE', lon: -95.66, lat: 38.95, elevationFt: 1078, name: 'Topeka Forbes Field' },
		KDDC: { icao: 'KDDC', lon: -99.97, lat: 37.76, elevationFt: 2594, name: 'Dodge City Regional' },
	},

	synoptic: {
		pressureSystems: [
			{
				id: 'L-nebraska',
				kind: 'L',
				lon: -100.5,
				lat: 42.0,
				centralPressureMb: 998,
				motionDegTrue: 80,
				motionKt: 22,
			},
			{
				id: 'H-southeast',
				kind: 'H',
				lon: -86.0,
				lat: 33.0,
				centralPressureMb: 1024,
				motionDegTrue: 70,
				motionKt: 12,
			},
		],
		fronts: [
			{
				// Cold front sweeping ESE across Kansas. At 1200Z it lies west of
				// the route; KDDC is right at the boundary, KICT/KMHK/KTOP/KFOE are
				// pre-frontal, KJLN is deep in the warm sector.
				id: 'cf-1',
				kind: 'cold',
				points: COLD_FRONT_INITIAL_POINTS,
				pipSide: 'E', // cold side is W; pips face the warm sector (E)
				motionDegTrue: 110,
				motionKt: 15,
				intensity: 'moderate',
			},
		],
	},

	airMasses: [
		{
			// Pre-frontal warm sector (mT). Covers the route's eastern stations.
			// Polygon traces the east side of the cold front then a wide eastern
			// envelope.
			id: 'warm',
			classification: 'mT',
			polygon: [
				[-99.2, 35.5],
				[-99.6, 37.0],
				[-100.0, 38.5],
				[-100.4, 40.0],
				[-92.0, 40.5],
				[-92.0, 34.5],
				[-99.2, 35.5],
			],
			surfaceTempC: 16, // ~61 F pre-frontal
			surfaceDewpointC: 12, // ~54 F -- moist warm sector
			stability: 'conditionally-unstable',
			surfaceWindDirDeg: 190, // S/SSW pre-frontal
			surfaceWindKt: 13,
			meanCloudCover: 'SCT',
			meanCloudBaseFtAgl: 5000,
			meanCloudTopFtAgl: 14000,
		},
		{
			// Post-frontal cold sector (cP). West of the cold front; KDDC sits
			// near the seam at 1200Z and falls behind the front as it advances.
			id: 'cold',
			classification: 'cP',
			polygon: [
				[-99.2, 35.5],
				[-99.6, 37.0],
				[-100.0, 38.5],
				[-100.4, 40.0],
				[-106.0, 40.5],
				[-106.0, 34.5],
				[-99.2, 35.5],
			],
			surfaceTempC: 5, // ~41 F -- sharp post-frontal temp drop
			surfaceDewpointC: -3, // ~27 F -- dry post-frontal
			stability: 'stable',
			surfaceWindDirDeg: 320, // NW post-frontal
			surfaceWindKt: 20,
			meanCloudCover: 'BKN',
			meanCloudBaseFtAgl: 3000, // post-frontal stratocumulus
			meanCloudTopFtAgl: 8000,
		},
	],

	upperLevel: {
		jetAxis: [
			[-108.0, 35.0],
			[-100.0, 39.0],
			[-92.0, 43.0],
		],
		jetMaxKt: 100,
		windByAltitude: [
			{ altitudeFt: 3000, meanDirDeg: 210, meanSpeedKt: 25, meanTempC: 6 },
			{ altitudeFt: 6000, meanDirDeg: 230, meanSpeedKt: 33, meanTempC: 1 },
			{ altitudeFt: 9000, meanDirDeg: 250, meanSpeedKt: 40, meanTempC: -5 },
			{ altitudeFt: 12000, meanDirDeg: 260, meanSpeedKt: 48, meanTempC: -12 },
			{ altitudeFt: 18000, meanDirDeg: 270, meanSpeedKt: 62, meanTempC: -24 },
			{ altitudeFt: 24000, meanDirDeg: 280, meanSpeedKt: 80, meanTempC: -37 },
			{ altitudeFt: 30000, meanDirDeg: 285, meanSpeedKt: 92, meanTempC: -51 },
			{ altitudeFt: 34000, meanDirDeg: 290, meanSpeedKt: 100, meanTempC: -56 },
			{ altitudeFt: 39000, meanDirDeg: 295, meanSpeedKt: 90, meanTempC: -58 },
		],
	},

	convection: {
		// No cells at 1200Z -- the evolution block spawns pre-frontal convection
		// at 1500Z, 60 nm ahead of the boundary.
		cells: [],
		frontalBand: null,
		capeJperKgByStation: {
			KICT: 700, // pre-frontal warm sector, modest CAPE
			KMHK: 650,
			KTOP: 600,
			KJLN: 750, // deep warm sector
			KFOE: 600,
			KDDC: 100, // near/behind the front, stable
		},
	},

	diurnal: {
		solarNoonUtcHour: 18, // CST solar noon ~12 local = 18 UTC in March
		mixingHeightFtMsl: 6500,
		nocturnalInversion: false,
	},

	hazardZones: [],

	terrain: {
		ridges: [], // no significant terrain on the Kansas route
	},

	routeStations: ['KDDC', 'KICT', 'KFOE'],
	fbStations: ['KDDC', 'KICT', 'KFOE', 'KMHK', 'KTOP', 'KJLN'],
	// 8-hour window-anchored TAF so the upcoming frontal passage drives an FM
	// transition rather than rolling off the end of the forecast.
	tafValidHours: 8,

	// v2 temporal evolution. The static fields above are the world at 1200Z;
	// this block describes how it changes through 2000Z.
	evolution: {
		start: '2026-03-14T12:00:00Z',
		end: '2026-03-14T20:00:00Z',
		stepMinutes: 60,
		fronts: [
			{
				id: 'cf-1',
				pointsAtStart: COLD_FRONT_INITIAL_POINTS,
				motion: {
					// The front accelerates: 15 kt -> 22 kt -> 28 kt.
					kind: 'piecewise',
					segments: [
						{ until: '2026-03-14T15:00:00Z', bearingDeg: 110, speedKt: 15 },
						{ until: '2026-03-14T18:00:00Z', bearingDeg: 110, speedKt: 22 },
						{ until: '2026-03-14T20:00:00Z', bearingDeg: 110, speedKt: 28 },
					],
				},
				intensitySchedule: [
					{ at: '2026-03-14T12:00:00Z', intensity: 'moderate' },
					{ at: '2026-03-14T16:00:00Z', intensity: 'strong' },
				],
				prefrontalConvection: {
					// Storms appear 60 nm ahead of the front starting at 1500Z.
					leadDistanceNm: 60,
					onsetAt: '2026-03-14T15:00:00Z',
					cellTemplate: { radiusKm: 12, peakDbz: 50, motionMatchesFront: true },
				},
			},
		],
		cells: [],
		airMassMotion: [
			// The warm sector drifts slowly ENE; the cold sector tracks the front.
			{ airMassId: 'warm', motion: { bearingDeg: 90, speedKt: 8 } },
			{ airMassId: 'cold', motion: { bearingDeg: 110, speedKt: 18 } },
		],
		hazardLifecycle: [],
	},
};
