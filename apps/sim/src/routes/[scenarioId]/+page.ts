import { getScenario } from '@ab/bc-sim';
import { SIM_SCENARIO_ID_VALUES, type SimScenarioId } from '@ab/constants';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

function isSimScenarioId(value: string): value is SimScenarioId {
	return (SIM_SCENARIO_ID_VALUES as readonly string[]).includes(value);
}

export const load: PageLoad = async ({ params }) => {
	if (!isSimScenarioId(params.scenarioId)) {
		throw error(404, 'Unknown scenario');
	}
	const scenario = getScenario(params.scenarioId);
	return { scenario };
};
