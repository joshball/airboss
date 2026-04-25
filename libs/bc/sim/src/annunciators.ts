/**
 * Annunciator predicates.
 *
 * Each function returns true when the cockpit annunciator should be
 * lit. Predicates are pure on DisplayState + AircraftConfig so the
 * cockpit, the dev gallery, and any future debrief panel all light
 * the same lamps for the same state.
 *
 * The annunciator strip is informational, not modelled in the FDM.
 * Faults are still triggered by the scenario runner via def.faults;
 * these predicates surface the consequence to the pilot.
 */

import type { DisplayState } from './faults/types';
import type { AircraftConfig } from './types';

/** Threshold below which the alternator-low-voltage lamp lights (volts). */
export const LOW_VOLTAGE_THRESHOLD_V = 24;
/** Threshold below which the low-fuel lamp lights (gallons, per tank). */
export const LOW_FUEL_GALLONS = 5;
/** Buffer below the oil-temp redline at which the over-temp lamp lights (C). */
export const OIL_TEMP_BUFFER_C = 10;
/** Vacuum below this (in.Hg) lights the vacuum-low lamp. */
export const VACUUM_LOW_INHG = 4.5;

export function shouldAnnunciateLowVoltage(display: DisplayState): boolean {
	return display.electricBusVolts < LOW_VOLTAGE_THRESHOLD_V;
}

export function shouldAnnunciateLowFuel(display: DisplayState): boolean {
	return display.fuelLeftGallons < LOW_FUEL_GALLONS || display.fuelRightGallons < LOW_FUEL_GALLONS;
}

export function shouldAnnunciateOilPress(display: DisplayState, cfg: AircraftConfig): boolean {
	return display.oilPressurePsi < cfg.oilPressureGreenLowPsi;
}

export function shouldAnnunciateOilTemp(display: DisplayState, cfg: AircraftConfig): boolean {
	return display.oilTempCelsius > cfg.oilTempRedlineC - OIL_TEMP_BUFFER_C;
}

export function shouldAnnunciateVacuumLow(display: DisplayState): boolean {
	return display.vacuumInHg < VACUUM_LOW_INHG;
}

/**
 * Aggregate the annunciator lamp states. Returns one boolean per lamp;
 * the cockpit + gallery render the strip from this object so they cannot
 * disagree about which lamp is lit.
 */
export interface AnnunciatorState {
	lowVoltage: boolean;
	lowFuel: boolean;
	oilPress: boolean;
	oilTemp: boolean;
	vacuumLow: boolean;
}

export function annunciatorState(display: DisplayState, cfg: AircraftConfig): AnnunciatorState {
	return {
		lowVoltage: shouldAnnunciateLowVoltage(display),
		lowFuel: shouldAnnunciateLowFuel(display),
		oilPress: shouldAnnunciateOilPress(display, cfg),
		oilTemp: shouldAnnunciateOilTemp(display, cfg),
		vacuumLow: shouldAnnunciateVacuumLow(display),
	};
}
