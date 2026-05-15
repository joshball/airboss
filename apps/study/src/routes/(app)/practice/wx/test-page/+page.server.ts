/**
 * Server load for `/practice/wx/test-page` -- the truth-model authoring
 * sandbox (Drill Phase 4).
 *
 * Admin-only. The (app) layout already enforces sign-in; this page-server
 * re-gates to ADMIN via `requireRole` -- the same pattern the hangar admin
 * audit explorer uses (`apps/hangar/.../admin/audit/+page.server.ts`).
 * The sandbox writes files into the course corpus and exposes the raw
 * wx-engine, so it stays behind the highest role floor.
 *
 * The load function ships only the default slider state + slider bounds to
 * the client; every derivation happens through the `derive` POST endpoint.
 */

import { requireRole } from '@ab/auth';
import { ROLES } from '@ab/constants';
import { SANDBOX_DEFAULT_STATE, SANDBOX_SLIDER_BOUNDS, SANDBOX_STATION } from './_lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	requireRole(event, ROLES.ADMIN);

	return {
		station: SANDBOX_STATION,
		defaultState: SANDBOX_DEFAULT_STATE,
		sliderBounds: SANDBOX_SLIDER_BOUNDS,
	};
};
