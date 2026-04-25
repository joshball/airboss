/**
 * Aircraft profile registry. Maps SimAircraftId -> AircraftConfig so
 * the FDM worker resolves a scenario's pinned aircraft without a
 * hand-rolled switch in the worker code.
 */

import { SIM_AIRCRAFT_IDS, type SimAircraftId } from '@ab/constants';
import type { AircraftConfig } from '../types';
import { C172_CONFIG } from './c172';
import { PA28_CONFIG } from './pa28';

export const AIRCRAFT_REGISTRY: Record<SimAircraftId, AircraftConfig> = {
	[SIM_AIRCRAFT_IDS.C172]: C172_CONFIG,
	[SIM_AIRCRAFT_IDS.PA28]: PA28_CONFIG,
};

/** Resolve an aircraft id to its config. Throws on unknown id. */
export function getAircraftConfig(id: SimAircraftId): AircraftConfig {
	const cfg = AIRCRAFT_REGISTRY[id];
	if (!cfg) {
		throw new Error(`Unknown aircraft id: ${id}`);
	}
	return cfg;
}

/** All registered aircraft configs in registration order. */
export function listAircraftConfigs(): readonly AircraftConfig[] {
	return Object.values(AIRCRAFT_REGISTRY);
}
