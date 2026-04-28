/**
 * Shared Avionics BC types. Plain data only -- no classes, no behaviour.
 * The PFD demo, future scan-trainer drills, and any FDM coupling all
 * hand telemetry across worker / main-thread / persistence boundaries,
 * so every value on these types must be structured-clone-safe (no
 * functions, no symbols, no class instances).
 *
 * The Phase-0 scaffold wires the slider state on the PFD page into a
 * single `AvionicsTelemetry` aggregate; the components read from it.
 * Later features (FDM coupling, scan grading, MFD pages) will produce
 * the same shape from a real source without changing component contracts.
 */

/**
 * Inertial-attitude reading. Sourced today from PFD slider input; in a
 * later FDM coupling it comes from the AHRS channel of the truth state.
 */
export interface Attitude {
	/** Pitch angle in degrees (nose-up positive). */
	pitchDeg: number;
	/** Roll / bank angle in degrees (right wing down positive). */
	rollDeg: number;
	/**
	 * Slip/skid indicator, range -1..+1 (0 = coordinated, positive = ball
	 * right, negative = ball left). Reserved -- not rendered yet. Carried on
	 * the type so the slider/FDM source can populate it without churning
	 * the contract when the inclinometer lands.
	 */
	slipBall: number;
}

/**
 * Air-data reading. Sourced today from PFD sliders; in a later FDM
 * coupling it comes from the air-data computer (ADC) channel of the
 * truth state, with pitot/static failure modes already modelled in
 * `libs/bc/sim/src/faults/`.
 */
export interface AirData {
	/** Indicated airspeed (knots). The boxed digit on the airspeed tape. */
	indicatedAirspeedKnots: number;
	/** Pressure altitude (feet MSL) -- the value rendered on the altitude tape. */
	pressureAltitudeFeet: number;
	/** Vertical speed (feet per minute, positive up). */
	verticalSpeedFpm: number;
	/**
	 * Outside air temperature (Celsius). Optional; lands when the PFD
	 * shows a temp readout.
	 */
	outsideAirTempC?: number;
}

/**
 * Navigation reading. Sourced today from PFD slider input; in a later
 * coupling it comes from the navigation radio (VOR/ILS) or GPS receiver
 * channel.
 */
export interface NavData {
	/** Magnetic heading (0..359 degrees). The boxed digit on the heading strip. */
	headingDegMag: number;
	/**
	 * True heading (degrees). Optional; differs from magnetic heading by
	 * local magnetic variation. Lands when a true-vs-magnetic toggle is
	 * wired on the PFD.
	 */
	headingDegTrue?: number;
	/**
	 * Selected course on the CDI / OBS (degrees). Optional; reserved for
	 * the CDI/HSI work in later waves.
	 */
	courseSelectDeg?: number;
	/**
	 * Cross-track error (nautical miles). Optional; reserved for the CDI
	 * deflection rendering in later waves.
	 */
	crossTrackErrorNm?: number;
}

/**
 * Snapshot of every avionics channel at a single instant. The PFD demo
 * builds one of these each animation frame from the slider state and
 * passes it down to the instruments. A later FDM coupling produces the
 * same shape from the truth state at the FDM tick rate.
 */
export interface AvionicsTelemetry {
	attitude: Attitude;
	airData: AirData;
	navData: NavData;
}
