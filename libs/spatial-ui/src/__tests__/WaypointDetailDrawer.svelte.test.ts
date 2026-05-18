/**
 * `<WaypointDetailDrawer>` tests.
 *
 * The drawer shows airport detail + METAR + TAF + AIRMETs; closes on the
 * close button and on Esc.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-34.
 */

import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WaypointDetailDrawer from '../WaypointDetailDrawer.svelte';
import { fixtureAirmets, fixtureAirports } from './fixtures';

afterEach(cleanup);

const waypoint = { id: 'wp-a', label: 'KTST', lon: -89.95, lat: 35.05, airportIcao: 'KTST', kind: 'airport' as const };
const wxView = {
	waypointId: 'wp-a',
	metar: {
		station: 'KCPS',
		raw: 'KCPS 191953Z 20014KT 10SM BKN045 17/13 A2970',
		flightCategory: 'VFR' as const,
		stationDistanceNm: 210,
	},
	taf: {
		station: 'KCPS',
		raw: 'FM192000 32020G30KT 5SM VCSH OVC025',
		arrivalFlightCategory: 'MVFR' as const,
		stationDistanceNm: 210,
	},
	windsAloft: [],
	airmetIds: ['airmet-sierra-test'],
};

describe('<WaypointDetailDrawer>', () => {
	it('renders nothing when closed', () => {
		const { container } = render(WaypointDetailDrawer, {
			open: false,
			waypoint,
			wxView,
			airport: fixtureAirports[0],
			airmets: fixtureAirmets,
			onclose: () => {},
		});
		expect(container.querySelector('[data-testid="waypoint-drawer"]')).toBeNull();
	});

	it('renders the airport detail + METAR + TAF when open', () => {
		const { container } = render(WaypointDetailDrawer, {
			open: true,
			waypoint,
			wxView,
			airport: fixtureAirports[0],
			airmets: fixtureAirmets,
			onclose: () => {},
		});
		expect(container.querySelector('[data-testid="waypoint-drawer"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="plate-stub"]')).not.toBeNull();
		const text = container.textContent ?? '';
		expect(text).toContain('METAR');
		expect(text).toContain('TAF');
		expect(text).toContain('KCPS');
	});

	it('lists the AIRMETs the waypoint sits inside', () => {
		const { container } = render(WaypointDetailDrawer, {
			open: true,
			waypoint,
			wxView,
			airport: fixtureAirports[0],
			airmets: fixtureAirmets,
			onclose: () => {},
		});
		const text = container.textContent ?? '';
		expect(text).toContain('AIRMET SIERRA');
	});

	it('fires onclose when the close button is clicked', async () => {
		const onclose = vi.fn();
		const { container } = render(WaypointDetailDrawer, {
			open: true,
			waypoint,
			wxView,
			airport: fixtureAirports[0],
			airmets: fixtureAirmets,
			onclose,
		});
		const closeBtn = container.querySelector('.drawer-close');
		expect(closeBtn).not.toBeNull();
		if (closeBtn) await fireEvent.click(closeBtn);
		expect(onclose).toHaveBeenCalledTimes(1);
	});

	it('fires onclose on Escape', async () => {
		const onclose = vi.fn();
		render(WaypointDetailDrawer, {
			open: true,
			waypoint,
			wxView,
			airport: fixtureAirports[0],
			airmets: fixtureAirmets,
			onclose,
		});
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onclose).toHaveBeenCalledTimes(1);
	});
});
