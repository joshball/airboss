/**
 * Pure slider-state -> `TruthModel` mapper for the `/practice/wx/test-page`
 * authoring sandbox (Drill Phase 4).
 *
 * Browser-safe: imports only `@ab/wx-engine` *types* and the sandbox
 * constants. No Node imports, no value imports of server-only modules --
 * so it can be unit-tested directly and (in principle) called from either
 * side. The actual `deriveMetar`/`deriveTaf` calls stay in the `+server.ts`
 * endpoint; this module only assembles the input shape.
 *
 * The mapper builds a *single-station* `TruthModel` that validates cleanly
 * against `truthModelSchema` and exercises the same derivation paths the
 * full scenarios do:
 *
 *   - The station sits at a fixed CONUS-central point inside one air mass.
 *   - Wind / temp / dewpoint sliders feed the air mass surface state.
 *   - The SLP slider feeds a pressure system centred on the station.
 *   - The front sliders place a cold front EAST of the station with
 *     `pipSide: 'E'`, so the station (west of the line) lands in the
 *     post-frontal cold sector -- the configuration `deriveMetar` reads
 *     to emit a gust group.
 *   - The cell slider places one convective cell on the requested bearing.
 *   - The hazard slider places one IFR hazard zone over the station.
 *
 * See `truth-from-sliders.test.ts` for the lever-by-lever contract.
 */

import type { AirMass, Front, HazardZone, PressureSystem, TruthModel } from '@ab/wx-engine';
import { SANDBOX_STATION, SANDBOX_VALID_AT, type SandboxHazardSeverity, type SandboxSliderState } from './types';

/** Km per degree of latitude (and longitude at the equator). */
const KM_PER_DEG = 111;
/** Km per nautical mile. */
const KM_PER_NM = 1.852;
/**
 * Half-extent (deg) of the air mass / hazard polygons around the station.
 * Wide enough that `findAirMass` and `pointInPolygon` always contain the
 * station regardless of where the front lever moves it conceptually.
 */
const POLYGON_HALF_DEG = 4;
/**
 * Distance (km) at or beyond which the front lever is treated as "no front
 * present" -- matches the engine's `FRONT_GUST_INFLUENCE_KM` so a front
 * parked at the slider max has no derivation effect.
 */
const FRONT_ABSENT_THRESHOLD_KM = 600;
/** Distance (nm) at or beyond which the cell lever is treated as "no cell". */
const CELL_ABSENT_THRESHOLD_NM = 120;
/** Background SLP the pressure-sample model falls back to away from systems. */
const BACKGROUND_SLP_MB = 1013;

/** Build the square polygon ring (closed) around a lon/lat centre. */
function squareRing(lon: number, lat: number, halfDeg: number): [number, number][] {
	return [
		[lon - halfDeg, lat - halfDeg],
		[lon + halfDeg, lat - halfDeg],
		[lon + halfDeg, lat + halfDeg],
		[lon - halfDeg, lat + halfDeg],
		[lon - halfDeg, lat - halfDeg],
	];
}

/** Map a hazard severity lever to the engine's `HazardSeverity` (or null for `off`). */
function hazardSeverityFor(severity: SandboxHazardSeverity): HazardZone['severity'] | null {
	switch (severity) {
		case 'off':
			return null;
		case 'light':
			return 'light';
		case 'moderate':
			return 'moderate';
		case 'severe':
			return 'severe';
	}
}

/**
 * Build the single air mass containing the station. Wind / temp / dewpoint
 * sliders feed its surface state; the engine seeds the METAR baseline from
 * exactly these fields.
 */
function buildAirMass(state: SandboxSliderState): AirMass {
	const dewpointC = state.tempC - state.dewpointSpreadC;
	// Small spread -> low stratus deck; wide spread -> higher scattered base.
	const lowMoisture = state.dewpointSpreadC <= 3;
	return {
		id: 'AM-sandbox',
		classification: state.tempC >= 12 ? 'mT' : 'cP',
		polygon: squareRing(SANDBOX_STATION.lon, SANDBOX_STATION.lat, POLYGON_HALF_DEG),
		surfaceTempC: state.tempC,
		surfaceDewpointC: dewpointC,
		stability: state.tempC >= 20 ? 'conditionally-unstable' : 'stable',
		surfaceWindDirDeg: state.windDirDeg,
		surfaceWindKt: state.windKt,
		meanCloudCover: lowMoisture ? 'SCT' : 'BKN',
		meanCloudBaseFtAgl: lowMoisture ? 5500 : 3500,
		meanCloudTopFtAgl: lowMoisture ? 9000 : 11000,
	};
}

/**
 * Build the pressure system centred on the station. The slider sets the
 * central pressure directly; `samplePressureMb` at the station then returns
 * (approximately) that value, which the engine rounds to the altimeter.
 */
function buildPressureSystem(state: SandboxSliderState): PressureSystem {
	return {
		id: 'P-sandbox',
		kind: state.seaLevelPressureMb >= BACKGROUND_SLP_MB ? 'H' : 'L',
		lon: SANDBOX_STATION.lon,
		lat: SANDBOX_STATION.lat,
		centralPressureMb: state.seaLevelPressureMb,
		motionDegTrue: 90,
		motionKt: 15,
		backgroundPressureMb: BACKGROUND_SLP_MB,
	};
}

/**
 * Build the cold front, or return null when the front lever is parked at
 * (or beyond) the absent threshold.
 *
 * The front is a near-vertical polyline EAST of the station at
 * `stationLon + offset`, with `pipSide: 'E'`. The pip side is the warm
 * sector; the station -- west of the line -- is on the `opposite` (cold)
 * side, which is what `deriveMetar` requires to emit a gust group.
 */
function buildFront(state: SandboxSliderState): Front | null {
	if (state.frontDistanceKm >= FRONT_ABSENT_THRESHOLD_KM) return null;
	const offsetDeg = state.frontDistanceKm / KM_PER_DEG;
	const frontLon = SANDBOX_STATION.lon + offsetDeg;
	return {
		id: 'F-sandbox-cold',
		kind: 'cold',
		points: [
			[frontLon, SANDBOX_STATION.lat - POLYGON_HALF_DEG],
			[frontLon, SANDBOX_STATION.lat],
			[frontLon, SANDBOX_STATION.lat + POLYGON_HALF_DEG],
		],
		pipSide: 'E',
		motionDegTrue: 110,
		motionKt: 25,
		intensity: state.frontIntensity,
	};
}

/**
 * Build the convective cell, or return null when the cell lever is parked
 * at (or beyond) the absent threshold. The cell is placed due west of the
 * station so its bearing is stable; the engine triggers `+TSRA` when the
 * station is within `radius + 10 nm`.
 */
function buildCell(state: SandboxSliderState): { cell: TruthModel['convection']['cells'][number] } | null {
	if (state.cellDistanceNm >= CELL_ABSENT_THRESHOLD_NM) return null;
	const offsetDeg = (state.cellDistanceNm * KM_PER_NM) / KM_PER_DEG;
	return {
		cell: {
			id: 'C-sandbox',
			lon: SANDBOX_STATION.lon - offsetDeg,
			lat: SANDBOX_STATION.lat,
			radiusKm: 25,
			peakDbz: 48,
		},
	};
}

/** Build the IFR hazard zone over the station, or null when severity is `off`. */
function buildHazardZone(state: SandboxSliderState): HazardZone | null {
	const severity = hazardSeverityFor(state.hazardSeverity);
	if (severity === null) return null;
	return {
		id: 'HZ-sandbox-ifr',
		kind: 'ifr',
		polygon: squareRing(SANDBOX_STATION.lon, SANDBOX_STATION.lat, POLYGON_HALF_DEG),
		altitudeBandFtMsl: { min: 0, max: 4000 },
		source: 'Sandbox-authored IFR hazard zone',
		severity,
	};
}

/**
 * Assemble a schema-valid single-station `TruthModel` from the slider state.
 *
 * Pure: same input -> same output, no I/O. The result validates against
 * `truthModelSchema` and is the input to `deriveMetar` / `deriveTaf`.
 */
export function truthFromSliders(state: SandboxSliderState): TruthModel {
	const front = buildFront(state);
	const cell = buildCell(state);
	const hazard = buildHazardZone(state);
	const dewpointC = state.tempC - state.dewpointSpreadC;

	return {
		scenarioId: 'wx-test-page-sandbox',
		validAt: SANDBOX_VALID_AT,
		primaryTimeZone: 'America/Chicago',
		narrative: 'Authoring-sandbox single-station truth model -- driven by the /practice/wx/test-page sliders.',
		stations: {
			[SANDBOX_STATION.icao]: {
				icao: SANDBOX_STATION.icao,
				lon: SANDBOX_STATION.lon,
				lat: SANDBOX_STATION.lat,
				elevationFt: SANDBOX_STATION.elevationFt,
				name: SANDBOX_STATION.name,
			},
		},
		synoptic: {
			pressureSystems: [buildPressureSystem(state)],
			fronts: front === null ? [] : [front],
		},
		airMasses: [buildAirMass(state)],
		upperLevel: {
			jetAxis: [
				[SANDBOX_STATION.lon - 6, SANDBOX_STATION.lat - 3],
				[SANDBOX_STATION.lon + 6, SANDBOX_STATION.lat + 3],
			],
			jetMaxKt: 90,
			windByAltitude: [
				{ altitudeFt: 3000, meanDirDeg: state.windDirDeg, meanSpeedKt: state.windKt + 8, meanTempC: state.tempC - 4 },
				{
					altitudeFt: 6000,
					meanDirDeg: (state.windDirDeg + 20) % 360,
					meanSpeedKt: state.windKt + 16,
					meanTempC: state.tempC - 11,
				},
				{
					altitudeFt: 9000,
					meanDirDeg: (state.windDirDeg + 35) % 360,
					meanSpeedKt: state.windKt + 24,
					meanTempC: state.tempC - 18,
				},
				{
					altitudeFt: 12000,
					meanDirDeg: (state.windDirDeg + 50) % 360,
					meanSpeedKt: state.windKt + 32,
					meanTempC: state.tempC - 25,
				},
			],
		},
		convection: {
			cells: cell === null ? [] : [cell.cell],
			frontalBand: null,
			capeJperKgByStation: {
				[SANDBOX_STATION.icao]: state.tempC >= 20 ? 800 : 100,
			},
		},
		diurnal: {
			solarNoonUtcHour: 18,
			mixingHeightFtMsl: 6000,
			nocturnalInversion: dewpointC >= state.tempC - 2,
		},
		hazardZones: hazard === null ? [] : [hazard],
		terrain: { ridges: [] },
		routeStations: [SANDBOX_STATION.icao],
		fbStations: [SANDBOX_STATION.icao],
		tafValidHours: 12,
	};
}
