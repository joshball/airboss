/**
 * `<WaypointWxChip>` rendering tests.
 *
 * The chip renders the METAR flight category, colors by category, and
 * fires the click handler.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-31.
 */

import { regionalLambertProjection } from '@ab/spatial-engine';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WaypointWxChip from '../WaypointWxChip.svelte';
import { fixtureBundleWithWeather } from './fixtures';

afterEach(cleanup);

const projection = regionalLambertProjection('memphis', { width: 800, height: 600 });
const waypointA = fixtureBundleWithWeather.flight.route.waypoints[0];
const waypointB = fixtureBundleWithWeather.flight.route.waypoints[1];
const wxViewA = fixtureBundleWithWeather.weather.byWaypoint['wp-a'];
const wxViewB = fixtureBundleWithWeather.weather.byWaypoint['wp-b'];

describe('<WaypointWxChip>', () => {
	it('renders a chip carrying the METAR flight category', () => {
		const { container } = render(WaypointWxChip, { waypoint: waypointA, wxView: wxViewA, projection });
		const chip = container.querySelector('[data-testid="wx-chip"]');
		expect(chip).not.toBeNull();
		expect(chip?.getAttribute('data-flight-category')).toBe('VFR');
	});

	it('colors the chip by flight category', () => {
		const { container } = render(WaypointWxChip, { waypoint: waypointB, wxView: wxViewB, projection });
		const chip = container.querySelector('[data-testid="wx-chip"]');
		expect(chip?.classList.contains('wx-cat-ifr')).toBe(true);
	});

	it('fires the chip-click handler with the waypoint + view', async () => {
		const onchipclick = vi.fn();
		const { container } = render(WaypointWxChip, { waypoint: waypointA, wxView: wxViewA, projection, onchipclick });
		const chip = container.querySelector('[data-testid="wx-chip"]');
		expect(chip).not.toBeNull();
		if (chip) await fireEvent.click(chip);
		expect(onchipclick).toHaveBeenCalledTimes(1);
		expect(onchipclick.mock.calls[0][0].waypoint.id).toBe('wp-a');
	});

	it('renders nothing when the waypoint has no METAR', () => {
		const noMetar = { ...wxViewA, metar: null };
		const { container } = render(WaypointWxChip, { waypoint: waypointA, wxView: noMetar, projection });
		expect(container.querySelector('[data-testid="wx-chip"]')).toBeNull();
	});
});
