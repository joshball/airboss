/**
 * Bundle composition + performance derivation integration tests.
 *
 * `composeBundle` for the v1 scenario returns a fully-populated bundle;
 * `derivePerformance` yields a 4-leg table with a non-negative reserve;
 * `runConsistency` passes; a pathological 400-nm route is rejected.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-6, XC-41..44.
 */

import { describe, expect, it } from 'vitest';
import { C172N_SKYHAWK } from '../flight/aircraft/c172n-skyhawk';
import { derivePerformance } from '../flight/performance';
import { KMEM_KMKL_KOLV } from '../flight/routes/kmem-kmkl-kolv';
import type { RouteSpec } from '../flight/types';
import { composeScenario } from '../scenario/compose';
import { runConsistency } from '../validate/consistency';
import { validateScenario } from '../validate/scenario-check';
import { loadWeatherForScenario } from '../weather/view';

describe('composeBundle', () => {
	it('returns a fully-populated bundle for the v1 scenario', () => {
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		expect(bundle.scenarioId).toBe('kmem-kmkl-kolv-frontal-march');
		expect(bundle.geography.airports.length).toBeGreaterThan(3);
		expect(bundle.geography.airspace.length).toBeGreaterThanOrEqual(3);
		expect(bundle.flight.route.waypoints.length).toBe(5);
		expect(Object.keys(bundle.weather.byWaypoint).length).toBe(5);
		expect(bundle.events).toEqual([]);
		expect(bundle.performance.legs.length).toBe(4);
	});

	it('ships zero scenario events in v1', () => {
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		expect(bundle.events.length).toBe(0);
	});
});

describe('derivePerformance', () => {
	it('produces a 4-leg table with every per-leg field populated', () => {
		const weather = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);
		const table = derivePerformance({
			route: KMEM_KMKL_KOLV,
			aircraft: C172N_SKYHAWK,
			weather,
			magneticVariationDeg: -1,
		});
		expect(table.legs.length).toBe(4);
		for (const leg of table.legs) {
			expect(leg.distanceNm).toBeGreaterThan(0);
			expect(leg.trueCourse).toBeGreaterThanOrEqual(0);
			expect(leg.trueCourse).toBeLessThan(360);
			expect(leg.groundSpeedKt).toBeGreaterThan(0);
			expect(leg.eteMin).toBeGreaterThan(0);
			expect(leg.fuelGal).toBeGreaterThan(0);
		}
	});

	it('produces a non-negative reserve for the v1 route (short XC, full tanks)', () => {
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		expect(bundle.performance.reserveGal).toBeGreaterThanOrEqual(0);
	});

	it('total fuel is the sum of per-leg fuel', () => {
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		const summed = bundle.performance.legs.reduce((s, l) => s + l.fuelGal, 0);
		expect(bundle.performance.totalFuelGal).toBeCloseTo(summed, 5);
	});

	it('reserve is capacity minus total burn', () => {
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		expect(bundle.performance.reserveGal).toBeCloseTo(
			C172N_SKYHAWK.fuelCapacityGal - bundle.performance.totalFuelGal,
			5,
		);
	});

	it('the total fuel is within a plausible band for a ~125-nm C172N XC', () => {
		// Two ~58-nm cruise legs plus two short pattern legs at 8 gph cruise:
		// with the scenario winds the total lands in single-digit-to-low-teens
		// gallons. The hard guarantee is internal consistency (the spec's
		// killer-feature thesis); this band is a sanity check, not a fixture.
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		expect(bundle.performance.totalFuelGal).toBeGreaterThan(5);
		expect(bundle.performance.totalFuelGal).toBeLessThan(25);
	});
});

describe('runConsistency', () => {
	it('passes for the v1 scenario', () => {
		const bundle = composeScenario('kmem-kmkl-kolv-frontal-march');
		const report = runConsistency(bundle);
		expect(report.ok).toBe(true);
		expect(report.issues.filter((i) => i.rule !== 'altitude-near-ceiling')).toEqual([]);
	});

	it('rejects a pathological route whose fuel burn exceeds capacity', () => {
		// A ~700-nm route on a 40-gal C172N at 8 gph burns more than six
		// hours of fuel -- past the tanks. Build a synthetic multi-leg route
		// and confirm the reserve check produces a negative reserve.
		const longRoute: RouteSpec = {
			...KMEM_KMKL_KOLV,
			waypoints: [
				{ id: 'far-a', label: 'FAR-A', lon: -95.0, lat: 33.0, kind: 'fix' },
				{ id: 'far-b', label: 'FAR-B', lon: -95.0, lat: 44.0, kind: 'fix' },
				{ id: 'far-c', label: 'FAR-C', lon: -85.0, lat: 44.0, kind: 'fix' },
			],
			altitudeProfile: [{ altitudeFtMsl: 4500 }, { altitudeFtMsl: 4500 }],
			speedProfile: [{ tasKt: 110 }, { tasKt: 110 }],
			alternateIcao: undefined,
		};
		const weather = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', longRoute.waypoints);
		const table = derivePerformance({
			route: longRoute,
			aircraft: C172N_SKYHAWK,
			weather,
			magneticVariationDeg: -1,
		});
		expect(table.reserveGal).toBeLessThan(0);
	});
});

describe('validateScenario', () => {
	it('reports the v1 scenario as valid', () => {
		const result = validateScenario('kmem-kmkl-kolv-frontal-march');
		expect(result.ok).toBe(true);
		expect(result.error).toBeUndefined();
	});
});
