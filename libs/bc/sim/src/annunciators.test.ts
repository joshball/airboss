/**
 * Annunciator predicate tests. Pure -- no FDM, no audio, no UI.
 */

import { describe, expect, it } from 'vitest';
import {
	annunciatorState,
	LOW_FUEL_GALLONS,
	LOW_VOLTAGE_THRESHOLD_V,
	OIL_TEMP_BUFFER_C,
	shouldAnnunciateLowFuel,
	shouldAnnunciateLowVoltage,
	shouldAnnunciateOilPress,
	shouldAnnunciateOilTemp,
	shouldAnnunciateVacuumLow,
	VACUUM_LOW_INHG,
} from './annunciators';
import type { DisplayState } from './faults/types';
import { C172_CONFIG } from './fdm/c172';

function makeDisplay(overrides: Partial<DisplayState> = {}): DisplayState {
	return {
		indicatedAirspeed: 0,
		altitudeMsl: 0,
		verticalSpeed: 0,
		pitchIndicated: 0,
		rollIndicated: 0,
		headingIndicated: 0,
		yawRateIndicated: 0,
		slipBall: 0,
		alpha: 0,
		stallWarning: false,
		stalled: false,
		engineRpm: 800,
		flapsDegrees: 0,
		electricBusVolts: 28,
		onGround: true,
		t: 0,
		oilPressurePsi: 60,
		oilTempCelsius: 95,
		fuelLeftGallons: 26,
		fuelRightGallons: 26,
		ammeterAmps: 3,
		vacuumInHg: 5,
		...overrides,
	};
}

describe('shouldAnnunciateLowVoltage', () => {
	it('does not fire at nominal volts', () => {
		expect(shouldAnnunciateLowVoltage(makeDisplay({ electricBusVolts: 28 }))).toBe(false);
	});

	it('fires when bus drops below the threshold', () => {
		expect(shouldAnnunciateLowVoltage(makeDisplay({ electricBusVolts: LOW_VOLTAGE_THRESHOLD_V - 0.1 }))).toBe(true);
	});

	it('does not fire exactly at the threshold (strict less-than)', () => {
		expect(shouldAnnunciateLowVoltage(makeDisplay({ electricBusVolts: LOW_VOLTAGE_THRESHOLD_V }))).toBe(false);
	});
});

describe('shouldAnnunciateLowFuel', () => {
	it('does not fire when both tanks are well above the threshold', () => {
		expect(shouldAnnunciateLowFuel(makeDisplay({ fuelLeftGallons: 26, fuelRightGallons: 26 }))).toBe(false);
	});

	it('fires when the left tank dips below the threshold', () => {
		expect(
			shouldAnnunciateLowFuel(makeDisplay({ fuelLeftGallons: LOW_FUEL_GALLONS - 0.1, fuelRightGallons: 20 })),
		).toBe(true);
	});

	it('fires when the right tank dips below the threshold', () => {
		expect(
			shouldAnnunciateLowFuel(makeDisplay({ fuelLeftGallons: 20, fuelRightGallons: LOW_FUEL_GALLONS - 0.1 })),
		).toBe(true);
	});
});

describe('shouldAnnunciateOilPress', () => {
	it('fires when oil pressure drops below the green-arc low', () => {
		expect(shouldAnnunciateOilPress(makeDisplay({ oilPressurePsi: 20 }), C172_CONFIG)).toBe(true);
	});

	it('does not fire in the green arc', () => {
		expect(shouldAnnunciateOilPress(makeDisplay({ oilPressurePsi: 60 }), C172_CONFIG)).toBe(false);
	});
});

describe('shouldAnnunciateOilTemp', () => {
	it('fires within the redline buffer', () => {
		expect(
			shouldAnnunciateOilTemp(
				makeDisplay({ oilTempCelsius: C172_CONFIG.oilTempRedlineC - OIL_TEMP_BUFFER_C + 1 }),
				C172_CONFIG,
			),
		).toBe(true);
	});

	it('does not fire at cruise temp', () => {
		expect(shouldAnnunciateOilTemp(makeDisplay({ oilTempCelsius: C172_CONFIG.oilTempCruiseC }), C172_CONFIG)).toBe(
			false,
		);
	});
});

describe('shouldAnnunciateVacuumLow', () => {
	it('fires below the threshold', () => {
		expect(shouldAnnunciateVacuumLow(makeDisplay({ vacuumInHg: VACUUM_LOW_INHG - 0.1 }))).toBe(true);
	});

	it('does not fire at the nominal value', () => {
		expect(shouldAnnunciateVacuumLow(makeDisplay({ vacuumInHg: 5 }))).toBe(false);
	});
});

describe('annunciatorState aggregate', () => {
	it('reports all-clear at healthy values', () => {
		const state = annunciatorState(makeDisplay(), C172_CONFIG);
		expect(state).toEqual({
			lowVoltage: false,
			lowFuel: false,
			oilPress: false,
			oilTemp: false,
			vacuumLow: false,
		});
	});

	it('lights every lamp when each predicate fires', () => {
		const state = annunciatorState(
			makeDisplay({
				electricBusVolts: 10,
				fuelLeftGallons: 1,
				fuelRightGallons: 1,
				oilPressurePsi: 10,
				oilTempCelsius: 115,
				vacuumInHg: 0,
			}),
			C172_CONFIG,
		);
		expect(state).toEqual({
			lowVoltage: true,
			lowFuel: true,
			oilPress: true,
			oilTemp: true,
			vacuumLow: true,
		});
	});
});
