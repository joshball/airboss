/**
 * Scenario grading evaluator.
 *
 * Pure function over a `ReplayTape`: produces a per-component score
 * (0..1) and a weighted total. Scenarios declare a `GradingDefinition`;
 * this file is the runtime side of that contract.
 *
 * Pass/fail is independent and lives in the runner (`SimScenarioOutcome`);
 * the grade is a finer-grained quality signal that the spaced-rep
 * scheduler reads when deciding whether to re-queue a weak scenario.
 *
 * Scoring shape per component:
 * - 1.0 inside the tolerance band (|deviation| <= tolerance).
 * - Linearly decays to 0.0 at the hard-fail boundary
 *   (|deviation| >= hardFail). When `hardFail` is unset, the decay caps
 *   at tolerance * SIM_GRADING.HARD_FAIL_TOLERANCE_MULTIPLIER so a
 *   missing param never collapses to zero.
 * - Components are sampled at frame cadence and averaged across the run.
 */

import { SIM_GRADING, SIM_SCENARIO_OUTCOMES, type SimFaultKind } from '@ab/constants';
import type { ReplayFrame, ReplayTape } from '../replay/types';
import type { GradingComponent, GradingComponentKind, GradingDefinition, IdealPathDefinition } from '../types';

/** Per-component result. */
export interface GradeComponentResult {
	kind: GradingComponentKind;
	weight: number;
	/** Score 0..1. */
	score: number;
	/** Optional human-readable summary -- "held airspeed within 4 KIAS of target". */
	summary?: string;
}

/** Top-level grade report attached to a scenario attempt. */
export interface GradeReport {
	/** Weighted total, 0..1. */
	total: number;
	/** Per-component breakdown in declaration order. */
	components: readonly GradeComponentResult[];
}

/**
 * Optional inputs the evaluator needs that don't live on the tape -- the
 * authored `idealPath` for `ideal_path_match` is the only one today.
 */
export interface GradingEvaluationContext {
	idealPath?: IdealPathDefinition;
}

/**
 * Evaluate a grading definition against a replay tape. Returns a 0..1
 * total plus per-component breakdown. Throws on malformed definitions
 * (weights must sum to ~1.0, frames must be non-empty).
 */
export function evaluateGrading(
	def: GradingDefinition,
	tape: ReplayTape,
	context: GradingEvaluationContext = {},
): GradeReport {
	if (def.components.length === 0) {
		throw new Error('GradingDefinition.components must not be empty.');
	}
	const weightSum = def.components.reduce((sum, c) => sum + c.weight, 0);
	if (Math.abs(weightSum - 1.0) > SIM_GRADING.WEIGHT_SUM_EPSILON) {
		throw new Error(`Grading weights must sum to ~1.0; got ${weightSum.toFixed(4)}.`);
	}
	if (tape.frames.length === 0) {
		throw new Error('Cannot grade an empty tape (no frames).');
	}

	const components = def.components.map((c) => evaluateComponent(c, tape, context));
	const total = components.reduce((sum, c) => sum + c.score * c.weight, 0);
	return { total, components };
}

function evaluateComponent(
	component: GradingComponent,
	tape: ReplayTape,
	context: GradingEvaluationContext,
): GradeComponentResult {
	switch (component.kind) {
		case 'altitude_hold':
			return evaluateAltitudeHold(component, tape);
		case 'heading_hold':
			return evaluateHeadingHold(component, tape);
		case 'airspeed_hold':
			return evaluateAirspeedHold(component, tape);
		case 'stall_margin':
			return evaluateStallMargin(component, tape);
		case 'reaction_time':
			return evaluateReactionTime(component, tape);
		case 'ideal_path_match':
			return evaluateIdealPathMatch(component, tape, context.idealPath);
	}
}

/* -------------------------------------------------------------------------- */
/* Hold components: altitude / heading / airspeed                              */
/* -------------------------------------------------------------------------- */

function evaluateAltitudeHold(component: GradingComponent, tape: ReplayTape): GradeComponentResult {
	const target = component.params?.target;
	const tolerance = component.params?.tolerance ?? 0;
	if (typeof target !== 'number' || tolerance <= 0) {
		return zero(component, 'altitude_hold requires params.target and params.tolerance');
	}
	const hardFail = component.params?.hardFail ?? tolerance * SIM_GRADING.HARD_FAIL_TOLERANCE_MULTIPLIER;
	const deviations = tape.frames.map((f) => Math.abs(f.truth.altitude - target));
	const score = averageBandScore(deviations, tolerance, hardFail);
	const meanDev = mean(deviations);
	return {
		kind: 'altitude_hold',
		weight: component.weight,
		score,
		summary: `mean altitude deviation ${meanDev.toFixed(0)} m`,
	};
}

function evaluateHeadingHold(component: GradingComponent, tape: ReplayTape): GradeComponentResult {
	const target = component.params?.target;
	const tolerance = component.params?.tolerance ?? 0;
	if (typeof target !== 'number' || tolerance <= 0) {
		return zero(component, 'heading_hold requires params.target and params.tolerance');
	}
	const hardFail = component.params?.hardFail ?? tolerance * SIM_GRADING.HARD_FAIL_TOLERANCE_MULTIPLIER;
	const deviations = tape.frames.map((f) => Math.abs(angularDelta(f.truth.heading, target)));
	const score = averageBandScore(deviations, tolerance, hardFail);
	const meanDev = mean(deviations);
	return {
		kind: 'heading_hold',
		weight: component.weight,
		score,
		summary: `mean heading deviation ${((meanDev * 180) / Math.PI).toFixed(0)} deg`,
	};
}

function evaluateAirspeedHold(component: GradingComponent, tape: ReplayTape): GradeComponentResult {
	const target = component.params?.target;
	const tolerance = component.params?.tolerance ?? 0;
	if (typeof target !== 'number' || tolerance <= 0) {
		return zero(component, 'airspeed_hold requires params.target and params.tolerance');
	}
	const hardFail = component.params?.hardFail ?? tolerance * SIM_GRADING.HARD_FAIL_TOLERANCE_MULTIPLIER;
	const deviations = tape.frames.map((f) => Math.abs(f.truth.indicatedAirspeed - target));
	const score = averageBandScore(deviations, tolerance, hardFail);
	const meanDev = mean(deviations);
	return {
		kind: 'airspeed_hold',
		weight: component.weight,
		score,
		summary: `mean airspeed deviation ${meanDev.toFixed(1)} m/s`,
	};
}

/* -------------------------------------------------------------------------- */
/* Stall margin -- penalise time spent above the stall-warning AoA             */
/* -------------------------------------------------------------------------- */

function evaluateStallMargin(component: GradingComponent, tape: ReplayTape): GradeComponentResult {
	const totalT = tape.frames[tape.frames.length - 1].t - tape.frames[0].t;
	if (totalT <= 0) {
		// Single-frame tape -- evaluate state at that one frame.
		const f = tape.frames[0];
		const score = f.truth.stalled ? 0 : f.truth.stallWarning ? 0.5 : 1;
		return {
			kind: 'stall_margin',
			weight: component.weight,
			score,
			summary: f.truth.stalled ? 'stalled' : f.truth.stallWarning ? 'stall warning' : 'clear of stall',
		};
	}

	let warningSeconds = 0;
	let stalledSeconds = 0;
	for (let i = 1; i < tape.frames.length; i += 1) {
		const dt = tape.frames[i].t - tape.frames[i - 1].t;
		if (dt <= 0) continue;
		const f = tape.frames[i - 1];
		if (f.truth.stalled) stalledSeconds += dt;
		else if (f.truth.stallWarning) warningSeconds += dt;
	}
	// Stalled time counts double against the score vs warning time.
	const penalisedSeconds = warningSeconds + SIM_GRADING.STALL_PENALTY_MULTIPLIER * stalledSeconds;
	const score = Math.max(0, 1 - penalisedSeconds / totalT);
	return {
		kind: 'stall_margin',
		weight: component.weight,
		score,
		summary:
			stalledSeconds > 0
				? `stalled for ${stalledSeconds.toFixed(1)}s, warning ${warningSeconds.toFixed(1)}s`
				: warningSeconds > 0
					? `stall warning ${warningSeconds.toFixed(1)}s`
					: 'clear of stall',
	};
}

/* -------------------------------------------------------------------------- */
/* Reaction time                                                               */
/* -------------------------------------------------------------------------- */

function evaluateReactionTime(component: GradingComponent, tape: ReplayTape): GradeComponentResult {
	const triggerT = findTriggerTime(component, tape);
	if (triggerT === null) {
		return zero(component, 'no trigger event found in tape');
	}
	const reactionT = findReactionTime(component, tape, triggerT);
	if (reactionT === null) {
		return zero(component, `no reaction within window (trigger at t=${triggerT.toFixed(1)}s)`);
	}
	const latency = reactionT - triggerT;
	const score = scoreLatency(latency);
	return {
		kind: 'reaction_time',
		weight: component.weight,
		score,
		summary: `reacted in ${latency.toFixed(2)}s`,
	};
}

function findTriggerTime(component: GradingComponent, tape: ReplayTape): number | null {
	const triggerKind = component.params?.triggerFaultKind as SimFaultKind | undefined;
	if (triggerKind) {
		// Activations are sticky -- any frame after firing carries the activation.
		for (const frame of tape.frames) {
			const hit = frame.activations.find((a) => a.kind === triggerKind);
			if (hit) return hit.firedAtT;
		}
		return null;
	}
	// No fault-kind: assume an engine-cut style trigger (EFATO). Find the
	// peak engineRpm in the first quarter of the tape and treat the first
	// later frame whose RPM falls below ENGINE_CUT_RPM_FRACTION of that peak
	// as the trigger.
	const quarterIndex = Math.max(1, Math.floor(tape.frames.length / 4));
	let peakRpm = 0;
	for (let i = 0; i < quarterIndex; i += 1) {
		const rpm = tape.frames[i].truth.engineRpm;
		if (rpm > peakRpm) peakRpm = rpm;
	}
	if (peakRpm <= 0) return null;
	const cutThreshold = peakRpm * SIM_GRADING.ENGINE_CUT_RPM_FRACTION;
	for (let i = quarterIndex; i < tape.frames.length; i += 1) {
		if (tape.frames[i].truth.engineRpm < cutThreshold) {
			return tape.frames[i].t;
		}
	}
	return null;
}

function findReactionTime(component: GradingComponent, tape: ReplayTape, triggerT: number): number | null {
	const predicate = component.params?.reactionPredicate;
	const triggerFrame = tape.frames.find((f) => f.t >= triggerT);
	if (!triggerFrame) return null;

	const matches = (frame: ReplayFrame): boolean => {
		if (predicate === 'stick_forward') return frame.inputs.elevator <= SIM_GRADING.STICK_FORWARD_ELEVATOR;
		if (predicate === 'throttle_idle') return frame.inputs.throttle <= SIM_GRADING.THROTTLE_IDLE_THRESHOLD;
		if (predicate === 'flaps_extended') return frame.inputs.flaps > 0;
		// `autopilot_disengaged` and the no-predicate case share the same
		// "any control axis moved meaningfully since trigger" semantics.
		const dElevator = Math.abs(frame.inputs.elevator - triggerFrame.inputs.elevator);
		const dAileron = Math.abs(frame.inputs.aileron - triggerFrame.inputs.aileron);
		const dRudder = Math.abs(frame.inputs.rudder - triggerFrame.inputs.rudder);
		const dThrottle = Math.abs(frame.inputs.throttle - triggerFrame.inputs.throttle);
		const delta = SIM_GRADING.REACTION_INPUT_DELTA;
		return dElevator > delta || dAileron > delta || dRudder > delta || dThrottle > delta;
	};

	for (const frame of tape.frames) {
		if (frame.t < triggerT) continue;
		if (matches(frame)) return frame.t;
	}
	return null;
}

function scoreLatency(latencySeconds: number): number {
	if (latencySeconds <= SIM_GRADING.REACTION_EXCELLENT_SECONDS) return 1;
	if (latencySeconds >= SIM_GRADING.REACTION_POOR_SECONDS) return 0;
	const span = SIM_GRADING.REACTION_POOR_SECONDS - SIM_GRADING.REACTION_EXCELLENT_SECONDS;
	const over = latencySeconds - SIM_GRADING.REACTION_EXCELLENT_SECONDS;
	return 1 - over / span;
}

/* -------------------------------------------------------------------------- */
/* Ideal-path match                                                            */
/* -------------------------------------------------------------------------- */

function evaluateIdealPathMatch(
	component: GradingComponent,
	tape: ReplayTape,
	idealPath: IdealPathDefinition | undefined,
): GradeComponentResult {
	const tolerance = component.params?.tolerance;
	if (!idealPath || typeof tolerance !== 'number' || tolerance <= 0) {
		return zero(component, 'ideal_path_match requires params.tolerance + ScenarioDefinition.idealPath');
	}
	const hardFail = component.params?.hardFail ?? tolerance * SIM_GRADING.HARD_FAIL_TOLERANCE_MULTIPLIER;
	const deviations = tape.frames.map((f) => idealPathDeviation(idealPath, f));
	const score = averageBandScore(deviations, tolerance, hardFail);
	const meanDev = mean(deviations);
	return {
		kind: 'ideal_path_match',
		weight: component.weight,
		score,
		summary: `mean path deviation ${meanDev.toFixed(0)} m`,
	};
}

/**
 * Distance from a tape frame to the linearly-interpolated ideal path at
 * the same sim time. Combines altitude + airspeed + heading deviations
 * into a single magnitude (each axis scaled to be commensurate before
 * squaring).
 */
function idealPathDeviation(path: IdealPathDefinition, frame: ReplayFrame): number {
	const segments = path.segments;
	if (segments.length === 0) return 0;
	const t = frame.t;
	if (t <= segments[0].endT) {
		return rmsAxisDeviation(frame, segments[0]);
	}
	if (t >= segments[segments.length - 1].endT) {
		return rmsAxisDeviation(frame, segments[segments.length - 1]);
	}
	for (let i = 1; i < segments.length; i += 1) {
		const a = segments[i - 1];
		const b = segments[i];
		if (t >= a.endT && t <= b.endT) {
			const span = b.endT - a.endT;
			const u = span > 0 ? (t - a.endT) / span : 0;
			return rmsAxisDeviation(frame, {
				altitudeMsl: lerp(a.altitudeMsl, b.altitudeMsl, u),
				indicatedAirspeed: lerp(a.indicatedAirspeed, b.indicatedAirspeed, u),
				heading: lerp(a.heading, b.heading, u),
			});
		}
	}
	return 0;
}

function rmsAxisDeviation(
	frame: ReplayFrame,
	target: { altitudeMsl: number; indicatedAirspeed: number; heading: number },
): number {
	const dAlt = frame.truth.altitude - target.altitudeMsl;
	const dIas = frame.truth.indicatedAirspeed - target.indicatedAirspeed;
	const dHdg = angularDelta(frame.truth.heading, target.heading);
	const altScaled = dAlt;
	const iasScaled = dIas * SIM_GRADING.IDEAL_PATH_IAS_WEIGHT;
	const hdgScaled = ((dHdg * 180) / Math.PI) * SIM_GRADING.IDEAL_PATH_HEADING_WEIGHT;
	return Math.sqrt(altScaled * altScaled + iasScaled * iasScaled + hdgScaled * hdgScaled);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function averageBandScore(deviations: readonly number[], tolerance: number, hardFail: number): number {
	if (deviations.length === 0) return 0;
	let sum = 0;
	for (const d of deviations) {
		sum += bandScore(d, tolerance, hardFail);
	}
	return sum / deviations.length;
}

function bandScore(deviation: number, tolerance: number, hardFail: number): number {
	const abs = Math.abs(deviation);
	if (abs <= tolerance) return 1;
	if (abs >= hardFail) return 0;
	const span = hardFail - tolerance;
	if (span <= 0) return 0;
	return 1 - (abs - tolerance) / span;
}

function angularDelta(a: number, b: number): number {
	let d = a - b;
	while (d > Math.PI) d -= 2 * Math.PI;
	while (d < -Math.PI) d += 2 * Math.PI;
	return d;
}

function mean(xs: readonly number[]): number {
	if (xs.length === 0) return 0;
	let sum = 0;
	for (const x of xs) sum += x;
	return sum / xs.length;
}

function lerp(a: number, b: number, u: number): number {
	return a + (b - a) * u;
}

function zero(component: GradingComponent, summary?: string): GradeComponentResult {
	return { kind: component.kind, weight: component.weight, score: 0, summary };
}

/**
 * Convenience: returns true if the tape is from a successful run, false
 * otherwise. Useful for callers that want to skip grading for non-success
 * tapes (e.g. timeouts, aborts).
 */
export function tapeWasSuccessful(tape: ReplayTape): boolean {
	return tape.result.outcome === SIM_SCENARIO_OUTCOMES.SUCCESS;
}
