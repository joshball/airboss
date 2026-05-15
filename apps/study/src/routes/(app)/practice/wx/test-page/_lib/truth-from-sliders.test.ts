/**
 * Unit tests for the slider-state -> TruthModel mapper.
 *
 * The mapper is the load-bearing pure helper of the `/practice/wx/test-page`
 * sandbox: every lever must (a) keep the truth model schema-valid and
 * (b) produce the derivation effect the slider label promises. These tests
 * import the server-only `truthModelSchema` + `deriveMetar` directly --
 * test files run in node mode, so the server barrel is fine here.
 */

import { deriveMetar, truthModelSchema } from '@ab/wx-engine/server';
import { describe, expect, it } from 'vitest';
import { truthFromSliders } from './truth-from-sliders';
import { SANDBOX_DEFAULT_STATE, SANDBOX_STATION, type SandboxSliderState } from './types';

function state(overrides: Partial<SandboxSliderState> = {}): SandboxSliderState {
	return { ...SANDBOX_DEFAULT_STATE, ...overrides };
}

describe('truthFromSliders', () => {
	it('produces a schema-valid truth model from the default state', () => {
		const result = truthModelSchema.safeParse(truthFromSliders(SANDBOX_DEFAULT_STATE));
		expect(result.success).toBe(true);
	});

	it('keeps the model schema-valid across every lever extreme', () => {
		const extremes: SandboxSliderState[] = [
			state({ windDirDeg: 0, windKt: 0, tempC: -25, dewpointSpreadC: 0, seaLevelPressureMb: 980 }),
			state({ windDirDeg: 350, windKt: 45, tempC: 42, dewpointSpreadC: 25, seaLevelPressureMb: 1040 }),
			state({ frontDistanceKm: 0, frontIntensity: 'strong', cellDistanceNm: 0, hazardSeverity: 'severe' }),
			state({ frontDistanceKm: 600, cellDistanceNm: 120, hazardSeverity: 'off', frontIntensity: 'weak' }),
		];
		for (const s of extremes) {
			expect(truthModelSchema.safeParse(truthFromSliders(s)).success).toBe(true);
		}
	});

	it('routes the wind sliders into the air mass surface state', () => {
		const truth = truthFromSliders(state({ windDirDeg: 310, windKt: 22 }));
		const airMass = truth.airMasses[0];
		expect(airMass?.surfaceWindDirDeg).toBe(310);
		expect(airMass?.surfaceWindKt).toBe(22);
	});

	it('derives dewpoint as temp minus the spread lever', () => {
		const truth = truthFromSliders(state({ tempC: 18, dewpointSpreadC: 6 }));
		const airMass = truth.airMasses[0];
		expect(airMass?.surfaceTempC).toBe(18);
		expect(airMass?.surfaceDewpointC).toBe(12);
	});

	it('feeds the SLP slider into the pressure system central pressure', () => {
		const truth = truthFromSliders(state({ seaLevelPressureMb: 1028 }));
		const system = truth.synoptic.pressureSystems[0];
		expect(system?.centralPressureMb).toBe(1028);
		expect(system?.kind).toBe('H');
	});

	it('labels a sub-background SLP as a low-pressure system', () => {
		const truth = truthFromSliders(state({ seaLevelPressureMb: 994 }));
		expect(truth.synoptic.pressureSystems[0]?.kind).toBe('L');
	});

	it('omits the cold front when the front lever is parked at the max', () => {
		const truth = truthFromSliders(state({ frontDistanceKm: 600 }));
		expect(truth.synoptic.fronts).toHaveLength(0);
	});

	it('places a cold front when the front lever is closed in', () => {
		const truth = truthFromSliders(state({ frontDistanceKm: 120, frontIntensity: 'strong' }));
		expect(truth.synoptic.fronts).toHaveLength(1);
		expect(truth.synoptic.fronts[0]?.kind).toBe('cold');
		expect(truth.synoptic.fronts[0]?.intensity).toBe('strong');
	});

	it('produces a gust group when a strong cold front is close', () => {
		const gusty = truthFromSliders(state({ windKt: 18, frontDistanceKm: 100, frontIntensity: 'strong' }));
		const metar = deriveMetar(gusty, SANDBOX_STATION.icao);
		expect(metar.raw).toMatch(/\d{3}\d{2}G\d{2}KT/);
	});

	it('produces no gust group with no front present', () => {
		const calm = truthFromSliders(state({ windKt: 18, frontDistanceKm: 600 }));
		const metar = deriveMetar(calm, SANDBOX_STATION.icao);
		expect(metar.raw).not.toMatch(/G\d{2}KT/);
	});

	it('omits the convective cell when the cell lever is parked at the max', () => {
		const truth = truthFromSliders(state({ cellDistanceNm: 120 }));
		expect(truth.convection.cells).toHaveLength(0);
	});

	it('emits +TSRA when a convective cell is within the influence radius', () => {
		const stormy = truthFromSliders(state({ cellDistanceNm: 0 }));
		const metar = deriveMetar(stormy, SANDBOX_STATION.icao);
		expect(metar.raw).toMatch(/\+TSRA/);
	});

	it('omits the hazard zone when severity is off', () => {
		const truth = truthFromSliders(state({ hazardSeverity: 'off' }));
		expect(truth.hazardZones).toHaveLength(0);
	});

	it('drops visibility to IFR minimums with a moderate hazard', () => {
		const ifr = truthFromSliders(state({ hazardSeverity: 'moderate' }));
		const metar = deriveMetar(ifr, SANDBOX_STATION.icao);
		expect(metar.parsed.visibilitySM).toBe(3);
	});

	it('drops visibility below 1 SM with a severe hazard', () => {
		const lifr = truthFromSliders(state({ hazardSeverity: 'severe' }));
		const metar = deriveMetar(lifr, SANDBOX_STATION.icao);
		const vis = metar.parsed.visibilitySM;
		expect(vis).not.toBeNull();
		expect(vis ?? Number.POSITIVE_INFINITY).toBeLessThan(1);
		expect(metar.raw).toMatch(/FG/);
	});

	it('is pure -- the same slider state yields a deeply equal truth model', () => {
		const s = state({ windKt: 14, tempC: 9, frontDistanceKm: 200 });
		expect(truthFromSliders(s)).toEqual(truthFromSliders(s));
	});
});
