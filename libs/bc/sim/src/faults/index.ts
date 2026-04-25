/**
 * Sim BC -- fault model.
 *
 * Public surface for the truth-vs-display separation. Phase 3 ships the
 * interface + identity transform; per-instrument fault rendering fans out
 * across B5.* PRs.
 */

export { activateFault, applyFaults, indicatedAirspeedKnots } from './transform';
export { shouldTriggerFault, type TriggerEvalContext } from './triggers';
export type {
	DisplayState,
	FaultActivation,
	FaultKind,
	FaultParams,
	FaultTransformInput,
	FaultTriggerKind,
	ScenarioFault,
	ScenarioFaultTrigger,
} from './types';
