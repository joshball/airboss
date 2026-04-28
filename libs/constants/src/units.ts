/**
 * Unit-conversion constants. Centralised so every surface that has to
 * cross between physics-native units (SI in `libs/bc/sim/`) and pilot-
 * facing units (knots / feet) routes through the same factor.
 */

/** Meters-per-second to knots. 1 m/s = 1.943_844_492 kt. */
export const MPS_TO_KNOTS = 1.943_844_492;
