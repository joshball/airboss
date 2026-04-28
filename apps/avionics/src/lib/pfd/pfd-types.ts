/**
 * PFD-local view types.
 *
 * These describe the slider and keyboard input pipeline that drives the
 * tape-style instruments. They are app-local because the PFD shell owns
 * its own input metaphor; later WP cycles may promote the bindings to
 * `libs/activities/pfd/` once a second consumer materialises.
 *
 * Plain data only -- structured-clone-safe so the same shape can survive
 * a future migration into a worker without churn.
 */

/**
 * The PFD tracks six driven values. Each is a target the rAF loop eases
 * the rendered value toward. Keys are stable so they index both the
 * slider strip and the keyboard handlers.
 */
export const PFD_INPUT_KEYS = {
	PITCH: 'pitch',
	BANK: 'bank',
	AIRSPEED: 'airspeed',
	ALTITUDE: 'altitude',
	HEADING: 'heading',
	VERTICAL_SPEED: 'verticalSpeed',
} as const;

export type PfdInputKey = (typeof PFD_INPUT_KEYS)[keyof typeof PFD_INPUT_KEYS];

/**
 * Slider / keyboard binding for a single PFD channel. Range, step, and
 * default come straight from the spec's Inputs table; the keyboard
 * shortcut keys are the bindings the `?` legend renders.
 *
 * `keyboardModifierKeys` is the modifier (e.g. Shift) that the binding
 * requires; an empty array means the modifier must NOT be pressed.
 *
 * `unitLabel` is the human label shown in the slider strip and the
 * legend ("deg", "kt", "ft", "fpm").
 */
export interface PfdInputBinding {
	key: PfdInputKey;
	label: string;
	unitLabel: string;
	min: number;
	max: number;
	step: number;
	default: number;
	/** Keys that decrement the value (e.g. `['s']` for pitch-down). */
	decKeys: readonly string[];
	/** Keys that increment the value (e.g. `['w']` for pitch-up). */
	incKeys: readonly string[];
	/** Step size for keyboard nudges; may differ from the slider step. */
	keyStep: number;
	/** True when the binding requires the Shift modifier. */
	requiresShift: boolean;
}

export type PfdInputBindings = readonly PfdInputBinding[];

/**
 * Per-channel "feel" tuning for the rAF loop.
 *
 * Each value is a critically-damped low-pass time constant in seconds.
 * Smaller = more responsive (snappier follow). Larger = smoother (more
 * lag). The component code never inlines these literals; revisions go
 * through this constants object so feel changes happen as a focused
 * commit, not a component edit.
 */
export interface PfdEasingConfig {
	/** Pitch / bank attitude time constant (seconds). */
	attitude: number;
	/** Airspeed time constant (seconds). */
	airspeed: number;
	/** Altitude time constant (seconds). */
	altitude: number;
	/** Heading time constant (seconds). Wraps at 360 deg. */
	heading: number;
	/** Vertical speed time constant (seconds). */
	verticalSpeed: number;
}

/**
 * The bag of values the rAF loop drives toward each frame. Targets are
 * written by sliders / keyboard handlers; rendered values are read by
 * instrument props. The two are kept apart so the eased curve is the
 * only path from input to render -- there is no way to bypass the
 * easing and slam the instruments.
 */
export interface PfdValues {
	pitchDeg: number;
	bankDeg: number;
	airspeedKnots: number;
	altitudeFeet: number;
	headingDeg: number;
	verticalSpeedFpm: number;
}
