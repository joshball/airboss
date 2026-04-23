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
} as const;

export type SimScenarioId = (typeof SIM_SCENARIO_IDS)[keyof typeof SIM_SCENARIO_IDS];

export const SIM_SCENARIO_ID_VALUES = Object.values(SIM_SCENARIO_IDS) as readonly SimScenarioId[];

/** Aircraft profile identifiers. Phase 0 only ships the C172. */
export const SIM_AIRCRAFT_IDS = {
	C172: 'c172',
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
		description: 'Yoke back: elevator up, nose rises +5%',
		group: 'elevator',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.ELEVATOR_DOWN,
		keys: ['w', 'W', 'ArrowDown'],
		shift: false,
		label: 'W / Down',
		description: 'Yoke forward: elevator down, nose drops -5%',
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
		description: 'Aileron left -5%',
		group: 'aileron',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.AILERON_RIGHT,
		keys: ['d', 'D'],
		label: 'D',
		description: 'Aileron right +5%',
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
		description: 'Rudder left -5%',
		group: 'rudder',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.RUDDER_RIGHT,
		keys: ['/'],
		label: '/',
		description: 'Rudder right +5%',
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
		description: 'Throttle up +5%',
		group: 'throttle',
	},
	{
		action: SIM_KEYBINDING_ACTIONS.THROTTLE_DOWN,
		keys: ['Control'],
		label: 'Ctrl',
		description: 'Throttle down -5%',
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
