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
	pitch: number;
	/** Roll / bank angle in degrees (right wing down positive). */
	roll: number;
	/**
	 * Yaw angle in degrees relative to a scenario-local reference (0..359).
	 * Optional because the PFD's bottom heading strip is driven from
	 * `NavData.headingDegMag` today; yaw arrives when a real AHRS feed lands.
	 */
	yaw?: number;
	/**
	 * Source channel. Locked to `'AHRS'` today; reserved as a discriminant
	 * for future synthetic-vision overlays that may inject pitch/roll from
	 * a different sensor (radar altimeter cross-check, GPS-derived attitude
	 * for low-cost panels, etc).
	 */
	source: 'AHRS';
}

/**
 * Air-data reading. Sourced today from PFD sliders; in a later FDM
 * coupling it comes from the air-data computer (ADC) channel of the
 * truth state, with pitot/static failure modes already modelled in
 * `libs/bc/sim/src/faults/`.
 */
export interface AirData {
	/** Indicated airspeed (knots). The boxed digit on the airspeed tape. */
	indicatedAirspeedKt: number;
	/**
	 * True airspeed (knots). Optional today: the PFD's airspeed tape
	 * shows IAS only. TAS lands when the air-data computer surface is real.
	 */
	trueAirspeedKt?: number;
	/** Pressure altitude (feet MSL) -- the value rendered on the altitude tape. */
	altitudeFt: number;
	/** Vertical speed (feet per minute, positive up). */
	verticalSpeedFpm: number;
	/**
	 * Outside air temperature (Celsius). Optional; lands when the PFD
	 * shows a temp readout.
	 */
	oat?: number;
	/**
	 * Source channel. Locked to `'ADC'` today; reserved as a discriminant
	 * for future fallback paths (GPS-derived altitude when the static port
	 * fails, etc).
	 */
	source: 'ADC';
}

/**
 * Navigation reading. Sourced today from PFD slider input; in a later
 * coupling it comes from the navigation radio (VOR/ILS) or GPS receiver
 * channel. The `source` discriminant lets downstream consumers tell the
 * two apart -- a CDI behaves differently when it's tracking a localizer
 * versus a GPS course.
 */
export interface NavData {
	/** Magnetic heading (0..359 degrees). The boxed digit on the heading strip. */
	headingDegMag: number;
	/**
	 * Ground track (degrees true). Optional; differs from heading when
	 * there's wind. Lands when the PFD wires a ground-track diamond on
	 * the heading strip.
	 */
	groundTrackDeg?: number;
	/** Ground speed (knots). Optional; lands with the ground-track diamond. */
	groundSpeedKt?: number;
	/** Aircraft latitude (decimal degrees). Optional; reserved for MFD map. */
	positionLat?: number;
	/** Aircraft longitude (decimal degrees). Optional; reserved for MFD map. */
	positionLon?: number;
	/**
	 * Source channel. `'NavRadio'` for VOR/ILS-driven readings;
	 * `'GPS'` for satnav-driven readings. The CDI rendering and
	 * cross-track tolerances change between the two.
	 */
	source: 'NavRadio' | 'GPS';
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
	/**
	 * Wall-clock timestamp (milliseconds since the Unix epoch) at which
	 * this snapshot was produced. Lets downstream consumers (replay,
	 * scan-trainer grading) align telemetry frames against external
	 * events without inventing a per-channel clock.
	 */
	timestampMs: number;
}
