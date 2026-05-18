/**
 * v1 route literal: KMEM -> KMKL -> KOLV.
 *
 * A short VFR cross-country from Memphis International, north to
 * McKellar-Sipes Regional (Jackson, TN) for a touch-and-go, then south to
 * Olive Branch. Five waypoints, four legs, VFR cruise at 4500 ft / 110 kt
 * TAS.
 *
 * Waypoint coordinates: KMEM / KMKL / KOLV from the airport records under
 * `course/sectionals/memphis/airports/<icao>/airport.json`. The two fix
 * waypoints are hand-authored offsets:
 *  - KMEM-DEP-FIX: ~5 nm northeast of KMEM, a climb-out fix.
 *  - KOLV-ARR-FIX: ~5 nm south of KOLV, a descent fix.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` C.1.
 */

import { XC_ROUTES } from '@ab/constants';
import type { RouteSpec } from '../types';

/**
 * The KMEM -> KMKL -> KOLV route.
 *
 * Departure planned for 19:00Z on 2026-03-19 -- inside the
 * `frontal-xc-march` wx scenario's truth window.
 */
export const KMEM_KMKL_KOLV: RouteSpec = {
	id: XC_ROUTES.KMEM_KMKL_KOLV,
	label: 'KMEM -> KMKL -> KOLV',
	waypoints: [
		{
			id: 'wp-kmem',
			label: 'KMEM',
			lon: -89.9767,
			lat: 35.0424,
			airportIcao: 'KMEM',
			kind: 'airport',
		},
		{
			// ~5 nm northeast of KMEM -- a climb-out fix toward Jackson.
			id: 'wp-kmem-dep-fix',
			label: 'KMEM-DEP-FIX',
			lon: -89.9067,
			lat: 35.0974,
			kind: 'fix',
		},
		{
			id: 'wp-kmkl',
			label: 'KMKL',
			lon: -88.9156,
			lat: 35.5999,
			airportIcao: 'KMKL',
			kind: 'airport',
		},
		{
			// ~5 nm south of KOLV -- a descent fix on the inbound leg.
			id: 'wp-kolv-arr-fix',
			label: 'KOLV-ARR-FIX',
			lon: -89.7869,
			lat: 34.9053,
			kind: 'fix',
		},
		{
			id: 'wp-kolv',
			label: 'KOLV',
			lon: -89.7869,
			lat: 34.9786,
			airportIcao: 'KOLV',
			kind: 'airport',
		},
	],
	// One altitude entry per leg. Climb out at 1500 ft, cruise at 4500 ft
	// for the two long legs, descend to 2500 ft for the arrival leg.
	altitudeProfile: [{ altitudeFtMsl: 1500 }, { altitudeFtMsl: 4500 }, { altitudeFtMsl: 4500 }, { altitudeFtMsl: 2500 }],
	// One TAS entry per leg. Pattern speeds at the ends, 110 kt at cruise.
	speedProfile: [{ tasKt: 90 }, { tasKt: 110 }, { tasKt: 110 }, { tasKt: 90 }],
	alternateIcao: 'KMKL',
	plannedDepartureUtc: '2026-03-19T19:00:00Z',
};
