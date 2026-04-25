/**
 * Scenario runner: turns a stream of FDM truth states into a running
 * verdict (still running / succeeded / failed / timed out) and, for
 * scenarios with a step ladder, tracks which step the learner is on.
 *
 * Pure and deterministic -- the runner is called from the worker after
 * each FDM step. The worker decides when to post an "outcome" message;
 * the runner just reports the current evaluation.
 */

import { SIM_SCENARIO_OUTCOMES, type SimFaultKind, type SimScenarioId, type SimScenarioOutcome } from '@ab/constants';
import { activateFault } from '../faults/transform';
import { shouldTriggerFault } from '../faults/triggers';
import type { FaultActivation } from '../faults/types';
import type { FdmInputs, FdmTruthState, ScenarioDefinition, ScenarioRunResult, ScenarioStepState } from '../types';

/**
 * Crash thresholds. A crash is a physical event distinct from a scoring
 * failure -- it fires for every scenario, including endless ones like the
 * playground. The aircraft is no longer airworthy, so the sim stops.
 */
const CRASH = {
	/** Hard impact: vertical speed at ground contact, m/s (negative = descending). */
	HARD_IMPACT_M_S: -3.0, // ~590 FPM descent
	/** Bank angle at ground contact counted as a wing strike, radians. */
	WING_STRIKE_BANK_RAD: 30 * (Math.PI / 180),
	/** Nose-up attitude at ground contact counted as a tail strike, radians. */
	TAIL_STRIKE_PITCH_RAD: 15 * (Math.PI / 180),
	/** Nose-down attitude at ground contact counted as a nose strike, radians. */
	NOSE_STRIKE_PITCH_RAD: -5 * (Math.PI / 180),
	/** Load factor above which the airframe is considered structurally failed. */
	G_OVERSTRESS: 4.0,
} as const;

/**
 * Detect a crash from the truth state. Returns the reason if crashed,
 * null otherwise. Uses previous airborne-state to distinguish "just
 * touched down" from "sitting on the runway at scenario start".
 */
function detectCrash(truth: FdmTruthState, wasAirborne: boolean): string | null {
	// In-flight structural failure.
	if (truth.loadFactor > CRASH.G_OVERSTRESS) {
		return `G overstress (${truth.loadFactor.toFixed(1)} G) -- airframe structural failure.`;
	}
	// Only evaluate ground-impact signatures on the transition from airborne
	// to on-ground. Parked scenarios start onGround and must not crash-fire.
	if (!truth.onGround || !wasAirborne) return null;
	if (truth.verticalSpeed < CRASH.HARD_IMPACT_M_S) {
		const fpm = Math.abs(truth.verticalSpeed) * 196.85; // m/s -> fpm
		return `Hard impact at ${fpm.toFixed(0)} fpm descent -- landing gear and airframe destroyed.`;
	}
	if (Math.abs(truth.roll) > CRASH.WING_STRIKE_BANK_RAD) {
		return `Wing strike at ${((Math.abs(truth.roll) * 180) / Math.PI).toFixed(0)} deg bank.`;
	}
	if (truth.pitch > CRASH.TAIL_STRIKE_PITCH_RAD) {
		return `Tail strike at ${((truth.pitch * 180) / Math.PI).toFixed(0)} deg nose-up.`;
	}
	if (truth.pitch < CRASH.NOSE_STRIKE_PITCH_RAD) {
		return `Nose strike at ${((truth.pitch * 180) / Math.PI).toFixed(0)} deg nose-down.`;
	}
	return null;
}

export interface RunnerEvaluation {
	outcome: SimScenarioOutcome;
	reason: string;
	/** Populated when the scenario has a step ladder. */
	stepState?: ScenarioStepState;
	/**
	 * Fault activations live this tick. Sticky -- once fired, an activation
	 * stays in this list for the rest of the run. Empty when the scenario
	 * declares no faults or none have triggered yet.
	 */
	activations: readonly FaultActivation[];
	/**
	 * Subset of activations that fired on THIS tick (the edge). The replay
	 * tape records this so the debrief can mark "fault fired here" on the
	 * scrubber timeline.
	 */
	firedThisTick: readonly SimFaultKind[];
}

export class ScenarioRunner {
	private readonly def: ScenarioDefinition;
	private stallAccumulator = 0;
	private peakAltitudeAgl = 0;
	private maxAlpha = Number.NEGATIVE_INFINITY;
	private lastTime = 0;
	private outcome: SimScenarioOutcome = SIM_SCENARIO_OUTCOMES.RUNNING;
	private outcomeReason = '';
	private currentStepIndex = 0;
	private stepHoldAccumulator = 0;
	private stepsCompleted = false;
	private wasAirborne = false;
	private prevTruth: FdmTruthState | null = null;
	private prevStepId: string | null = null;
	/** Sticky list of activated faults. Mutated in `evaluateFaults`. */
	private readonly activations: FaultActivation[] = [];
	/** Set of fault kinds already fired -- prevents double-trigger on edge bounces. */
	private readonly firedKinds = new Set<SimFaultKind>();

	constructor(def: ScenarioDefinition) {
		this.def = def;
	}

	getScenarioId(): SimScenarioId {
		return this.def.id;
	}

	/** Evaluate the next truth state. Returns current outcome + step state. */
	evaluate(truth: FdmTruthState, inputs: FdmInputs): RunnerEvaluation {
		// Once outcome is locked, fault evaluation also stops -- the tape
		// captures activations as they were at the moment of outcome and
		// nothing further changes them.
		if (this.outcome !== SIM_SCENARIO_OUTCOMES.RUNNING) {
			return this.respond([]);
		}

		const dt = Math.max(0, truth.t - this.lastTime);
		this.lastTime = truth.t;

		const aglMeters = truth.altitude - truth.groundElevation;
		if (aglMeters > this.peakAltitudeAgl) this.peakAltitudeAgl = aglMeters;
		if (truth.alpha > this.maxAlpha) this.maxAlpha = truth.alpha;

		// Track stall time.
		if (truth.stalled) this.stallAccumulator += dt;
		else this.stallAccumulator = 0;

		// Fault evaluation runs every tick before crash / scoring so the
		// activations propagate even if outcome locks this tick.
		const firedThisTick = this.evaluateFaults(truth);

		// Crash detection: physical events that end the flight regardless of
		// scoring. Runs for every scenario, including endless (Playground).
		const crashReason = detectCrash(truth, this.wasAirborne);
		if (crashReason !== null) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = crashReason;
			// Freeze airborne tracking so a bounce after the crash call is
			// still classified as the same event.
			this.wasAirborne = false;
			return this.respond(firedThisTick);
		}
		// Update airborne latch after crash evaluation so a clean takeoff is
		// captured before we ever get a chance to see the next touchdown.
		if (!truth.onGround) this.wasAirborne = true;

		// Step ladder (if present).
		if (this.def.steps && this.def.steps.length > 0) {
			this.updateSteps(truth, inputs, dt);
		}

		const crit = this.def.criteria;

		// Endless scenarios (Playground) never terminate on their own, but
		// crash detection above still applies.
		if (crit.endless) {
			return this.respond(firedThisTick);
		}

		// Failure: sustained stall.
		if (
			typeof crit.failureSustainedStallSeconds === 'number' &&
			this.stallAccumulator >= crit.failureSustainedStallSeconds
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Stalled for ${this.stallAccumulator.toFixed(2)} s -- aircraft departed controlled flight.`;
			return this.respond(firedThisTick);
		}

		// Failure: altitude below floor (while not on ground).
		if (
			typeof crit.failureMinimumAltitudeAglMeters === 'number' &&
			crit.failureMinimumAltitudeAglMeters >= 0 &&
			aglMeters < crit.failureMinimumAltitudeAglMeters &&
			!truth.onGround
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Descended below ${crit.failureMinimumAltitudeAglMeters.toFixed(0)} m AGL.`;
			return this.respond(firedThisTick);
		}

		// Ground contact is NOT an automatic failure when the scenario starts
		// on the runway (brake on) or when the failure floor is negative
		// (tutorial scenarios tolerate ground contact). It IS a failure when
		// the criterion explicitly wants it (floor=0) and we have left the
		// ground at some point (peak AGL > 1m).
		if (
			typeof crit.failureMinimumAltitudeAglMeters === 'number' &&
			crit.failureMinimumAltitudeAglMeters === 0 &&
			truth.onGround &&
			this.peakAltitudeAgl > 1 &&
			truth.t > 1.0
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = 'Touched the ground after departure.';
			return this.respond(firedThisTick);
		}

		// Success: step-driven scenarios graduate when all steps are done.
		if (this.def.steps && this.def.steps.length > 0 && this.stepsCompleted) {
			this.outcome = SIM_SCENARIO_OUTCOMES.SUCCESS;
			this.outcomeReason = 'All steps completed. Well done.';
			return this.respond(firedThisTick);
		}

		// Success: reached target altitude AGL (only for altitude-based scenarios without steps).
		if (
			(!this.def.steps || this.def.steps.length === 0) &&
			typeof crit.successAltitudeAglMeters === 'number' &&
			aglMeters >= crit.successAltitudeAglMeters
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.SUCCESS;
			this.outcomeReason = `Reached ${aglMeters.toFixed(0)} m AGL without stalling.`;
			return this.respond(firedThisTick);
		}

		// Timeout.
		if (typeof crit.timeoutSeconds === 'number' && truth.t >= crit.timeoutSeconds) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Timed out at ${crit.timeoutSeconds.toFixed(0)} s.`;
			return this.respond(firedThisTick);
		}

		this.prevTruth = truth;
		this.prevStepId = this.currentStepId();
		return this.respond(firedThisTick);
	}

	/**
	 * Build the per-tick response shared across every termination branch.
	 * Threads the running `outcome` + `reason` + step state + activations.
	 */
	private respond(firedThisTick: readonly SimFaultKind[]): RunnerEvaluation {
		return {
			outcome: this.outcome,
			reason: this.outcomeReason,
			stepState: this.buildStepState(),
			activations: this.activations,
			firedThisTick,
		};
	}

	/**
	 * Walk `def.faults`, fire any that just triggered, and return the kinds
	 * that fired on this tick. Activations are sticky -- once a kind fires
	 * it stays in `this.activations` for the rest of the run.
	 */
	private evaluateFaults(truth: FdmTruthState): readonly SimFaultKind[] {
		const declared = this.def.faults;
		if (!declared || declared.length === 0) return [];
		const fired: SimFaultKind[] = [];
		const currStepId = this.currentStepId();
		for (const fault of declared) {
			if (this.firedKinds.has(fault.kind)) continue;
			const triggered = shouldTriggerFault(fault, {
				prev: this.prevTruth,
				curr: truth,
				prevStepId: this.prevStepId,
				currStepId,
			});
			if (triggered) {
				this.activations.push(activateFault(fault, truth.t));
				this.firedKinds.add(fault.kind);
				fired.push(fault.kind);
			}
		}
		return fired;
	}

	/** Current step id when the scenario has a step ladder, else null. */
	private currentStepId(): string | null {
		if (!this.def.steps || this.def.steps.length === 0) return null;
		const idx = Math.min(this.currentStepIndex, this.def.steps.length - 1);
		return this.def.steps[idx]?.id ?? null;
	}

	/** Read-only access to the live activations list (consumed by the worker). */
	getActivations(): readonly FaultActivation[] {
		return this.activations;
	}

	private updateSteps(truth: FdmTruthState, inputs: FdmInputs, dt: number): void {
		if (!this.def.steps) return;
		if (this.stepsCompleted) return;
		const step = this.def.steps[this.currentStepIndex];
		if (!step) return;

		const satisfied = step.check(truth, {
			elapsedSeconds: truth.t,
			throttle: inputs.throttle,
			brakeOn: inputs.brake,
		});

		if (satisfied) {
			this.stepHoldAccumulator += dt;
			const required = step.holdSeconds ?? 0;
			if (this.stepHoldAccumulator >= required) {
				// Advance.
				this.currentStepIndex += 1;
				this.stepHoldAccumulator = 0;
				if (this.currentStepIndex >= this.def.steps.length) {
					this.stepsCompleted = true;
				}
			}
		} else {
			this.stepHoldAccumulator = 0;
		}
	}

	private buildStepState(): ScenarioStepState | undefined {
		if (!this.def.steps || this.def.steps.length === 0) return undefined;
		const total = this.def.steps.length;
		const idx = Math.min(this.currentStepIndex, total - 1);
		const step = this.def.steps[idx];
		if (!step) return undefined;
		return {
			currentStepIndex: idx,
			totalSteps: total,
			currentStepId: step.id,
			currentStepTitle: step.title,
			currentStepInstruction: step.instruction,
			holdAccumulatorSeconds: this.stepHoldAccumulator,
			holdRequiredSeconds: step.holdSeconds ?? 0,
			completed: this.stepsCompleted,
		};
	}

	/** Finalize the run into a result the UI can render. */
	finalResult(): ScenarioRunResult {
		return {
			scenarioId: this.def.id,
			outcome: this.outcome,
			elapsedSeconds: this.lastTime,
			peakAltitudeAgl: this.peakAltitudeAgl,
			maxAlpha: this.maxAlpha,
			reason: this.outcomeReason,
		};
	}

	/** Abort the run (pilot reset / unload). */
	abort(reason: string): void {
		if (this.outcome === SIM_SCENARIO_OUTCOMES.RUNNING) {
			this.outcome = SIM_SCENARIO_OUTCOMES.ABORTED;
			this.outcomeReason = reason;
		}
	}
}
