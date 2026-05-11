/**
 * `summer-thunderstorms-tx` -- pop-up afternoon convection along the Texas
 * Gulf Coast.
 *
 * Pedagogical archetype: CAPE-driven afternoon convection along an outflow
 * boundary. mT air mass inland with very high CAPE; a weakening ridge aloft
 * provides minimal capping; a stationary outflow boundary along the
 * upper-coastal plain triggers four mature cells. Cooler maritime air sits
 * just offshore. Validation time is mid-afternoon (21Z = 16 local CDT).
 *
 * Counts (per spec): 5 METARs / 5 TAFs / 4 AIRMETs / 1 FB / 4 PIREPs;
 * 17 chart artifacts; ~11 Socratic callouts (well inside the [8, 15] band).
 *
 * Severity discipline: every hazard zone is `light` so the four convective
 * cells alone drive the PIREP count to four. AIRMET commentary fires for
 * every hazard regardless of severity.
 */

import type { TruthModel } from '../types';

export const SUMMER_THUNDERSTORMS_TX: TruthModel = {
	scenarioId: 'summer-thunderstorms-tx',
	// July afternoon, 21Z = 16:00 local CDT -- afternoon convective peak.
	validAt: '2026-07-15T21:00:00Z',
	primaryTimeZone: 'America/Chicago',
	narrative:
		'Pop-up afternoon convection along the Texas Gulf Coast. Weak surface ridge over central Texas overhead with a weak trough offshore. mT inland air mass carries very high CAPE; an outflow boundary along the upper coastal plain triggers four mature cells along the KAUS-KIAH corridor. Cooler maritime air offshore stays capped.',

	stations: {
		KAUS: { icao: 'KAUS', lon: -97.67, lat: 30.19, elevationFt: 542, name: 'Austin-Bergstrom' },
		KIAH: { icao: 'KIAH', lon: -95.34, lat: 29.99, elevationFt: 97, name: 'Houston Bush Intercontinental' },
		KSAT: { icao: 'KSAT', lon: -98.47, lat: 29.53, elevationFt: 809, name: 'San Antonio' },
		KCLL: { icao: 'KCLL', lon: -96.36, lat: 30.59, elevationFt: 320, name: 'College Station Easterwood' },
		KCRP: { icao: 'KCRP', lon: -97.5, lat: 27.77, elevationFt: 44, name: 'Corpus Christi' },
	},

	synoptic: {
		pressureSystems: [
			{
				id: 'H-tx-ridge',
				kind: 'H',
				lon: -99,
				lat: 30.5,
				centralPressureMb: 1018,
				motionDegTrue: 0,
				motionKt: 0,
			},
			{
				id: 'L-gulf-trough',
				kind: 'L',
				lon: -94,
				lat: 27,
				centralPressureMb: 1010,
				motionDegTrue: 270,
				motionKt: 5,
			},
		],
		fronts: [
			{
				// Stationary outflow boundary along the upper coastal plain. The
				// boundary triggers the cells but isn't a cold-front gust producer
				// (gust math gates on `kind === 'cold'`).
				id: 'F-outflow-coastal',
				kind: 'stationary',
				points: [
					[-99, 29.5],
					[-97.5, 29.6],
					[-96, 29.7],
					[-94.5, 29.8],
				],
				pipSide: 'N',
				motionDegTrue: 135,
				motionKt: 10,
				intensity: 'weak',
			},
		],
	},

	airMasses: [
		{
			// mT inland: hot, humid, conditionally unstable. Covers KAUS / KIAH /
			// KSAT / KCLL up through the upper coast.
			id: 'AM-inland-mT',
			classification: 'mT',
			polygon: [
				[-101, 28.8],
				[-93, 28.8],
				[-93, 33],
				[-101, 33],
				[-101, 28.8],
			],
			surfaceTempC: 35,
			surfaceDewpointC: 24,
			stability: 'conditionally-unstable',
			surfaceWindDirDeg: 130,
			surfaceWindKt: 10,
			meanCloudCover: 'SCT',
			meanCloudBaseFtAgl: 4500,
			meanCloudTopFtAgl: 12000,
		},
		{
			// Cooler maritime air over the coastal margin including KCRP. mP
			// classification is the closest approximation in the schema (no mT-
			// stable family). Stable, weak south flow.
			id: 'AM-coastal-mP',
			classification: 'mP',
			polygon: [
				[-101, 26],
				[-93, 26],
				[-93, 28.8],
				[-101, 28.8],
				[-101, 26],
			],
			surfaceTempC: 28,
			surfaceDewpointC: 23,
			stability: 'stable',
			surfaceWindDirDeg: 150,
			surfaceWindKt: 8,
			meanCloudCover: 'FEW',
			meanCloudBaseFtAgl: 2500,
			meanCloudTopFtAgl: 6000,
		},
	],

	upperLevel: {
		// Weak summer upper flow; the ridge aloft over central Texas keeps winds
		// modest. Jet axis well north -- through the central Plains.
		jetAxis: [
			[-110, 38],
			[-100, 40],
			[-90, 41],
		],
		jetMaxKt: 25,
		windByAltitude: [
			{ altitudeFt: 3000, meanDirDeg: 150, meanSpeedKt: 8, meanTempC: 27 },
			{ altitudeFt: 6000, meanDirDeg: 160, meanSpeedKt: 10, meanTempC: 22 },
			{ altitudeFt: 9000, meanDirDeg: 170, meanSpeedKt: 12, meanTempC: 14 },
			{ altitudeFt: 12000, meanDirDeg: 180, meanSpeedKt: 15, meanTempC: 8 },
			{ altitudeFt: 18000, meanDirDeg: 220, meanSpeedKt: 18, meanTempC: -8 },
			{ altitudeFt: 24000, meanDirDeg: 240, meanSpeedKt: 22, meanTempC: -22 },
			{ altitudeFt: 30000, meanDirDeg: 250, meanSpeedKt: 25, meanTempC: -38 },
			{ altitudeFt: 34000, meanDirDeg: 260, meanSpeedKt: 22, meanTempC: -47 },
		],
	},

	convection: {
		// Four mature cells along/just south of the outflow boundary in the
		// KAUS-KIAH corridor. Motion 135 at 10 kt mirrors the boundary push.
		cells: [
			{ id: 'C-aus-east', lon: -97.3, lat: 30.1, radiusKm: 18, peakDbz: 55 },
			{ id: 'C-corridor-mid', lon: -96.5, lat: 30.05, radiusKm: 20, peakDbz: 55 },
			{ id: 'C-cll-near', lon: -96.3, lat: 30.45, radiusKm: 16, peakDbz: 50 },
			{ id: 'C-iah-south', lon: -95.4, lat: 29.8, radiusKm: 18, peakDbz: 55 },
		],
		frontalBand: null,
		capeJperKgByStation: {
			KAUS: 3500,
			KIAH: 3800,
			KSAT: 3000,
			KCLL: 3200,
			KCRP: 2200,
		},
	},

	diurnal: {
		// July CDT solar noon ~12:30 local = ~17:30 UTC. Mid-afternoon mixing.
		solarNoonUtcHour: 17,
		mixingHeightFtMsl: 8000,
		nocturnalInversion: false,
	},

	hazardZones: [
		{
			// Tango: convective turbulence under cells along the corridor.
			id: 'HZ-corridor-tango-low',
			kind: 'turbulence',
			polygon: [
				[-98, 29.5],
				[-94.5, 29.5],
				[-94.5, 30.8],
				[-98, 30.8],
				[-98, 29.5],
			],
			altitudeBandFtMsl: { min: 0, max: 15000 },
			source: 'Convective turbulence column under thunderstorm cells along the upper coastal plain outflow boundary',
			severity: 'light',
		},
		{
			// Tango: low-level boundary turbulence along the outflow boundary.
			id: 'HZ-outflow-tango',
			kind: 'turbulence',
			polygon: [
				[-99, 29.3],
				[-94.5, 29.3],
				[-94.5, 30],
				[-99, 30],
				[-99, 29.3],
			],
			altitudeBandFtMsl: { min: 0, max: 6000 },
			source: 'Low-level mechanical turbulence along the stationary outflow boundary that anchors the cell line',
			severity: 'light',
		},
		{
			// Zulu: icing aloft above the freezing level inside cell anvils.
			id: 'HZ-anvil-zulu',
			kind: 'icing',
			polygon: [
				[-98, 29.6],
				[-94.5, 29.6],
				[-94.5, 30.7],
				[-98, 30.7],
				[-98, 29.6],
			],
			altitudeBandFtMsl: { min: 12000, max: 25000 },
			source: 'Supercooled liquid water in the rising anvil tops above the convective freezing level',
			severity: 'light',
		},
		{
			// Sierra: LIFR pocket under the heaviest cells where heavy rain
			// crashes the visibility and the cloud base sags to <500ft.
			id: 'HZ-cell-sierra',
			kind: 'ifr',
			polygon: [
				[-97.5, 29.9],
				[-95.2, 29.9],
				[-95.2, 30.35],
				[-97.5, 30.35],
				[-97.5, 29.9],
			],
			altitudeBandFtMsl: { min: 0, max: 3000 },
			source: 'LIFR pocket directly under the heaviest precipitating cells -- heavy rain blocks the visibility',
			severity: 'light',
		},
	],

	terrain: {
		ridges: [],
	},

	routeStations: ['KAUS', 'KIAH', 'KSAT', 'KCLL', 'KCRP'],
	fbStations: ['KAUS', 'KIAH', 'KSAT', 'KCLL', 'KCRP'],
	tafValidHours: 12,
};
