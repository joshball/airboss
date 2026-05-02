/**
 * Airspeed-arc derivation: V-speeds (m/s) -> tape arc bands (knots).
 *
 * The tape components stay aircraft-agnostic; the bands flow in via this
 * helper. A regression in the conversion would silently mis-paint the
 * white / green / yellow arcs and the Vne red line, which is a real
 * pilot-facing safety regression.
 */

import { C172_CONFIG } from '@ab/bc-sim';
import { MPS_TO_KNOTS } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { arcBandsFromConfig } from '../src/pfd/airspeed-arcs';

describe('arcBandsFromConfig (C172)', () => {
	const bands = arcBandsFromConfig(C172_CONFIG);

	it('white arc starts at Vs0 (full-flap stall)', () => {
		expect(bands.whiteStartKt).toBeCloseTo(C172_CONFIG.vS0 * MPS_TO_KNOTS, 5);
	});

	it('white arc ends at Vfe (max flap-extended)', () => {
		expect(bands.whiteEndKt).toBeCloseTo(C172_CONFIG.vFe * MPS_TO_KNOTS, 5);
	});

	it('green arc starts at Vs1 (clean stall)', () => {
		expect(bands.greenStartKt).toBeCloseTo(C172_CONFIG.vS1 * MPS_TO_KNOTS, 5);
	});

	it('green arc ends at Vno (max structural cruise)', () => {
		expect(bands.greenEndKt).toBeCloseTo(C172_CONFIG.vNo * MPS_TO_KNOTS, 5);
	});

	it('yellow arc ends at Vne (never-exceed)', () => {
		expect(bands.yellowEndKt).toBeCloseTo(C172_CONFIG.vNe * MPS_TO_KNOTS, 5);
	});

	it('redline coincides with Vne', () => {
		expect(bands.redLineKt).toBe(bands.yellowEndKt);
	});

	it('arcs respect the V-speed ordering: Vs0 < Vs1 < Vfe < Vno < Vne', () => {
		expect(bands.whiteStartKt).toBeLessThan(bands.greenStartKt);
		expect(bands.greenStartKt).toBeLessThan(bands.whiteEndKt);
		expect(bands.whiteEndKt).toBeLessThan(bands.greenEndKt);
		expect(bands.greenEndKt).toBeLessThan(bands.yellowEndKt);
	});
});

describe('arcBandsFromConfig (synthetic config)', () => {
	it('linearly scales m/s to knots via MPS_TO_KNOTS', () => {
		const cfg = {
			vS0: 1,
			vS1: 1,
			vFe: 1,
			vNo: 1,
			vNe: 1,
		} as Parameters<typeof arcBandsFromConfig>[0];
		const bands = arcBandsFromConfig(cfg);
		expect(bands.whiteStartKt).toBeCloseTo(MPS_TO_KNOTS, 10);
		expect(bands.greenStartKt).toBeCloseTo(MPS_TO_KNOTS, 10);
		expect(bands.whiteEndKt).toBeCloseTo(MPS_TO_KNOTS, 10);
		expect(bands.greenEndKt).toBeCloseTo(MPS_TO_KNOTS, 10);
		expect(bands.yellowEndKt).toBeCloseTo(MPS_TO_KNOTS, 10);
		expect(bands.redLineKt).toBeCloseTo(MPS_TO_KNOTS, 10);
	});
});
