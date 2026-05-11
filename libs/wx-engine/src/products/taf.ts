/**
 * Layer-2 TAF derivation.
 *
 * Walks the truth model forward in 1-hour steps via `advanceTruth`. Detects
 * air-mass transitions at the station (frontal passage) -> emits `FM` group.
 * Detects convective-cell proximity windows -> emits `PROB30 -TSRA`. Detects
 * IFR-zone overlap -> drops ceiling + visibility. Formats per FAA TAF grammar
 * and round-trips via `parseTaf` from `@ab/wx-charts` with zero warnings.
 *
 * V1 emits one TAF per station per issuance window (24-hour valid forecast,
 * no AMD/COR cycles, no wind-shear groups). Issuance time is 1h20m before
 * the analysis time (real TAFs are typically issued ~40 min before validFrom).
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/taf.ts`
 * (PR #801 -- now retired).
 */

import { parseTaf } from '@ab/wx-charts';
import { advanceTruth } from '../truth/advance';
import { distanceToPolylineKm, findAirMass, pointInPolygon } from '../truth/geometry';
import type { SkyCoverHint, TruthModel } from '../truth/types';
import type { DerivedTaf } from './types';

const KM_PER_NM = 1.852;
/** Convective-cell proximity threshold (nm) for PROB30 -TSRA emission. */
const TSRA_PROXIMITY_NM = 30;
/** Frontal-band buffer (km) for VCSH emission beyond the band's own width. */
const FRONTAL_BAND_VCSH_BUFFER_KM = 50;
/** Default TAF valid window in hours. Real TAFs are 24h; spike-parity uses 12h
 *  for the analysis-time-anchored variant where the front passage is the
 *  pedagogical focus. */
const DEFAULT_VALID_HOURS = 24;

interface PerHourState {
	hourOffset: number;
	timestamp: string;
	airMassId: string | null;
	windDir: number;
	windKt: number;
	gustKt: number | null;
	visibilitySm: number;
	cloudCover: SkyCoverHint;
	cloudBaseFt: number | null;
	hasShra: boolean;
	hasTsra: boolean;
}

/**
 * Derive a TAF for the given station. `validHours` defaults to 24 (FAA-standard
 * TAF window); pass `{ validHours: 12 }` for a shorter window anchored to the
 * analysis time (the spike-parity scenario uses 12).
 */
export function deriveTaf(
	truth: TruthModel,
	stationIcao: string,
	options: { issuedAt?: string; validHours?: number } = {},
): DerivedTaf {
	const station = truth.stations[stationIcao];
	if (station === undefined) throw new Error(`deriveTaf: unknown station '${stationIcao}'`);

	// Issue 1h20m before analysis time so the TAF window starts at the
	// analysis hour and the learner sees upcoming front transitions.
	const baseTime = new Date(truth.validAt);
	const issuedAt =
		options.issuedAt ??
		new Date(
			Date.UTC(
				baseTime.getUTCFullYear(),
				baseTime.getUTCMonth(),
				baseTime.getUTCDate(),
				baseTime.getUTCHours() - 1,
				20,
			),
		).toISOString();

	// Valid from the analysis time (rounded to top-of-hour).
	const validFromDt = new Date(baseTime);
	validFromDt.setUTCMinutes(0, 0, 0);
	const validHours = options.validHours ?? DEFAULT_VALID_HOURS;
	const validToDt = new Date(validFromDt);
	validToDt.setUTCHours(validToDt.getUTCHours() + validHours);

	const validFrom = validFromDt.toISOString();
	const validTo = validToDt.toISOString();

	// Walk hour-by-hour, compute per-hour station state.
	const hours: PerHourState[] = [];
	const baseValidAt = new Date(truth.validAt);
	for (let h = 0; h <= validHours; h += 1) {
		const t = new Date(validFromDt.getTime() + h * 3_600_000);
		const offsetHoursFromTruth = (t.getTime() - baseValidAt.getTime()) / 3_600_000;
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
		const hasTsra = nearestCellNm <= TSRA_PROXIMITY_NM;

		// Frontal-band proximity -> VCSH showers.
		let nearBand = false;
		if (evolved.convection.frontalBand !== null) {
			const distKm = distanceToPolylineKm([station.lon, station.lat], evolved.convection.frontalBand.axis);
			if (distKm <= evolved.convection.frontalBand.widthKm / 2 + FRONTAL_BAND_VCSH_BUFFER_KM) nearBand = true;
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

		const cloudCover: SkyCoverHint = inIfr ? 'OVC' : (am?.meanCloudCover ?? 'SKC');
		const cloudBaseFt = inIfr ? 1500 : (am?.meanCloudBaseFtAgl ?? null);
		const visibilitySm = inIfr ? 3 : nearBand ? 5 : 6;
		const windDir = am?.surfaceWindDirDeg ?? 0;
		const windKt = am?.surfaceWindKt ?? 0;
		// Gusts in the cP cold sector.
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

	// Detect transitions: air-mass change = FM; transient TSRA window = PROB30.
	type Period =
		| { kind: 'INITIAL' | 'FM'; start: PerHourState }
		| { kind: 'PROB30' | 'TEMPO' | 'BECMG'; start: PerHourState; end: PerHourState; weather: string[] };

	const periods: Period[] = [];

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

	// PROB30 windows for TSRA: one period per consecutive TSRA-positive run.
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
			const cloudToken = p.start.cloudCover === 'SKC' ? 'SKC' : 'BKN045CB';
			periodLines.push(`${p.kind} ${range} 4SM ${p.weather.join(' ')} ${cloudToken}`);
		}
	}

	const raw = `TAF ${stationIcao} ${issueDdHhMm}Z ${validRange} ${periodLines.join(' ')}`;
	const parsed = parseTaf(raw);
	if (parsed.warnings.length > 0) {
		throw new Error(
			`deriveTaf: emitted TAF for ${stationIcao} re-parses with warnings: ${parsed.warnings.join('; ')}\nraw: ${raw}`,
		);
	}

	return { raw, parsed, issuedAt, validFrom, validTo };
}

function formatPeriodBody(state: PerHourState): string {
	const wind = formatWind(state.windDir, state.windKt, state.gustKt);
	// Use explicit "6SM" instead of "P6SM" -- the wx-charts TAF parser does
	// not yet recognise the FAA "P6SM" shorthand.
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
