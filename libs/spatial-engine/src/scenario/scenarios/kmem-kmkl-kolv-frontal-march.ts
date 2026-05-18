/**
 * v1 scenario literal: KMEM -> KMKL -> KOLV, cold-front passage (March).
 *
 * Ties the `kmem-kmkl-kolv` route + the `c172n-skyhawk` aircraft + the
 * existing `frontal-xc-march` wx-engine scenario into a single
 * `ScenarioSpec`. v1 ships zero scenario events.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Scope" and `tasks.md` A.8.
 */

import { WX_SCENARIOS, XC_REGIONS, XC_ROUTES, XC_SCENARIO_LABELS, XC_SCENARIOS } from '@ab/constants';
import type { ScenarioSpec } from '../types';

/** The KMEM -> KMKL -> KOLV cold-front-passage scenario. */
export const KMEM_KMKL_KOLV_FRONTAL_MARCH: ScenarioSpec = {
	id: XC_SCENARIOS.KMEM_KMKL_KOLV_FRONTAL_MARCH,
	label: XC_SCENARIO_LABELS[XC_SCENARIOS.KMEM_KMKL_KOLV_FRONTAL_MARCH],
	regionSlug: XC_REGIONS.MEMPHIS,
	routeId: XC_ROUTES.KMEM_KMKL_KOLV,
	aircraftId: 'c172n-skyhawk',
	wxScenarioSlug: WX_SCENARIOS.FRONTAL_XC_MARCH,
	events: [],
	// The route departs 19:00Z on 2026-03-19 -- inside the
	// `frontal-xc-march` truth window.
	validAt: '2026-03-19T19:00:00Z',
};
