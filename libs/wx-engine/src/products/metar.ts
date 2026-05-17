/**
 * Layer-2 METAR derivation.
 *
 * Pure function: `(TruthModel, stationIcao, observationTime?) -> DerivedMetar`.
 * The emitted METAR string round-trips through `parseMetar` from `@ab/wx-charts`
 * with zero warnings. Algorithm per
 * `docs/vision/products/pre-flight/weather-scenario-engine/DESIGN.md`
 * "Layer 2 derivation: products -> METAR":
 *
 *   1. Look up the station in `truth.stations`.
 *   2. Find the air mass containing the station via `findAirMass`. The mass
 *      seeds the wind direction/speed, temp / dewpoint, cloud cover, base + top.
 *   3. Sample SLP via `samplePressureMb` -> altimeter inHg.
 *   4. Strong cold front + opposite (post-frontal) side + within 400 km +
 *      moderate/strong intensity -> add gust group `G<base * 1.3..1.5 + gradient>`.
 *   5. Station inside an IFR or mountain-obscuration hazard zone whose
 *      altitude band reaches the surface -> drop ceiling + visibility per severity.
 *   6. Convective cell within (cell radius + 10 nm) of the station ->
 *      `+TSRA` weather group + BKN 1500 ft CB + OVC 6000 ft.
 *   7. Frontal precipitation band overlapping the station ->
 *      `-RA` weather + visibility floor of 5SM.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/metar.ts`
 * (PR #801 -- now retired). The production lib normalizes the imports to
 * `@ab/wx-engine` server-only modules instead of the spike's intra-package
 * relative paths.
 */

import { parseMetar } from '@ab/wx-charts';
import {
	distanceToPolylineKm,
	findAirMass,
	pointInPolygon,
	pressureGradientMbPer100km,
	samplePressureMb,
	sideOfFront,
} from '../truth/geometry';
import type { SkyCoverHint, TruthModel } from '../truth/types';
import type { DerivedMetar } from './types';

const KM_PER_NM = 1.852;
/** Distance threshold (km) beyond which a front no longer drives gust derivation. */
const FRONT_GUST_INFLUENCE_KM = 400;
/** Strong-front gust multiplier on baseline wind speed. */
const GUST_FACTOR_STRONG = 1.5;
/** Moderate-front gust multiplier on baseline wind speed. */
const GUST_FACTOR_MODERATE = 1.3;
/** Pressure gradient -> gust boost: each mb/100km adds this many knots. */
const GUST_GRADIENT_KT_PER_MB_PER_100KM = 2;

/**
 * Derive a METAR for the given station at the truth's analysis time (or an
 * override observation time). Pure function -- reads only the truth model.
 */
export function deriveMetar(truth: TruthModel, stationIcao: string, observationTime?: string): DerivedMetar {
	const station = truth.stations[stationIcao];
	if (station === undefined) throw new Error(`deriveMetar: unknown station '${stationIcao}'`);
	const time = observationTime ?? truth.validAt;
	const airMass = findAirMass(truth, [station.lon, station.lat]);
	if (airMass === null) throw new Error(`deriveMetar: no air mass contains ${stationIcao}`);

	// Baseline from air mass.
	const windDir = airMass.surfaceWindDirDeg;
	const windKt = airMass.surfaceWindKt;
	let gustKt: number | null = null;
	const tempC = airMass.surfaceTempC;
	const dewpointC = airMass.surfaceDewpointC;
	let cloudCover: SkyCoverHint = airMass.meanCloudCover;
	let cloudBaseFt = airMass.meanCloudBaseFtAgl;
	const cloudTopFt = airMass.meanCloudTopFtAgl;
	let visibilitySm = 10;
	const weatherCodes: string[] = [];
	const additionalLayers: Array<{
		cover: 'FEW' | 'SCT' | 'BKN' | 'OVC';
		baseFt: number;
		/** `CB` tags a convective layer so the encoded METAR carries the cumulonimbus marker. */
		cloudType?: 'CB' | 'TCU';
	}> = [];

	// Pressure -> altimeter (inHg, nearest 0.01).
	const slpMb = samplePressureMb(truth, [station.lon, station.lat]);
	const altimeterInHg = Math.round((slpMb / 33.8639) * 100) / 100;

	// Strong front + post-frontal sector -> gusts. Pressure gradient amplifies.
	for (const front of truth.synoptic.fronts) {
		const distKm = distanceToPolylineKm([station.lon, station.lat], front.points);
		const side = sideOfFront([station.lon, station.lat], front);
		if (
			front.kind === 'cold' &&
			side === 'opposite' &&
			distKm < FRONT_GUST_INFLUENCE_KM &&
			front.intensity !== 'weak'
		) {
			const gradient = pressureGradientMbPer100km(truth, [station.lon, station.lat]);
			const gustFactor = front.intensity === 'strong' ? GUST_FACTOR_STRONG : GUST_FACTOR_MODERATE;
			const gustBoost = Math.max(0, gradient * GUST_GRADIENT_KT_PER_MB_PER_100KM);
			gustKt = Math.round(windKt * gustFactor + gustBoost);
		}
	}

	// IFR hazard zone over surface -> drop ceiling + visibility.
	// Severe == dense-fog/LIFR class (visibility under 1 SM, ceiling under 1000 ft);
	// moderate == IFR (1-3 SM, 1000-1500 ft); light == MVFR-margin (5 SM, 2500 ft).
	for (const hazard of truth.hazardZones) {
		if (hazard.kind !== 'ifr' && hazard.kind !== 'mountain-obscuration') continue;
		if (hazard.altitudeBandFtMsl.min > station.elevationFt + 500) continue;
		if (!pointInPolygon([station.lon, station.lat], hazard.polygon)) continue;
		const ifrCeiling = hazard.severity === 'severe' ? 300 : hazard.severity === 'moderate' ? 1500 : 2500;
		cloudCover = 'OVC';
		cloudBaseFt = ifrCeiling;
		visibilitySm = hazard.severity === 'severe' ? 0.5 : hazard.severity === 'moderate' ? 3 : 5;
		// Dense-fog visibilities take FG (fog); higher BR (mist) per FMH-1 convention.
		if (visibilitySm < 1) weatherCodes.push('FG');
		else if (visibilitySm <= 5) weatherCodes.push('BR');
	}

	// Convective cell within (radius + 10 nm) -> +TSRA + BKN CB + OVC.
	for (const cell of truth.convection.cells) {
		const dKm = Math.hypot(
			(station.lon - cell.lon) * Math.cos((station.lat * Math.PI) / 180) * 111,
			(station.lat - cell.lat) * 111,
		);
		const dNm = dKm / KM_PER_NM;
		if (dNm <= cell.radiusKm / KM_PER_NM + 10) {
			weatherCodes.push('+TSRA');
			additionalLayers.push({ cover: 'BKN', baseFt: 1500, cloudType: 'CB' });
			additionalLayers.push({ cover: 'OVC', baseFt: 6000 });
			visibilitySm = Math.min(visibilitySm, 3);
		}
	}

	// Frontal precipitation band -> -RA + visibility floor.
	const band = truth.convection.frontalBand;
	if (band !== null) {
		const distKm = distanceToPolylineKm([station.lon, station.lat], band.axis);
		if (distKm <= band.widthKm / 2) {
			weatherCodes.push('-RA');
			visibilitySm = Math.min(visibilitySm, 5);
		}
	}

	// Format the METAR string.
	const dt = new Date(time);
	const day = String(dt.getUTCDate()).padStart(2, '0');
	const hour = String(dt.getUTCHours()).padStart(2, '0');
	// Routine METARs typically issue at 53 past the hour.
	const minute = '53';
	const dttg = `${day}${hour}${minute}Z`;

	const windToken = formatWind(windDir, windKt, gustKt);
	const visToken = formatVisibility(visibilitySm);
	const wxToken = weatherCodes.length > 0 ? ` ${weatherCodes.join(' ')}` : '';

	const cloudTokens: string[] = [];
	if (cloudCover === 'SKC') {
		cloudTokens.push('SKC');
	} else {
		if (cloudBaseFt !== null) cloudTokens.push(formatCloudLayer(cloudCover, cloudBaseFt));
		for (const layer of additionalLayers) {
			cloudTokens.push(formatCloudLayer(layer.cover, layer.baseFt, layer.cloudType));
		}
		// If a top is far above base and no additional layer was inserted, add a higher OVC.
		if (
			cloudTopFt !== null &&
			cloudBaseFt !== null &&
			cloudTopFt > cloudBaseFt + 4000 &&
			additionalLayers.length === 0
		) {
			cloudTokens.push(formatCloudLayer('OVC', Math.min(cloudTopFt, 25000)));
		}
	}

	const tempToken = `${formatTempPart(Math.round(tempC))}/${formatTempPart(Math.round(dewpointC))}`;
	const altimeterToken = `A${formatAltimeter(altimeterInHg)}`;

	const raw = `${stationIcao} ${dttg} ${windToken} ${visToken}${wxToken} ${cloudTokens.join(' ')} ${tempToken} ${altimeterToken}`;

	const parsed = parseMetar(raw);
	if (parsed.warnings.length > 0) {
		throw new Error(
			`deriveMetar: emitted METAR for ${stationIcao} re-parses with warnings: ${parsed.warnings.join('; ')}\nraw: ${raw}`,
		);
	}

	return {
		raw,
		parsed,
		stationLon: station.lon,
		stationLat: station.lat,
	};
}

function formatWind(dir: number, kt: number, gust: number | null): string {
	const dirStr = String(dir % 360).padStart(3, '0');
	const ktStr = String(kt).padStart(2, '0');
	if (gust !== null) {
		return `${dirStr}${ktStr}G${String(gust).padStart(2, '0')}KT`;
	}
	return `${dirStr}${ktStr}KT`;
}

function formatVisibility(sm: number): string {
	if (sm >= 10) return '10SM';
	if (Number.isInteger(sm)) return `${sm}SM`;
	if (sm < 1) {
		if (sm <= 0.25) return '1/4SM';
		if (sm <= 0.5) return '1/2SM';
		return '3/4SM';
	}
	if (sm < 2) {
		if (sm < 1.5) return '1 1/4SM';
		return '1 1/2SM';
	}
	return `${Math.floor(sm)}SM`;
}

function formatCloudLayer(cover: string, ft: number, cloudType?: 'CB' | 'TCU'): string {
	const hundreds = Math.round(ft / 100);
	return `${cover}${String(hundreds).padStart(3, '0')}${cloudType ?? ''}`;
}

function formatTempPart(c: number): string {
	if (c < 0) return `M${String(-c).padStart(2, '0')}`;
	return String(c).padStart(2, '0');
}

function formatAltimeter(inHg: number): string {
	const v = Math.round(inHg * 100);
	return String(v).padStart(4, '0');
}
