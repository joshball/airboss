/**
 * `dense-fog-radiation-central-valley` -- nocturnal radiation fog over the
 * California Central Valley.
 *
 * Pedagogical archetype: clear skies + calm winds + saturated boundary
 * layer collapse the surface inversion overnight; LIFR floods the valley
 * floor (KFAT / KSCK / KMOD / KMER) with visibilities under 1/2 SM and
 * ceilings under 300 ft. KPRB sits west of the Coast Range and stays
 * clear. The diurnal cycle is the named mechanism: nocturnal inversion is
 * true; surface heating after solar noon (20Z) burns the inversion off
 * and lifts the LIFR to VFR. A weak departing cold front lingers east of
 * the divide so the front-crossing commentary rule has a synoptic anchor.
 *
 * Counts (per spec): 5 METARs / 5 TAFs / 2 AIRMETs / 1 FB / 2 PIREPs;
 * 17 chart artifacts; ~11 Socratic callouts.
 *
 * Severity discipline: the LIFR Sierra is `severe` (drives visibility to
 * 1/2 SM under 1 SM per the patched METAR rule and emits the first
 * hazard PIREP); the Coast Range obscuration is `moderate` (emits the
 * second). Front intensity is `weak` so the METAR gust math stays quiet.
 */

import type { TruthModel } from '../types';

export const DENSE_FOG_RADIATION_CENTRAL_VALLEY: TruthModel = {
	scenarioId: 'dense-fog-radiation-central-valley',
	// Predawn February morning, 10Z = 02:00 local PST. Trough of the
	// nocturnal-radiation cycle.
	validAt: '2026-02-08T10:00:00Z',
	primaryTimeZone: 'America/Los_Angeles',
	narrative:
		'Nocturnal radiation fog over the California Central Valley. Weak ridge overhead with calm winds; clear overnight skies have collapsed the surface inversion; saturated boundary layer fog has flooded the valley floor with visibility under 1/2 SM at KFAT / KSCK / KMOD / KMER. KPRB sits west of the Coast Range and stays clear. The diurnal cycle drives the lifecycle: the LIFR layer burns off in the 4 hours after solar noon (20Z) as surface heating lifts the mixing height through the inversion.',

	stations: {
		KFAT: { icao: 'KFAT', lon: -119.72, lat: 36.78, elevationFt: 336, name: 'Fresno Yosemite' },
		KSCK: { icao: 'KSCK', lon: -121.24, lat: 37.89, elevationFt: 33, name: 'Stockton' },
		KMOD: { icao: 'KMOD', lon: -120.95, lat: 37.63, elevationFt: 97, name: 'Modesto City-County' },
		KMER: { icao: 'KMER', lon: -120.51, lat: 37.29, elevationFt: 155, name: 'Merced Regional' },
		KPRB: { icao: 'KPRB', lon: -120.63, lat: 35.67, elevationFt: 840, name: 'Paso Robles' },
	},

	synoptic: {
		pressureSystems: [
			{
				id: 'H-ridge-overhead',
				kind: 'H',
				lon: -120,
				lat: 37,
				centralPressureMb: 1020,
				motionDegTrue: 0,
				motionKt: 0,
			},
			{
				id: 'L-departing-east',
				kind: 'L',
				lon: -110,
				lat: 38,
				centralPressureMb: 1014,
				motionDegTrue: 90,
				motionKt: 10,
			},
		],
		fronts: [
			{
				// Weak departing cold front -- already east of the Sierras at the
				// scenario's analysis time. Intensity 'weak' so METAR gust math
				// stays quiet. Stations west of -118 are all on the opposite
				// (cold) side, which lets rule 1 (front-crossing) reference
				// this front for the cP/mT contrast.
				id: 'F-departing-weak-cold',
				kind: 'cold',
				points: [
					[-117.5, 40],
					[-117.5, 38],
					[-117.5, 36],
					[-117.5, 34],
				],
				pipSide: 'E',
				motionDegTrue: 90,
				motionKt: 8,
				intensity: 'weak',
			},
		],
	},

	airMasses: [
		{
			// cP under the inversion. Calm, cool, saturated. Covers all five
			// route stations including KPRB. The LIFR + obscuration hazard
			// polygons sub-set this mass for the specific affected zones.
			id: 'AM-valley-inversion-cP',
			classification: 'cP',
			polygon: [
				[-123, 34],
				[-117.5, 34],
				[-117.5, 41],
				[-123, 41],
				[-123, 34],
			],
			surfaceTempC: 4,
			surfaceDewpointC: 4,
			stability: 'stable',
			surfaceWindDirDeg: 0,
			surfaceWindKt: 2,
			meanCloudCover: 'SKC',
			meanCloudBaseFtAgl: null,
			meanCloudTopFtAgl: null,
		},
		{
			// Warm sector mT east of the departing weak cold front. Far east
			// of every route station -- no station lives inside this polygon.
			// Present so commentary rule 1 has a warmSector reference to cite
			// when describing what the cold sector replaced.
			id: 'AM-departing-warm-mT',
			classification: 'mT',
			polygon: [
				[-117.5, 34],
				[-110, 34],
				[-110, 41],
				[-117.5, 41],
				[-117.5, 34],
			],
			surfaceTempC: 15,
			surfaceDewpointC: -5,
			stability: 'stable',
			surfaceWindDirDeg: 320,
			surfaceWindKt: 5,
			meanCloudCover: 'SKC',
			meanCloudBaseFtAgl: null,
			meanCloudTopFtAgl: null,
		},
	],

	upperLevel: {
		// Light westerly flow above the inversion -- the upper-level mass is
		// warm and dry. No jet maximum threshold breached.
		jetAxis: [
			[-128, 41],
			[-118, 40],
			[-108, 39],
		],
		jetMaxKt: 20,
		windByAltitude: [
			{ altitudeFt: 3000, meanDirDeg: 320, meanSpeedKt: 5, meanTempC: 8 },
			{ altitudeFt: 6000, meanDirDeg: 320, meanSpeedKt: 8, meanTempC: 4 },
			{ altitudeFt: 9000, meanDirDeg: 310, meanSpeedKt: 12, meanTempC: -2 },
			{ altitudeFt: 12000, meanDirDeg: 300, meanSpeedKt: 15, meanTempC: -8 },
			{ altitudeFt: 18000, meanDirDeg: 290, meanSpeedKt: 18, meanTempC: -22 },
			{ altitudeFt: 24000, meanDirDeg: 280, meanSpeedKt: 20, meanTempC: -36 },
			{ altitudeFt: 30000, meanDirDeg: 270, meanSpeedKt: 20, meanTempC: -48 },
			{ altitudeFt: 34000, meanDirDeg: 270, meanSpeedKt: 18, meanTempC: -54 },
		],
	},

	convection: {
		cells: [],
		frontalBand: null,
		capeJperKgByStation: {
			KFAT: 0,
			KSCK: 0,
			KMOD: 0,
			KMER: 0,
			KPRB: 0,
		},
	},

	diurnal: {
		// PST solar noon ~12 local = 20Z. Nocturnal inversion is the named
		// pedagogical anchor for rule 10.
		solarNoonUtcHour: 20,
		mixingHeightFtMsl: 200,
		nocturnalInversion: true,
	},

	hazardZones: [
		{
			// Sierra LIFR over the valley floor: severe so the patched METAR
			// rule drives visibility to 1/2 SM and emits FG. Polygon covers
			// KFAT + KSCK + KMOD + KMER but stops west of KPRB (lon -120.63;
			// the polygon's west edge is at -121.5 so KPRB falls outside).
			id: 'HZ-valley-floor-lifr',
			kind: 'ifr',
			polygon: [
				[-121.5, 36.7],
				[-119.5, 36.7],
				[-119.5, 38.2],
				[-121.5, 38.2],
				[-121.5, 36.7],
			],
			altitudeBandFtMsl: { min: 0, max: 300 },
			source:
				'Dense radiation fog under the nocturnal surface inversion -- saturated boundary layer collapses to visibility under 1/2 SM until the post-noon mixing-height rise lifts the trapped layer',
			severity: 'severe',
		},
		{
			// Sierra mountain obscuration along the Coast Range. Polygon at
			// lon -120.9 to -120.7 sits west of the valley-floor polygon and
			// east of KPRB -- it does not contain KPRB at the surface but
			// caps the Coast Range crests.
			id: 'HZ-coast-range-obscuration',
			kind: 'mountain-obscuration',
			polygon: [
				[-120.9, 35.4],
				[-120.7, 35.4],
				[-120.7, 36.9],
				[-120.9, 36.9],
				[-120.9, 35.4],
			],
			altitudeBandFtMsl: { min: 0, max: 4000 },
			source:
				'Mountain obscuration along the Coast Range west of the Central Valley -- fog top abuts the ridge line; the upwind side stays in stratus',
			severity: 'moderate',
		},
	],

	terrain: {
		ridges: [
			{
				id: 'R-coast-range',
				polyline: [
					[-120.8, 35.4],
					[-120.8, 37.5],
				],
				peakElevationFt: 3400,
			},
		],
	},

	routeStations: ['KFAT', 'KSCK', 'KMOD', 'KMER', 'KPRB'],
	fbStations: ['KFAT', 'KSCK', 'KMOD', 'KMER', 'KPRB'],
	tafValidHours: 12,
};
