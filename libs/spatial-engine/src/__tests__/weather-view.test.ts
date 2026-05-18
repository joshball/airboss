/**
 * Layer-3 weather-view tests.
 *
 * `loadWeatherForScenario` against the committed `frontal-xc-march`
 * wx-engine bundle: one waypoint view per route waypoint; AIRMET
 * point-in-polygon membership matches a manual check.
 *
 * See `docs/work-packages/xc-viewer-v1/test-plan.md` XC-30.
 */

import { describe, expect, it } from 'vitest';
import { KMEM_KMKL_KOLV } from '../flight/routes/kmem-kmkl-kolv';
import { clearWeatherCache, loadWeatherForScenario, pointInRing } from '../weather/view';

describe('loadWeatherForScenario', () => {
	it('returns one waypoint view per route waypoint', () => {
		clearWeatherCache();
		const view = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);
		expect(Object.keys(view.byWaypoint).length).toBe(KMEM_KMKL_KOLV.waypoints.length);
		for (const wp of KMEM_KMKL_KOLV.waypoints) {
			expect(view.byWaypoint[wp.id]).toBeDefined();
		}
	});

	it('projects a nearest METAR to every waypoint with a parsed flight category', () => {
		clearWeatherCache();
		const view = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);
		for (const wp of KMEM_KMKL_KOLV.waypoints) {
			const wxView = view.byWaypoint[wp.id];
			expect(wxView.metar).not.toBeNull();
			expect(['VFR', 'MVFR', 'IFR', 'LIFR']).toContain(wxView.metar?.flightCategory);
			expect(wxView.metar?.stationDistanceNm).toBeGreaterThan(0);
		}
	});

	it('projects a TAF only for airport waypoints', () => {
		clearWeatherCache();
		const view = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);
		for (const wp of KMEM_KMKL_KOLV.waypoints) {
			const wxView = view.byWaypoint[wp.id];
			if (wp.kind === 'airport') {
				expect(wxView.taf).not.toBeNull();
			} else {
				expect(wxView.taf).toBeNull();
			}
		}
	});

	it('carries every AIRMET from the wx bundle', () => {
		clearWeatherCache();
		const view = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);
		// The frontal-xc-march spike scenario ships three AIRMETs.
		expect(view.airmets.length).toBe(3);
		for (const a of view.airmets) {
			expect(['airmet-sierra', 'airmet-tango', 'airmet-zulu']).toContain(a.family);
		}
	});

	it('attaches winds aloft to every waypoint view', () => {
		clearWeatherCache();
		const view = loadWeatherForScenario('frontal-xc-march', '2026-03-19T19:00:00Z', KMEM_KMKL_KOLV.waypoints);
		for (const wp of KMEM_KMKL_KOLV.waypoints) {
			expect(view.byWaypoint[wp.id].windsAloft.length).toBeGreaterThan(0);
		}
	});
});

describe('pointInRing', () => {
	it('detects a point inside a simple square ring', () => {
		const square: ReadonlyArray<readonly [number, number]> = [
			[-90, 34],
			[-88, 34],
			[-88, 36],
			[-90, 36],
			[-90, 34],
		];
		expect(pointInRing([-89, 35], square)).toBe(true);
	});

	it('detects a point outside the ring', () => {
		const square: ReadonlyArray<readonly [number, number]> = [
			[-90, 34],
			[-88, 34],
			[-88, 36],
			[-90, 36],
			[-90, 34],
		];
		expect(pointInRing([-95, 35], square)).toBe(false);
	});
});
