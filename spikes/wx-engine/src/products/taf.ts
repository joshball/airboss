/**
 * Spike 01 -- Layer 2 TAF derivation.
 *
 * Walk the truth model forward in 1-hour steps. Detect when the air mass
 * under a station changes (frontal passage) -> emit FM group. Detect
 * proximity to convective cells -> emit PROB30 with -TSRA. Format as a
 * canonical TAF and round-trip via parseTaf.
 *
 * Spike 01 emits one TAF per station for one issuance window (24-hour
 * forecast valid from issue+1h, no AMD/COR cycles).
 */

import { parseTaf, type ParsedTaf } from '@ab/wx-charts';
import {
	advanceTruth,
	distanceToPolylineKm,
	findAirMass,
	pointInPolygon,
	type TruthModel,
} from '../truth/types';

export interface DerivedTaf {
	parsed: ParsedTaf;
	raw: string;
	issuedAt: string;
	validFrom: string;
	validTo: string;
}

interface PerHourState {
	hourOffset: number;
	timestamp: string;
	airMassId: string | null;
	windDir: number;
	windKt: number;
	gustKt: number | null;
	visibilitySm: number;
	cloudCover: 'SKC' | 'FEW' | 'SCT' | 'BKN' | 'OVC';
	cloudBaseFt: number | null;
	hasShra: boolean;
	hasTsra: boolean;
}

const KM_PER_NM = 1.852;

export function deriveTaf(
	truth: TruthModel,
	stationIcao: string,
	options: { issuedAt?: string; validHours?: number } = {},
): DerivedTaf {
	const station = truth.stations[stationIcao];
	if (station === undefined) throw new Error(`deriveTaf: unknown station '${stationIcao}'`);

	// Real TAFs are issued ~40 min before validFrom (e.g. 1720Z TAF
	// validFrom 1800Z). Truth.validAt is the analysis "now"; we issue
	// 40 min earlier so the TAF window starts at the analysis time and
	// the learner can see upcoming front transitions.
	const baseTime = new Date(truth.validAt);
	const issuedAt = options.issuedAt ?? new Date(Date.UTC(
		baseTime.getUTCFullYear(),
		baseTime.getUTCMonth(),
		baseTime.getUTCDate(),
		baseTime.getUTCHours() - 1,
		20, // 1h20m earlier
	)).toISOString();

	const issueDt = new Date(issuedAt);
	// Valid from the analysis time (truth.validAt rounded to top-of-hour).
	const validFromDt = new Date(baseTime);
	validFromDt.setUTCMinutes(0, 0, 0);
	const validHours = options.validHours ?? 24;
	const validToDt = new Date(validFromDt);
	validToDt.setUTCHours(validToDt.getUTCHours() + validHours);

	const validFrom = validFromDt.toISOString();
	const validTo = validToDt.toISOString();

	// Walk hour-by-hour from validFrom to validTo. Compute the per-hour state.
	const hours: PerHourState[] = [];
	const baseValidAt = new Date(truth.validAt);
	for (let h = 0; h <= validHours; h += 1) {
		const t = new Date(validFromDt.getTime() + h * 3600_000);
		const offsetHoursFromTruth = (t.getTime() - baseValidAt.getTime()) / 3600_000;
		const evolved = advanceTruth(truth, offsetHoursFromTruth);
		const am = findAirMass(evolved, [station.lon, station.lat]);

		// Distance to nearest convective cell.
		let nearestCellNm = Number.POSITIVE_INFINITY;
		for (const cell of evolved.convection.cells) {
			const dKm = Math.hypot(
				(station.lon - cell.lon) * Math.cos((station.lat * Math.PI) / 180) * 111,
				(station.lat - cell.lat) * 111,
			);
			const dNm = dKm / KM_PER_NM;
			if (dNm < nearestCellNm) nearestCellNm = dNm;
		}
		const hasTsra = nearestCellNm <= 30;

		// Frontal band proximity -> showers.
		let nearBand = false;
		if (evolved.convection.frontalBand !== null) {
			const distKm = distanceToPolylineKm([station.lon, station.lat], evolved.convection.frontalBand.axis);
			if (distKm <= evolved.convection.frontalBand.widthKm / 2 + 50) nearBand = true;
		}

		// IFR hazard zone overlap.
		let inIfr = false;
		for (const hz of evolved.hazardZones) {
			if (hz.kind !== 'ifr') continue;
			if (hz.altitudeBandFtMsl.min > station.elevationFt + 500) continue;
			if (pointInPolygon([station.lon, station.lat], hz.polygon)) {
				inIfr = true;
				break;
			}
		}

		const cloudCover: PerHourState['cloudCover'] = inIfr ? 'OVC' : (am?.meanCloudCover ?? 'SKC');
		const cloudBaseFt = inIfr ? 1500 : (am?.meanCloudBaseFtAgl ?? null);
		const visibilitySm = inIfr ? 3 : nearBand ? 5 : 6;
		const windDir = am?.surfaceWindDirDeg ?? 0;
		const windKt = am?.surfaceWindKt ?? 0;
		// Gusts in cold sector with strong front.
		let gustKt: number | null = null;
		if (am?.classification === 'cP') gustKt = Math.round(windKt * 1.5);

		hours.push({
			hourOffset: h,
			timestamp: t.toISOString(),
			airMassId: am?.id ?? null,
			windDir,
			windKt,
			gustKt,
			visibilitySm,
			cloudCover,
			cloudBaseFt,
			hasShra: nearBand,
			hasTsra,
		});
	}

	// Detect transitions: air-mass change = FM group; transient TSRA proximity = PROB30.
	const periods: Array<
		| { kind: 'INITIAL' | 'FM'; start: PerHourState }
		| { kind: 'PROB30' | 'TEMPO' | 'BECMG'; start: PerHourState; end: PerHourState; weather: string[] }
	> = [];

	const initial = hours[0];
	if (initial === undefined) throw new Error('deriveTaf: no per-hour states');
	periods.push({ kind: 'INITIAL', start: initial });

	let lastBaseAirMass = initial.airMassId;
	for (let i = 1; i < hours.length; i += 1) {
		const h = hours[i];
		if (h === undefined) continue;
		if (h.airMassId !== lastBaseAirMass && h.airMassId !== null) {
			periods.push({ kind: 'FM', start: h });
			lastBaseAirMass = h.airMassId;
		}
	}

	// PROB30 windows for TSRA: emit one period per consecutive TSRA-positive hour run.
	let runStart: PerHourState | null = null;
	for (let i = 0; i < hours.length; i += 1) {
		const h = hours[i];
		if (h === undefined) continue;
		if (h.hasTsra && runStart === null) runStart = h;
		if ((!h.hasTsra || i === hours.length - 1) && runStart !== null) {
			const end = h.hasTsra ? h : hours[i - 1];
			if (end !== undefined) {
				periods.push({ kind: 'PROB30', start: runStart, end, weather: ['-TSRA'] });
			}
			runStart = null;
		}
	}

	// Emit the TAF string.
	const issueDdHhMm = formatDdHhMm(new Date(issuedAt));
	const validRange = `${formatDdHh(validFromDt)}/${formatDdHh(validToDt)}`;
	const periodLines: string[] = [];

	for (let i = 0; i < periods.length; i += 1) {
		const p = periods[i];
		if (p === undefined) continue;
		if (p.kind === 'INITIAL') {
			periodLines.push(formatPeriodBody(p.start));
		} else if (p.kind === 'FM') {
			const fmTag = `FM${formatDdHhMm(new Date(p.start.timestamp))}`;
			periodLines.push(`${fmTag} ${formatPeriodBody(p.start)}`);
		} else {
			const range = `${formatDdHh(new Date(p.start.timestamp))}/${formatDdHh(new Date(p.end.timestamp))}`;
			const cloudToken = p.start.cloudCover === 'SKC' ? 'SKC' : `BKN045CB`;
			periodLines.push(`${p.kind} ${range} 4SM ${p.weather.join(' ')} ${cloudToken}`);
		}
	}

	const raw = `TAF ${stationIcao} ${issueDdHhMm}Z ${validRange} ${periodLines.join(' ')}`;
	const parsed = parseTaf(raw);

	return { parsed, raw, issuedAt, validFrom, validTo };
}

function formatPeriodBody(state: PerHourState): string {
	const wind = formatWind(state.windDir, state.windKt, state.gustKt);
	// Use explicit "6SM" instead of "P6SM" so the wx-charts TAF parser captures
	// visibility (the parser does not yet recognise the FAA "P6SM" shorthand).
	const vis = state.visibilitySm >= 6 ? '6SM' : `${Math.floor(state.visibilitySm)}SM`;
	const clouds = state.cloudCover === 'SKC' ? 'SKC' : `${state.cloudCover}${formatHundreds(state.cloudBaseFt ?? 5000)}`;
	const wx = state.hasShra ? ' VCSH' : '';
	return `${wind} ${vis}${wx} ${clouds}`;
}

function formatWind(dir: number, kt: number, gust: number | null): string {
	const dirStr = String(dir % 360).padStart(3, '0');
	const ktStr = String(kt).padStart(2, '0');
	if (gust !== null) {
		return `${dirStr}${ktStr}G${String(gust).padStart(2, '0')}KT`;
	}
	return `${dirStr}${ktStr}KT`;
}

function formatHundreds(ft: number): string {
	const hundreds = Math.round(ft / 100);
	return String(hundreds).padStart(3, '0');
}

function formatDdHh(d: Date): string {
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	return `${dd}${hh}`;
}

function formatDdHhMm(d: Date): string {
	const dd = String(d.getUTCDate()).padStart(2, '0');
	const hh = String(d.getUTCHours()).padStart(2, '0');
	const mm = String(d.getUTCMinutes()).padStart(2, '0');
	return `${dd}${hh}${mm}`;
}
