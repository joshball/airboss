/**
 * `frontal-xc-march` -- the Phase A spike-lift scenario.
 *
 * Hand-coded layer-1 truth state lifted from the spike's pre-retirement
 * `spikes/wx-engine/src/truth/scenarios/frontal-xc-march.ts` (PR #801 -- now
 * retired). The literal below is the exact truth state that produced the
 * spike's 5 METARs, 5 TAFs, 3 AIRMETs, 1 FB grid, 3 PIREPs, 11 chart specs,
 * and 10 Socratic callouts -- all mutually consistent and round-tripping
 * cleanly through the wx-charts parsers. See
 * `spikes/wx-engine/01-frontal-xc/spike-notes.md` for the verdict.
 *
 * Spike-bug fix: the spike authored motionDegTrue as 070 / 060 (leading-zero
 * numeric literals); Bun's parser interpreted those as octal 56 / 48 even
 * though the author's comments ('moving ENE' = ~70 deg) made decimal intent
 * clear. TypeScript's strict mode rejects 070 outright (TS1121), so this
 * lift uses the corrected decimal values 70 / 60.
 *
 * Scenario: winter frontal passage during a midwest XC, KSTL -> KORD,
 * March afternoon. Synoptic-scale low pressure system over the Upper
 * Midwest with a cold front trailing south-southeast. Pre-frontal warm
 * sector covers KSTL/KCPS and the lower portion of the route. Front
 * is at roughly 39N 89W (between KSPI and KCPS) at 14:00 local. Post-
 * frontal cold sector behind the front -- KMLI is deep in it; KSPI
 * just passed; KORD will see the front in 2-4 hours.
 *
 * Locations and physics are hand-tuned to be internally consistent. The
 * Zod schema (`./truth/schema.ts`) is the gate: this literal must validate
 * cleanly via `loadScenario('frontal-xc-march')`.
 *
 * See:
 *   - `docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md`
 *     for the truth-model schema rationale
 *   - `spikes/wx-engine/01-frontal-xc/spike-notes.md` for the spike verdict
 */

import type { TruthModel } from '../types';

export const FRONTAL_XC_MARCH: TruthModel = {
	scenarioId: 'frontal-xc-march',
	// March afternoon, 14:00 local CDT = 19:00 UTC.
	validAt: '2026-03-19T19:00:00Z',
	primaryTimeZone: 'America/Chicago',
	narrative:
		'Winter frontal passage during a midwest XC, KSTL -> KORD. Synoptic-scale low over the Upper Midwest with a cold front trailing SSE. Pre-frontal warm sector ahead of the front (KSTL/KCPS); post-frontal cold sector behind it (KSPI/KMLI). KORD ahead of the front, will see passage 2-4 hours later.',

	stations: {
		KSTL: { icao: 'KSTL', lon: -90.37, lat: 38.75, elevationFt: 605, name: 'St. Louis Lambert' },
		KCPS: { icao: 'KCPS', lon: -90.16, lat: 38.57, elevationFt: 413, name: 'St. Louis Downtown (Cahokia)' },
		KSPI: { icao: 'KSPI', lon: -89.68, lat: 39.84, elevationFt: 597, name: 'Springfield Capital' },
		KMLI: { icao: 'KMLI', lon: -90.51, lat: 41.45, elevationFt: 590, name: 'Quad Cities (Moline)' },
		KORD: { icao: 'KORD', lon: -87.91, lat: 41.98, elevationFt: 672, name: "Chicago O'Hare" },
		// Reference stations for the FB grid + chart context (not on route, but in region).
		KMSP: { icao: 'KMSP', lon: -93.22, lat: 44.88, elevationFt: 841, name: 'Minneapolis-St. Paul' },
		KDSM: { icao: 'KDSM', lon: -93.65, lat: 41.53, elevationFt: 958, name: 'Des Moines' },
		KIND: { icao: 'KIND', lon: -86.29, lat: 39.72, elevationFt: 797, name: 'Indianapolis' },
	},

	synoptic: {
		pressureSystems: [
			{
				id: 'L-upper-midwest',
				kind: 'L',
				lon: -91,
				lat: 44,
				centralPressureMb: 996,
				motionDegTrue: 70, // moving ENE
				motionKt: 25,
			},
			{
				id: 'H-southeast',
				kind: 'H',
				lon: -82,
				lat: 32,
				centralPressureMb: 1023,
				motionDegTrue: 70,
				motionKt: 12,
			},
			{
				id: 'H-rockies',
				kind: 'H',
				lon: -109,
				lat: 41,
				centralPressureMb: 1028,
				motionDegTrue: 90, // pushing east
				motionKt: 18,
			},
		],
		fronts: [
			{
				// Cold front sliding ESE. At 19Z the front has progressed at an
				// angle: the northern segment is well east (already through KMLI
				// and KSPI), the southern segment is still west of KSTL/KCPS.
				// This is the typical "front sweeps S/SE" shape -- north passes
				// first, south follows.
				//   - lat 44 (low): -88 (well east of KMSP)
				//   - lat 41.5 (KMLI/KORD lat): -89.0 (east of KMLI, west of KORD)
				//   - lat 39.8 (KSPI lat): -89.4 (slightly west of KSPI, post-frontal)
				//   - lat 38.7 (KSTL/KCPS): -90.6 (west of both, both pre-frontal)
				//   - lat 35: -92
				//   - lat 33: -93
				id: 'F-cold-main',
				kind: 'cold',
				points: [
					[-88, 44],
					[-88.5, 42.5],
					[-89.0, 41.5],
					[-89.4, 39.8],
					[-90.8, 38.5],
					[-92, 35],
					[-93, 33],
				],
				pipSide: 'E', // cold side is W; pips face the warm sector (E)
				motionDegTrue: 110, // moving ESE at 25 kt
				motionKt: 25,
				intensity: 'strong',
			},
			{
				// Warm front extending east of the low.
				id: 'F-warm-east',
				kind: 'warm',
				points: [
					[-88, 44],
					[-83, 44.5],
					[-78, 44],
				],
				pipSide: 'N',
				motionDegTrue: 60,
				motionKt: 15,
				intensity: 'moderate',
			},
		],
	},

	airMasses: [
		{
			// Pre-frontal warm sector: mT (maritime tropical, modified). Covers
			// KSTL, KCPS (south of front), KORD (east of front), KIND, southeast.
			// Polygon traces the eastern (warm) side of the cold front + a wide
			// southeast envelope.
			id: 'AM-warm-sector',
			classification: 'mT',
			polygon: [
				// Trace east side of the cold front, from south to north
				[-93, 33],
				[-92, 35],
				[-90.8, 38.5],
				[-89.4, 39.8],
				[-89.0, 41.5],
				[-88.5, 42.5],
				[-88, 44],
				// Continue east along warm front to the east coast
				[-83, 44.5],
				[-78, 44],
				// Down the east side
				[-78, 30],
				[-93, 30],
				[-93, 33],
			],
			surfaceTempC: 17, // ~63 F
			surfaceDewpointC: 13, // ~55 F
			stability: 'conditionally-unstable',
			surfaceWindDirDeg: 200, // S/SSW pre-frontal
			surfaceWindKt: 14,
			meanCloudCover: 'BKN',
			meanCloudBaseFtAgl: 4500,
			meanCloudTopFtAgl: 12000,
		},
		{
			// Post-frontal cold sector: cP (continental polar). Covers KSPI,
			// KMLI, KDSM, KMSP, the upper Mississippi valley + Plains. Polygon
			// traces the western (cold) side of the cold front.
			id: 'AM-cold-sector',
			classification: 'cP',
			polygon: [
				// Trace west side of the cold front, from south to north
				[-93, 33],
				[-92, 35],
				[-90.8, 38.5],
				[-89.4, 39.8],
				[-89.0, 41.5],
				[-88.5, 42.5],
				[-88, 44],
				[-90, 47],
				// Across the top
				[-103, 48],
				// Down the west side
				[-103, 33],
				[-93, 33],
			],
			surfaceTempC: 4, // ~39 F (significant temp drop across front)
			surfaceDewpointC: -3, // ~27 F (dry post-frontal)
			stability: 'stable',
			surfaceWindDirDeg: 320, // NW post-frontal
			surfaceWindKt: 20,
			meanCloudCover: 'OVC',
			meanCloudBaseFtAgl: 2500, // post-frontal stratocumulus, lowered ceiling
			meanCloudTopFtAgl: 7000,
		},
	],

	upperLevel: {
		// Jet axis from the SW US through the upper Midwest, lifting NE behind the trough.
		jetAxis: [
			[-110, 36],
			[-100, 40],
			[-92, 44],
			[-82, 47],
		],
		jetMaxKt: 110,
		// Wind by altitude. Pre-frontal southerly veers to NW with height; post-trough
		// flow is increasingly NW behind the cold front. We use values broadly
		// consistent with the surface-to-39000 ft envelope for a March frontal day.
		windByAltitude: [
			{ altitudeFt: 3000, meanDirDeg: 220, meanSpeedKt: 22, meanTempC: 5 },
			{ altitudeFt: 6000, meanDirDeg: 240, meanSpeedKt: 30, meanTempC: 0 },
			{ altitudeFt: 9000, meanDirDeg: 260, meanSpeedKt: 38, meanTempC: -5 },
			{ altitudeFt: 12000, meanDirDeg: 270, meanSpeedKt: 45, meanTempC: -11 },
			{ altitudeFt: 18000, meanDirDeg: 280, meanSpeedKt: 60, meanTempC: -23 },
			{ altitudeFt: 24000, meanDirDeg: 285, meanSpeedKt: 80, meanTempC: -36 },
			{ altitudeFt: 30000, meanDirDeg: 290, meanSpeedKt: 95, meanTempC: -50 },
			{ altitudeFt: 34000, meanDirDeg: 295, meanSpeedKt: 105, meanTempC: -55 },
			{ altitudeFt: 39000, meanDirDeg: 300, meanSpeedKt: 95, meanTempC: -58 },
		],
	},

	convection: {
		// Pre-frontal warm-sector instability + frontal lifting -> isolated
		// scattered cells along the front and a band of frontal precipitation.
		// Cells are placed in the warm sector just east of the front line, where
		// pre-frontal lift triggers them.
		cells: [
			{ id: 'C-prefront-1', lon: -89.0, lat: 38.0, radiusKm: 25, peakDbz: 48 },
			{ id: 'C-prefront-2', lon: -88.5, lat: 36.0, radiusKm: 20, peakDbz: 42 },
		],
		frontalBand: {
			// A 60-km-wide rain band right along the cold front (matches the
			// front polyline exactly).
			axis: [
				[-89.0, 41.5],
				[-89.4, 39.8],
				[-90.8, 38.5],
				[-92, 35],
			],
			widthKm: 60,
			peakDbz: 45,
		},
		capeJperKgByStation: {
			KSTL: 800, // pre-frontal warm sector, modest CAPE
			KCPS: 800,
			KSPI: 100, // post-frontal, stable, low CAPE
			KMLI: 50,
			KORD: 600, // pre-frontal but further from instability axis
			KMSP: 0,
			KDSM: 50,
			KIND: 700,
		},
	},

	diurnal: {
		solarNoonUtcHour: 18, // CST/CDT solar noon ~12 local = 18 UTC in March
		mixingHeightFtMsl: 6000, // March afternoon -- modest mixing
		nocturnalInversion: false,
	},

	hazardZones: [
		{
			// Post-frontal IFR conditions in the cold sector: low ceilings, lifted
			// air-mass moisture, stable stratocumulus deck. West of the cold front.
			id: 'HZ-postfrontal-ifr',
			kind: 'ifr',
			polygon: [
				// West side of front, north portion (cold sector)
				[-89.5, 39.8],
				[-89.2, 41.5],
				[-89.0, 43],
				[-92, 44],
				[-95, 43],
				[-95, 40],
				[-91, 39],
				[-89.5, 39.8],
			],
			altitudeBandFtMsl: { min: 0, max: 4000 },
			source: 'Post-frontal cold-sector IFR: lifted air-mass moisture trapped beneath a stable inversion',
			severity: 'moderate',
		},
		{
			// Cold-sector turbulence: cold advection + tightening pressure gradient
			// + jet exit aloft. West of the cold front, broader extent.
			id: 'HZ-postfrontal-turb',
			kind: 'turbulence',
			polygon: [
				[-90, 36],
				[-89.5, 39.8],
				[-89.0, 43],
				[-93, 44.5],
				[-97, 44],
				[-98, 36],
				[-90, 36],
			],
			altitudeBandFtMsl: { min: 6000, max: 24000 },
			source:
				'Cold-sector turbulence: cold advection behind front, tightening surface gradient, jet-exit ageostrophic flow aloft',
			severity: 'moderate',
		},
		{
			// Pre-frontal isolated convection band along/just east of the front.
			id: 'HZ-prefrontal-tsra',
			kind: 'turbulence',
			polygon: [
				[-89.4, 36],
				[-87, 36],
				[-87, 42],
				[-89.0, 42],
				[-89.4, 36],
			],
			altitudeBandFtMsl: { min: 0, max: 30000 },
			source: 'Pre-frontal warm-sector convection along cold front; isolated cells with embedded turbulence',
			severity: 'moderate',
		},
	],

	terrain: {
		ridges: [], // no significant terrain in the midwest XC
	},
};
