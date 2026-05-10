/**
 * Spike 01 -- Layer 2 METAR derivation.
 *
 * Pure function: truth + station + observation time -> ParsedMetar + raw
 * METAR string. The string round-trips through `parseMetar` from the
 * wx-charts library; that's the spike's automated test that we're
 * emitting a real METAR shape, not an invented one.
 *
 * Algorithm (per DESIGN.md):
 *   1. Air mass under station -> wind/temp/dewpoint/cloud cover baseline.
 *   2. Synoptic pressure field -> SLP -> altimeter inHg.
 *   3. Strong front + opposite side (cold sector) -> add gust = wind +30%.
 *   4. IFR hazard zone over surface -> drop visibility + ceiling.
 *   5. Convective cell within 10 nm -> add +TSRA, BKN045CB ceiling.
 */

import { parseMetar, type ParsedMetar } from '@ab/wx-charts';
import {
	distanceNm,
	distanceToPolylineKm,
	findAirMass,
	pointInPolygon,
	pressureGradientMbPer100km,
	samplePressureMb,
	sideOfFront,
	type AirMass,
	type TruthModel,
} from '../truth/types';

export interface DerivedMetar {
	parsed: ParsedMetar;
	raw: string;
	stationLat: number;
	stationLon: number;
}

const KM_PER_NM = 1.852;

export function deriveMetar(truth: TruthModel, stationIcao: string, observationTime?: string): DerivedMetar {
	const station = truth.stations[stationIcao];
	if (station === undefined) throw new Error(`deriveMetar: unknown station '${stationIcao}'`);
	const time = observationTime ?? truth.validAt;
	const airMass = findAirMass(truth, [station.lon, station.lat]);
	if (airMass === null) throw new Error(`deriveMetar: no air mass contains ${stationIcao}`);

	// Baseline from air mass.
	let windDir = airMass.surfaceWindDirDeg;
	let windKt = airMass.surfaceWindKt;
	let gustKt: number | null = null;
	let tempC = airMass.surfaceTempC;
	let dewpointC = airMass.surfaceDewpointC;
	let cloudCover: 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC' = airMass.meanCloudCover;
	let cloudBaseFt = airMass.meanCloudBaseFtAgl;
	let cloudTopFt = airMass.meanCloudTopFtAgl;
	let visibilitySm = 10;
	const weatherCodes: string[] = [];
	const additionalLayers: Array<{ cover: 'FEW' | 'SCT' | 'BKN' | 'OVC'; baseFt: number }> = [];

	// Pressure -> altimeter.
	const slpMb = samplePressureMb(truth, [station.lon, station.lat]);
	// Convert SLP to station altimeter (very rough -- use SLP directly, then to inHg).
	// inHg = mb / 33.8639. We round to nearest 0.01.
	const altimeterInHg = Math.round((slpMb / 33.8639) * 100) / 100;

	// Strong front + cold sector -> gusts. Pressure gradient amplifies gusts.
	for (const front of truth.synoptic.fronts) {
		const distKm = distanceToPolylineKm([station.lon, station.lat], front.points);
		const side = sideOfFront([station.lon, station.lat], front);
		if (front.kind === 'cold' && side === 'opposite' && distKm < 400 && front.intensity !== 'weak') {
			// Cold sector behind a moderate-or-strong cold front. Gusts.
			const gradient = pressureGradientMbPer100km(truth, [station.lon, station.lat]);
			const gustFactor = front.intensity === 'strong' ? 1.5 : 1.3;
			const gustBoost = Math.max(0, gradient * 2); // each mb/100km adds ~2 kt
			gustKt = Math.round(windKt * gustFactor + gustBoost);
		}
	}

	// IFR hazard zone over surface -> drop ceiling + visibility.
	for (const hazard of truth.hazardZones) {
		if (hazard.kind !== 'ifr' && hazard.kind !== 'mountain-obscuration') continue;
		if (hazard.altitudeBandFtMsl.min > station.elevationFt + 500) continue;
		if (!pointInPolygon([station.lon, station.lat], hazard.polygon)) continue;
		// Inside an IFR zone. Drop ceiling and visibility per severity.
		const ifrCeiling = hazard.severity === 'severe' ? 700 : hazard.severity === 'moderate' ? 1500 : 2500;
		cloudCover = 'OVC';
		cloudBaseFt = ifrCeiling;
		visibilitySm = hazard.severity === 'severe' ? 1 : hazard.severity === 'moderate' ? 3 : 5;
		// Mist code accompanies low visibility.
		if (visibilitySm <= 5) weatherCodes.push('BR');
	}

	// Convective cell within 10 nm -> add TSRA + CB ceiling.
	for (const cell of truth.convection.cells) {
		const dKm = Math.hypot(
			(station.lon - cell.lon) * Math.cos((station.lat * Math.PI) / 180) * 111,
			(station.lat - cell.lat) * 111,
		);
		const dNm = dKm / KM_PER_NM;
		if (dNm <= cell.radiusKm / KM_PER_NM + 10) {
			weatherCodes.push('+TSRA');
			additionalLayers.push({ cover: 'BKN', baseFt: 1500 });
			additionalLayers.push({ cover: 'OVC', baseFt: 6000 });
			visibilitySm = Math.min(visibilitySm, 3);
		}
	}

	// Frontal precipitation band: if station is within (band width / 2) of band axis -> -RA.
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
	const minute = '53'; // Routine METARs typically issued at 55 or 53 past the hour
	const dttg = `${day}${hour}${minute}Z`;

	const windToken = formatWind(windDir, windKt, gustKt);
	const visToken = formatVisibility(visibilitySm);
	const wxToken = weatherCodes.length > 0 ? ` ${weatherCodes.join(' ')}` : '';

	const cloudTokens: string[] = [];
	if (cloudCover === 'SKC') {
		cloudTokens.push('SKC');
	} else {
		// Primary layer.
		if (cloudBaseFt !== null) cloudTokens.push(formatCloudLayer(cloudCover, cloudBaseFt));
		// Additional layers (TSRA / CB).
		for (const layer of additionalLayers) cloudTokens.push(formatCloudLayer(layer.cover, layer.baseFt));
		// If a top is given and it differs from the primary layer, add a higher layer too.
		if (cloudTopFt !== null && cloudBaseFt !== null && cloudTopFt > cloudBaseFt + 4000 && additionalLayers.length === 0) {
			cloudTokens.push(formatCloudLayer('OVC', Math.min(cloudTopFt, 25000)));
		}
	}

	const tempToken = `${formatTempPart(Math.round(tempC))}/${formatTempPart(Math.round(dewpointC))}`;
	const altimeterToken = `A${formatAltimeter(altimeterInHg)}`;

	const raw = `${stationIcao} ${dttg} ${windToken} ${visToken}${wxToken} ${cloudTokens.join(' ')} ${tempToken} ${altimeterToken}`;

	const parsed = parseMetar(raw);

	return {
		parsed,
		raw,
		stationLat: station.lat,
		stationLon: station.lon,
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
		// e.g. 1/2SM, 1/4SM
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

function formatCloudLayer(cover: string, ft: number): string {
	const hundreds = Math.round(ft / 100);
	return `${cover}${String(hundreds).padStart(3, '0')}`;
}

function formatTempPart(c: number): string {
	if (c < 0) return `M${String(-c).padStart(2, '0')}`;
	return String(c).padStart(2, '0');
}

function formatAltimeter(inHg: number): string {
	// e.g. 29.97 -> 2997
	const v = Math.round(inHg * 100);
	return String(v).padStart(4, '0');
}
