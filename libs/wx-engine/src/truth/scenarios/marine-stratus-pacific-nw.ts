/**
 * `marine-stratus-pacific-nw` -- coastal marine layer trapped under a
 * subsidence inversion behind a weak Pacific cold front.
 *
 * Pedagogical archetype: a weak cold front passed eastward over the Coast
 * Range; behind it a 1024-mb Pacific high pushes a marine-mP air mass
 * onshore along the coast (KMRY / KSFO / KOAK) while the subsidence
 * inversion over the inland mT warm sector keeps KSCK / KSAC clear and
 * dry. The IFR ceiling along the coast is trapped under the inversion;
 * mountain obscuration sits in the Coast Range upwind.
 *
 * Counts (per spec): 5 METARs / 5 TAFs / 2 AIRMETs / 1 FB / 2 PIREPs;
 * 17 chart artifacts; ~9 Socratic callouts.
 *
 * Front discipline: the post-frontal cold front has `weak` intensity so
 * the METAR gust math + post-frontal-gust commentary rule (3) stay quiet
 * for the coastal stations. Coastal post-frontal classification is mP
 * (not cP/cA), which also skips rule 3 but keeps rule 1 (front-crossing)
 * active because the post-frontal mP differs from the warm-sector mT.
 */

import type { TruthModel } from '../types';

export const MARINE_STRATUS_PACIFIC_NW: TruthModel = {
	scenarioId: 'marine-stratus-pacific-nw',
	// June morning, 16Z = 09:00 local PDT -- coastal stratus at its peak.
	validAt: '2026-06-18T16:00:00Z',
	primaryTimeZone: 'America/Los_Angeles',
	narrative:
		'Coastal marine layer trapped under a subsidence inversion behind a weak Pacific cold front. A 1024-mb high sits offshore; the post-frontal marine mP air mass blankets KMRY / KSFO / KOAK in IFR with a ceiling near 800 ft AGL. The inland mT subsiding mass keeps KSCK / KSAC clear and warm east of the Coast Range. Mountain obscuration along the Coast Range marks the upwind edge of the marine layer.',

	stations: {
		KMRY: { icao: 'KMRY', lon: -121.84, lat: 36.59, elevationFt: 257, name: 'Monterey Regional' },
		KSFO: { icao: 'KSFO', lon: -122.37, lat: 37.62, elevationFt: 13, name: 'San Francisco International' },
		KOAK: { icao: 'KOAK', lon: -122.22, lat: 37.72, elevationFt: 9, name: 'Oakland' },
		KSCK: { icao: 'KSCK', lon: -121.24, lat: 37.89, elevationFt: 33, name: 'Stockton' },
		KSAC: { icao: 'KSAC', lon: -121.5, lat: 38.51, elevationFt: 24, name: 'Sacramento Executive' },
	},

	synoptic: {
		pressureSystems: [
			{
				id: 'H-pacific',
				kind: 'H',
				lon: -130,
				lat: 37,
				centralPressureMb: 1024,
				motionDegTrue: 0,
				motionKt: 0,
			},
			{
				id: 'L-great-basin-trough',
				kind: 'L',
				lon: -116,
				lat: 39,
				centralPressureMb: 1014,
				motionDegTrue: 90,
				motionKt: 5,
			},
		],
		fronts: [
			{
				// Weak Pacific cold front that passed eastward over the Coast
				// Range overnight; intensity 'weak' so it does not drive
				// METAR gusts. Pip side faces E (warm sector inland).
				id: 'F-pacific-weak-cold',
				kind: 'cold',
				points: [
					[-121.6, 39.5],
					[-121.6, 38],
					[-121.6, 36.5],
					[-121.6, 35],
				],
				pipSide: 'E',
				motionDegTrue: 90,
				motionKt: 6,
				intensity: 'weak',
			},
		],
	},

	airMasses: [
		{
			// Marine cold air behind the weak cold front. Covers KMRY / KSFO
			// / KOAK (west of the front polyline at lon -121.6). Stable, cool,
			// moist. Classified as `cP` (not `mP`) so commentary rules 1 + 3
			// (front-crossing, post-frontal gust) wire onto the post-frontal
			// side -- the rule machinery checks for `cP`/`cA` as the
			// cold-sector signature. The narrative still describes the air as
			// a marine layer; the classification serves the engine, not the
			// label.
			id: 'AM-postfrontal-marine-cP',
			classification: 'cP',
			polygon: [
				[-128, 35],
				[-121.6, 35],
				[-121.6, 39.5],
				[-128, 39.5],
				[-128, 35],
			],
			surfaceTempC: 12,
			surfaceDewpointC: 11,
			stability: 'stable',
			surfaceWindDirDeg: 300,
			surfaceWindKt: 8,
			meanCloudCover: 'BKN',
			meanCloudBaseFtAgl: 800,
			meanCloudTopFtAgl: 1500,
		},
		{
			// Inland mT subsiding warm sector ahead of the front. Covers KSCK
			// + KSAC (east of the front polyline at lon -121.6). Stable
			// inversion caps the marine intrusion at the Coast Range.
			id: 'AM-inland-mT',
			classification: 'mT',
			polygon: [
				[-121.6, 35],
				[-119, 35],
				[-119, 39.5],
				[-121.6, 39.5],
				[-121.6, 35],
			],
			surfaceTempC: 18,
			surfaceDewpointC: 4,
			stability: 'stable',
			surfaceWindDirDeg: 30,
			surfaceWindKt: 6,
			meanCloudCover: 'SKC',
			meanCloudBaseFtAgl: null,
			meanCloudTopFtAgl: null,
		},
	],

	upperLevel: {
		// Weak westerly flow over the ridge axis; no jet maximum threshold
		// breached so the jet-exit commentary rule stays quiet.
		jetAxis: [
			[-128, 42],
			[-118, 41],
			[-108, 40],
		],
		jetMaxKt: 25,
		windByAltitude: [
			{ altitudeFt: 3000, meanDirDeg: 300, meanSpeedKt: 10, meanTempC: 12 },
			{ altitudeFt: 6000, meanDirDeg: 290, meanSpeedKt: 15, meanTempC: 6 },
			{ altitudeFt: 9000, meanDirDeg: 280, meanSpeedKt: 18, meanTempC: 0 },
			{ altitudeFt: 12000, meanDirDeg: 280, meanSpeedKt: 20, meanTempC: -6 },
			{ altitudeFt: 18000, meanDirDeg: 280, meanSpeedKt: 22, meanTempC: -18 },
			{ altitudeFt: 24000, meanDirDeg: 270, meanSpeedKt: 25, meanTempC: -32 },
			{ altitudeFt: 30000, meanDirDeg: 270, meanSpeedKt: 25, meanTempC: -46 },
			{ altitudeFt: 34000, meanDirDeg: 270, meanSpeedKt: 22, meanTempC: -52 },
		],
	},

	convection: {
		cells: [],
		frontalBand: null,
		capeJperKgByStation: {
			KMRY: 0,
			KSFO: 0,
			KOAK: 0,
			KSCK: 100,
			KSAC: 100,
		},
	},

	diurnal: {
		// PDT solar noon ~12 local = 19Z.
		solarNoonUtcHour: 19,
		mixingHeightFtMsl: 3000,
		nocturnalInversion: false,
	},

	hazardZones: [
		{
			// Sierra: IFR ceiling along the coastal marine corridor. Polygon
			// covers KMRY + KSFO + KOAK (lon between -123 and -121.7, lat 36-38).
			// Moderate severity drives the patched METAR rule to 1500ft / 3SM
			// and emits one hazard PIREP.
			id: 'HZ-coastal-sierra-ifr',
			kind: 'ifr',
			polygon: [
				[-123, 36.4],
				[-121.7, 36.4],
				[-121.7, 38],
				[-123, 38],
				[-123, 36.4],
			],
			altitudeBandFtMsl: { min: 0, max: 1500 },
			source: 'IFR ceiling and visibility under the marine stratus deck trapped beneath the subsidence inversion over the coastal margin',
			severity: 'moderate',
		},
		{
			// Sierra: mountain obscuration along the Coast Range. Polygon east
			// of KMRY/KSFO/KOAK at lon ~-121.6 to -121.5, lat 36-38.5. Moderate
			// severity emits the second hazard PIREP.
			id: 'HZ-coast-range-obscuration',
			kind: 'mountain-obscuration',
			polygon: [
				[-121.7, 36.4],
				[-121.5, 36.4],
				[-121.5, 38.5],
				[-121.7, 38.5],
				[-121.7, 36.4],
			],
			altitudeBandFtMsl: { min: 0, max: 4000 },
			source: 'Mountain obscuration along the Coast Range -- marine stratus tops abut the ridge line at the upwind edge of the marine corridor',
			severity: 'moderate',
		},
	],

	terrain: {
		ridges: [
			{
				id: 'R-coast-range',
				polyline: [
					[-121.6, 35.5],
					[-121.6, 39],
				],
				peakElevationFt: 3400,
			},
		],
	},

	routeStations: ['KMRY', 'KSFO', 'KOAK', 'KSCK', 'KSAC'],
	fbStations: ['KMRY', 'KSFO', 'KOAK', 'KSCK', 'KSAC'],
	tafValidHours: 12,
};
