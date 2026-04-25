/**
 * Scenario registry -- the single source of truth for sim scenarios. The
 * sim app and the FDM worker both resolve scenarios through this registry
 * so scenario ids are always typed and never drift.
 */

import { SIM_SCENARIO_IDS, type SimScenarioId } from '@ab/constants';
import type { ScenarioDefinition } from '../types';
import { AFT_CG_SLOW_FLIGHT_SCENARIO } from './aft-cg-slow-flight';
import { DEPARTURE_STALL_SCENARIO } from './departure-stall';
import { EFATO_SCENARIO } from './efato';
import { FIRST_FLIGHT_SCENARIO } from './first-flight';
import { PARTIAL_PANEL_SCENARIO } from './partial-panel';
import { PITOT_BLOCK_SCENARIO } from './pitot-block';
import { PLAYGROUND_SCENARIO } from './playground';
import { STATIC_BLOCK_SCENARIO } from './static-block';
import { UNUSUAL_ATTITUDES_SCENARIO } from './unusual-attitudes';
import { UNUSUAL_ATTITUDES_NOSE_LO_SCENARIO } from './unusual-attitudes-nose-lo';
import { VACUUM_FAILURE_SCENARIO } from './vacuum-failure';
import { VMC_INTO_IMC_SCENARIO } from './vmc-into-imc';

export const SCENARIO_REGISTRY: Record<SimScenarioId, ScenarioDefinition> = {
	[SIM_SCENARIO_IDS.PLAYGROUND]: PLAYGROUND_SCENARIO,
	[SIM_SCENARIO_IDS.FIRST_FLIGHT]: FIRST_FLIGHT_SCENARIO,
	[SIM_SCENARIO_IDS.DEPARTURE_STALL]: DEPARTURE_STALL_SCENARIO,
	[SIM_SCENARIO_IDS.EFATO]: EFATO_SCENARIO,
	[SIM_SCENARIO_IDS.VACUUM_FAILURE]: VACUUM_FAILURE_SCENARIO,
	[SIM_SCENARIO_IDS.PITOT_BLOCK]: PITOT_BLOCK_SCENARIO,
	[SIM_SCENARIO_IDS.STATIC_BLOCK]: STATIC_BLOCK_SCENARIO,
	[SIM_SCENARIO_IDS.PARTIAL_PANEL]: PARTIAL_PANEL_SCENARIO,
	[SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_HI]: UNUSUAL_ATTITUDES_SCENARIO,
	[SIM_SCENARIO_IDS.UNUSUAL_ATTITUDES_NOSE_LO]: UNUSUAL_ATTITUDES_NOSE_LO_SCENARIO,
	[SIM_SCENARIO_IDS.AFT_CG_SLOW_FLIGHT]: AFT_CG_SLOW_FLIGHT_SCENARIO,
	[SIM_SCENARIO_IDS.VMC_INTO_IMC]: VMC_INTO_IMC_SCENARIO,
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
