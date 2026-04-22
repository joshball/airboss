// Sim BC -- flight dynamics, scenarios, runner. Phase 0.5 prototype.

export { C172_CONFIG } from './fdm/c172';
export { FdmEngine, windFromScenario } from './fdm/engine';
export {
	airDensity,
	angleOfAttack,
	coordinatedTurnRate,
	derivatives,
	dragCoefficient,
	effectiveElevator,
	type FdmStateVector,
	fdmStep,
	liftCoefficient,
	pitchingAcceleration,
	slipBall,
	truthStateFromVector,
	type WindVector,
} from './fdm/physics';
export { DEPARTURE_STALL_SCENARIO } from './scenarios/departure-stall';
export { FIRST_FLIGHT_SCENARIO } from './scenarios/first-flight';
export { PLAYGROUND_SCENARIO } from './scenarios/playground';
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
	ScenarioScriptedInput,
	ScenarioStepContext,
	ScenarioStepDefinition,
	ScenarioStepState,
	ScenarioWind,
} from './types';
