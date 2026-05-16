/**
 * v2 temporal sampler.
 *
 * `sampleTruthAt(truth, t)` projects a v2 `TruthModel` (one carrying an
 * optional `evolution` block) onto a v1-shape snapshot for the timestamp `t`.
 * Every existing derivation function (`deriveMetar`, `deriveTaf`, ...) runs
 * unchanged on the returned snapshot -- the temporal extension is purely
 * upstream of derivation.
 *
 * The function is PURE and DETERMINISTIC: no `Math.random`, no `Date.now()`.
 * Any noise effect a future caller needs takes a seed derived from
 * `(scenarioId, station, timestamp)` via `temporalNoiseSeed`. See the plan's
 * "Open questions / Reproducibility" section.
 *
 * CRITICAL identity property: when `truth.evolution` is undefined,
 * `sampleTruthAt(truth, truth.validAt)` deep-equals `truth`. v1 callers are
 * never reshaped.
 *
 * See `docs/work/plans/2026-05-14-truth-model-v2-temporal.md` "Shape B".
 */

import {
	WX_TEMPORAL_CELL_INTENSITY_CURVES,
	WX_TEMPORAL_KM_PER_DEG_LAT,
	WX_TEMPORAL_KM_PER_NM,
	WX_TEMPORAL_MS_PER_HOUR,
	WX_TEMPORAL_RADIUS_GROW_SHRINK,
	WX_TEMPORAL_REFERENCE_CELL_PEAK_DBZ,
	WX_TEMPORAL_REFERENCE_CELL_RADIUS_KM,
} from '@ab/constants';
import type {
	AirMass,
	AirMassMotion,
	ConvectiveCell,
	Front,
	FrontIntensity,
	FrontMotion,
	HazardLifecycle,
	HazardSeverity,
	HazardZone,
	InlineIntensityCurve,
	TemporalCell,
	TemporalEvolution,
	TemporalFront,
	TruthModel,
} from './types';

// ----------------------------------------------------------------
// Geometry primitives. Pure; mirror `advance.ts` so a temporal sample at an
// hour boundary agrees with `advanceTruth` for a constant-motion front.
// ----------------------------------------------------------------

/**
 * Translate a lon/lat point by a motion vector for a given elapsed time.
 * `bearingDeg` is degrees true (clockwise from north); `speedKt` is knots;
 * `hours` is elapsed time. Returns a fresh tuple.
 */
function translatePoint(point: [number, number], bearingDeg: number, speedKt: number, hours: number): [number, number] {
	const distKm = speedKt * hours * WX_TEMPORAL_KM_PER_NM;
	const distLat = distKm / WX_TEMPORAL_KM_PER_DEG_LAT;
	const distLon = distKm / (WX_TEMPORAL_KM_PER_DEG_LAT * Math.cos((point[1] * Math.PI) / 180));
	const rad = (bearingDeg * Math.PI) / 180;
	return [point[0] + distLon * Math.sin(rad), point[1] + distLat * Math.cos(rad)];
}

/** Elapsed hours between two ISO timestamps. */
function elapsedHours(fromIso: string, toIso: string): number {
	return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / WX_TEMPORAL_MS_PER_HOUR;
}

/** Instant comparison: true when `aIso` is at or after `bIso`. */
function isAtOrAfter(aIso: string, bIso: string): boolean {
	return new Date(aIso).getTime() >= new Date(bIso).getTime();
}

/**
 * Deterministic 32-bit seed derived from `(scenarioId, station, timestamp)`.
 * Exposed so future noise effects (variable-wind eddies, off-cycle SPECI
 * jitter) stay reproducible without ever reaching for `Math.random`.
 */
export function temporalNoiseSeed(scenarioId: string, station: string, timestamp: string): number {
	const input = `${scenarioId}|${station}|${timestamp}`;
	let hash = 2166136261;
	for (let i = 0; i < input.length; i += 1) {
		hash ^= input.charCodeAt(i);
		// FNV-1a 32-bit prime multiply, kept in 32-bit range via Math.imul.
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

// ----------------------------------------------------------------
// Front evolution
// ----------------------------------------------------------------

/**
 * Net displacement of a front from `start` to `t` under its motion rule.
 * For a constant motion this is `motion x elapsedTime`. For a piecewise
 * motion each segment contributes `bearing/speed x time-in-segment`, so the
 * returned displacement is the sum of per-segment translations -- consistent
 * with `advanceTruth` applied segment by segment.
 */
function frontDisplacement(
	point: [number, number],
	motion: FrontMotion,
	startIso: string,
	tIso: string,
): [number, number] {
	if (motion.kind === 'constant') {
		return translatePoint(point, motion.bearingDeg, motion.speedKt, elapsedHours(startIso, tIso));
	}
	let cursor = point;
	let segmentStartIso = startIso;
	const tMs = new Date(tIso).getTime();
	for (const segment of motion.segments) {
		const segmentEndMs = Math.min(new Date(segment.until).getTime(), tMs);
		const segmentStartMs = new Date(segmentStartIso).getTime();
		if (segmentEndMs > segmentStartMs) {
			const hours = (segmentEndMs - segmentStartMs) / WX_TEMPORAL_MS_PER_HOUR;
			cursor = translatePoint(cursor, segment.bearingDeg, segment.speedKt, hours);
		}
		segmentStartIso = segment.until;
		if (segmentEndMs >= tMs) break;
	}
	return cursor;
}

/**
 * Resolve a front's intensity at `t` from its schedule. The last schedule
 * entry whose `at` is at or before `t` wins; if `t` precedes every entry the
 * fallback (the v1 front intensity) is used.
 */
function frontIntensityAt(
	schedule: TemporalFront['intensitySchedule'],
	tIso: string,
	fallback: FrontIntensity,
): FrontIntensity {
	if (schedule === undefined) return fallback;
	let resolved = fallback;
	for (const entry of schedule) {
		if (isAtOrAfter(tIso, entry.at)) resolved = entry.intensity;
	}
	return resolved;
}

/**
 * Project the v1 fronts forward. Each `TemporalFront` is matched to the v1
 * `synoptic.fronts` entry sharing its `id`; the matched front's points are
 * replaced by `pointsAtStart` translated to `t`, and its intensity is
 * overridden per the schedule. v1 fronts without a temporal counterpart
 * advance under their own static `motionDegTrue` / `motionKt` so the snapshot
 * stays internally consistent.
 */
function projectFronts(truth: TruthModel, evolution: TemporalEvolution, tIso: string): Front[] {
	const temporalById = new Map(evolution.fronts.map((tf) => [tf.id, tf]));
	const hours = elapsedHours(evolution.start, tIso);
	return truth.synoptic.fronts.map((front) => {
		const temporal = temporalById.get(front.id);
		if (temporal === undefined) {
			return {
				...front,
				points: front.points.map((p) => translatePoint(p, front.motionDegTrue, front.motionKt, hours)),
			};
		}
		return {
			...front,
			points: temporal.pointsAtStart.map((p) => frontDisplacement(p, temporal.motion, evolution.start, tIso)),
			intensity: frontIntensityAt(temporal.intensitySchedule, tIso, front.intensity),
		};
	});
}

// ----------------------------------------------------------------
// Cell evolution
// ----------------------------------------------------------------

/**
 * Reflectivity (dBZ) of a temporal cell at life fraction `lifeFrac` (0 at
 * genesis, 1 at dissipation). A named curve interpolates the preset
 * multipliers against the cell's peak dBZ; an inline curve linearly
 * interpolates the authored (time, dBZ) samples.
 */
function cellPeakDbzAt(cell: TemporalCell, tIso: string, lifeFrac: number, fallbackPeakDbz: number): number {
	const { intensityCurve } = cell;
	if (Array.isArray(intensityCurve)) {
		return interpolateInlineCurve(intensityCurve, tIso, fallbackPeakDbz);
	}
	const preset = WX_TEMPORAL_CELL_INTENSITY_CURVES[intensityCurve];
	let mul: number;
	if (lifeFrac <= preset.peakFrac) {
		const span = preset.peakFrac === 0 ? 1 : preset.peakFrac;
		mul = preset.startMul + (preset.peakMul - preset.startMul) * (lifeFrac / span);
	} else {
		const span = 1 - preset.peakFrac;
		const past = span === 0 ? 0 : (lifeFrac - preset.peakFrac) / span;
		mul = preset.peakMul + (preset.endMul - preset.peakMul) * past;
	}
	return fallbackPeakDbz * mul;
}

/** Linear interpolation of an inline (time, dBZ) sample curve at `tIso`. */
function interpolateInlineCurve(curve: InlineIntensityCurve, tIso: string, fallback: number): number {
	if (curve.length === 0) return fallback;
	const tMs = new Date(tIso).getTime();
	const first = curve[0];
	const last = curve[curve.length - 1];
	if (first === undefined || last === undefined) return fallback;
	if (tMs <= new Date(first.at).getTime()) return first.peakDbz;
	if (tMs >= new Date(last.at).getTime()) return last.peakDbz;
	for (let i = 0; i < curve.length - 1; i += 1) {
		const a = curve[i];
		const b = curve[i + 1];
		if (a === undefined || b === undefined) continue;
		const aMs = new Date(a.at).getTime();
		const bMs = new Date(b.at).getTime();
		if (tMs >= aMs && tMs <= bMs) {
			const frac = bMs === aMs ? 0 : (tMs - aMs) / (bMs - aMs);
			return a.peakDbz + (b.peakDbz - a.peakDbz) * frac;
		}
	}
	return last.peakDbz;
}

/**
 * Cell radius (km) at life fraction `lifeFrac`. A `linear-grow-shrink` curve
 * ramps the template radius up to mid-life then back down; an explicit
 * `{ peak, peakAt }` curve grows toward `peak` at `peakAt` and shrinks after.
 */
function cellRadiusAt(cell: TemporalCell, tIso: string, lifeFrac: number, templateRadiusKm: number): number {
	const curve = cell.radiusKmCurve;
	if (curve === undefined) return templateRadiusKm;
	if (curve === 'linear-grow-shrink') {
		const { startMul, peakMul, endMul } = WX_TEMPORAL_RADIUS_GROW_SHRINK;
		const mul =
			lifeFrac <= 0.5
				? startMul + (peakMul - startMul) * (lifeFrac / 0.5)
				: peakMul + (endMul - peakMul) * ((lifeFrac - 0.5) / 0.5);
		return templateRadiusKm * mul;
	}
	const genesisMs = new Date(cell.genesisAt).getTime();
	const endMs = new Date(cell.dissipatesAt).getTime();
	const peakMs = new Date(curve.peakAt).getTime();
	const tMs = new Date(tIso).getTime();
	if (tMs <= peakMs) {
		const span = peakMs - genesisMs;
		const frac = span <= 0 ? 1 : (tMs - genesisMs) / span;
		return templateRadiusKm + (curve.peak - templateRadiusKm) * frac;
	}
	const span = endMs - peakMs;
	const frac = span <= 0 ? 1 : (tMs - peakMs) / span;
	return curve.peak + (templateRadiusKm - curve.peak) * frac;
}

/**
 * Project the temporal cells active at `t`. A cell contributes a v1
 * `ConvectiveCell` only when `genesisAt <= t <= dissipatesAt`. Its position is
 * the genesis point translated by motion x time-since-genesis; its radius and
 * peak dBZ follow the lifecycle curves.
 */
function projectTemporalCells(evolution: TemporalEvolution, tIso: string): ConvectiveCell[] {
	const tMs = new Date(tIso).getTime();
	const cells: ConvectiveCell[] = [];
	for (const cell of evolution.cells) {
		const genesisMs = new Date(cell.genesisAt).getTime();
		const endMs = new Date(cell.dissipatesAt).getTime();
		if (tMs < genesisMs || tMs > endMs) continue;
		const sinceGenesisHours = (tMs - genesisMs) / WX_TEMPORAL_MS_PER_HOUR;
		const [lon, lat] = translatePoint(
			[cell.initialLon, cell.initialLat],
			cell.motion.bearingDeg,
			cell.motion.speedKt,
			sinceGenesisHours,
		);
		const lifeSpan = endMs - genesisMs;
		const lifeFrac = lifeSpan <= 0 ? 1 : (tMs - genesisMs) / lifeSpan;
		cells.push({
			id: cell.id,
			lon,
			lat,
			radiusKm: cellRadiusAt(cell, tIso, lifeFrac, WX_TEMPORAL_REFERENCE_CELL_RADIUS_KM),
			peakDbz: Math.round(cellPeakDbzAt(cell, tIso, lifeFrac, WX_TEMPORAL_REFERENCE_CELL_PEAK_DBZ)),
		});
	}
	return cells;
}

/**
 * Spawn pre-frontal convection cells for any temporal front whose
 * `prefrontalConvection.onsetAt` is at or before `t`. A spawned cell sits
 * `leadDistanceNm` ahead of the projected front's lead vertex along the
 * front's instantaneous motion bearing.
 */
function spawnPrefrontalCells(evolution: TemporalEvolution, projectedFronts: Front[], tIso: string): ConvectiveCell[] {
	const frontById = new Map(projectedFronts.map((f) => [f.id, f]));
	const cells: ConvectiveCell[] = [];
	for (const temporal of evolution.fronts) {
		const pre = temporal.prefrontalConvection;
		if (pre === undefined || !isAtOrAfter(tIso, pre.onsetAt)) continue;
		const front = frontById.get(temporal.id);
		if (front === undefined) continue;
		const bearing = instantaneousBearing(temporal.motion, tIso);
		front.points.forEach((point, idx) => {
			// translatePoint takes speedKt x hours; passing leadDistanceNm as the
			// "speed" with hours = 1 yields a displacement of exactly that many
			// nautical miles ahead of the front along its motion bearing.
			const ahead = translatePoint(point, bearing, pre.leadDistanceNm, 1);
			cells.push({
				id: `${temporal.id}-prefront-${idx}`,
				lon: ahead[0],
				lat: ahead[1],
				radiusKm: pre.cellTemplate.radiusKm,
				peakDbz: pre.cellTemplate.peakDbz,
			});
		});
	}
	return cells;
}

/** Instantaneous motion bearing of a front at `t` (handles piecewise). */
function instantaneousBearing(motion: FrontMotion, tIso: string): number {
	if (motion.kind === 'constant') return motion.bearingDeg;
	const tMs = new Date(tIso).getTime();
	for (const segment of motion.segments) {
		if (tMs <= new Date(segment.until).getTime()) return segment.bearingDeg;
	}
	const last = motion.segments[motion.segments.length - 1];
	return last === undefined ? 0 : last.bearingDeg;
}

// ----------------------------------------------------------------
// Air-mass evolution
// ----------------------------------------------------------------

/**
 * Project the v1 air masses. Each `AirMassMotion` is matched to the
 * `AirMass.id` it names; the matched mass's polygon translates by the motion
 * vector and its surface wind / temperature drift per the per-hour rates.
 * Air masses without a motion rule are returned unchanged.
 */
function projectAirMasses(truth: TruthModel, evolution: TemporalEvolution, tIso: string): AirMass[] {
	const motionById = new Map(evolution.airMassMotion.map((m) => [m.airMassId, m]));
	const hours = elapsedHours(evolution.start, tIso);
	return truth.airMasses.map((airMass) => {
		const motion = motionById.get(airMass.id);
		if (motion === undefined) return airMass;
		return applyAirMassMotion(airMass, motion, hours);
	});
}

/** Apply one air-mass motion + drift rule for `hours` of elapsed time. */
function applyAirMassMotion(airMass: AirMass, motion: AirMassMotion, hours: number): AirMass {
	const polygon = airMass.polygon.map((p) => translatePoint(p, motion.motion.bearingDeg, motion.motion.speedKt, hours));
	let surfaceWindDirDeg = airMass.surfaceWindDirDeg;
	let surfaceWindKt = airMass.surfaceWindKt;
	if (motion.surfaceWindShift !== undefined) {
		surfaceWindDirDeg = normalizeBearing(surfaceWindDirDeg + motion.surfaceWindShift.perHour.dirDeg * hours);
		surfaceWindKt = Math.max(0, surfaceWindKt + motion.surfaceWindShift.perHour.speedKt * hours);
	}
	let surfaceTempC = airMass.surfaceTempC;
	if (motion.temperatureDriftCPerHour !== undefined) {
		surfaceTempC = airMass.surfaceTempC + motion.temperatureDriftCPerHour * hours;
	}
	return { ...airMass, polygon, surfaceWindDirDeg, surfaceWindKt, surfaceTempC };
}

/** Wrap a bearing into [0, 360). */
function normalizeBearing(deg: number): number {
	const wrapped = deg % 360;
	return wrapped < 0 ? wrapped + 360 : wrapped;
}

// ----------------------------------------------------------------
// Hazard-zone evolution
// ----------------------------------------------------------------

/**
 * Resolve a hazard zone's severity at `t` from its schedule. The last entry
 * whose `at` is at or before `t` wins; if `t` precedes every entry the v1
 * hazard severity is used.
 */
function hazardSeverityAt(
	schedule: HazardLifecycle['severitySchedule'],
	tIso: string,
	fallback: HazardSeverity,
): HazardSeverity {
	if (schedule === undefined) return fallback;
	let resolved = fallback;
	for (const entry of schedule) {
		if (isAtOrAfter(tIso, entry.at)) resolved = entry.severity;
	}
	return resolved;
}

/**
 * Project the hazard zones active at `t`. A v1 hazard zone with a lifecycle
 * is included only while `onsetAt <= t <= endAt`, with its severity resolved
 * from the schedule. Hazard zones without a lifecycle entry are always active
 * (v1 behavior).
 */
function projectHazardZones(truth: TruthModel, evolution: TemporalEvolution, tIso: string): HazardZone[] {
	const lifecycleById = new Map(evolution.hazardLifecycle.map((l) => [l.hazardZoneId, l]));
	const zones: HazardZone[] = [];
	for (const zone of truth.hazardZones) {
		const lifecycle = lifecycleById.get(zone.id);
		if (lifecycle === undefined) {
			zones.push(zone);
			continue;
		}
		if (!isAtOrAfter(tIso, lifecycle.onsetAt)) continue;
		if (isAtOrAfter(tIso, lifecycle.endAt) && new Date(tIso).getTime() !== new Date(lifecycle.endAt).getTime()) {
			continue;
		}
		zones.push({ ...zone, severity: hazardSeverityAt(lifecycle.severitySchedule, tIso, zone.severity) });
	}
	return zones;
}

// ----------------------------------------------------------------
// Public entry point
// ----------------------------------------------------------------

/**
 * Project a v2 `TruthModel` onto a v1-shape snapshot for timestamp `t`.
 *
 * When `truth.evolution` is undefined the function is the identity: the input
 * is returned verbatim. This guarantees every v1 scenario and every existing
 * `deriveX` caller is unaffected by the temporal extension.
 *
 * When `truth.evolution` is present, `t` should fall inside
 * `[evolution.start, evolution.end]`; timestamps outside the window still
 * resolve (motion extrapolates) but the engine's sequence helpers never call
 * with an out-of-window `t`.
 *
 * The returned snapshot carries `validAt = t` and `evolution` stripped, so
 * downstream `deriveX` functions see a pure v1 model.
 */
export function sampleTruthAt(truth: TruthModel, t: string): TruthModel {
	const { evolution } = truth;
	// Identity: a v1 model sampled at its own validAt is returned verbatim.
	if (evolution === undefined) return truth;

	const projectedFronts = projectFronts(truth, evolution, t);
	const temporalCells = projectTemporalCells(evolution, t);
	const prefrontalCells = spawnPrefrontalCells(evolution, projectedFronts, t);
	const cells =
		temporalCells.length > 0 || prefrontalCells.length > 0
			? [...temporalCells, ...prefrontalCells]
			: truth.convection.cells;

	const { evolution: _stripped, ...v1 } = truth;
	return {
		...v1,
		validAt: t,
		synoptic: { ...truth.synoptic, fronts: projectedFronts },
		airMasses: projectAirMasses(truth, evolution, t),
		convection: { ...truth.convection, cells },
		hazardZones: projectHazardZones(truth, evolution, t),
	};
}
