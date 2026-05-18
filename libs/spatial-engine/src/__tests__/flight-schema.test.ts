/**
 * Layer-2 flight schema tests.
 *
 * Verifies `routeSpecSchema` + `aircraftSpecSchema` accept synthetic
 * literals and reject an inverted CG envelope + a route with duplicate
 * waypoint ids.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-5.
 */

import { describe, expect, it } from 'vitest';
import { C172N_SKYHAWK } from '../flight/aircraft/c172n-skyhawk';
import { KMEM_KMKL_KOLV } from '../flight/routes/kmem-kmkl-kolv';
import { aircraftSpecSchema, routeSpecSchema } from '../flight/schema';

describe('routeSpecSchema', () => {
	it('accepts the v1 route literal', () => {
		expect(routeSpecSchema.safeParse(KMEM_KMKL_KOLV).success).toBe(true);
	});

	it('rejects a route with duplicate waypoint ids', () => {
		const dup = {
			...KMEM_KMKL_KOLV,
			waypoints: [KMEM_KMKL_KOLV.waypoints[0], { ...KMEM_KMKL_KOLV.waypoints[1], id: KMEM_KMKL_KOLV.waypoints[0].id }],
			altitudeProfile: [KMEM_KMKL_KOLV.altitudeProfile[0]],
			speedProfile: [KMEM_KMKL_KOLV.speedProfile[0]],
		};
		const result = routeSpecSchema.safeParse(dup);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('unique'))).toBe(true);
		}
	});

	it('rejects a route whose altitude profile length is wrong', () => {
		const bad = { ...KMEM_KMKL_KOLV, altitudeProfile: [{ altitudeFtMsl: 4500 }] };
		expect(routeSpecSchema.safeParse(bad).success).toBe(false);
	});
});

describe('aircraftSpecSchema', () => {
	it('accepts the C172N literal', () => {
		expect(aircraftSpecSchema.safeParse(C172N_SKYHAWK).success).toBe(true);
	});

	it('rejects an inverted CG envelope (forward CG > aft CG)', () => {
		const inverted = {
			...C172N_SKYHAWK,
			wbEnvelope: {
				...C172N_SKYHAWK.wbEnvelope,
				envelope: [
					{ weightLb: 1500, fwdCgIn: 50.0, aftCgIn: 47.3 },
					{ weightLb: 2300, fwdCgIn: 51.0, aftCgIn: 47.3 },
				],
			},
		};
		const result = aircraftSpecSchema.safeParse(inverted);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('inverted'))).toBe(true);
		}
	});

	it('rejects a non-monotonic cruise polar', () => {
		const nonMono = {
			...C172N_SKYHAWK,
			perfPolar: {
				...C172N_SKYHAWK.perfPolar,
				cruise: {
					points: [
						{ pressureAltitudeFtMsl: 6000, tasKt: 114, gph: 8.0 },
						{ pressureAltitudeFtMsl: 2000, tasKt: 109, gph: 8.4 },
					],
				},
			},
		};
		const result = aircraftSpecSchema.safeParse(nonMono);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((i) => i.message.includes('monotonic'))).toBe(true);
		}
	});
});
