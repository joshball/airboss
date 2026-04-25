/**
 * Engine cluster gauge derivation.
 *
 * The FDM does not model the engine internals (oil pressure, oil
 * temperature, cylinder head temp, manifold pressure, etc). For a
 * training-grade sim we synthesize each cluster reading from RPM +
 * throttle + elapsed sim time so the gauges respond to pilot input
 * coherently:
 *
 *   - Oil pressure scales linearly between idle and max RPM.
 *   - Oil temperature warms up exponentially toward the cruise-temp
 *     setpoint, with a configurable warmup time constant.
 *   - Fuel quantity is integrated separately as part of the FDM state
 *     vector (it actually depletes over time -- not a function of the
 *     instantaneous tick).
 *   - Ammeter scales linearly with throttle (heavier electrical load
 *     while charging the battery during higher RPM).
 *   - Vacuum is a step function: 0 at engine-stopped, nominal once
 *     RPM crosses idle.
 *
 * Each value is plain truth -- the fault model decides whether to lie
 * about it on the way to the cockpit. Alternator failure wires the
 * ammeter and electric instruments; vacuum failure zeros the vacuum
 * gauge and drifts the AI/HI.
 */

import type { AircraftConfig } from '../types';

export interface EngineClusterReading {
	oilPressurePsi: number;
	oilTempCelsius: number;
	ammeterAmps: number;
	vacuumInHg: number;
}

export interface EngineClusterInput {
	cfg: AircraftConfig;
	rpm: number;
	throttle: number;
	/** Elapsed sim time since scenario start (sec). Drives the warmup curve. */
	elapsedSeconds: number;
	/** Outside air temperature at the engine. ISA standard at sea level today. */
	oatCelsius?: number;
}

/** Cold-start reference; oil sits at OAT until the engine warms it. */
const ISA_SEA_LEVEL_OAT_C = 15;

/**
 * Compute every cluster reading from the current input. Pure -- no
 * persistent state (fuel is integrated separately on the FDM state
 * vector since it actually depletes).
 */
export function computeEngineCluster(input: EngineClusterInput): EngineClusterReading {
	const { cfg, rpm, throttle, elapsedSeconds } = input;
	const oat = input.oatCelsius ?? ISA_SEA_LEVEL_OAT_C;

	// Oil pressure: linear in RPM between idle and max.
	const rpmRange = Math.max(1, cfg.maxRpm - cfg.idleRpm);
	const rpmFraction = Math.max(0, Math.min(1, (rpm - cfg.idleRpm) / rpmRange));
	const oilPressurePsi = cfg.oilPressureIdlePsi + rpmFraction * (cfg.oilPressureMaxPsi - cfg.oilPressureIdlePsi);

	// Oil temperature: exponential approach to cruise-temp from OAT
	// when the engine is running, decay back toward OAT when idle/off.
	const isRunning = rpm >= cfg.idleRpm * 0.9;
	const targetTemp = isRunning ? cfg.oilTempCruiseC : oat;
	const tau = cfg.oilWarmupSeconds;
	// 1 - exp(-t/tau) saturates at the target. Starts cold at OAT.
	const warmupRatio = 1 - Math.exp(-elapsedSeconds / tau);
	const oilTempCelsius = oat + (targetTemp - oat) * warmupRatio;

	// Ammeter: positive when alternator is charging, scales with throttle.
	// Idle reading reflects standby load; cruise reading reflects avionics
	// + battery charging at higher RPM.
	const ammeterAmps =
		cfg.ammeterIdleAmps + Math.max(0, Math.min(1, throttle)) * (cfg.ammeterCruiseAmps - cfg.ammeterIdleAmps);

	// Vacuum: nominal once the engine is running, zero otherwise.
	const vacuumInHg = isRunning ? cfg.vacuumNominalInHg : 0;

	return { oilPressurePsi, oilTempCelsius, ammeterAmps, vacuumInHg };
}

/**
 * Per-tick fuel burn rate in gallons-per-second for the given throttle.
 * Caller integrates by multiplying by dt and subtracting from the
 * appropriate tank. Linear interpolation between idle-burn and full-
 * burn rates.
 */
export function fuelBurnGallonsPerSecond(cfg: AircraftConfig, throttle: number): number {
	const t = Math.max(0, Math.min(1, throttle));
	const gph = cfg.fuelBurnGphIdle + t * (cfg.fuelBurnGphFull - cfg.fuelBurnGphIdle);
	return gph / 3600;
}
