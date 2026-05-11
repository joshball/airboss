/**
 * `winter-icing-great-lakes` -- stratus + lake-effect icing over Lake Erie.
 *
 * Pedagogical archetype: post-frontal cP air pours over the still-warm lake,
 * forming a freezing-precip stratus band downwind of Lake Erie that traps
 * KCLE and KCAK in IFR with moderate rime icing. The departing low keeps a
 * cold-front-driven turbulence band active behind the front; a secondary
 * Zulu polygon east of the lake-effect band catches the lighter cloud icing
 * that survives at altitude. Stations: KCLE / KORD / KDTW / KGRR / KCAK.
 *
 * Counts (per spec): 5 METARs / 5 TAFs / 4 AIRMETs / 1 FB / 3 PIREPs;
 * 17 chart artifacts; ~11 Socratic callouts.
 *
 * Severity discipline: three hazard zones (lake-effect Zulu, lake-effect
 * Sierra, post-frontal Tango) are moderate so derivePireps emits exactly
 * three PIREPs; the east-of-band Zulu stays `light` so it does not double
 * the PIREP count.
 */

import type { TruthModel } from '../types';

export const WINTER_ICING_GREAT_LAKES: TruthModel = {
	scenarioId: 'winter-icing-great-lakes',
	// January morning, 15Z = 10:00 local EST -- mid-morning post-frontal regime.
	validAt: '2026-01-22T15:00:00Z',
	primaryTimeZone: 'America/New_York',
	narrative:
		'Stratus and lake-effect icing over Lake Erie. cP air pours over the still-warm lake behind a departing low to the east; downwind (south + SE of Erie) the boundary layer saturates and a freezing-precip stratus band traps KCLE and KCAK in IFR with moderate rime. KORD / KDTW / KGRR sit in clearer cP air west of the band but still inside the post-frontal turbulence column.',

	stations: {
		KCLE: { icao: 'KCLE', lon: -81.85, lat: 41.41, elevationFt: 791, name: 'Cleveland-Hopkins' },
		KORD: { icao: 'KORD', lon: -87.91, lat: 41.97, elevationFt: 672, name: "Chicago O'Hare" },
		KDTW: { icao: 'KDTW', lon: -83.35, lat: 42.22, elevationFt: 645, name: 'Detroit Metro' },
		KGRR: { icao: 'KGRR', lon: -85.52, lat: 42.88, elevationFt: 794, name: 'Grand Rapids' },
		KCAK: { icao: 'KCAK', lon: -81.44, lat: 40.92, elevationFt: 1228, name: 'Akron-Canton' },
	},

	synoptic: {
		pressureSystems: [
			{
				id: 'H-canadian-cp',
				kind: 'H',
				lon: -100,
				lat: 50,
				centralPressureMb: 1028,
				motionDegTrue: 130,
				motionKt: 15,
			},
			{
				id: 'L-departing-east',
				kind: 'L',
				lon: -78,
				lat: 44,
				centralPressureMb: 1004,
				motionDegTrue: 50,
				motionKt: 25,
			},
		],
		fronts: [
			{
				// Cold front trailing south from the departing low; all five stations
				// are west of the front (post-frontal cP). The front polyline is
				// east of every station so commentary rule 1 fires for each.
				id: 'F-trailing-cold',
				kind: 'cold',
				points: [
					[-79, 44],
					[-78.5, 42],
					[-78.2, 40],
					[-78, 38],
				],
				pipSide: 'E', // pip faces the warm sector (E); stations west = opposite side
				motionDegTrue: 130,
				motionKt: 20,
				intensity: 'moderate',
			},
		],
	},

	airMasses: [
		{
			// cP behind the departing low: cold, dry, stable. Covers all five
			// stations and the surrounding Great Lakes basin.
			id: 'AM-postfrontal-cP',
			classification: 'cP',
			polygon: [
				[-92, 38],
				[-78.5, 38],
				[-78.5, 46],
				[-92, 46],
				[-92, 38],
			],
			surfaceTempC: -10,
			surfaceDewpointC: -15,
			stability: 'stable',
			surfaceWindDirDeg: 320,
			surfaceWindKt: 20,
			meanCloudCover: 'BKN',
			meanCloudBaseFtAgl: 3500,
			meanCloudTopFtAgl: 8000,
		},
		{
			// Maritime warm-sector air ahead of the front (east of the front
			// polyline). Required for rule 1 (front-crossing) -- the rule needs
			// a warm-sector air mass to describe what was there before passage.
			id: 'AM-prefrontal-mT',
			classification: 'mT',
			polygon: [
				[-78.5, 38],
				[-70, 38],
				[-70, 46],
				[-78.5, 46],
				[-78.5, 38],
			],
			surfaceTempC: 6,
			surfaceDewpointC: 4,
			stability: 'conditionally-unstable',
			surfaceWindDirDeg: 200,
			surfaceWindKt: 14,
			meanCloudCover: 'OVC',
			meanCloudBaseFtAgl: 2500,
			meanCloudTopFtAgl: 12000,
		},
	],

	upperLevel: {
		// NW flow aloft behind the trough; jet axis through the central Great
		// Lakes at ~45kt -- below the 80-kt jet-exit commentary threshold so
		// rule 9 stays quiet on this scenario.
		jetAxis: [
			[-95, 45],
			[-85, 44],
			[-75, 43],
		],
		jetMaxKt: 45,
		windByAltitude: [
			{ altitudeFt: 3000, meanDirDeg: 310, meanSpeedKt: 18, meanTempC: -10 },
			{ altitudeFt: 6000, meanDirDeg: 320, meanSpeedKt: 25, meanTempC: -16 },
			{ altitudeFt: 9000, meanDirDeg: 320, meanSpeedKt: 30, meanTempC: -22 },
			{ altitudeFt: 12000, meanDirDeg: 320, meanSpeedKt: 35, meanTempC: -28 },
			{ altitudeFt: 18000, meanDirDeg: 320, meanSpeedKt: 40, meanTempC: -38 },
			{ altitudeFt: 24000, meanDirDeg: 320, meanSpeedKt: 45, meanTempC: -50 },
			{ altitudeFt: 30000, meanDirDeg: 320, meanSpeedKt: 45, meanTempC: -58 },
			{ altitudeFt: 34000, meanDirDeg: 320, meanSpeedKt: 42, meanTempC: -60 },
		],
	},

	convection: {
		// No deep convection in this regime; stratus + freezing precip only.
		cells: [],
		frontalBand: null,
		capeJperKgByStation: {
			KCLE: 0,
			KORD: 0,
			KDTW: 0,
			KGRR: 0,
			KCAK: 0,
		},
	},

	diurnal: {
		// EST solar noon = 17Z.
		solarNoonUtcHour: 17,
		mixingHeightFtMsl: 3500,
		nocturnalInversion: false,
	},

	hazardZones: [
		{
			// Zulu: lake-effect icing band downwind of Lake Erie. Moderate rime
			// in the saturated stratus deck. Polygon covers KCLE + KCAK.
			id: 'HZ-lake-effect-zulu',
			kind: 'icing',
			polygon: [
				[-82.5, 40.3],
				[-80.8, 40.3],
				[-80.8, 42],
				[-82.5, 42],
				[-82.5, 40.3],
			],
			altitudeBandFtMsl: { min: 0, max: 8000 },
			source: 'Lake-effect band downwind of Lake Erie: cP air saturates over the still-warm lake; moderate rime in the freezing-drizzle column',
			severity: 'moderate',
		},
		{
			// Sierra: IFR ceiling within the lake-effect band. Ceiling 500ft;
			// polygon covers KCLE + KCAK at surface.
			id: 'HZ-lake-effect-sierra',
			kind: 'ifr',
			polygon: [
				[-82.5, 40.3],
				[-80.8, 40.3],
				[-80.8, 42],
				[-82.5, 42],
				[-82.5, 40.3],
			],
			altitudeBandFtMsl: { min: 0, max: 1500 },
			source: 'IFR ceiling and visibility in the lake-effect band -- BKN/OVC stratus with embedded freezing drizzle keeps ceilings near 500 ft AGL',
			severity: 'moderate',
		},
		{
			// Tango: low-level turbulence behind the cold front across the Great
			// Lakes basin. Covers all five route stations.
			id: 'HZ-postfrontal-tango',
			kind: 'turbulence',
			polygon: [
				[-90, 39],
				[-80, 39],
				[-80, 44],
				[-90, 44],
				[-90, 39],
			],
			altitudeBandFtMsl: { min: 0, max: 8000 },
			source: 'Low-level mechanical turbulence in the cold-advection boundary layer behind F-trailing-cold',
			severity: 'moderate',
		},
		{
			// Zulu: lighter cloud icing east of the lake-effect band at mid
			// levels. Light severity -> emits an AIRMET but no PIREP, so total
			// PIREP count stays at three.
			id: 'HZ-east-of-band-zulu',
			kind: 'icing',
			polygon: [
				[-80.8, 40.3],
				[-79.5, 40.3],
				[-79.5, 42],
				[-80.8, 42],
				[-80.8, 40.3],
			],
			altitudeBandFtMsl: { min: 5000, max: 12000 },
			source: 'Light cloud icing east of the lake-effect band at mid levels in the cP cloud deck',
			severity: 'light',
		},
	],

	terrain: {
		ridges: [],
	},

	routeStations: ['KCLE', 'KORD', 'KDTW', 'KGRR', 'KCAK'],
	fbStations: ['KCLE', 'KORD', 'KDTW', 'KGRR', 'KCAK'],
	tafValidHours: 12,
};
