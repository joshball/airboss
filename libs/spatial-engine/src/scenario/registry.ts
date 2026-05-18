/**
 * Scenario registry.
 *
 * `loadScenario(slug)` resolves a registered `ScenarioSpec` literal by
 * slug and validates it against `scenarioSpecSchema`. Adding a scenario
 * means adding one literal + one registry entry.
 *
 * See `docs/work-packages/xc-viewer-v1/tasks.md` A.8.
 */

import { XC_SCENARIO_VALUES, type XcScenario } from '@ab/constants';
import { KMEM_KMKL_KOLV_FRONTAL_MARCH } from './scenarios/kmem-kmkl-kolv-frontal-march';
import { scenarioSpecSchema } from './schema';
import type { ScenarioSpec } from './types';

/** Registry of hand-authored scenario literals, keyed by scenario slug. */
const SCENARIO_REGISTRY: Record<string, ScenarioSpec> = {
	[KMEM_KMKL_KOLV_FRONTAL_MARCH.id]: KMEM_KMKL_KOLV_FRONTAL_MARCH,
};

/** Resolve + validate a scenario literal by slug. */
export function loadScenario(slug: XcScenario): ScenarioSpec {
	const scenario = SCENARIO_REGISTRY[slug];
	if (!scenario) {
		throw new Error(
			`spatial-engine: unknown scenario slug "${slug}". Registered: ${Object.keys(SCENARIO_REGISTRY).join(', ')}`,
		);
	}
	return scenarioSpecSchema.parse(scenario) as ScenarioSpec;
}

/** Enumerate every registered scenario slug. */
export function listScenarioSlugs(): XcScenario[] {
	return [...XC_SCENARIO_VALUES];
}
