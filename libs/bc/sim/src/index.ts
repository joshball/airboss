// Sim BC -- flight dynamics, scenarios, runner. Phase 0 throwaway prototype.

export { C172_CONFIG } from './fdm/c172';
export { FdmEngine } from './fdm/engine';
export {
	airDensity,
	angleOfAttack,
	derivatives,
	dragCoefficient,
	type FdmStateVector,
	liftCoefficient,
	pitchingAcceleration,
	rk4Step,
	truthStateFromVector,
} from './fdm/physics';
export { DEPARTURE_STALL_SCENARIO } from './scenarios/departure-stall';
export { getScenario, listScenarios, SCENARIO_REGISTRY } from './scenarios/registry';
export { type RunnerEvaluation, ScenarioRunner } from './scenarios/runner';
export type {
	AircraftConfig,
	FdmInputs,
	FdmTruthState,
	ScenarioCriteria,
	ScenarioDefinition,
	ScenarioInitialState,
	ScenarioRunResult,
} from './types';
