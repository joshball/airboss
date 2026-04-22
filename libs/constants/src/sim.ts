/**
 * Flight Dynamics Sim constants (Phase 0 throwaway prototype).
 *
 * These are enum-shaped literals and physical/engine tuning values used by
 * the hand-rolled FDM, the scenario definitions, and the SvelteKit sim app.
 * Per the project's "no magic strings/numbers" rule, anything referenced
 * from BC code, the worker, or the UI lives here.
 */

/** Identifiers for Phase 0 scenarios. Extend as scenarios are added. */
export const SIM_SCENARIO_IDS = {
	DEPARTURE_STALL: 'departure-stall',
} as const;

export type SimScenarioId = (typeof SIM_SCENARIO_IDS)[keyof typeof SIM_SCENARIO_IDS];

export const SIM_SCENARIO_ID_VALUES = Object.values(SIM_SCENARIO_IDS) as readonly SimScenarioId[];

/** Aircraft profile identifiers. Phase 0 only ships the C172. */
export const SIM_AIRCRAFT_IDS = {
	C172: 'c172',
} as const;

export type SimAircraftId = (typeof SIM_AIRCRAFT_IDS)[keyof typeof SIM_AIRCRAFT_IDS];

/** Terminal states for a scenario run. */
export const SIM_SCENARIO_OUTCOMES = {
	RUNNING: 'running',
	SUCCESS: 'success',
	FAILURE: 'failure',
	ABORTED: 'aborted',
} as const;

export type SimScenarioOutcome = (typeof SIM_SCENARIO_OUTCOMES)[keyof typeof SIM_SCENARIO_OUTCOMES];

/**
 * FDM integrator configuration.
 *
 * The physics loop runs at `FDM_HZ` inside a Web Worker; UI snapshots are
 * posted to the main thread at `SNAPSHOT_HZ` to keep the instrument
 * components painting at ~60 Hz without saturating postMessage.
 */
export const SIM_TIMING = {
	FDM_HZ: 120,
	SNAPSHOT_HZ: 60,
} as const;

/** Derived step sizes (seconds). */
export const SIM_FDM_DT_SECONDS = 1 / SIM_TIMING.FDM_HZ;
export const SIM_SNAPSHOT_INTERVAL_SECONDS = 1 / SIM_TIMING.SNAPSHOT_HZ;

/** Standard atmosphere sea-level air density (kg/m^3). */
export const SIM_SEA_LEVEL_DENSITY_KG_M3 = 1.225;

/** Gravity (m/s^2). */
export const SIM_GRAVITY_M_S2 = 9.80665;

/** Unit conversions used across the FDM and instruments. */
export const SIM_METERS_PER_FOOT = 0.3048;
export const SIM_FEET_PER_METER = 1 / SIM_METERS_PER_FOOT;
export const SIM_KNOTS_PER_METER_PER_SECOND = 1.943844492440605;

/** Message kinds exchanged with the FDM worker. */
export const SIM_WORKER_MESSAGES = {
	INIT: 'init',
	START: 'start',
	PAUSE: 'pause',
	RESUME: 'resume',
	RESET: 'reset',
	INPUT: 'input',
	SNAPSHOT: 'snapshot',
	OUTCOME: 'outcome',
	READY: 'ready',
} as const;

export type SimWorkerMessage = (typeof SIM_WORKER_MESSAGES)[keyof typeof SIM_WORKER_MESSAGES];
