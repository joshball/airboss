/**
 * Layer-2 PIREP derivation.
 *
 * Pure function: `(TruthModel) -> DerivedPirep[]`. Every emitted PIREP round-trips
 * through `parsePirep` from `@ab/wx-charts` with zero warnings.
 *
 * The spike scenario (`frontal-xc-march`) gets a hand-curated 3-PIREP set
 * anchored to KORD / KSPI / KMLI; that set is the regression baseline for
 * `pirep.test.ts`. Every other scenario walks `truth.hazardZones` +
 * `truth.convection.cells` to author PIREPs automatically, picking the nearest
 * `routeStations` entry as the reporting anchor and mapping hazard kind +
 * severity onto the PIREP's TB / IC / WX groups.
 *
 * Lifted from the spike's pre-retirement `spikes/wx-engine/src/products/pirep.ts`
 * (PR #801 -- now retired).
 */

import { parsePirep } from '@ab/wx-charts';
import { pointInPolygon } from '../truth/geometry';
import type { HazardZone, TruthModel } from '../truth/types';
import type { DerivedPirep } from './types';

/** Time-offset minutes relative to truth.validAt for each curated PIREP. */
const PIREP_KORD_TIME_OFFSET_MIN = -25;
const PIREP_KSPI_TIME_OFFSET_MIN = -12;
const PIREP_KMLI_TIME_OFFSET_MIN = -5;

/** Lat/lon offsets (deg) anchoring each curated PIREP near its station. */
const PIREP_KORD_LAT_OFFSET = -0.3;
const PIREP_KSPI_LON_OFFSET = -0.2;
const PIREP_KMLI_LAT_OFFSET = 0.3;

/**
 * Derive the PIREP set for the truth model. Spike scenario (frontal-xc-march)
 * gets the hand-curated regression baseline; every other scenario walks
 * hazard zones + convective cells.
 */
export function derivePireps(truth: TruthModel): DerivedPirep[] {
	if (truth.scenarioId === 'frontal-xc-march') {
		return deriveCuratedSpikePireps(truth);
	}
	return deriveGeneralPireps(truth);
}

function deriveCuratedSpikePireps(truth: TruthModel): DerivedPirep[] {
	const dt = new Date(truth.validAt);
	const tm = (offsetMin: number): string => {
		const t = new Date(dt.getTime() + offsetMin * 60_000);
		return `${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}`;
	};

	const items: DerivedPirep[] = [];

	// 1. Pre-frontal warm-sector PIREP near KORD: light chop above 6000.
	const ord = truth.stations.KORD;
	if (ord !== undefined) {
		const raw = `KORD UA /OV ORD180020/TM ${tm(PIREP_KORD_TIME_OFFSET_MIN)}/FL080/TP B738/TB LGT/SK BKN045 OVC120/RM SMOOTH BELOW 070`;
		items.push(makePirep(raw, ord.lon, ord.lat + PIREP_KORD_LAT_OFFSET));
	}

	// 2. Frontal-band PIREP near KSPI: moderate turbulence + rain in the band.
	const spi = truth.stations.KSPI;
	if (spi !== undefined) {
		const raw = `KSPI UUA /OV SPI270010/TM ${tm(PIREP_KSPI_TIME_OFFSET_MIN)}/FL060/TP C172/TB MOD 050-080/SK OVC020/WX RA/RM CONT MOD CHOP IN PRECIP`;
		items.push(makePirep(raw, spi.lon + PIREP_KSPI_LON_OFFSET, spi.lat));
	}

	// 3. Deep post-frontal cold-sector PIREP near KMLI: chop + low ceiling.
	const mli = truth.stations.KMLI;
	if (mli !== undefined) {
		const raw = `KMLI UA /OV MLI020015/TM ${tm(PIREP_KMLI_TIME_OFFSET_MIN)}/FL050/TP B190/TB LGT 050-080/SK OVC025/WX FU/RM SMOOTH ABV 080 CONT NW WIND 30KT`;
		items.push(makePirep(raw, mli.lon, mli.lat + PIREP_KMLI_LAT_OFFSET));
	}

	return items;
}

/**
 * General PIREP derivation. Walks hazard zones (severity moderate or higher
 * emits one PIREP) plus convective cells (one PIREP per cell). The reporting
 * station is the nearest entry from `truth.routeStations`; the PIREP's
 * altitude + turbulence intensity + weather codes are derived from the
 * hazard band + kind + severity.
 *
 * Determinism: hazard zones drive the order; cells follow. Both walk in their
 * truth-model declaration order so output is stable.
 */
function deriveGeneralPireps(truth: TruthModel): DerivedPirep[] {
	const dt = new Date(truth.validAt);
	const items: DerivedPirep[] = [];

	let offsetMin = -30;

	for (const hz of truth.hazardZones) {
		if (hz.severity === 'light') continue;
		const anchor = nearestRouteStation(truth, polygonCentroid(hz.polygon));
		if (anchor === null) continue;
		const pirep = makeHazardPirep(truth, anchor, hz, dt, offsetMin);
		if (pirep !== null) items.push(pirep);
		offsetMin += 5;
	}

	for (const cell of truth.convection.cells) {
		const anchor = nearestRouteStation(truth, [cell.lon, cell.lat]);
		if (anchor === null) continue;
		const t = new Date(dt.getTime() + offsetMin * 60_000);
		const tm = `${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}`;
		const radial = computeRadialFromTo(anchor.lon, anchor.lat, cell.lon, cell.lat);
		const ovHeading = String(radial.bearingDeg).padStart(3, '0');
		const ovDist = String(Math.max(5, Math.min(99, Math.round(radial.distanceNm)))).padStart(3, '0');
		const stationStem = anchor.icao.slice(1);
		const raw = `${anchor.icao} UUA /OV ${stationStem}${ovHeading}${ovDist}/TM ${tm}/FL090/TP B738/TB MOD 070-110/SK BKN040 OVC100/WX TSRA/RM HVY PRECIP NEAR CELL`;
		items.push(makePirep(raw, cell.lon, cell.lat));
		offsetMin += 5;
	}

	return items;
}

function makeHazardPirep(
	truth: TruthModel,
	anchor: { icao: string; lon: number; lat: number },
	hz: HazardZone,
	dt: Date,
	offsetMin: number,
): DerivedPirep | null {
	const t = new Date(dt.getTime() + offsetMin * 60_000);
	const tm = `${String(t.getUTCHours()).padStart(2, '0')}${String(t.getUTCMinutes()).padStart(2, '0')}`;
	const ptr = pickPirepPointInside(hz);
	const radial = computeRadialFromTo(anchor.lon, anchor.lat, ptr[0], ptr[1]);
	const ovHeading = String(radial.bearingDeg).padStart(3, '0');
	const ovDist = String(Math.max(5, Math.min(99, Math.round(radial.distanceNm)))).padStart(3, '0');
	const stationStem = anchor.icao.slice(1);

	// Altitude: stay inside the hazard band; clamp to FL010-FL400.
	const minFl = Math.max(10, Math.round(hz.altitudeBandFtMsl.min / 100));
	const maxFlCap = hz.altitudeBandFtMsl.max ?? hz.altitudeBandFtMsl.min + 4000;
	const maxFl = Math.min(400, Math.round(maxFlCap / 100));
	const reportFl = String(Math.max(minFl + 5, Math.min(maxFl - 5, Math.round((minFl + maxFl) / 2)))).padStart(3, '0');

	if (hz.kind === 'turbulence') {
		const intensity = hz.severity === 'severe' ? 'SEV' : 'MOD';
		const tbBand = `${String(minFl).padStart(3, '0')}-${String(maxFl).padStart(3, '0')}`;
		const kindLabel = hz.severity === 'severe' ? 'UUA' : 'UUA';
		const raw = `${anchor.icao} ${kindLabel} /OV ${stationStem}${ovHeading}${ovDist}/TM ${tm}/FL${reportFl}/TP B738/TB ${intensity} ${tbBand}/SK BKN090/RM CONT ${intensity} CHOP`;
		return makePirep(raw, ptr[0], ptr[1]);
	}

	if (hz.kind === 'icing') {
		const intensity = hz.severity === 'severe' ? 'MOD' : 'LGT';
		const icBand = `${String(minFl).padStart(3, '0')}-${String(maxFl).padStart(3, '0')}`;
		const raw = `${anchor.icao} UUA /OV ${stationStem}${ovHeading}${ovDist}/TM ${tm}/FL${reportFl}/TP C172/TB LGT/SK OVC050/IC ${intensity} RIME ${icBand}/RM ACCRETING ON LE`;
		return makePirep(raw, ptr[0], ptr[1]);
	}

	if (hz.kind === 'ifr') {
		const raw = `${anchor.icao} UA /OV ${stationStem}${ovHeading}${ovDist}/TM ${tm}/FL${reportFl}/TP C172/TB LGT/SK OVC008/WX BR/RM IFR BELOW LAYER`;
		return makePirep(raw, ptr[0], ptr[1]);
	}

	if (hz.kind === 'mountain-obscuration') {
		const raw = `${anchor.icao} UA /OV ${stationStem}${ovHeading}${ovDist}/TM ${tm}/FL${reportFl}/TP C172/TB LGT/SK BKN030/WX FU/RM MTN OBSCURED IN STRATUS`;
		return makePirep(raw, ptr[0], ptr[1]);
	}

	return null;
}

function pickPirepPointInside(hz: HazardZone): [number, number] {
	// Pick the polygon centroid; clamp to a vertex if for some reason the
	// centroid lies outside the ring (concave polygons -- defensive).
	const c = polygonCentroid(hz.polygon);
	if (pointInPolygon(c, hz.polygon)) return c;
	const v = hz.polygon[0];
	return v ?? c;
}

function polygonCentroid(poly: [number, number][]): [number, number] {
	let lonSum = 0;
	let latSum = 0;
	const used = poly[poly.length - 1] === poly[0] ? poly.length - 1 : poly.length;
	for (let i = 0; i < used; i += 1) {
		const p = poly[i];
		if (p === undefined) continue;
		lonSum += p[0];
		latSum += p[1];
	}
	return [lonSum / used, latSum / used];
}

function nearestRouteStation(
	truth: TruthModel,
	pt: [number, number],
): { icao: string; lon: number; lat: number } | null {
	let best: { icao: string; lon: number; lat: number; d2: number } | null = null;
	for (const icao of truth.routeStations) {
		const st = truth.stations[icao];
		if (st === undefined) continue;
		const dLon = st.lon - pt[0];
		const dLat = st.lat - pt[1];
		const d2 = dLon * dLon + dLat * dLat;
		if (best === null || d2 < best.d2) best = { icao, lon: st.lon, lat: st.lat, d2 };
	}
	if (best === null) return null;
	return { icao: best.icao, lon: best.lon, lat: best.lat };
}

function computeRadialFromTo(
	fromLon: number,
	fromLat: number,
	toLon: number,
	toLat: number,
): { bearingDeg: number; distanceNm: number } {
	const KM_PER_DEG_LAT = 111;
	const KM_PER_NM = 1.852;
	const dx = (toLon - fromLon) * KM_PER_DEG_LAT * Math.cos((fromLat * Math.PI) / 180);
	const dy = (toLat - fromLat) * KM_PER_DEG_LAT;
	const distKm = Math.hypot(dx, dy);
	const distanceNm = distKm / KM_PER_NM;
	const bearingRad = Math.atan2(dx, dy);
	let bearingDeg = (bearingRad * 180) / Math.PI;
	if (bearingDeg < 0) bearingDeg += 360;
	bearingDeg = Math.round(bearingDeg / 10) * 10;
	if (bearingDeg === 0) bearingDeg = 360;
	if (bearingDeg > 360) bearingDeg = 360;
	return { bearingDeg, distanceNm };
}

function makePirep(raw: string, lon: number, lat: number): DerivedPirep {
	const parsed = parsePirep(raw);
	if (parsed.warnings.length > 0) {
		throw new Error(`derivePireps: emitted PIREP re-parses with warnings: ${parsed.warnings.join('; ')}\nraw: ${raw}`);
	}
	return { raw, parsed, lon, lat };
}
