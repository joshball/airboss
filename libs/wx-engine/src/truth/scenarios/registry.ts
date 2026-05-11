/**
 * Scenario registry.
 *
 * Maps every `WX_SCENARIOS.*` slug to a lazy loader that returns a validated
 * `TruthModel`. The loader runs `truthModelSchema.parse(...)` on the literal
 * before handing it to the engine, so any author-side mistake (bad polygon,
 * out-of-bounds station, missing severity) surfaces at load time -- never
 * at chart-render time.
 *
 * Phase A only resolves `frontal-xc-march` (the spike-lift scenario); the
 * other five slugs throw "scenario not yet authored". Phase E adds the
 * remaining five scenario literals; nothing else in the lib changes.
 */

import { WX_SCENARIOS, type WxScenario } from '@ab/constants';
import { truthModelSchema } from '../schema';
import type { TruthModel } from '../types';
import { FRONTAL_XC_MARCH } from './frontal-xc-march';
import { SUMMER_THUNDERSTORMS_TX } from './summer-thunderstorms-tx';
import { MOUNTAIN_WAVE_ROCKIES } from './mountain-wave-rockies';
import { WINTER_ICING_GREAT_LAKES } from './winter-icing-great-lakes';

/**
 * Per-slug lazy loaders. Each entry returns the raw scenario literal (not
 * yet schema-validated). `loadScenario` runs validation, so adding a new
 * scenario means dropping one TS literal under `truth/scenarios/<slug>.ts`,
 * registering it here, and the lib resolves through validation
 * automatically.
 */
const SCENARIO_LOADERS: Record<WxScenario, () => TruthModel> = {
	[WX_SCENARIOS.FRONTAL_XC_MARCH]: () => FRONTAL_XC_MARCH,
	[WX_SCENARIOS.SUMMER_THUNDERSTORMS_TX]: () => SUMMER_THUNDERSTORMS_TX,
	[WX_SCENARIOS.WINTER_ICING_GREAT_LAKES]: () => WINTER_ICING_GREAT_LAKES,
	[WX_SCENARIOS.MOUNTAIN_WAVE_ROCKIES]: () => MOUNTAIN_WAVE_ROCKIES,
	[WX_SCENARIOS.MARINE_STRATUS_PACIFIC_NW]: () => {
		throw new Error(`scenario "${WX_SCENARIOS.MARINE_STRATUS_PACIFIC_NW}" not yet authored (lands in Phase E)`);
	},
	[WX_SCENARIOS.DENSE_FOG_RADIATION_CENTRAL_VALLEY]: () => {
		throw new Error(
			`scenario "${WX_SCENARIOS.DENSE_FOG_RADIATION_CENTRAL_VALLEY}" not yet authored (lands in Phase E)`,
		);
	},
};

/**
 * Load a scenario literal by slug. Validates against `truthModelSchema`
 * before returning, so callers receive a `TruthModel` that satisfies the
 * full contract (CONUS-bounded stations, ringed hazard polygons, etc.).
 *
 * Throws when the slug is unknown to the registry or when the scenario
 * literal fails schema validation.
 */
export function loadScenario(slug: WxScenario): TruthModel {
	const loader = SCENARIO_LOADERS[slug];
	if (loader === undefined) {
		throw new Error(`loadScenario: unknown scenario slug "${slug}"`);
	}
	const literal = loader();
	const parsed = truthModelSchema.safeParse(literal);
	if (!parsed.success) {
		throw new Error(
			`loadScenario: scenario "${slug}" failed truthModelSchema validation:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
		);
	}
	// `parsed.data` is structurally equal to the TruthModel literal but typed
	// as the Zod inferred type. Cast through the interface to preserve
	// downstream type narrowing (the schema mirrors TruthModel exactly).
	return parsed.data as TruthModel;
}
