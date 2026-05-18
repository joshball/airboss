// @browser-globals: server-only -- never imported by client .svelte
/**
 * Layer-2 (flight) loader.
 *
 * Resolves a route id + aircraft id to the hand-authored `RouteSpec` +
 * `AircraftSpec` literals, validates each against its Zod schema, and
 * returns a typed `Flight`. The route + aircraft literals are imported
 * statically -- they are small TS modules, not filesystem reads.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Layer composition
 * contracts" -> "Layer 2".
 */

import { C172N_SKYHAWK } from './aircraft/c172n-skyhawk';
import { KMEM_KMKL_KOLV } from './routes/kmem-kmkl-kolv';
import { aircraftSpecSchema, routeSpecSchema } from './schema';
import type { AircraftSpec, Flight, RouteSpec } from './types';

/** Registry of hand-authored routes, keyed by route id. */
const ROUTE_REGISTRY: Record<string, RouteSpec> = {
	[KMEM_KMKL_KOLV.id]: KMEM_KMKL_KOLV,
};

/** Registry of hand-authored aircraft, keyed by aircraft id. */
const AIRCRAFT_REGISTRY: Record<string, AircraftSpec> = {
	[C172N_SKYHAWK.id]: C172N_SKYHAWK,
};

/** Resolve + validate a route literal by id. */
export function loadRoute(routeId: string): RouteSpec {
	const route = ROUTE_REGISTRY[routeId];
	if (!route) {
		throw new Error(
			`spatial-engine: unknown route id "${routeId}". Registered: ${Object.keys(ROUTE_REGISTRY).join(', ')}`,
		);
	}
	return routeSpecSchema.parse(route) as RouteSpec;
}

/** Resolve + validate an aircraft literal by id. */
export function loadAircraft(aircraftId: string): AircraftSpec {
	const aircraft = AIRCRAFT_REGISTRY[aircraftId];
	if (!aircraft) {
		throw new Error(
			`spatial-engine: unknown aircraft id "${aircraftId}". Registered: ${Object.keys(AIRCRAFT_REGISTRY).join(', ')}`,
		);
	}
	return aircraftSpecSchema.parse(aircraft) as AircraftSpec;
}

/**
 * Load a flight: resolve the route + aircraft, validate both, and return
 * the composite `Flight`. The flight scenario id is `<routeId>-<aircraftId>`.
 */
export function loadFlight(routeId: string, aircraftId: string): Flight {
	const route = loadRoute(routeId);
	const aircraft = loadAircraft(aircraftId);
	return {
		scenarioId: `${routeId}-${aircraftId}`,
		route,
		aircraft,
	};
}
