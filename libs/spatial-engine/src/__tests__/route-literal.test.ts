/**
 * v1 route-literal tests.
 *
 * `routeSpecSchema.parse(KMEM_KMKL_KOLV)` succeeds; the waypoint count is
 * 5; the first waypoint matches the KMEM airport coordinate.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-20.
 */

import { describe, expect, it } from 'vitest';
import { loadRoute } from '../flight/loader';
import { KMEM_KMKL_KOLV } from '../flight/routes/kmem-kmkl-kolv';
import { routeSpecSchema } from '../flight/schema';

describe('KMEM_KMKL_KOLV route literal', () => {
	it('validates against routeSpecSchema', () => {
		expect(routeSpecSchema.safeParse(KMEM_KMKL_KOLV).success).toBe(true);
	});

	it('has five waypoints', () => {
		expect(KMEM_KMKL_KOLV.waypoints.length).toBe(5);
	});

	it('has four legs (one altitude + one speed step per leg)', () => {
		expect(KMEM_KMKL_KOLV.altitudeProfile.length).toBe(4);
		expect(KMEM_KMKL_KOLV.speedProfile.length).toBe(4);
	});

	it('starts at KMEM within 0.01 deg of the airport coordinate', () => {
		const first = KMEM_KMKL_KOLV.waypoints[0];
		expect(Math.abs(first.lon - -89.9767)).toBeLessThan(0.01);
		expect(Math.abs(first.lat - 35.0424)).toBeLessThan(0.01);
		expect(first.airportIcao).toBe('KMEM');
	});

	it('is resolvable through loadRoute', () => {
		const route = loadRoute('kmem-kmkl-kolv');
		expect(route.id).toBe('kmem-kmkl-kolv');
		expect(route.waypoints.length).toBe(5);
	});

	it('declares KMKL as the alternate', () => {
		expect(KMEM_KMKL_KOLV.alternateIcao).toBe('KMKL');
	});
});
