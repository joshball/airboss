/**
 * Convenience wrapper: build snapshots for a closed set of scenarios.
 * Server-only -- transitively reaches `@ab/wx-engine/server`.
 */

import { WX_SCENARIO_VALUES, type WxScenario } from '@ab/constants';
import { type ScenarioSnapshot, snapshotScenario } from './snapshot';

export function buildAllScenarioSnapshots(scenarios?: readonly WxScenario[]): ScenarioSnapshot[] {
	const slugs = scenarios && scenarios.length > 0 ? scenarios : WX_SCENARIO_VALUES;
	return slugs.map(snapshotScenario);
}
