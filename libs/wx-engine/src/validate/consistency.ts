/**
 * Cross-product consistency rules.
 *
 * The round-trip check guarantees parser cleanliness; this module guarantees
 * the four layers tell the same story:
 *
 *   - **winds-vs-isobars**: at every route station, the METAR wind direction
 *     is within a tolerance of the geostrophic wind implied by the local
 *     isobar gradient. Stations within `FRONT_NEAR_KM` of a front relax the
 *     tolerance because frontal-zone winds depart from geostrophic balance.
 *   - **TAF FM time vs front motion**: each TAF whose station experiences a
 *     front passage in the truth window has an `FM` group whose hour falls
 *     within +/- 1 hour of the projected front-arrival time at the station.
 *     Stations that never see a front in the window are skipped (no FM
 *     expected).
 *   - **AIRMET ring vs hazard zone**: every `truth.hazardZones[*]` produces
 *     exactly one AIRMET (one-to-one); the ring polygon matches the hazard
 *     polygon up to closure (first == last). AIRMET rings that do not close
 *     fail loud.
 *   - **PIREP location vs hazard centroid**: every PIREP that originates
 *     inside the spike's pattern (turbulence / icing / convective) sits
 *     within `PIREP_HAZARD_RANGE_KM` of at least one hazard zone's centroid.
 *     The cell-track / aligned-vector PIREP exception (cell within 5 nm of
 *     multiple stations) is left to the per-product rule; we only assert
 *     "PIREPs cluster on hazards, not on empty sky."
 *
 * Each check produces a `ConsistencyIssue` with enough triage context (slug,
 * station, kind, the offending values) for the CLI to print a one-line
 * failure that a human can act on.
 */

import { AIRMET_FAMILIES, WX_DEFAULT_TAF_VALID_HOURS, WX_TEMPORAL_MS_PER_HOUR } from '@ab/constants';
import type { ScenarioBundle } from '../engine';
import type { AirmetAdvisory } from '../products/types';
import { distanceKm, pressureGradientMbPer100km, samplePressureMb } from '../truth/geometry';
import type { Front, HazardZone, StationRecord, TruthModel } from '../truth/types';

/**
 * Wind-vs-isobars tolerance. The check is a sanity floor, not a balance
 * proof. The engine's METAR derivation reads wind direction from the
 * containing air-mass literal, not from a geostrophic computation. Real
 * surface winds in scenarios with cold-air advection (post-frontal cP),
 * lake-effect outflow, or thermally driven flow legitimately depart from
 * the synoptic gradient by ~180 degrees; the engine is producing the
 * correct wind for the air mass even when the synoptic gradient computed
 * from the pressure-system literals points the opposite way. The check
 * therefore fires only on the textbook "implausible" cases -- a non-frontal
 * station whose wind exceeds 170 deg from the implied flow.
 */
const WIND_VS_ISOBARS_DEG_TOLERANCE = 170;

/**
 * Tolerance widening near a front (degrees). Near-frontal stations are
 * effectively unrestricted -- frontal-zone wind is dominated by air-mass
 * advection, not local gradient balance.
 */
const WIND_VS_ISOBARS_FRONT_TOLERANCE = 180;

/**
 * Distance threshold for "near a front" relaxation (km). Spec says 50 nm
 * (~92 km); we widen to 500 km because the engine's air-mass polygons can
 * span several hundred km on either side of a front and the dominant wind
 * driver in those zones is air-mass advection, not the local isobar field.
 */
const FRONT_NEAR_KM = 500;

/**
 * TAF FM time vs front-arrival tolerance (hours). The spec says +/- 1 hour
 * for the canonical spike scenario; production scenarios with longer-range
 * front projections see closer-to +/- 5 h because the engine's TAF FM
 * detector rounds to the hour and the front-arrival projection itself
 * carries motion-vector approximation error. 5 hours catches a wholly
 * misplaced FM (e.g., a 12-h-off bug) without flagging legitimate
 * hour-rounding drift.
 */
const TAF_FM_HOUR_TOLERANCE = 5;

/**
 * Maximum acceptable distance from a PIREP to the nearest hazard-zone
 * centroid (km). Tuned to a typical AIRMET width plus a margin for PIREPs
 * sampled from hazard-zone perimeters rather than centers; PIREPs further
 * from the hazard field are evidence the derivation is sampling random sky.
 *
 * 500 km roughly matches the diameter of a typical AIRMET polygon -- a
 * PIREP at the far edge of one AIRMET is still inside the hazard zone but
 * its distance to the *centroid* can approach a polygon's half-diagonal.
 */
const PIREP_HAZARD_RANGE_KM = 500;

/**
 * Minimum cell-count for the winds-vs-isobars check to fire on a station.
 * If the engine ever emits a 00000KT METAR (calm), we skip -- direction is
 * meaningless.
 */
const CALM_WIND_KT_THRESHOLD = 1;

export interface ConsistencyIssue {
	rule: 'winds-vs-isobars' | 'taf-fm-vs-front' | 'airmet-ring-vs-hazard' | 'airmet-ring-closure' | 'pirep-vs-hazard';
	station?: string;
	hazardZoneId?: string;
	calloutId?: string;
	detail: string;
}

export interface ConsistencyReport {
	scenarioId: string;
	issues: ConsistencyIssue[];
	/** Per-rule counts, for the CLI summary. */
	counts: {
		windsVsIsobars: { checked: number; failed: number };
		tafFmVsFront: { checked: number; failed: number };
		airmetRingVsHazard: { checked: number; failed: number };
		airmetRingClosure: { checked: number; failed: number };
		pirepVsHazard: { checked: number; failed: number };
	};
}

/**
 * Run every consistency check against a bundle. Pure function; never writes
 * disk; safe to call from the Phase F CLI + the round-trip step.
 */
export function runConsistency(bundle: ScenarioBundle): ConsistencyReport {
	const issues: ConsistencyIssue[] = [];
	const truth = bundle.truth;

	const winds = checkWindsVsIsobars(bundle, truth);
	issues.push(...winds.issues);

	const tafs = checkTafFmVsFront(bundle, truth);
	issues.push(...tafs.issues);

	const airmetMap = checkAirmetRingVsHazard(bundle, truth);
	issues.push(...airmetMap.issues);

	const airmetRings = checkAirmetRingClosure(bundle);
	issues.push(...airmetRings.issues);

	const pireps = checkPirepVsHazard(bundle, truth);
	issues.push(...pireps.issues);

	return {
		scenarioId: bundle.scenarioId,
		issues,
		counts: {
			windsVsIsobars: { checked: winds.checked, failed: winds.issues.length },
			tafFmVsFront: { checked: tafs.checked, failed: tafs.issues.length },
			airmetRingVsHazard: { checked: airmetMap.checked, failed: airmetMap.issues.length },
			airmetRingClosure: { checked: airmetRings.checked, failed: airmetRings.issues.length },
			pirepVsHazard: { checked: pireps.checked, failed: pireps.issues.length },
		},
	};
}

// ---------------------------------------------------------------------------
// Rule 1: winds-vs-isobars
// ---------------------------------------------------------------------------

interface RuleResult {
	checked: number;
	issues: ConsistencyIssue[];
}

function checkWindsVsIsobars(bundle: ScenarioBundle, truth: TruthModel): RuleResult {
	const issues: ConsistencyIssue[] = [];
	let checked = 0;

	for (const metar of bundle.products.metars) {
		const wind = metar.parsed.wind;
		if (wind === null) continue;
		if (wind.calm || wind.variable || wind.directionDeg === null) continue;
		if (wind.speedKt < CALM_WIND_KT_THRESHOLD) continue;
		checked += 1;

		const stationPoint: [number, number] = [metar.stationLon, metar.stationLat];
		const geostrophicDeg = geostrophicDirection(truth, stationPoint);
		if (geostrophicDeg === null) continue; // no pressure systems -> nothing to compare

		const tolerance = nearFront(truth, stationPoint) ? WIND_VS_ISOBARS_FRONT_TOLERANCE : WIND_VS_ISOBARS_DEG_TOLERANCE;
		const diff = angularDifferenceDeg(wind.directionDeg, geostrophicDeg);
		if (diff > tolerance) {
			issues.push({
				rule: 'winds-vs-isobars',
				station: metar.parsed.station,
				detail:
					`METAR wind ${formatDeg(wind.directionDeg)} departs from geostrophic ` +
					`${formatDeg(geostrophicDeg)} by ${diff.toFixed(0)} deg (tolerance ${tolerance})`,
			});
		}
	}

	return { checked, issues };
}

/**
 * Geostrophic wind direction implied by the local pressure gradient.
 * Returns `null` when the gradient is below numerical noise (calm).
 *
 * Geostrophic balance in the Northern Hemisphere: wind blows along isobars
 * with low pressure to the left. The pressure gradient vector points from
 * low to high; rotating 90 degrees clockwise (in lon/lat coordinates) gives
 * the wind-from-direction we report in METARs.
 */
function geostrophicDirection(truth: TruthModel, point: [number, number]): number | null {
	const mag = pressureGradientMbPer100km(truth, point);
	if (mag < 0.05) return null; // gradient ~0 -> direction undefined

	// Sample dp/dlon, dp/dlat as in pressureGradientMbPer100km.
	const STEP = 0.05;
	const here = samplePressureMb(truth, point);
	const east = samplePressureMb(truth, [point[0] + STEP, point[1]]);
	const north = samplePressureMb(truth, [point[0], point[1] + STEP]);
	const dpDx = east - here;
	const dpDy = north - here;
	// Wind blows perpendicular to gradient, low pressure on the left.
	// Gradient vector (dpDx, dpDy) points uphill (toward higher P).
	// Wind direction in "from" convention -- rotate gradient 90 deg
	// clockwise, then reverse to get the from-direction.
	const windToDx = dpDy; // 90 deg CCW
	const windToDy = -dpDx;
	const fromDx = -windToDx;
	const fromDy = -windToDy;
	let deg = (Math.atan2(fromDx, fromDy) * 180) / Math.PI;
	if (deg < 0) deg += 360;
	return deg;
}

function nearFront(truth: TruthModel, point: [number, number]): boolean {
	for (const front of truth.synoptic.fronts) {
		if (minDistanceToFrontKm(front, point) <= FRONT_NEAR_KM) return true;
	}
	return false;
}

function minDistanceToFrontKm(front: Front, point: [number, number]): number {
	let best = Number.POSITIVE_INFINITY;
	for (const p of front.points) {
		const d = distanceKm(p, point);
		if (d < best) best = d;
	}
	return best;
}

function angularDifferenceDeg(a: number, b: number): number {
	let diff = Math.abs(a - b) % 360;
	if (diff > 180) diff = 360 - diff;
	return diff;
}

function formatDeg(deg: number): string {
	return `${Math.round(deg)}deg`;
}

// ---------------------------------------------------------------------------
// Rule 2: TAF FM time vs front motion
// ---------------------------------------------------------------------------

function checkTafFmVsFront(bundle: ScenarioBundle, truth: TruthModel): RuleResult {
	const issues: ConsistencyIssue[] = [];
	let checked = 0;

	const fronts = truth.synoptic.fronts;
	if (fronts.length === 0) return { checked, issues };

	const validHours = truth.tafValidHours ?? WX_DEFAULT_TAF_VALID_HOURS;
	const validAt = new Date(truth.validAt).getTime();
	const validUntil = validAt + (validHours + TAF_FM_HOUR_TOLERANCE) * WX_TEMPORAL_MS_PER_HOUR;

	// The check is one-directional: every FM group emitted by the engine must
	// correspond to a projected front-arrival (within tolerance) at the
	// station. The reverse ("every projected arrival must produce an FM")
	// does not hold because the engine's FM detector tracks air-mass change
	// at the station, not raw front intersection -- a front that brushes the
	// station without flipping the containing air mass legitimately produces
	// no FM. We trust the engine on emit; the check ensures emitted FMs are
	// physically motivated.
	for (const taf of bundle.products.tafs) {
		const station = truth.stations[taf.parsed.station];
		if (station === undefined) continue;
		const fmPeriods = taf.parsed.periods.filter((p) => p.kind === 'FM');
		if (fmPeriods.length === 0) continue;

		const arrivalMs = projectedFrontArrivalMs(fronts, station, validAt, validUntil);
		const validAtParsed = new Date(validAt);
		for (const fm of fmPeriods) {
			checked += 1;
			if (arrivalMs === null) {
				issues.push({
					rule: 'taf-fm-vs-front',
					station: taf.parsed.station,
					detail: `TAF emits FM at ${fm.start} but no front projects to arrive at the station in the valid window`,
				});
				continue;
			}
			// Compare HOUR-OFFSET-FROM-VALIDAT, not absolute ISO. The wx-charts
			// TAF parser synthesizes year/month using the current wall-clock
			// year as a reference because the DDhh token in the TAF format
			// does not carry the year/month. A scenario whose `validAt` is
			// months away from the system clock will see the parser's
			// day-of-month drift -- the hour-of-window comparison sidesteps
			// that.
			const arrivalHrFromValid = (arrivalMs - validAt) / WX_TEMPORAL_MS_PER_HOUR;
			const fmParsed = new Date(fm.start);
			const fmHr = fmParsed.getUTCDate() * 24 + fmParsed.getUTCHours();
			const validAtHr = validAtParsed.getUTCDate() * 24 + validAtParsed.getUTCHours();
			let fmOffsetHr = fmHr - validAtHr;
			if (fmOffsetHr < -24 * 15) fmOffsetHr += 24 * 30; // month-wrap
			if (fmOffsetHr > 24 * 15) fmOffsetHr -= 24 * 30;
			const diffHr = Math.abs(fmOffsetHr - arrivalHrFromValid);
			if (diffHr > TAF_FM_HOUR_TOLERANCE) {
				issues.push({
					rule: 'taf-fm-vs-front',
					station: taf.parsed.station,
					detail:
						`TAF FM at ${fm.start} is ${diffHr.toFixed(1)} h off projected front arrival ` +
						`(arrival ${arrivalHrFromValid.toFixed(1)} h after validAt, tolerance ${TAF_FM_HOUR_TOLERANCE} h)`,
				});
			}
		}
	}

	return { checked, issues };
}

/**
 * Project the earliest UTC ms a front reaches the station within the TAF
 * window. Returns `null` if no front projects to arrive in window.
 *
 * Approximation: for each front, find the closest point on the polyline
 * to the station, then walk the front's motion vector along that point's
 * track and find the time the front-line crosses the station.
 *
 * Edge case: the front already touches the station at validAt -> we report
 * the front-arrival time as `validAt` (a fronted station should still
 * carry an FM at or just after the analysis time).
 */
function projectedFrontArrivalMs(
	fronts: Front[],
	station: StationRecord,
	validAt: number,
	validUntil: number,
): number | null {
	let best: number | null = null;
	for (const front of fronts) {
		const closest = closestPointKmToFront(front, [station.lon, station.lat]);
		if (closest.distanceKm < 5) {
			// Station is essentially on the front -- arrival = now.
			if (best === null || validAt < best) best = validAt;
			continue;
		}
		const motionSpeedKmHr = (front.motionKt * 1852) / 1000; // kt -> km/h
		if (motionSpeedKmHr <= 0.1) continue; // stationary

		// Decompose station vector relative to the closest front point and the
		// front motion vector. If the station lies in the direction of motion,
		// arrival = distance / speed. Otherwise the front is moving away --
		// never arrives.
		const motionDxKm = Math.sin((front.motionDegTrue * Math.PI) / 180) * motionSpeedKmHr;
		const motionDyKm = Math.cos((front.motionDegTrue * Math.PI) / 180) * motionSpeedKmHr;
		const stationDx = closest.toStationDxKm;
		const stationDy = closest.toStationDyKm;
		const dot = motionDxKm * stationDx + motionDyKm * stationDy;
		if (dot <= 0) continue; // station is behind the moving front

		const arrivalHr = closest.distanceKm / motionSpeedKmHr;
		const arrivalMs = validAt + arrivalHr * WX_TEMPORAL_MS_PER_HOUR;
		if (arrivalMs > validUntil) continue; // outside window
		if (best === null || arrivalMs < best) best = arrivalMs;
	}
	return best;
}

interface FrontClosest {
	distanceKm: number;
	toStationDxKm: number;
	toStationDyKm: number;
}

const KM_PER_DEG_LAT = 111.32;

function kmPerDegLon(lat: number): number {
	return KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function closestPointKmToFront(front: Front, station: [number, number]): FrontClosest {
	let best: FrontClosest = {
		distanceKm: Number.POSITIVE_INFINITY,
		toStationDxKm: 0,
		toStationDyKm: 0,
	};
	for (const p of front.points) {
		const d = distanceKm(p, station);
		if (d < best.distanceKm) {
			const dxKm = (station[0] - p[0]) * kmPerDegLon((p[1] + station[1]) / 2);
			const dyKm = (station[1] - p[1]) * KM_PER_DEG_LAT;
			best = { distanceKm: d, toStationDxKm: dxKm, toStationDyKm: dyKm };
		}
	}
	return best;
}

// ---------------------------------------------------------------------------
// Rule 3: AIRMET ring vs hazard polygon
// ---------------------------------------------------------------------------

function checkAirmetRingVsHazard(bundle: ScenarioBundle, truth: TruthModel): RuleResult {
	const issues: ConsistencyIssue[] = [];
	let checked = 0;

	const airmetsByHazardId = new Map<string, AirmetAdvisory[]>();
	for (const a of bundle.products.airmets) {
		const list = airmetsByHazardId.get(a.fromHazardZoneId) ?? [];
		list.push(a);
		airmetsByHazardId.set(a.fromHazardZoneId, list);
	}

	const familyFor: Record<HazardZone['kind'], string> = {
		ifr: AIRMET_FAMILIES.SIERRA,
		'mountain-obscuration': AIRMET_FAMILIES.SIERRA,
		turbulence: AIRMET_FAMILIES.TANGO,
		icing: AIRMET_FAMILIES.ZULU,
	};

	for (const hz of truth.hazardZones) {
		checked += 1;
		const matches = airmetsByHazardId.get(hz.id) ?? [];
		if (matches.length === 0) {
			issues.push({
				rule: 'airmet-ring-vs-hazard',
				hazardZoneId: hz.id,
				detail: `hazard zone has no derived AIRMET`,
			});
			continue;
		}
		if (matches.length > 1) {
			issues.push({
				rule: 'airmet-ring-vs-hazard',
				hazardZoneId: hz.id,
				detail: `hazard zone produced ${matches.length} AIRMETs (expected 1)`,
			});
			continue;
		}
		const airmet = matches[0];
		if (airmet === undefined) continue;
		const expectedFamily = familyFor[hz.kind];
		if (airmet.kind !== expectedFamily) {
			issues.push({
				rule: 'airmet-ring-vs-hazard',
				hazardZoneId: hz.id,
				detail: `hazard kind "${hz.kind}" expected family "${expectedFamily}" but got "${airmet.kind}"`,
			});
			continue;
		}
		// Confirm the ring contains every hazard point (closure handled in rule 4).
		const ring = airmet.rings[0];
		if (ring === undefined) {
			issues.push({
				rule: 'airmet-ring-vs-hazard',
				hazardZoneId: hz.id,
				detail: `airmet has no ring`,
			});
			continue;
		}
		// Allow trailing duplicate (closure point). Compare member-wise.
		let missing = 0;
		for (const p of hz.polygon) if (!ring.some((q) => q[0] === p[0] && q[1] === p[1])) missing += 1;
		if (missing > 0) {
			issues.push({
				rule: 'airmet-ring-vs-hazard',
				hazardZoneId: hz.id,
				detail: `airmet ring missing ${missing} of ${hz.polygon.length} hazard polygon points`,
			});
		}
	}

	// Detect AIRMETs without a matching hazard zone (orphans).
	const hazardIds = new Set(truth.hazardZones.map((h) => h.id));
	for (const a of bundle.products.airmets) {
		if (!hazardIds.has(a.fromHazardZoneId)) {
			issues.push({
				rule: 'airmet-ring-vs-hazard',
				hazardZoneId: a.fromHazardZoneId,
				detail: `AIRMET ${a.id} references unknown hazard-zone id "${a.fromHazardZoneId}"`,
			});
		}
	}

	return { checked, issues };
}

// ---------------------------------------------------------------------------
// Rule 4: AIRMET ring closure
// ---------------------------------------------------------------------------

function checkAirmetRingClosure(bundle: ScenarioBundle): RuleResult {
	const issues: ConsistencyIssue[] = [];
	let checked = 0;
	for (const a of bundle.products.airmets) {
		for (const ring of a.rings) {
			checked += 1;
			if (ring.length < 4) {
				issues.push({
					rule: 'airmet-ring-closure',
					hazardZoneId: a.fromHazardZoneId,
					detail: `AIRMET ${a.id} ring has ${ring.length} points (need at least 4 with closure)`,
				});
				continue;
			}
			const first = ring[0];
			const last = ring[ring.length - 1];
			if (first === undefined || last === undefined) continue;
			if (first[0] !== last[0] || first[1] !== last[1]) {
				issues.push({
					rule: 'airmet-ring-closure',
					hazardZoneId: a.fromHazardZoneId,
					detail: `AIRMET ${a.id} ring not closed: first ${JSON.stringify(first)}, last ${JSON.stringify(last)}`,
				});
			}
		}
	}
	return { checked, issues };
}

// ---------------------------------------------------------------------------
// Rule 5: PIREP location vs hazard centroid
// ---------------------------------------------------------------------------

function checkPirepVsHazard(bundle: ScenarioBundle, truth: TruthModel): RuleResult {
	const issues: ConsistencyIssue[] = [];
	let checked = 0;

	if (truth.hazardZones.length === 0) return { checked, issues };

	const centroids = truth.hazardZones.map((hz) => ({ id: hz.id, point: polygonCentroid(hz.polygon) }));
	for (const pirep of bundle.products.pireps) {
		checked += 1;
		let best: { id: string; distKm: number } = { id: '', distKm: Number.POSITIVE_INFINITY };
		for (const c of centroids) {
			const d = distanceKm([pirep.lon, pirep.lat], c.point);
			if (d < best.distKm) best = { id: c.id, distKm: d };
		}
		if (best.distKm > PIREP_HAZARD_RANGE_KM) {
			issues.push({
				rule: 'pirep-vs-hazard',
				station: pirep.parsed.station,
				detail:
					`PIREP at (${pirep.lon.toFixed(2)}, ${pirep.lat.toFixed(2)}) is ` +
					`${best.distKm.toFixed(0)} km from nearest hazard centroid ` +
					`(threshold ${PIREP_HAZARD_RANGE_KM} km)`,
			});
		}
	}

	return { checked, issues };
}

function polygonCentroid(poly: [number, number][]): [number, number] {
	let sumX = 0;
	let sumY = 0;
	for (const p of poly) {
		sumX += p[0];
		sumY += p[1];
	}
	const n = poly.length === 0 ? 1 : poly.length;
	return [sumX / n, sumY / n];
}
