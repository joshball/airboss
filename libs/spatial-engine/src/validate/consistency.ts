/**
 * Cross-layer consistency checks.
 *
 * Scenario-level invariants -- not unit tests. Each rule surfaces enough
 * context to triage: which waypoint, which bounds, which leg. Failing one
 * is a bug in a scenario literal OR in the loader / composer.
 *
 * See `docs/work-packages/xc-viewer-v1/design.md` "Test seams" and
 * `spec.md` "Validation".
 */

import type { Flight } from '../flight/types';
import type { Geography } from '../geography/types';
import type { ScenarioBundle } from '../scenario/types';

/** A single consistency issue. */
export interface ConsistencyIssue {
	/** The rule that failed. */
	rule: string;
	/** Human-readable detail with the offending entity. */
	message: string;
}

/** The result of a consistency run. */
export interface ConsistencyReport {
	/** Whether every rule passed. */
	ok: boolean;
	/** The issues found (empty when `ok`). */
	issues: ConsistencyIssue[];
}

/** Every route waypoint sits inside the region bounds. */
function checkWaypointsInRegion(flight: Flight, geography: Geography, issues: ConsistencyIssue[]): void {
	const { bounds } = geography;
	for (const wp of flight.route.waypoints) {
		if (wp.lon < bounds.minLon || wp.lon > bounds.maxLon || wp.lat < bounds.minLat || wp.lat > bounds.maxLat) {
			issues.push({
				rule: 'waypoint-in-region',
				message:
					`waypoint "${wp.id}" (${wp.lon.toFixed(4)}, ${wp.lat.toFixed(4)}) sits outside the ` +
					`${geography.regionSlug} region bounds ` +
					`[${bounds.minLon}, ${bounds.minLat}] -> [${bounds.maxLon}, ${bounds.maxLat}]`,
			});
		}
	}
}

/** A declared alternate, if set, is in the region's airport table. */
function checkAlternateKnown(flight: Flight, geography: Geography, issues: ConsistencyIssue[]): void {
	const alt = flight.route.alternateIcao;
	if (!alt) return;
	const known = geography.airports.some((a) => a.icao === alt);
	if (!known) {
		issues.push({
			rule: 'alternate-known',
			message: `declared alternate "${alt}" is not in the ${geography.regionSlug} region airport table`,
		});
	}
}

/** Every route waypoint id is unique. */
function checkUniqueWaypointIds(flight: Flight, issues: ConsistencyIssue[]): void {
	const seen = new Set<string>();
	for (const wp of flight.route.waypoints) {
		if (seen.has(wp.id)) {
			issues.push({ rule: 'unique-waypoint-id', message: `duplicate waypoint id "${wp.id}"` });
		}
		seen.add(wp.id);
	}
}

/** No route leg cruises above the aircraft's service ceiling. */
function checkAltitudeBelowCeiling(flight: Flight, issues: ConsistencyIssue[]): void {
	const ceiling = flight.aircraft.perfPolar.serviceCeilingFtMsl;
	flight.route.altitudeProfile.forEach((step, i) => {
		if (step.altitudeFtMsl > ceiling) {
			issues.push({
				rule: 'altitude-below-ceiling',
				message:
					`leg ${i + 1} cruise altitude ${step.altitudeFtMsl} ft exceeds the ` +
					`${flight.aircraft.model} service ceiling ${ceiling} ft`,
			});
		}
		if (step.altitudeFtMsl > ceiling * 0.9 && step.altitudeFtMsl <= ceiling) {
			issues.push({
				rule: 'altitude-near-ceiling',
				message:
					`leg ${i + 1} cruise altitude ${step.altitudeFtMsl} ft is within 90% of the ` +
					`${flight.aircraft.model} service ceiling -- an authoring smell`,
			});
		}
	});
}

/** The wx scenario's truth window covers the flight's departure + ETA. */
function checkWxCoversFlight(bundle: ScenarioBundle, issues: ConsistencyIssue[]): void {
	const departure = Date.parse(bundle.flight.route.plannedDepartureUtc);
	const totalEteMs = bundle.performance.totalEteMin * 60_000;
	const eta = departure + totalEteMs;
	const truthValidAt = Date.parse(bundle.weather.truthValidAt);
	// The wx engine truth model is a single-time snapshot; the scenario is
	// consistent when its planned window is anchored at the truth time.
	// A drift of more than 12 hours means the wx scenario does not cover
	// the flight.
	const TWELVE_HOURS_MS = 12 * 3_600_000;
	if (Math.abs(departure - truthValidAt) > TWELVE_HOURS_MS || Math.abs(eta - truthValidAt) > TWELVE_HOURS_MS) {
		issues.push({
			rule: 'wx-covers-flight',
			message:
				`the wx scenario "${bundle.weather.wxScenarioSlug}" truth time ` +
				`${bundle.weather.truthValidAt} does not cover the flight window ` +
				`(departure ${bundle.flight.route.plannedDepartureUtc}, ETA +${bundle.performance.totalEteMin.toFixed(0)} min)`,
		});
	}
}

/** The performance reserve is non-negative. */
function checkReserveNonNegative(bundle: ScenarioBundle, issues: ConsistencyIssue[]): void {
	if (bundle.performance.reserveGal < 0) {
		const breakdown = bundle.performance.legs.map((l) => `${l.from}->${l.to}: ${l.fuelGal.toFixed(1)} gal`).join(', ');
		issues.push({
			rule: 'reserve-non-negative',
			message:
				`negative fuel reserve (${bundle.performance.reserveGal.toFixed(1)} gal) -- the route is too ` +
				`long for the aircraft + winds. Per-leg fuel: ${breakdown}`,
		});
	}
}

/** Run every cross-layer consistency rule against a composed bundle. */
export function runConsistency(bundle: ScenarioBundle): ConsistencyReport {
	const issues: ConsistencyIssue[] = [];
	checkWaypointsInRegion(bundle.flight, bundle.geography, issues);
	checkAlternateKnown(bundle.flight, bundle.geography, issues);
	checkUniqueWaypointIds(bundle.flight, issues);
	checkAltitudeBelowCeiling(bundle.flight, issues);
	checkWxCoversFlight(bundle, issues);
	checkReserveNonNegative(bundle, issues);
	// `altitude-near-ceiling` is a warning, not a hard failure -- a route
	// that cruises near the ceiling is an authoring smell but not invalid.
	const hardIssues = issues.filter((i) => i.rule !== 'altitude-near-ceiling');
	return { ok: hardIssues.length === 0, issues };
}
