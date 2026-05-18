// @browser-globals: server-only -- never imported by client .svelte
/**
 * The bundle composition pipeline -- the load-bearing function.
 *
 * `composeBundle` loads the four layers (geography, flight, weather,
 * scenario events) and derives the per-leg performance. Layer-1/2/3 are
 * loaded once; the bundle is the composition. It is a pure function of
 * its arguments (the loaders cache, but the result is deterministic).
 *
 * v1 ships zero scenario events; `bundle.events` is always `[]`.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Bundle composition".
 */

import { XC_REGION_MAGNETIC_VARIATION_DEG } from '@ab/constants';
import { loadFlight } from '../flight/loader';
import { derivePerformance } from '../flight/performance';
import { loadGeography } from '../geography/loader';
import { loadWeatherForScenario } from '../weather/view';
import { loadScenario } from './registry';
import type { ComposeArgs, ScenarioBundle } from './types';

/**
 * Compose a `ScenarioBundle` from layer-1/2/3 sources.
 *
 * 1. Load the geography for the region.
 * 2. Load the flight (route + aircraft).
 * 3. Load + project the weather onto the route's waypoints.
 * 4. Derive the per-leg performance.
 *
 * Throws (via the loaders / schemas) on any unresolved reference or
 * schema failure -- a malformed scenario fails loud at compose time.
 */
export function composeBundle(args: ComposeArgs): ScenarioBundle {
	const scenario = loadScenario(args.scenarioId);
	const validAt = args.validAt ?? scenario.validAt;
	if (!validAt) {
		throw new Error(
			`spatial-engine: scenario "${args.scenarioId}" has no validAt and none was supplied to composeBundle`,
		);
	}

	const geography = loadGeography(args.regionSlug);
	const flight = loadFlight(args.routeId, args.aircraftId);
	const weather = loadWeatherForScenario(args.wxScenarioSlug, validAt, flight.route.waypoints);

	const performance = derivePerformance({
		route: flight.route,
		aircraft: flight.aircraft,
		weather,
		magneticVariationDeg: XC_REGION_MAGNETIC_VARIATION_DEG[args.regionSlug],
	});

	return {
		scenarioId: args.scenarioId,
		label: scenario.label,
		validAt,
		geography,
		flight,
		weather,
		events: [],
		performance,
	};
}

/**
 * Compose a bundle directly from a registered scenario slug. Resolves the
 * scenario's region / route / aircraft / wx references and composes.
 */
export function composeScenario(slug: ComposeArgs['scenarioId']): ScenarioBundle {
	const scenario = loadScenario(slug);
	return composeBundle({
		scenarioId: scenario.id,
		regionSlug: scenario.regionSlug,
		routeId: scenario.routeId,
		aircraftId: scenario.aircraftId,
		wxScenarioSlug: scenario.wxScenarioSlug,
		validAt: scenario.validAt,
	});
}
