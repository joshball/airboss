/**
 * Scenario registry -- the single source of truth for Phase 0 scenarios.
 * The sim app and the FDM worker both resolve scenarios through this
 * registry so scenario ids are always typed and never drift.
 */

import { SIM_SCENARIO_IDS, type SimScenarioId } from '@ab/constants';
import type { ScenarioDefinition } from '../types';
import { DEPARTURE_STALL_SCENARIO } from './departure-stall';

export const SCENARIO_REGISTRY: Record<SimScenarioId, ScenarioDefinition> = {
	[SIM_SCENARIO_IDS.DEPARTURE_STALL]: DEPARTURE_STALL_SCENARIO,
};

/** Defensive lookup; throws on unknown ids so callers fail fast. */
export function getScenario(id: SimScenarioId): ScenarioDefinition {
	const found = SCENARIO_REGISTRY[id];
	if (!found) {
		throw new Error(`Unknown scenario id: ${id}`);
	}
	return found;
}

export function listScenarios(): readonly ScenarioDefinition[] {
	return Object.values(SCENARIO_REGISTRY);
}
