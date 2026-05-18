/**
 * `<RouteOverlay>` rendering tests.
 *
 * The route line + one diamond per waypoint render; the click handler
 * fires with the waypoint payload.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-21, XC-23.
 */

import { regionalLambertProjection } from '@ab/spatial-engine';
import { KMEM_KMKL_KOLV } from '@ab/spatial-engine/server';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RouteOverlay from '../RouteOverlay.svelte';

afterEach(cleanup);

const projection = regionalLambertProjection('memphis', { width: 800, height: 600 });

describe('<RouteOverlay>', () => {
	it('renders one route line path', () => {
		const { container } = render(RouteOverlay, { route: KMEM_KMKL_KOLV, projection });
		expect(container.querySelectorAll('.route-line').length).toBe(1);
	});

	it('renders one waypoint diamond per route waypoint', () => {
		const { container } = render(RouteOverlay, { route: KMEM_KMKL_KOLV, projection });
		expect(container.querySelectorAll('.route-waypoint').length).toBe(KMEM_KMKL_KOLV.waypoints.length);
	});

	it('tags each waypoint group with its id', () => {
		const { container } = render(RouteOverlay, { route: KMEM_KMKL_KOLV, projection });
		expect(container.querySelector('[data-waypoint-id="wp-kmem"]')).not.toBeNull();
		expect(container.querySelector('[data-waypoint-id="wp-kolv"]')).not.toBeNull();
	});

	it('fires the waypoint-click handler with the waypoint object', async () => {
		const onwaypointclick = vi.fn();
		const { container } = render(RouteOverlay, { route: KMEM_KMKL_KOLV, projection, onwaypointclick });
		const wp = container.querySelector('[data-waypoint-id="wp-kmem"]');
		expect(wp).not.toBeNull();
		if (wp) await fireEvent.click(wp);
		expect(onwaypointclick).toHaveBeenCalledTimes(1);
		expect(onwaypointclick.mock.calls[0][0].id).toBe('wp-kmem');
	});

	it('distinguishes airport waypoints from fix waypoints', () => {
		const { container } = render(RouteOverlay, { route: KMEM_KMKL_KOLV, projection });
		const airportWp = container.querySelector('[data-waypoint-id="wp-kmem"]');
		const fixWp = container.querySelector('[data-waypoint-id="wp-kmem-dep-fix"]');
		expect(airportWp?.classList.contains('waypoint-airport')).toBe(true);
		expect(fixWp?.classList.contains('waypoint-fix')).toBe(true);
	});
});
