/**
 * Weather-view fixture regression test (Phase D).
 *
 * Asserts `loadWeatherForScenario('frontal-xc-march', ...)` for the v1
 * route projects to the committed fixture. The fixture is a trimmed
 * projection (per-waypoint METAR / TAF station + category, AIRMET counts)
 * regenerated when the wx-engine output drifts.
 *
 * Note: the v1 route is in the Memphis sectional; the `frontal-xc-march`
 * scenario covers a Midwest XC. The nearest reporting station to every
 * Memphis waypoint is the southernmost wx-scenario station (KCPS), and no
 * route waypoint sits inside an AIRMET ring. That geographic offset is
 * the documented v1 simplification -- the fixture captures it so a drift
 * in the wx output (or a projection bug) fails loud.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-30.
 */

import { describe, expect, it } from 'vitest';
import { KMEM_KMKL_KOLV } from '../flight/routes/kmem-kmkl-kolv';
import { clearWeatherCache, loadWeatherForScenario } from '../weather/view';
import fixture from './fixtures/frontal-xc-march-wx-view.json';

describe('loadWeatherForScenario fixture parity', () => {
	it('matches the committed frontal-xc-march projection for the v1 route', () => {
		clearWeatherCache();
		const view = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);

		expect(view.wxScenarioSlug).toBe(fixture.wxScenarioSlug);
		expect(view.truthValidAt).toBe(fixture.truthValidAt);
		expect(view.airmets.length).toBe(fixture.airmetCount);
		expect(view.airmets.map((a) => a.family)).toEqual(fixture.airmetFamilies);

		for (const [waypointId, expected] of Object.entries(fixture.byWaypoint)) {
			const wxView = view.byWaypoint[waypointId];
			expect(wxView, `waypoint ${waypointId} should have a view`).toBeDefined();
			expect(wxView.metar?.station ?? null).toBe(expected.metarStation);
			expect(wxView.metar?.flightCategory ?? null).toBe(expected.metarCategory);
			expect(wxView.taf?.station ?? null).toBe(expected.tafStation);
			expect(wxView.taf?.arrivalFlightCategory ?? null).toBe(expected.tafCategory);
			expect(wxView.airmetIds.length).toBe(expected.airmetCount);
			expect(wxView.windsAloft.length).toBe(expected.windsAloftCount);
		}
	});
});
