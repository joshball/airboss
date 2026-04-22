import { listScenarios } from '@ab/bc-sim';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	return {
		scenarios: listScenarios(),
	};
};
