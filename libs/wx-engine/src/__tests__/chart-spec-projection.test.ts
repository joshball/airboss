/**
 * Regression guard for the "hunchback" CONUS projection bug.
 *
 * Every wx-engine chart-spec emitter must set
 * `spec.projection.rotate = [CONUS_CENTRAL_MERIDIAN, 0]`. The `-39` latitude
 * rotation that was present in the spike-lift literals tilted the Lambert
 * Conformal Conic projection axis, placing the projection's "north pole"
 * at ~51 N instead of 90 N and producing the inverted-arc / warped Great
 * Lakes geometry visible in PRs #922 / #923 / #924 + the unmerged viewport
 * clip workaround. Root cause: spec authors confused "central meridian +
 * reference latitude" (a `center: [0, 38]` concept) with "rotate" (a
 * `rotate: [-96, 0]` concept).
 *
 * The latitude rotation `0` is a math invariant: the Lambert Conformal
 * Conic projection is non-oblique for CONUS, so any non-zero latitude
 * rotation is wrong by definition. We inline the literal `0` rather than
 * routing it through a constant.
 *
 * Driving every emitter via `generateScenario` across all six registered
 * scenarios is strictly stronger than per-emitter unit calls: it covers
 * every chart kind (13 unique types, 17 charts per scenario including
 * multi-station TAFs), exercises the real seed-loading path, and catches
 * any future emitter automatically without test maintenance.
 */

import { WX_SCENARIO_VALUES } from '@ab/constants';
import { CONUS_CENTRAL_MERIDIAN } from '@ab/wx-charts';
import { generateScenario } from '@ab/wx-engine/server';
import { describe, expect, it } from 'vitest';

interface RotatableSpec {
	type: string;
	projection: {
		rotate: [number, number];
	};
}

describe('wx-engine chart-spec projection rotate', () => {
	it.each(
		WX_SCENARIO_VALUES,
	)('scenario "%s": every emitted chart spec uses rotate [CONUS_CENTRAL_MERIDIAN, 0]', (slug) => {
		const bundle = generateScenario({ kind: slug });
		expect(bundle.charts.length).toBeGreaterThan(0);
		for (const chart of bundle.charts) {
			const spec = chart.spec as RotatableSpec;
			expect(spec.projection.rotate).toEqual([CONUS_CENTRAL_MERIDIAN, 0]);
		}
	});

	it('exercises every registered chart kind across the six scenarios', () => {
		const observedKinds = new Set<string>();
		for (const slug of WX_SCENARIO_VALUES) {
			const bundle = generateScenario({ kind: slug });
			for (const chart of bundle.charts) {
				observedKinds.add((chart.spec as RotatableSpec).type);
			}
		}
		// All 13 chart kinds emitted by the 13 wx-engine chart-spec emitters
		// listed in libs/wx-engine/src/charts/*.ts.
		const expectedKinds = [
			'advisory-overlay',
			'convective-outlook',
			'cva',
			'freezing-level',
			'gfa',
			'icing-gairmet',
			'metar-plot-grid',
			'pirep-plot-grid',
			'prog-chart',
			'surface-analysis',
			'taf-timeline',
			'turbulence-gairmet',
			'winds-aloft-fb',
		];
		for (const kind of expectedKinds) {
			expect(observedKinds.has(kind)).toBe(true);
		}
		expect(observedKinds.size).toBe(expectedKinds.length);
	});
});
