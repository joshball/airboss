/**
 * Airspeed-tape arc bands derived from the selected aircraft's FDM config.
 *
 * The FDM stores V-speeds in m/s on `AircraftConfig`. The PFD renders in
 * knots, so this helper converts at the boundary. Tape components stay
 * aircraft-agnostic; the bands flow in as a prop.
 *
 * Real ASI band convention:
 *   - White arc: Vs0 (full-flap stall) -> Vfe (max flap-extended)
 *   - Green arc: Vs1 (clean stall)     -> Vno (max structural cruise)
 *   - Yellow arc: Vno                  -> Vne (caution range)
 *   - Red line at Vne (never-exceed)
 */

import type { AircraftConfig } from '@ab/bc-sim';
import { MPS_TO_KNOTS } from '@ab/constants';

export interface AirspeedArcBands {
	/** Bottom of white arc -- Vs0 (full-flap stall) in knots. */
	whiteStartKt: number;
	/** Top of white arc -- Vfe (max flap-extended) in knots. */
	whiteEndKt: number;
	/** Bottom of green arc -- Vs1 (clean stall) in knots. */
	greenStartKt: number;
	/** Top of green arc -- Vno (max structural cruise) in knots. */
	greenEndKt: number;
	/** Top of yellow arc -- Vne (never-exceed) in knots. */
	yellowEndKt: number;
	/** Red line at Vne (never-exceed) in knots. */
	redLineKt: number;
}

/** Derive ASI arc band positions (knots) from an aircraft FDM config. */
export function arcBandsFromConfig(cfg: AircraftConfig): AirspeedArcBands {
	return {
		whiteStartKt: cfg.vS0 * MPS_TO_KNOTS,
		whiteEndKt: cfg.vFe * MPS_TO_KNOTS,
		greenStartKt: cfg.vS1 * MPS_TO_KNOTS,
		greenEndKt: cfg.vNo * MPS_TO_KNOTS,
		yellowEndKt: cfg.vNe * MPS_TO_KNOTS,
		redLineKt: cfg.vNe * MPS_TO_KNOTS,
	};
}
