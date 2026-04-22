/**
 * Stateful FDM engine wrapper. Holds the current state vector and input
 * latches; exposes `step(dt)` and `snapshot()` for the worker loop.
 *
 * Pure module: no DOM, no worker APIs, no Date. Driven entirely by the
 * caller (the worker posts `step` calls at 120 Hz; a headless test can
 * drive it at any rate to check determinism).
 */

import type { AircraftConfig, FdmInputs, FdmTruthState, ScenarioInitialState } from '../types';
import { type FdmStateVector, rk4Step, truthStateFromVector } from './physics';

export class FdmEngine {
	private state: FdmStateVector;
	private inputs: FdmInputs;
	private readonly cfg: AircraftConfig;
	private readonly groundElevation: number;

	constructor(cfg: AircraftConfig, initial: ScenarioInitialState) {
		this.cfg = cfg;
		this.groundElevation = initial.groundElevation;
		this.state = {
			x: 0,
			altitude: initial.altitude,
			u: initial.u,
			w: initial.w,
			pitch: initial.pitch,
			pitchRate: initial.pitchRate,
			t: 0,
		};
		this.inputs = {
			throttle: initial.throttle,
			elevator: initial.elevator,
		};
	}

	setInputs(next: Partial<FdmInputs>): void {
		if (typeof next.throttle === 'number') {
			this.inputs.throttle = clamp(next.throttle, 0, 1);
		}
		if (typeof next.elevator === 'number') {
			this.inputs.elevator = clamp(next.elevator, -1, 1);
		}
	}

	getInputs(): FdmInputs {
		return { throttle: this.inputs.throttle, elevator: this.inputs.elevator };
	}

	/** Advance one tick. Returns the new internal state. */
	step(dt: number): FdmStateVector {
		this.state = rk4Step(this.state, this.inputs, this.cfg, this.groundElevation, dt);
		return this.state;
	}

	snapshot(): FdmTruthState {
		return truthStateFromVector(this.state, this.cfg, this.groundElevation);
	}

	getConfig(): AircraftConfig {
		return this.cfg;
	}

	getGroundElevation(): number {
		return this.groundElevation;
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}
