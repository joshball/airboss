/**
 * Layer-4 (scenario) types: the `ScenarioSpec` literal, the timed-event
 * union (declared but unused in v1), and the composed `ScenarioBundle`.
 *
 * Pure type module -- safe at any tier; re-exported `type`-only from the
 * runtime barrel.
 *
 * See `docs/work-packages/xc-viewer-v1/spec.md` "Data model" + design.md
 * "Open design questions resolved" #5 (v1 ships `events: []`).
 */

import type { WxScenario, XcRegion, XcScenario } from '@ab/constants';
import type { Flight, PerformanceTable } from '../flight/types';
import type { Geography } from '../geography/types';
import type { WxBundleView } from '../weather/types';

/**
 * A wx-change event -- the scenario flips to a different wx truth state.
 * Declared for v2+; v1 emits no events.
 */
export interface WxChangeEvent {
	kind: 'wx-change';
	/** Minutes after departure the event fires. */
	atMinute: number;
	/** The wx scenario slug to switch to. */
	wxScenarioSlug: WxScenario;
}

/** An aircraft-failure event. v2+. */
export interface AcFailureEvent {
	kind: 'ac-failure';
	atMinute: number;
	/** The system that fails. */
	system: 'engine' | 'electrical' | 'vacuum' | 'pitot-static';
}

/** An ATC-change event (reroute / hold / altitude change). v2+. */
export interface AtcChangeEvent {
	kind: 'atc-change';
	atMinute: number;
	/** Free-text instruction. */
	instruction: string;
}

/** A NOTAM-activation event. v2+. */
export interface NotamActivationEvent {
	kind: 'notam-activation';
	atMinute: number;
	/** The NOTAM id. */
	notamId: string;
}

/** A PIREP-drop event -- a fresh PIREP appears en route. v2+. */
export interface PirepDropEvent {
	kind: 'pirep-drop';
	atMinute: number;
	/** The PIREP id from the wx bundle. */
	pirepId: string;
}

/** The timed-event union. v1 ships an empty events array. */
export type TimedEvent = WxChangeEvent | AcFailureEvent | AtcChangeEvent | NotamActivationEvent | PirepDropEvent;

/**
 * A scenario composition -- the literal an author writes. Ties a region +
 * a route + an aircraft + a wx-engine scenario slug together.
 */
export interface ScenarioSpec {
	/** Scenario id; one of `XC_SCENARIO_VALUES`. */
	id: XcScenario;
	/** Human label. */
	label: string;
	/** Region slug. */
	regionSlug: XcRegion;
	/** Route id (resolved against the route registry). */
	routeId: string;
	/** Aircraft id (resolved against the aircraft registry). */
	aircraftId: string;
	/** Weather scenario slug (resolved against the wx-engine output). */
	wxScenarioSlug: WxScenario;
	/** Scenario events -- empty in v1. */
	events: TimedEvent[];
	/**
	 * UTC ISO timestamp the scenario is valid at. Defaults to the wx
	 * scenario's `validAt` when omitted by the composer.
	 */
	validAt?: string;
}

/** The composed scenario bundle -- the canonical artifact the viewer reads. */
export interface ScenarioBundle {
	/** Scenario id. */
	scenarioId: XcScenario;
	/** Human label. */
	label: string;
	/** UTC timestamp the composition is valid at. */
	validAt: string;
	/** Layer 1: geography. */
	geography: Geography;
	/** Layer 2: flight (route + aircraft). */
	flight: Flight;
	/** Layer 3: weather, projected to the route's waypoints. */
	weather: WxBundleView;
	/** Layer 4: scenario events (empty in v1). */
	events: TimedEvent[];
	/** Derived per-leg performance (layers 2 + 3). */
	performance: PerformanceTable;
}

/** Arguments to `composeBundle`. */
export interface ComposeArgs {
	/** Scenario id. */
	scenarioId: XcScenario;
	/** Region slug. */
	regionSlug: XcRegion;
	/** Route id. */
	routeId: string;
	/** Aircraft id. */
	aircraftId: string;
	/** Weather scenario slug. */
	wxScenarioSlug: WxScenario;
	/** UTC ISO timestamp; defaults to the wx scenario's validAt. */
	validAt?: string;
}
