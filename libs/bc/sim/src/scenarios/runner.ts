/**
 * Scenario runner: turns a stream of FDM truth states into a running
 * verdict (still running / succeeded / failed / timed out) and, for
 * scenarios with a step ladder, tracks which step the learner is on.
 *
 * Pure and deterministic -- the runner is called from the worker after
 * each FDM step. The worker decides when to post an "outcome" message;
 * the runner just reports the current evaluation.
 */

import { SIM_SCENARIO_OUTCOMES, type SimScenarioId, type SimScenarioOutcome } from '@ab/constants';
import type { FdmInputs, FdmTruthState, ScenarioDefinition, ScenarioRunResult, ScenarioStepState } from '../types';

export interface RunnerEvaluation {
	outcome: SimScenarioOutcome;
	reason: string;
	/** Populated when the scenario has a step ladder. */
	stepState?: ScenarioStepState;
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

	constructor(def: ScenarioDefinition) {
		this.def = def;
	}

	getScenarioId(): SimScenarioId {
		return this.def.id;
	}

	/** Evaluate the next truth state. Returns current outcome + step state. */
	evaluate(truth: FdmTruthState, inputs: FdmInputs): RunnerEvaluation {
		if (this.outcome !== SIM_SCENARIO_OUTCOMES.RUNNING) {
			return {
				outcome: this.outcome,
				reason: this.outcomeReason,
				stepState: this.buildStepState(),
			};
		}

		const dt = Math.max(0, truth.t - this.lastTime);
		this.lastTime = truth.t;

		const aglMeters = truth.altitude - truth.groundElevation;
		if (aglMeters > this.peakAltitudeAgl) this.peakAltitudeAgl = aglMeters;
		if (truth.alpha > this.maxAlpha) this.maxAlpha = truth.alpha;

		// Track stall time.
		if (truth.stalled) this.stallAccumulator += dt;
		else this.stallAccumulator = 0;

		// Step ladder (if present).
		if (this.def.steps && this.def.steps.length > 0) {
			this.updateSteps(truth, inputs, dt);
		}

		const crit = this.def.criteria;

		// Endless scenarios (Playground) never terminate on their own.
		if (crit.endless) {
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
		}

		// Failure: sustained stall.
		if (
			typeof crit.failureSustainedStallSeconds === 'number' &&
			this.stallAccumulator >= crit.failureSustainedStallSeconds
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Stalled for ${this.stallAccumulator.toFixed(2)} s -- aircraft departed controlled flight.`;
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
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
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
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
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
		}

		// Success: step-driven scenarios graduate when all steps are done.
		if (this.def.steps && this.def.steps.length > 0 && this.stepsCompleted) {
			this.outcome = SIM_SCENARIO_OUTCOMES.SUCCESS;
			this.outcomeReason = 'All steps completed. Well done.';
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
		}

		// Success: reached target altitude AGL (only for altitude-based scenarios without steps).
		if (
			(!this.def.steps || this.def.steps.length === 0) &&
			typeof crit.successAltitudeAglMeters === 'number' &&
			aglMeters >= crit.successAltitudeAglMeters
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.SUCCESS;
			this.outcomeReason = `Reached ${aglMeters.toFixed(0)} m AGL without stalling.`;
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
		}

		// Timeout.
		if (typeof crit.timeoutSeconds === 'number' && truth.t >= crit.timeoutSeconds) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Timed out at ${crit.timeoutSeconds.toFixed(0)} s.`;
			return { outcome: this.outcome, reason: this.outcomeReason, stepState: this.buildStepState() };
		}

		return { outcome: SIM_SCENARIO_OUTCOMES.RUNNING, reason: '', stepState: this.buildStepState() };
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
