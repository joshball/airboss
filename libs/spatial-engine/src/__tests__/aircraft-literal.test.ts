/**
 * v1 aircraft-literal tests.
 *
 * `aircraftSpecSchema.parse(C172N_SKYHAWK)` succeeds; the CG envelope
 * passes the fwd < aft rule; the perf polar is monotonic in pressure
 * altitude.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-40.
 */

import { describe, expect, it } from 'vitest';
import { C172N_SKYHAWK } from '../flight/aircraft/c172n-skyhawk';
import { loadAircraft } from '../flight/loader';
import { aircraftSpecSchema } from '../flight/schema';

describe('C172N_SKYHAWK aircraft literal', () => {
	it('validates against aircraftSpecSchema', () => {
		expect(aircraftSpecSchema.safeParse(C172N_SKYHAWK).success).toBe(true);
	});

	it('has a CG envelope with forward CG < aft CG at every vertex', () => {
		for (const v of C172N_SKYHAWK.wbEnvelope.envelope) {
			expect(v.fwdCgIn).toBeLessThan(v.aftCgIn);
		}
	});

	it('has a cruise polar monotonic in pressure altitude', () => {
		const points = C172N_SKYHAWK.perfPolar.cruise.points;
		for (let i = 1; i < points.length; i++) {
			expect(points[i].pressureAltitudeFtMsl).toBeGreaterThan(points[i - 1].pressureAltitudeFtMsl);
		}
	});

	it('has a 40-gallon fuel capacity (standard tanks)', () => {
		expect(C172N_SKYHAWK.fuelCapacityGal).toBe(40);
	});

	it('is a VFR-only aircraft', () => {
		expect(C172N_SKYHAWK.equipment.ifrCertified).toBe(false);
	});

	it('is resolvable through loadAircraft', () => {
		const ac = loadAircraft('c172n-skyhawk');
		expect(ac.id).toBe('c172n-skyhawk');
		expect(ac.model).toMatch(/172N/);
	});
});
