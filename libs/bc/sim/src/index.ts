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
	engineFiringHz,
	engineFundamentalHz,
	flapsChanged,
	markerBeaconAtPosition,
	noiseGainTarget,
	propBladePassHz,
	shouldSoundGearWarning,
	strainDetuneCents,
	strainFactor,
	throttleGainTarget,
	tremoloHz,
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
export { AIRCRAFT_REGISTRY, getAircraftConfig, listAircraftConfigs } from './fdm/aircraft-registry';
export { C172_CONFIG } from './fdm/c172';
export { FdmEngine, windFromScenario } from './fdm/engine';
export { PA28_CONFIG } from './fdm/pa28';
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
export { AFT_CG_SLOW_FLIGHT_SCENARIO } from './scenarios/aft-cg-slow-flight';
export { DEPARTURE_STALL_SCENARIO } from './scenarios/departure-stall';
export { EFATO_SCENARIO } from './scenarios/efato';
export { FIRST_FLIGHT_SCENARIO } from './scenarios/first-flight';
export {
	evaluateGrading,
	type GradeComponentResult,
	type GradeReport,
	type GradingEvaluationContext,
	tapeWasSuccessful,
} from './scenarios/grading';
export { ILS_APPROACH_SCENARIO } from './scenarios/ils-approach';
export { PARTIAL_PANEL_SCENARIO } from './scenarios/partial-panel';
export { PITOT_BLOCK_SCENARIO } from './scenarios/pitot-block';
export { PLAYGROUND_SCENARIO } from './scenarios/playground';
export { PLAYGROUND_PA28_SCENARIO } from './scenarios/playground-pa28';
export { getScenario, listScenarios, SCENARIO_REGISTRY } from './scenarios/registry';
export { type RunnerEvaluation, ScenarioRunner } from './scenarios/runner';
export { STATIC_BLOCK_SCENARIO } from './scenarios/static-block';
export { UNUSUAL_ATTITUDES_SCENARIO } from './scenarios/unusual-attitudes';
export { UNUSUAL_ATTITUDES_NOSE_LO_SCENARIO } from './scenarios/unusual-attitudes-nose-lo';
export { VACUUM_FAILURE_SCENARIO } from './scenarios/vacuum-failure';
export { VMC_INTO_IMC_SCENARIO } from './scenarios/vmc-into-imc';
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
	MarkerBeaconZone,
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
