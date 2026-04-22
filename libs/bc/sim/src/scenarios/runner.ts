/**
 * Scenario runner: turns a stream of FDM truth states into a running
 * verdict (still running / succeeded / failed / timed out).
 *
 * Pure and deterministic -- the runner is called from the worker after
 * each FDM step. The worker decides when to post an "outcome" message;
 * the runner just reports the current evaluation.
 */

import { SIM_SCENARIO_OUTCOMES, type SimScenarioId, type SimScenarioOutcome } from '@ab/constants';
import type { FdmTruthState, ScenarioDefinition, ScenarioRunResult } from '../types';

export interface RunnerEvaluation {
	outcome: SimScenarioOutcome;
	reason: string;
}

export class ScenarioRunner {
	private readonly def: ScenarioDefinition;
	private stallAccumulator = 0;
	private peakAltitudeAgl = 0;
	private maxAlpha = Number.NEGATIVE_INFINITY;
	private lastTime = 0;
	private outcome: SimScenarioOutcome = SIM_SCENARIO_OUTCOMES.RUNNING;
	private outcomeReason = '';

	constructor(def: ScenarioDefinition) {
		this.def = def;
	}

	getScenarioId(): SimScenarioId {
		return this.def.id;
	}

	/** Evaluate the next truth state. Returns current outcome. */
	evaluate(truth: FdmTruthState): RunnerEvaluation {
		if (this.outcome !== SIM_SCENARIO_OUTCOMES.RUNNING) {
			return { outcome: this.outcome, reason: this.outcomeReason };
		}

		const dt = Math.max(0, truth.t - this.lastTime);
		this.lastTime = truth.t;

		const aglMeters = truth.altitude - truth.groundElevation;
		if (aglMeters > this.peakAltitudeAgl) this.peakAltitudeAgl = aglMeters;
		if (truth.alpha > this.maxAlpha) this.maxAlpha = truth.alpha;

		// Failure: sustained stall.
		if (truth.stalled) {
			this.stallAccumulator += dt;
		} else {
			this.stallAccumulator = 0;
		}

		const crit = this.def.criteria;

		if (
			typeof crit.failureSustainedStallSeconds === 'number' &&
			this.stallAccumulator >= crit.failureSustainedStallSeconds
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Stalled for ${this.stallAccumulator.toFixed(2)} s -- aircraft departed controlled flight.`;
			return { outcome: this.outcome, reason: this.outcomeReason };
		}

		if (
			typeof crit.failureMinimumAltitudeAglMeters === 'number' &&
			aglMeters < crit.failureMinimumAltitudeAglMeters &&
			!truth.onGround
		) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Descended below ${crit.failureMinimumAltitudeAglMeters.toFixed(0)} m AGL.`;
			return { outcome: this.outcome, reason: this.outcomeReason };
		}

		// Ground contact while failure-floor is 0 counts as a crash.
		if (truth.onGround && truth.t > 1.0) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = 'Touched the ground.';
			return { outcome: this.outcome, reason: this.outcomeReason };
		}

		// Success: reached target altitude AGL.
		if (typeof crit.successAltitudeAglMeters === 'number' && aglMeters >= crit.successAltitudeAglMeters) {
			this.outcome = SIM_SCENARIO_OUTCOMES.SUCCESS;
			this.outcomeReason = `Reached ${(aglMeters).toFixed(0)} m AGL without stalling.`;
			return { outcome: this.outcome, reason: this.outcomeReason };
		}

		// Timeout.
		if (truth.t >= crit.timeoutSeconds) {
			this.outcome = SIM_SCENARIO_OUTCOMES.FAILURE;
			this.outcomeReason = `Timed out at ${crit.timeoutSeconds.toFixed(0)} s without reaching the target altitude.`;
			return { outcome: this.outcome, reason: this.outcomeReason };
		}

		return { outcome: SIM_SCENARIO_OUTCOMES.RUNNING, reason: '' };
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
