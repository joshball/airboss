// @browser-globals: server-only -- never imported by client .svelte
/**
 * v2 temporal derivation surface.
 *
 * Thin wrappers that sample a v2 `TruthModel` at a timestamp via
 * `sampleTruthAt` and then run the existing, untouched `deriveX` functions.
 * No `deriveX` signature changes -- the temporal extension is purely upstream
 * of derivation.
 *
 * These helpers wrap server-only product derivations, so the module is
 * re-exported only from `@ab/wx-engine/server`. The pure `sampleTruthAt`
 * helper lives in the runtime barrel.
 *
 * Round-trip parser validation is inherited: every METAR / TAF the sequence
 * helpers emit comes straight from `deriveMetar` / `deriveTaf`, which already
 * re-parse their output through `@ab/wx-charts` with zero warnings.
 *
 * See `docs/work/plans/2026-05-14-truth-model-v2-temporal.md` "Derivation
 * surface".
 */

import { WX_TEMPORAL_DEFAULT_STEP_MINUTES, WX_TEMPORAL_MS_PER_HOUR } from '@ab/constants';
import { sampleTruthAt } from '../truth/time';
import type { TruthModel } from '../truth/types';
import { deriveAirmets } from './airmet';
import { deriveMetar } from './metar';
import { deriveTaf } from './taf';
import type { AirmetAdvisory, DerivedMetar, DerivedTaf } from './types';

/** Milliseconds per minute -- step-size conversion. */
const MS_PER_MINUTE = 60_000;

/**
 * Resolve the evolution window for a v2 truth model. Throws when the model
 * carries no `evolution` block -- the sequence helpers are v2-only by
 * contract; a v1 model has nothing to sequence.
 */
function requireEvolution(truth: TruthModel): { start: string; end: string; stepMinutes: number } {
	if (truth.evolution === undefined) {
		throw new Error('temporal derivation requires a v2 TruthModel with an `evolution` block; received a v1 snapshot');
	}
	return truth.evolution;
}

/**
 * Enumerate the timestamps of an evolution window at a given step size.
 * Inclusive of both endpoints. The final step may be shorter than
 * `stepMinutes` so `end` is always emitted.
 */
function enumerateTimestamps(startIso: string, endIso: string, stepMinutes: number): string[] {
	const startMs = new Date(startIso).getTime();
	const endMs = new Date(endIso).getTime();
	const stepMs = stepMinutes * MS_PER_MINUTE;
	const timestamps: string[] = [];
	for (let ms = startMs; ms < endMs; ms += stepMs) {
		timestamps.push(new Date(ms).toISOString());
	}
	timestamps.push(new Date(endMs).toISOString());
	return timestamps;
}

// ----------------------------------------------------------------
// METAR
// ----------------------------------------------------------------

/**
 * Derive a METAR for one station at timestamp `t`. Equivalent to
 * `deriveMetar(sampleTruthAt(truth, t), station, t)`. Works on a v1 truth
 * model too -- `sampleTruthAt` is the identity there, so this collapses to
 * `deriveMetar(truth, station, t)`.
 */
export function deriveMetarAt(truth: TruthModel, stationIcao: string, t: string): DerivedMetar {
	return deriveMetar(sampleTruthAt(truth, t), stationIcao, t);
}

/**
 * Derive the hourly (or `stepMinutes`-spaced) METAR sequence for one station
 * across the scenario window. Requires a v2 truth model.
 */
export function deriveMetarSequence(
	truth: TruthModel,
	stationIcao: string,
	options: { stepMinutes?: number } = {},
): DerivedMetar[] {
	const evolution = requireEvolution(truth);
	const step = options.stepMinutes ?? evolution.stepMinutes ?? WX_TEMPORAL_DEFAULT_STEP_MINUTES;
	return enumerateTimestamps(evolution.start, evolution.end, step).map((t) => deriveMetarAt(truth, stationIcao, t));
}

// ----------------------------------------------------------------
// TAF
// ----------------------------------------------------------------

/**
 * Derive a TAF for one station as it would be issued at `issuedAt`. The TAF
 * is derived from the truth sampled at `issuedAt`, so a TAF issued early in
 * the window forecasts the front at its slower initial speed -- the
 * "TAF-vs-actuals" divergence the v2 drills exploit. The valid window
 * defaults to the model's `tafValidHours`.
 */
export function deriveTafAt(truth: TruthModel, stationIcao: string, issuedAt: string): DerivedTaf {
	const sampled = sampleTruthAt(truth, issuedAt);
	return deriveTaf(sampled, stationIcao, { issuedAt, validHours: truth.tafValidHours });
}

/**
 * Derive the TAF sequence for one station -- one TAF per issue time. Each
 * issue time samples the truth at that instant, so successive TAFs reflect
 * the forecaster's improving picture as the scenario unfolds.
 */
export function deriveTafSequence(
	truth: TruthModel,
	stationIcao: string,
	options: { issueTimes: string[] },
): DerivedTaf[] {
	requireEvolution(truth);
	return options.issueTimes.map((issuedAt) => deriveTafAt(truth, stationIcao, issuedAt));
}

// ----------------------------------------------------------------
// AIRMET timeline
// ----------------------------------------------------------------

/** One lifecycle event on an AIRMET timeline. */
export interface AirmetEvent {
	/** When the event occurs (UTC ISO). */
	at: string;
	/** `issue` when the advisory first appears; `cancel` when it disappears. */
	kind: 'issue' | 'cancel';
}

/** An AIRMET advisory plus its issue/cancel events across the window. */
export interface AirmetTimelineEntry {
	/** The advisory as derived at its first-appearance timestamp. */
	advisory: AirmetAdvisory;
	/** Issue/cancel events ordered by time. */
	events: AirmetEvent[];
}

/**
 * Derive the AIRMET timeline for a v2 scenario. Walks the evolution window at
 * `stepMinutes`, derives the AIRMET set at each step, and records when each
 * advisory (keyed by its originating hazard-zone id) first appears and when
 * it last disappears.
 *
 * Because AIRMETs map one-to-one onto active hazard zones, an advisory's
 * issue/cancel events line up exactly with the hazard zone's lifecycle.
 */
export function deriveAirmetTimeline(truth: TruthModel, options: { stepMinutes?: number } = {}): AirmetTimelineEntry[] {
	const evolution = requireEvolution(truth);
	const step = options.stepMinutes ?? evolution.stepMinutes ?? WX_TEMPORAL_DEFAULT_STEP_MINUTES;
	const timestamps = enumerateTimestamps(evolution.start, evolution.end, step);

	// Per hazard-zone id: the advisory snapshot + the set of timestamps it
	// was active at.
	const firstAdvisory = new Map<string, AirmetAdvisory>();
	const activeAt = new Map<string, string[]>();

	for (const t of timestamps) {
		const advisories = deriveAirmets(sampleTruthAt(truth, t));
		for (const advisory of advisories) {
			const key = advisory.fromHazardZoneId;
			if (!firstAdvisory.has(key)) firstAdvisory.set(key, advisory);
			const seen = activeAt.get(key) ?? [];
			seen.push(t);
			activeAt.set(key, seen);
		}
	}

	const entries: AirmetTimelineEntry[] = [];
	for (const [key, advisory] of firstAdvisory) {
		const seen = activeAt.get(key) ?? [];
		const issueAt = seen[0];
		const lastSeen = seen[seen.length - 1];
		if (issueAt === undefined || lastSeen === undefined) continue;
		const events: AirmetEvent[] = [{ at: issueAt, kind: 'issue' }];
		// The advisory is cancelled one step after it was last seen, unless it
		// was active through the final timestamp (then it never cancels inside
		// the window).
		if (lastSeen !== timestamps[timestamps.length - 1]) {
			const cancelMs = new Date(lastSeen).getTime() + step * MS_PER_MINUTE;
			events.push({ at: new Date(cancelMs).toISOString(), kind: 'cancel' });
		}
		entries.push({ advisory, events });
	}
	return entries;
}

// ----------------------------------------------------------------
// Timeline snapshot bundle
// ----------------------------------------------------------------

/** A v1-shape truth snapshot for one timestamp inside the evolution window. */
export interface TimelineSnapshot {
	/** The timestamp (UTC ISO). */
	at: string;
	/** Hours elapsed since the evolution start. */
	hoursSinceStart: number;
	/** The v1-shape truth model at this instant (no `evolution` block). */
	truth: TruthModel;
}

/**
 * Pre-render every snapshot in the evolution window. The returned snapshots
 * are plain v1 truth models -- any `deriveX` function consumes them directly.
 * This is the data the (out-of-scope) timeline-bundle CLI will serialize.
 */
export function buildTimeline(truth: TruthModel, options: { stepMinutes?: number } = {}): TimelineSnapshot[] {
	const evolution = requireEvolution(truth);
	const step = options.stepMinutes ?? evolution.stepMinutes ?? WX_TEMPORAL_DEFAULT_STEP_MINUTES;
	const startMs = new Date(evolution.start).getTime();
	return enumerateTimestamps(evolution.start, evolution.end, step).map((at) => ({
		at,
		hoursSinceStart: (new Date(at).getTime() - startMs) / WX_TEMPORAL_MS_PER_HOUR,
		truth: sampleTruthAt(truth, at),
	}));
}
