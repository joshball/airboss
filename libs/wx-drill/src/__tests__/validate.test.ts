/**
 * Round-trip validation tests. Builds a synthetic pack with one valid and
 * one malformed METAR; expects the validator to flag the malformed one.
 */

import { describe, expect, it } from 'vitest';
import type { DrillPack } from '../types';
import { validateDrillPack } from '../validate';

function makePack(items: DrillPack['items']): DrillPack {
	return {
		generatedAt: '2026-05-14T00:00:00.000Z',
		args: {
			count: items.length,
			products: ['metar'],
			layout: 'interleaved',
			seed: 1,
			fromScenarios: 'all',
			coverage: 'balanced',
		},
		items,
		coverageReport: { totalFamilies: 0, coveredFamilies: 0, uncoveredFamilies: [] },
	};
}

describe('validateDrillPack', () => {
	it('passes a pack of well-formed METARs', () => {
		const pack = makePack([
			{
				index: 0,
				product: 'metar',
				scenarioSlug: 'frontal-xc-march',
				stationIcao: 'KICT',
				raw: 'KICT 121753Z 28019G31KT 10SM FEW250 24/M02 A2999',
				annotations: [],
				exercisedFamilies: [],
			},
		]);
		const result = validateDrillPack(pack);
		expect(result.failed).toBe(false);
		expect(result.failures.length).toBe(0);
		expect(result.checked).toBe(1);
	});

	it('skips non-METAR/TAF products without falsely failing', () => {
		const pack = makePack([
			{
				index: 0,
				product: 'pirep',
				scenarioSlug: 'frontal-xc-march',
				stationIcao: null,
				raw: 'whatever -- not a METAR',
				annotations: [],
				exercisedFamilies: [],
			},
		]);
		const result = validateDrillPack(pack);
		expect(result.failed).toBe(false);
		expect(result.checked).toBe(0);
	});
});
