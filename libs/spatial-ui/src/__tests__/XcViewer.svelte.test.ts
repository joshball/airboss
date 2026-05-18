/**
 * `<XcViewer>` Phase B rendering tests.
 *
 * The viewer renders the layer-1 sectional (basemap + airspace + airports
 * + navaids) plus the pan/zoom + layer-toggle chrome against a synthetic
 * bundle, with no hydration errors.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-10, XC-15.
 */

import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import XcViewer from '../XcViewer.svelte';
import { fixtureBundle, fixtureBundleWithPerformance, fixtureBundleWithWeather } from './fixtures';

afterEach(cleanup);

describe('<XcViewer> (Phase B sectional)', () => {
	it('renders the viewer shell with an SVG canvas', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="xc-viewer"]')).not.toBeNull();
		expect(container.querySelector('.xc-canvas')).not.toBeNull();
	});

	it('renders the basemap, airspace, navaid, and airport layers', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="basemap-layer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="airspace-layer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="navaid-layer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="airport-layer"]')).not.toBeNull();
	});

	it('renders the pan/zoom + layer-toggle chrome', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="zoom-pan-controls"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="layer-toggle"]')).not.toBeNull();
	});

	it('hides a layer when its toggle is unchecked', async () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		const airspaceToggle = container.querySelector<HTMLInputElement>('[data-layer-key="airspace"]');
		expect(airspaceToggle).not.toBeNull();
		expect(container.querySelector('[data-testid="airspace-layer"]')).not.toBeNull();
		if (airspaceToggle) await fireEvent.click(airspaceToggle);
		expect(container.querySelector('[data-testid="airspace-layer"]')).toBeNull();
	});

	it('renders one airport symbol per region airport', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelectorAll('.airport-symbol').length).toBe(fixtureBundle.geography.airports.length);
	});
});

describe('<XcViewer> (Phase C route overlay)', () => {
	it('renders the route overlay with the route line', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="route-overlay"]')).not.toBeNull();
		expect(container.querySelector('.route-line')).not.toBeNull();
	});

	it('renders one waypoint diamond per route waypoint', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelectorAll('.route-waypoint').length).toBe(fixtureBundle.flight.route.waypoints.length);
	});

	it('renders one leg label per leg (waypoints - 1)', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		const expectedLegs = fixtureBundle.flight.route.waypoints.length - 1;
		expect(container.querySelectorAll('[data-testid="leg-label"]').length).toBe(expectedLegs);
	});
});

describe('<XcViewer> (Phase D weather overlay)', () => {
	it('renders a wx chip for every waypoint with a weather view', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithWeather });
		// The weather fixture populates wp-a + wp-b.
		expect(container.querySelectorAll('[data-testid="wx-chip"]').length).toBe(2);
	});

	it('renders an AIRMET polygon for every AIRMET in the bundle', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithWeather });
		expect(container.querySelectorAll('[data-testid="airmet-polygon"]').length).toBe(
			fixtureBundleWithWeather.weather.airmets.length,
		);
	});

	it('colors each wx chip by its METAR flight category', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithWeather });
		const chips = container.querySelectorAll('[data-testid="wx-chip"]');
		const categories = Array.from(chips).map((c) => c.getAttribute('data-flight-category'));
		expect(categories).toContain('VFR');
		expect(categories).toContain('IFR');
	});

	it('opens the waypoint detail drawer when a waypoint is clicked', async () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithWeather });
		expect(container.querySelector('[data-testid="waypoint-drawer"]')).toBeNull();
		const wp = container.querySelector('[data-waypoint-id="wp-a"]');
		expect(wp).not.toBeNull();
		if (wp) await fireEvent.click(wp);
		expect(container.querySelector('[data-testid="waypoint-drawer"]')).not.toBeNull();
	});

	it('closes the drawer on Escape', async () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithWeather });
		const wp = container.querySelector('[data-waypoint-id="wp-a"]');
		if (wp) await fireEvent.click(wp);
		expect(container.querySelector('[data-testid="waypoint-drawer"]')).not.toBeNull();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(container.querySelector('[data-testid="waypoint-drawer"]')).toBeNull();
	});
});

describe('<XcViewer> (Phase E performance)', () => {
	it('renders the performance band when the bundle carries a performance table', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithPerformance });
		expect(container.querySelector('[data-testid="performance-band"]')).not.toBeNull();
	});

	it('omits the performance band when there is no performance table', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundle });
		expect(container.querySelector('[data-testid="performance-band"]')).toBeNull();
	});

	it('shows non-zero total fuel + a non-negative reserve in the band', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithPerformance });
		const fuel = container.querySelector('[data-testid="perf-total-fuel"]')?.textContent ?? '';
		const reserve = container.querySelector('[data-testid="perf-reserve"]')?.textContent ?? '';
		expect(Number.parseFloat(fuel)).toBeGreaterThan(0);
		expect(Number.parseFloat(reserve)).toBeGreaterThanOrEqual(0);
	});

	it('opens the leg detail drawer when a leg label is clicked', async () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithPerformance });
		expect(container.querySelector('[data-testid="leg-drawer"]')).toBeNull();
		const legLabel = container.querySelector('[data-testid="leg-label"]');
		expect(legLabel).not.toBeNull();
		if (legLabel) await fireEvent.click(legLabel);
		expect(container.querySelector('[data-testid="leg-drawer"]')).not.toBeNull();
	});

	it('renders each leg label with the full four-field payload', () => {
		const { container } = render(XcViewer, { bundle: fixtureBundleWithPerformance });
		const label = container.querySelector('[data-testid="leg-label"]');
		const text = label?.textContent ?? '';
		expect(text).toContain('nm');
		expect(text).toContain('gal');
		expect(text).toContain('min');
		expect(text).toContain('wind');
	});
});
