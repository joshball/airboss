/**
 * Scenario registry -- the single source of truth for sim scenarios. The
 * sim app and the FDM worker both resolve scenarios through this registry
 * so scenario ids are always typed and never drift.
 */

import { SIM_SCENARIO_IDS, type SimScenarioId } from '@ab/constants';
import type { ScenarioDefinition } from '../types';
import { DEPARTURE_STALL_SCENARIO } from './departure-stall';
import { EFATO_SCENARIO } from './efato';
import { FIRST_FLIGHT_SCENARIO } from './first-flight';
import { PLAYGROUND_SCENARIO } from './playground';
import { VACUUM_FAILURE_SCENARIO } from './vacuum-failure';

export const SCENARIO_REGISTRY: Record<SimScenarioId, ScenarioDefinition> = {
	[SIM_SCENARIO_IDS.PLAYGROUND]: PLAYGROUND_SCENARIO,
	[SIM_SCENARIO_IDS.FIRST_FLIGHT]: FIRST_FLIGHT_SCENARIO,
	[SIM_SCENARIO_IDS.DEPARTURE_STALL]: DEPARTURE_STALL_SCENARIO,
	[SIM_SCENARIO_IDS.EFATO]: EFATO_SCENARIO,
	[SIM_SCENARIO_IDS.VACUUM_FAILURE]: VACUUM_FAILURE_SCENARIO,
};

/** Defensive lookup; throws on unknown ids so callers fail fast. */
export function getScenario(id: SimScenarioId): ScenarioDefinition {
	const found = SCENARIO_REGISTRY[id];
	if (!found) {
		throw new Error(`Unknown scenario id: ${id}`);
	}
	return found;
}

/** Scenarios in recommended presentation order. */
export function listScenarios(): readonly ScenarioDefinition[] {
	return Object.values(SCENARIO_REGISTRY)
		.slice()
		.sort((a, b) => a.recommendedOrder - b.recommendedOrder);
}
