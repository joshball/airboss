import { SIM_AIRCRAFT_IDS } from '@ab/constants';
import type { PageLoad } from './$types';

/**
 * Glass PFD demo route. Sim doesn't currently surface a selected
 * aircraft (no avionics-style aircraft cookie), so the demo defaults
 * to the C172. When sim grows an aircraft selector, this load can
 * route through it the same way `apps/avionics/+layout.server.ts`
 * does for the avionics PFD page.
 */
export const load: PageLoad = () => {
	return {
		selectedAircraftId: SIM_AIRCRAFT_IDS.C172,
	};
};
