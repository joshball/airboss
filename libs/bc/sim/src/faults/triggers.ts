/**
 * Pure trigger evaluation for scenario faults.
 *
 * The runner calls `shouldTriggerFault(fault, prev, curr, currentStepId)`
 * once per tick. It returns `true` on the tick the trigger fires (edge),
 * `false` otherwise. Faults are sticky: the runner keeps the activation in
 * its array forever, so this function only cares about the first crossing.
 *
 * Time-based fires when `truth.t` passes `at`.
 * Altitude-based fires when AGL crosses `above` upward (descent does not
 *   re-fire).
 * Step-based fires when the runner advances onto `stepId` (compared by
 *   the previous tick's currentStepId vs this tick's).
 */

import { SIM_FAULT_TRIGGER_KINDS } from '@ab/constants';
import type { FdmTruthState } from '../types';
import type { ScenarioFault } from './types';

export interface TriggerEvalContext {
	/** Truth state on the previous tick (or null on the first tick of a run). */
	prev: FdmTruthState | null;
	/** Truth state for this tick. */
	curr: FdmTruthState;
	/** Step id active on the previous tick (or null). */
	prevStepId: string | null;
	/** Step id active for this tick. */
	currStepId: string | null;
}

/** Returns true on the edge a fault trigger fires. */
export function shouldTriggerFault(fault: ScenarioFault, ctx: TriggerEvalContext): boolean {
	switch (fault.trigger.kind) {
		case SIM_FAULT_TRIGGER_KINDS.TIME_SECONDS: {
			if (ctx.prev === null) return ctx.curr.t >= fault.trigger.at;
			return ctx.prev.t < fault.trigger.at && ctx.curr.t >= fault.trigger.at;
		}
		case SIM_FAULT_TRIGGER_KINDS.ALTITUDE_AGL_METERS: {
			const currAgl = ctx.curr.altitude - ctx.curr.groundElevation;
			if (ctx.prev === null) return currAgl >= fault.trigger.above;
			const prevAgl = ctx.prev.altitude - ctx.prev.groundElevation;
			return prevAgl < fault.trigger.above && currAgl >= fault.trigger.above;
		}
		case SIM_FAULT_TRIGGER_KINDS.ON_STEP: {
			return ctx.prevStepId !== fault.trigger.stepId && ctx.currStepId === fault.trigger.stepId;
		}
		default: {
			// Exhaustive guard -- TS will complain if a new trigger kind is
			// added without a case here.
			const _exhaustive: never = fault.trigger;
			void _exhaustive;
			return false;
		}
	}
}
