import { XC_SCENARIO_LABELS, XC_SCENARIO_VALUES } from '@ab/constants';
import type { PageServerLoad } from './$types';

/**
 * XC scenario picker load.
 *
 * Enumerates the registered scenarios from `XC_SCENARIO_VALUES`. v1 lists
 * one scenario; v2+ extends the constants module.
 */
export const load: PageServerLoad = () => {
	return {
		scenarios: XC_SCENARIO_VALUES.map((slug) => ({ slug, label: XC_SCENARIO_LABELS[slug] })),
	};
};
