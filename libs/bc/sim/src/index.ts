// Sim BC -- flight dynamics, scenarios, runner. Phase 0.5 prototype.

export {
	type AnnunciatorState,
	annunciatorState,
	LOW_FUEL_GALLONS,
	LOW_VOLTAGE_THRESHOLD_V,
	OIL_TEMP_BUFFER_C,
	shouldAnnunciateLowFuel,
	shouldAnnunciateLowVoltage,
	shouldAnnunciateOilPress,
	shouldAnnunciateOilTemp,
	shouldAnnunciateVacuumLow,
	VACUUM_LOW_INHG,
} from './annunciators';
export {
	altitudeAlertCrossed,
	dynamicPressurePa,
	engineFundamentalHz,
	flapsChanged,
	noiseGainTarget,
	shouldSoundGearWarning,
	strainDetuneCents,
	strainFactor,
	throttleGainTarget,
} from './audio-mapping';
export {
	activateFault,
	applyFaults,
	type DisplayState,
	type FaultActivation,
	type FaultKind,
	type FaultParams,
	type FaultTransformInput,
	type FaultTriggerKind,
	indicatedAirspeedKnots,
	type ScenarioFault,
	type ScenarioFaultTrigger,
	shouldTriggerFault,
	type TriggerEvalContext,
} from './faults';
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
export {
	buildTape,
	createFrameRing,
	DEFAULT_RING_CAPACITY,
	drainFrames,
	type FrameRing,
	hashScenarioDefinition,
	parseTape,
	pushFrame,
	REPLAY_TAPE_FORMAT_VERSION,
	type ReplayFrame,
	type ReplayTape,
	ringFramesDropped,
	ringHasWrapped,
	serializeTape,
	type TapeHashValidation,
	type TapeOutcome,
	validateTapeHash,
} from './replay';
export { DEPARTURE_STALL_SCENARIO } from './scenarios/departure-stall';
export { EFATO_SCENARIO } from './scenarios/efato';
export { FIRST_FLIGHT_SCENARIO } from './scenarios/first-flight';
export { PLAYGROUND_SCENARIO } from './scenarios/playground';
export { getScenario, listScenarios, SCENARIO_REGISTRY } from './scenarios/registry';
export { type RunnerEvaluation, ScenarioRunner } from './scenarios/runner';
export { VACUUM_FAILURE_SCENARIO } from './scenarios/vacuum-failure';
export type {
	AircraftConfig,
	FdmInputs,
	FdmTruthState,
	GradingComponent,
	GradingComponentKind,
	GradingComponentParams,
	GradingDefinition,
	IdealPathDefinition,
	IdealPathSegment,
	RepMetadata,
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
