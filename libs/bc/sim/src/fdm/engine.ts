/**
 * Stateful FDM engine wrapper. Holds the current state vector, input
 * latches, and the scenario wind vector; exposes `step(dt)` and
 * `snapshot()` for the worker loop.
 *
 * Pure module: no DOM, no worker APIs, no Date. Driven entirely by the
 * caller (the worker posts `step` calls at 120 Hz; a headless test can
 * drive it at any rate to check determinism).
 */

import { SIM_KNOTS_PER_METER_PER_SECOND } from '@ab/constants';
import type {
	AircraftConfig,
	FdmInputs,
	FdmTruthState,
	ScenarioInitialState,
	ScenarioScriptedInput,
	ScenarioWind,
} from '../types';
import { type FdmStateVector, fdmStep, truthStateFromVector, type WindVector } from './physics';

function clamp(v: number, lo: number, hi: number): number {
	return v < lo ? lo : v > hi ? hi : v;
}

/** Convert a scenario wind (dir deg FROM / kt) into an earth-frame vector. */
export function windFromScenario(wind: ScenarioWind): WindVector {
	const speedMs = wind.speedKnots / SIM_KNOTS_PER_METER_PER_SECOND;
	// Wind is FROM directionDegrees; the air mass moves TO direction + 180.
	const towardRad = ((wind.directionDegrees + 180) * Math.PI) / 180;
	return {
		north: speedMs * Math.cos(towardRad),
		east: speedMs * Math.sin(towardRad),
	};
}

export class FdmEngine {
	private state: FdmStateVector;
	private inputs: FdmInputs;
	private readonly cfg: AircraftConfig;
	private readonly groundElevation: number;
	private readonly wind: WindVector;
	private readonly scriptedInput: ScenarioScriptedInput | undefined;

	constructor(
		cfg: AircraftConfig,
		initial: ScenarioInitialState,
		wind: ScenarioWind = { directionDegrees: 0, speedKnots: 0 },
		scriptedInput?: ScenarioScriptedInput,
	) {
		this.cfg = cfg;
		this.groundElevation = initial.groundElevation;
		this.wind = windFromScenario(wind);
		this.scriptedInput = scriptedInput;
		this.state = {
			x: 0,
			altitude: initial.altitude,
			u: initial.u,
			w: initial.w,
			pitch: initial.pitch,
			pitchRate: initial.pitchRate,
			roll: initial.roll,
			rollRate: initial.rollRate,
			yawRate: initial.yawRate,
			heading: initial.heading,
			t: 0,
			posNorth: 0,
			posEast: 0,
			engineRpm: cfg.idleRpm + (cfg.maxRpm - cfg.idleRpm) * initial.throttle,
			scriptedTrim: 0,
		};
		this.inputs = {
			throttle: initial.throttle,
			elevator: initial.elevator,
			trim: initial.trim,
			aileron: initial.aileron,
			rudder: initial.rudder,
			brake: initial.brake,
			autoCoordinate: initial.autoCoordinate,
			flaps: initial.flaps,
		};
	}

	setInputs(next: Partial<FdmInputs>): void {
		if (typeof next.throttle === 'number') this.inputs.throttle = clamp(next.throttle, 0, 1);
		if (typeof next.elevator === 'number') this.inputs.elevator = clamp(next.elevator, -1, 1);
		if (typeof next.trim === 'number') this.inputs.trim = clamp(next.trim, -1, 1);
		if (typeof next.aileron === 'number') this.inputs.aileron = clamp(next.aileron, -1, 1);
		if (typeof next.rudder === 'number') this.inputs.rudder = clamp(next.rudder, -1, 1);
		if (typeof next.brake === 'boolean') this.inputs.brake = next.brake;
		if (typeof next.autoCoordinate === 'boolean') this.inputs.autoCoordinate = next.autoCoordinate;
		if (typeof next.flaps === 'number') this.inputs.flaps = next.flaps;
	}

	getInputs(): FdmInputs {
		return { ...this.inputs };
	}

	/** Toggle parking brake. */
	toggleBrake(): void {
		this.inputs.brake = !this.inputs.brake;
	}

	/** Toggle auto-coordinate. */
	toggleAutoCoordinate(): void {
		this.inputs.autoCoordinate = !this.inputs.autoCoordinate;
	}

	getWind(): WindVector {
		return { north: this.wind.north, east: this.wind.east };
	}

	/**
	 * Advance one tick. Applies any scripted trim bias first, then runs
	 * the physics step.
	 */
	step(dt: number): FdmStateVector {
		this.updateScriptedTrim(dt);
		this.state = fdmStep(
			this.state,
			this.inputs,
			this.cfg,
			this.groundElevation,
			this.wind,
			this.state.scriptedTrim,
			dt,
		);
		return this.state;
	}

	private updateScriptedTrim(dt: number): void {
		if (!this.scriptedInput) return;
		const s = this.scriptedInput;
		const agl = this.state.altitude - this.groundElevation;
		const startOk = typeof s.startSeconds !== 'number' || this.state.t >= s.startSeconds;
		const aglOk = typeof s.minAltitudeAglMeters !== 'number' || agl >= s.minAltitudeAglMeters;
		if (!startOk || !aglOk) return;
		if (typeof s.trimBiasRatePerSecond !== 'number') return;
		const delta = s.trimBiasRatePerSecond * dt;
		let next = this.state.scriptedTrim + delta;
		if (typeof s.trimBiasMax === 'number') {
			if (delta >= 0) next = Math.min(next, s.trimBiasMax);
			else next = Math.max(next, -Math.abs(s.trimBiasMax));
		}
		this.state.scriptedTrim = next;
	}

	snapshot(): FdmTruthState {
		return truthStateFromVector(this.state, this.cfg, this.inputs, this.groundElevation, this.wind);
	}

	getConfig(): AircraftConfig {
		return this.cfg;
	}

	getGroundElevation(): number {
		return this.groundElevation;
	}
}
