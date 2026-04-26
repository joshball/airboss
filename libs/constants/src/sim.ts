/**
 * Flight Dynamics Sim constants (Phase 0 throwaway prototype).
 *
 * These are enum-shaped literals and physical/engine tuning values used by
 * the hand-rolled FDM, the scenario definitions, and the SvelteKit sim app.
 * Per the project's "no magic strings/numbers" rule, anything referenced
 * from BC code, the worker, or the UI lives here.
 */

/** Identifiers for sim scenarios. Extend as scenarios are added. */
export const SIM_SCENARIO_IDS = {
	PLAYGROUND: 'playground',
	FIRST_FLIGHT: 'first-flight',
	DEPARTURE_STALL: 'departure-stall',
	EFATO: 'efato',
	VACUUM_FAILURE: 'vacuum-failure',
	PITOT_BLOCK: 'pitot-block',
	STATIC_BLOCK: 'static-block',
	PARTIAL_PANEL: 'partial-panel',
	UNUSUAL_ATTITUDES_NOSE_HI: 'unusual-attitudes-nose-hi',
	UNUSUAL_ATTITUDES_NOSE_LO: 'unusual-attitudes-nose-lo',
	AFT_CG_SLOW_FLIGHT: 'aft-cg-slow-flight',
	VMC_INTO_IMC: 'vmc-into-imc',
	PLAYGROUND_PA28: 'playground-pa28',
	ILS_APPROACH: 'ils-approach',
} as const;

export type SimScenarioId = (typeof SIM_SCENARIO_IDS)[keyof typeof SIM_SCENARIO_IDS];

export const SIM_SCENARIO_ID_VALUES = Object.values(SIM_SCENARIO_IDS) as readonly SimScenarioId[];

/** Aircraft profile identifiers. */
export const SIM_AIRCRAFT_IDS = {
	C172: 'c172',
	PA28: 'pa28',
} as const;

export type SimAircraftId = (typeof SIM_AIRCRAFT_IDS)[keyof typeof SIM_AIRCRAFT_IDS];

/** Terminal states for a scenario run. */
export const SIM_SCENARIO_OUTCOMES = {
	RUNNING: 'running',
	SUCCESS: 'success',
	FAILURE: 'failure',
	ABORTED: 'aborted',
} as const;

export type SimScenarioOutcome = (typeof SIM_SCENARIO_OUTCOMES)[keyof typeof SIM_SCENARIO_OUTCOMES];

/**
 * FDM integrator configuration.
 *
 * The physics loop runs at `FDM_HZ` inside a Web Worker; UI snapshots are
 * posted to the main thread at `SNAPSHOT_HZ` to keep the instrument
 * components painting at ~60 Hz without saturating postMessage.
 */
export const SIM_TIMING = {
	FDM_HZ: 120,
	SNAPSHOT_HZ: 60,
} as const;

/** Derived step sizes (seconds). */
export const SIM_FDM_DT_SECONDS = 1 / SIM_TIMING.FDM_HZ;
export const SIM_SNAPSHOT_INTERVAL_SECONDS = 1 / SIM_TIMING.SNAPSHOT_HZ;

/** Standard atmosphere sea-level air density (kg/m^3). */
export const SIM_SEA_LEVEL_DENSITY_KG_M3 = 1.225;

/** Gravity (m/s^2). */
export const SIM_GRAVITY_M_S2 = 9.80665;

/** Unit conversions used across the FDM and instruments. */
export const SIM_METERS_PER_FOOT = 0.3048;
export const SIM_FEET_PER_METER = 1 / SIM_METERS_PER_FOOT;
export const SIM_KNOTS_PER_METER_PER_SECOND = 1.943844492440605;

/** Message kinds exchanged with the FDM worker. */
export const SIM_WORKER_MESSAGES = {
	INIT: 'init',
	START: 'start',
	PAUSE: 'pause',
	RESUME: 'resume',
	RESET: 'reset',
	INPUT: 'input',
	TOGGLE_BRAKE: 'toggle-brake',
	TOGGLE_AUTO_COORDINATE: 'toggle-auto-coordinate',
	SNAPSHOT: 'snapshot',
	OUTCOME: 'outcome',
	/**
	 * Posted once per scenario run, immediately after OUTCOME. Carries the
	 * full ReplayTape -- frames + scenarioHash + result -- so the persistence
	 * layer can save it for the debrief.
	 */
	TAPE: 'tape',
	READY: 'ready',
} as const;

export type SimWorkerMessage = (typeof SIM_WORKER_MESSAGES)[keyof typeof SIM_WORKER_MESSAGES];

/**
 * Control input increments for tap-based flight controls. Each key event
 * applies one of these deltas; holding a key is OS-level autorepeat.
 */
export const SIM_CONTROL_INCREMENTS = {
	/** Primary control surface tap step (elevator, aileron, rudder, throttle). */
	PRIMARY: 0.05,
	/** Trim tap step. */
	TRIM: 0.01,
} as const;

/**
 * Spring-centered ramp tuning for held keyboard primary controls. Elevator,
 * aileron, rudder deflect toward a target while the key is held and return to
 * neutral when released -- modeling the spring-centered feel of a yoke or
 * stick. Throttle ramps while held and holds position when released.
 *
 * Rates are per-second; the frame loop multiplies by dt and accumulates.
 */
export const SIM_CONTROL_RAMP = {
	/** Elevator/aileron/rudder: rate while a direction key is held (full-scale per sec). ~0.3 s to full deflection. */
	PRIMARY_DEFLECT_PER_SEC: 1 / 0.3,
	/** Elevator/aileron/rudder: rate while no key is held (return-to-center per sec). ~0.2 s to center. */
	PRIMARY_CENTER_PER_SEC: 1 / 0.2,
	/** Throttle: rate while Shift/Ctrl is held (full-scale per sec). ~2.5 s idle->full. */
	THROTTLE_PER_SEC: 0.4,
} as const;

/** Flap detent positions (0 = up, last = full). C172 ships 0/10/20/30. */
export const SIM_FLAP_NOTCHES = [0, 10, 20, 30] as const;
export type SimFlapDegrees = (typeof SIM_FLAP_NOTCHES)[number];

/** Stall horn tone frequency (Hz) and pulse cadence (Hz). */
export const SIM_STALL_HORN = {
	CARRIER_HZ: 400,
	PULSE_HZ: 5,
	GAIN: 0.12,
} as const;

/**
 * Procedural engine-sound tuning. OSC1 fundamental is scaled by `rpm /
 * idleRpm`; OSC2 adds a harmonic at 2x the fundamental; a band-passed noise
 * source models exhaust / wind. AoA-driven detune produces a climb-straining
 * wobble. Values target a plausible C172 prop note at idle and full power.
 */
export const SIM_ENGINE_SOUND = {
	/** Fundamental oscillator frequency at idle RPM (Hz). */
	BASE_FREQ_HZ: 60,
	/** Relative level (linear gain) of the harmonic oscillator. -12 dB ~= 0.25. */
	HARMONIC_GAIN: 0.25,
	/** Relative level (linear gain) of the noise source. -18 dB ~= 0.125. */
	NOISE_GAIN: 0.125,
	/** Lowpass cutoff for the noise source (Hz). */
	NOISE_LOWPASS_HZ: 800,
	/** Throttle-gain slope. Final gain = throttle * SLOPE + OFFSET. */
	THROTTLE_GAIN_SLOPE: 0.6,
	/** Idle audibility floor. */
	THROTTLE_GAIN_OFFSET: 0.1,
	/** Master gain ceiling applied after throttle gain. */
	MASTER_GAIN: 0.35,
	/** AoA (degrees) at which strain detune begins to take effect. */
	STRAIN_ALPHA_DEG: 8,
	/** Throttle floor below which strain detune stays at 0. */
	STRAIN_THROTTLE_MIN: 0.5,
	/** Maximum detune applied to OSC2 at full strain (cents). */
	STRAIN_DETUNE_CENTS: 10,
	/** Reference dynamic pressure (Pa) at which the noise source hits full level. */
	NOISE_REFERENCE_Q_PA: 3000,
	/** Smoothing time constant for parameter ramps (seconds). */
	RAMP_TAU_SECONDS: 0.05,
} as const;

/** Localstorage keys used by the cockpit UI. */
export const SIM_STORAGE_KEYS = {
	MUTE: 'airboss.sim.mute',
	HELP_DISMISSED: 'airboss.sim.helpDismissed',
	CHEATSHEET_COLLAPSED: 'airboss.sim.cheatsheetCollapsed',
} as const;

/**
 * Warning cue ids. Used to key the caption store, the tuning table, and the
 * per-cue audio class. Extends as new cues land.
 */
export const SIM_WARNING_CUES = {
	STALL_WARNING: 'stall-warning',
	GEAR_WARNING: 'gear-warning',
	FLAP_MOTOR: 'flap-motor',
	MARKER_OUTER: 'marker-outer',
	MARKER_MIDDLE: 'marker-middle',
	MARKER_INNER: 'marker-inner',
	ALTITUDE_ALERT: 'altitude-alert',
	AP_DISCONNECT: 'ap-disconnect',
} as const;

export type SimWarningCue = (typeof SIM_WARNING_CUES)[keyof typeof SIM_WARNING_CUES];

/** Human-readable captions rendered in the a11y caption panel. */
export const SIM_WARNING_CUE_LABELS: Record<SimWarningCue, string> = {
	[SIM_WARNING_CUES.STALL_WARNING]: 'Stall warning horn',
	[SIM_WARNING_CUES.GEAR_WARNING]: 'Gear warning horn',
	[SIM_WARNING_CUES.FLAP_MOTOR]: 'Flap motor running',
	[SIM_WARNING_CUES.MARKER_OUTER]: 'Outer marker beacon',
	[SIM_WARNING_CUES.MARKER_MIDDLE]: 'Middle marker beacon',
	[SIM_WARNING_CUES.MARKER_INNER]: 'Inner marker beacon',
	[SIM_WARNING_CUES.ALTITUDE_ALERT]: 'Altitude alert',
	[SIM_WARNING_CUES.AP_DISCONNECT]: 'Autopilot disconnect',
};

/** Marker-beacon kinds used by the scaffolded trigger API. */
export const SIM_MARKER_BEACON_KINDS = {
	OUTER: 'outer',
	MIDDLE: 'middle',
	INNER: 'inner',
} as const;

export type SimMarkerBeaconKind = (typeof SIM_MARKER_BEACON_KINDS)[keyof typeof SIM_MARKER_BEACON_KINDS];

/**
 * Gear-warning thresholds. Fires when throttle is at/below the idle gate AND
 * IAS is below the low-speed gate AND gear is up. The C172 has fixed gear so
 * this never fires today; the hook is scaffolded for retractable airframes.
 */
export const SIM_GEAR_WARNING = {
	/** Throttle (0..1) at/below which the warning can fire. */
	THROTTLE_MAX: 0.15,
	/** IAS (knots) below which the warning can fire. C172 Vs0 * 1.3 ~ 43 kt. */
	KIAS_MAX: 45,
	/** Warning carrier tone (Hz). */
	CARRIER_HZ: 280,
	/** Pulse cadence (Hz). */
	PULSE_HZ: 3,
	/** Master gain when active. */
	GAIN: 0.08,
} as const;

/**
 * Flap-motor cue tuning. The C172 has detent flaps in the Phase 0.5 prototype
 * (no continuous motion), so the cue fires on each detent-change command for
 * a fixed motor-run duration. Phase 6 continuous-flap work will drive the
 * duration from actual travel time.
 */
export const SIM_FLAP_MOTOR = {
	/** Milliseconds the motor cue plays per detent change. */
	DURATION_MS: 1500,
	/** Master gain. */
	GAIN: 0.04,
	/** Mechanical whirr carrier (Hz). */
	CARRIER_HZ: 110,
	/** Noise lowpass cutoff for the motor gear-train hiss (Hz). */
	NOISE_LOWPASS_HZ: 1200,
} as const;

/**
 * Marker beacon tuning. Audio frequencies and pulse rates are per-kind,
 * matching the ICAO/FAA standard:
 * - Outer: 400 Hz, continuous dashes (2/s)
 * - Middle: 1300 Hz, alternating dot-dash
 * - Inner: 3000 Hz, continuous dots (6/s)
 */
export const SIM_MARKER_BEACON = {
	OUTER_HZ: 400,
	OUTER_PULSE_HZ: 2,
	MIDDLE_HZ: 1300,
	MIDDLE_PULSE_HZ: 3,
	INNER_HZ: 3000,
	INNER_PULSE_HZ: 6,
	GAIN: 0.07,
} as const;

/**
 * Altitude-alert cue tuning. Tone fires once when the aircraft transitions
 * across `target - LEAD_FEET`. Follow-up Phase 4 scenario work wires
 * `setAltitudeAlert(targetFeet)` from scripted scenarios.
 */
export const SIM_ALTITUDE_ALERT = {
	/** Lead distance below target (feet) at which the alert fires. */
	LEAD_FEET: 1000,
	/** Single-shot tone duration (ms). */
	DURATION_MS: 700,
	/** Tone carrier (Hz). */
	CARRIER_HZ: 1000,
	/** Master gain. */
	GAIN: 0.08,
} as const;

/** Autopilot disconnect cue tuning. Single-shot rapid pulse. */
export const SIM_AP_DISCONNECT = {
	DURATION_MS: 900,
	CARRIER_HZ: 800,
	PULSE_HZ: 8,
	GAIN: 0.1,
} as const;

/** Caption panel timing. */
export const SIM_CAPTION = {
	/** How long each caption stays visible (ms) after its cue deactivates. */
	LINGER_MS: 3000,
	/** Cap on simultaneously visible captions. */
	MAX_VISIBLE: 6,
} as const;

/**
 * Keybinding definitions for the cockpit. Single source of truth rendered
 * in the help overlay and consumed by the keydown handler.
 */
export const SIM_KEYBINDING_ACTIONS = {
	ELEVATOR_UP: 'elevator-up',
	ELEVATOR_DOWN: 'elevator-down',
	ELEVATOR_CENTER: 'elevator-center',
	TRIM_DOWN: 'trim-down',
	TRIM_UP: 'trim-up',
	AILERON_LEFT: 'aileron-left',
	AILERON_RIGHT: 'aileron-right',
	AILERON_CENTER: 'aileron-center',
	RUDDER_LEFT: 'rudder-left',
	RUDDER_RIGHT: 'rudder-right',
	RUDDER_CENTER: 'rudder-center',
	THROTTLE_UP: 'throttle-up',
	THROTTLE_DOWN: 'throttle-down',
	THROTTLE_IDLE: 'throttle-idle',
	THROTTLE_FULL: 'throttle-full',
	BRAKE_TOGGLE: 'brake-toggle',
	FLAPS_DOWN: 'flaps-down',
	FLAPS_UP: 'flaps-up',
	PAUSE: 'pause',
	RESET: 'reset',
	RESET_IMMEDIATE: 'reset-immediate',
	HELP_TOGGLE: 'help-toggle',
	MUTE_TOGGLE: 'mute-toggle',
} as const;

export type SimKeybindingAction = (typeof SIM_KEYBINDING_ACTIONS)[keyof typeof SIM_KEYBINDING_ACTIONS];

export interface SimKeybinding {
	action: SimKeybindingAction;
	/** KeyboardEvent.key values that fire this action. */
	keys: readonly string[];
	/** Modifier flags. undefined = don't care. true = must be held. false = must NOT be held. */
	shift?: boolean;
	/** Human-readable key label for the help overlay. */
	label: string;
	/** Human-readable description. */
	description: string;
	/** Grouping for the help overlay. */
	group: 'elevator' | 'aileron' | 'rudder' | 'throttle' | 'trim' | 'configuration' | 'system';
}

export const SIM_KEYBINDINGS: readonly SimKeybinding[] = [
	{
		// Yoke-back semantics: S / ArrowUp pulls the yoke back, elevator UP,
		// nose RISES. The letter-key and arrow-key pairings intentionally
		// match: the arrows are physically oriented (UpArrow = pitch up), and
		// the WASD pair mirrors a stick: forward (W) = push, back (S) = pull.
		action: SIM_KEYBINDING_ACTIONS.ELEVATOR_UP,
		keys: ['s', 'S', 'ArrowUp'],
		shift: false,
		label: 'S / Up',
		description: 'Yoke back: hold for elevator up, nose rises',
		group: 'elevator',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN,
		keys: ['w', 'W', 'ArrowDown'],
		shift: false,
		label: 'W / Down',
		description: 'Yoke forward: hold for elevator down, nose drops',
		group: 'elevator',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.ELEVATOR_CENTER,
		keys: ['x', 'X'],
		label: 'X',
		description: 'Center elevator',
		group: 'elevator',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.TRIM_DOWN,
		keys: ['['],
		label: '[',
		description: 'Trim nose-down -1%',
		group: 'trim',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.TRIM_UP,
		keys: [']'],
		label: ']',
		description: 'Trim nose-up +1%',
		group: 'trim',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.AILERON_LEFT,
		keys: ['a', 'A'],
		label: 'A',
		description: 'Hold for aileron left (spring-centered)',
		group: 'aileron',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.AILERON_RIGHT,
		keys: ['d', 'D'],
		label: 'D',
		description: 'Hold for aileron right (spring-centered)',
		group: 'aileron',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.AILERON_CENTER,
		keys: ['c', 'C'],
		label: 'C',
		description: 'Center aileron',
		group: 'aileron',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.RUDDER_LEFT,
		keys: [','],
		label: ',',
		description: 'Hold for rudder left (spring-centered)',
		group: 'rudder',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT,
		keys: ['/'],
		label: '/',
		description: 'Hold for rudder right (spring-centered)',
		group: 'rudder',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.RUDDER_CENTER,
		keys: ['z', 'Z'],
		label: 'Z',
		description: 'Center rudder',
		group: 'rudder',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.THROTTLE_UP,
		keys: ['Shift'],
		label: 'Shift',
		description: 'Hold to push throttle up',
		group: 'throttle',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN,
		keys: ['Control'],
		label: 'Ctrl',
		description: 'Hold to pull throttle back',
		group: 'throttle',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.THROTTLE_IDLE,
		keys: ['0'],
		label: '0',
		description: 'Throttle idle',
		group: 'throttle',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.THROTTLE_FULL,
		keys: ['9'],
		label: '9',
		description: 'Throttle full',
		group: 'throttle',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.BRAKE_TOGGLE,
		keys: ['.'],
		label: '.',
		description: 'Toggle parking brake',
		group: 'configuration',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.FLAPS_DOWN,
		keys: ['f', 'F'],
		label: 'F',
		description: 'Flaps one notch down',
		group: 'configuration',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.FLAPS_UP,
		keys: ['v', 'V'],
		label: 'V',
		description: 'Flaps one notch up',
		group: 'configuration',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.PAUSE,
		keys: [' '],
		label: 'Space',
		description: 'Pause / resume',
		group: 'system',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.RESET,
		keys: ['r', 'R'],
		shift: false,
		label: 'R',
		description: 'Reset scenario (confirm)',
		group: 'system',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.RESET_IMMEDIATE,
		keys: ['R'],
		shift: true,
		label: 'Shift+R',
		description: 'Reset immediately',
		group: 'system',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.HELP_TOGGLE,
		keys: ['?', '/'],
		shift: true,
		label: '?',
		description: 'Toggle this help overlay',
		group: 'system',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.MUTE_TOGGLE,
		keys: ['m', 'M'],
		label: 'M',
		description: 'Toggle sound mute (engine + stall horn)',
		group: 'system',
	},
];

/**
 * Instrument fault kinds. Each fault transforms truth state into a display
 * state that lies in a specific way -- pitot block freezes the ASI sensor,
 * vacuum failure drifts the AI gyro, etc. The transform is pure (see
 * libs/bc/sim/src/faults/transform.ts); these ids are how scenarios declare
 * which faults to fire and how the runner activates them.
 */
export const SIM_FAULT_KINDS = {
	PITOT_BLOCK: 'pitot_block',
	STATIC_BLOCK: 'static_block',
	VACUUM_FAILURE: 'vacuum_failure',
	ALTERNATOR_FAILURE: 'alternator_failure',
	GYRO_TUMBLE: 'gyro_tumble',
} as const;

export type SimFaultKind = (typeof SIM_FAULT_KINDS)[keyof typeof SIM_FAULT_KINDS];

/** Human-readable label per fault, used in the storybook gallery + debrief. */
export const SIM_FAULT_LABELS: Record<SimFaultKind, string> = {
	pitot_block: 'Pitot block',
	static_block: 'Static block',
	vacuum_failure: 'Vacuum failure',
	alternator_failure: 'Alternator failure',
	gyro_tumble: 'Gyro tumble',
};

/**
 * How a fault is fired. Time-based fires after N seconds of scenario time.
 * Altitude-based fires the first tick the aircraft crosses the threshold
 * upward through it. Step-based fires when a named scenario step starts.
 */
export const SIM_FAULT_TRIGGER_KINDS = {
	TIME_SECONDS: 'time_seconds',
	ALTITUDE_AGL_METERS: 'altitude_agl_meters',
	ON_STEP: 'on_step',
} as const;

export type SimFaultTriggerKind = (typeof SIM_FAULT_TRIGGER_KINDS)[keyof typeof SIM_FAULT_TRIGGER_KINDS];

/**
 * Nominal cockpit electric-bus voltage. The C172 runs a 28V system; the
 * fault transform reads this as the "what every electric instrument sees
 * when the alternator is healthy" baseline. Scenarios with alternator
 * failure decay from here toward zero.
 */
export const SIM_ELECTRIC_BUS_NOMINAL_VOLTS = 28;

/**
 * Per-fault parameter defaults. Scenarios may override these on a fault-by-
 * fault basis via ScenarioFault.params.
 */
export const SIM_FAULT_DEFAULTS = {
	/** Vacuum AI/HI drift rate (deg/sec) when no override is given. */
	VACUUM_DRIFT_DEG_PER_SEC: 1.0,
	/** Alternator: time from trigger until the bus is fully discharged (sec). */
	ALTERNATOR_DECAY_SECONDS: 60,
	/** Whether gyro-tumble continues cycling once initiated. */
	GYRO_TUMBLE_CONTINUES: true,
	/** Static block: altitude at which the static port effectively froze (ft). */
	STATIC_BLOCK_FREEZE_ALT_FT: 0,
	/** Pitot block: airspeed at which the pitot tube effectively froze (KIAS). */
	PITOT_BLOCK_FREEZE_KIAS: 0,
} as const;

/**
 * Tuning for the scenario grading evaluator (libs/bc/sim/src/scenarios/grading.ts).
 * Pass/fail is independent and decided by the runner; these numbers shape
 * the 0..1 quality grade that feeds the spaced-rep scheduler.
 */
export const SIM_GRADING = {
	/** Tolerance for "weights sum to one" on a GradingDefinition. */
	WEIGHT_SUM_EPSILON: 0.001,
	/** When `hardFail` is omitted, decay-to-zero distance defaults to tolerance * this. */
	HARD_FAIL_TOLERANCE_MULTIPLIER: 4,
	/** EFATO-style trigger: engine RPM below this fraction of peak counts as cut. */
	ENGINE_CUT_RPM_FRACTION: 0.5,
	/** Reaction latency at/below this gets full credit (seconds). */
	REACTION_EXCELLENT_SECONDS: 2.0,
	/** Reaction latency at/above this gets zero credit (seconds). */
	REACTION_POOR_SECONDS: 8.0,
	/** Elevator command threshold for the `stick_forward` reaction predicate. */
	STICK_FORWARD_ELEVATOR: -0.2,
	/** Throttle at/below this counts as "idle" for the throttle_idle predicate. */
	THROTTLE_IDLE_THRESHOLD: 0.15,
	/** Stall warning seconds counted at 1x; stalled seconds at 2x. */
	STALL_PENALTY_MULTIPLIER: 2,
	/** ideal_path_match axis weights: altitude in m, IAS scaled by this. */
	IDEAL_PATH_IAS_WEIGHT: 20,
	/** ideal_path_match heading scaled by this (per degree). */
	IDEAL_PATH_HEADING_WEIGHT: 20,
	/** Min control-axis delta to count as "any input change" reaction. */
	REACTION_INPUT_DELTA: 0.1,
} as const;

/**
 * Spaced-rep bias from sim performance.
 *
 * Read by `getRecentSimWeakness` to translate a learner's recent
 * `sim.attempt` rows into a per-scenario weakness signal that the
 * study scheduler can later consume. The thresholds are deliberately
 * loose -- the goal is "this scenario keeps grading <= POOR_THRESHOLD,
 * surface its related study cards" without being noisy on a single
 * bad run.
 */
export const SIM_BIAS = {
	/** Default lookback window when no `since` is provided (days). */
	DEFAULT_WINDOW_DAYS: 30,
	/** Default cap on attempts considered per scenario; newest wins. */
	DEFAULT_MAX_ATTEMPTS_PER_SCENARIO: 5,
	/** Below this average grade total a scenario is "weak" (0..1). */
	POOR_THRESHOLD: 0.6,
	/** Min attempts in the window before the signal counts; one bad run is noise. */
	MIN_ATTEMPTS: 2,
	/** Floor on the returned weight (0..1). Keeps the signal nonzero when the user is right at the threshold. */
	WEIGHT_FLOOR: 0.1,
} as const;
