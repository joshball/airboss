/**
 * `frontal-pressure-march` scenario test plan (TruthModel v2 step 4).
 *
 * Asserts:
 *   - The scenario literal validates cleanly through `loadScenario`
 *     (`truthModelSchema` accepts the optional `evolution` block).
 *   - `generateScenario` produces a v1-shape bundle from the v1 snapshot
 *     fields (the build path is unchanged by the temporal extension).
 *   - The temporal evolution behaves as authored: the front accelerates,
 *     intensifies to strong at 1600Z, and pre-frontal cells appear at 1500Z.
 *   - `deriveMetarSequence` produces an hourly METAR sequence at each route
 *     station, every METAR round-tripping cleanly.
 *   - `deriveTafSequence` produces TAFs at successive issue times.
 */

import { describe, expect, it } from 'vitest';
import { generateScenario } from '../engine';
import { deriveMetarSequence, deriveTafSequence } from '../products/temporal';
import { FRONTAL_PRESSURE_MARCH } from '../truth/scenarios/frontal-pressure-march';
import { loadScenario } from '../truth/scenarios/registry';
import { sampleTruthAt } from '../truth/time';

const SLUG = 'frontal-pressure-march';

describe('frontal-pressure-march -- scenario contract', () => {
	it('validates cleanly through loadScenario', () => {
		const truth = loadScenario(SLUG);
		expect(truth.scenarioId).toBe(SLUG);
		expect(truth.evolution).toBeDefined();
	});

	it('carries an evolution window from 1200Z to 2000Z', () => {
		expect(FRONTAL_PRESSURE_MARCH.evolution?.start).toBe('2026-03-14T12:00:00Z');
		expect(FRONTAL_PRESSURE_MARCH.evolution?.end).toBe('2026-03-14T20:00:00Z');
	});

	it('generates a v1-shape bundle (build path unaffected by evolution)', () => {
		const bundle = generateScenario({ kind: SLUG });
		expect(bundle.products.metars.length).toBeGreaterThan(0);
		expect(bundle.products.tafs.length).toBeGreaterThan(0);
		for (const metar of bundle.products.metars) {
			expect(metar.parsed.warnings).toEqual([]);
		}
	});
});

describe('frontal-pressure-march -- temporal evolution', () => {
	it('accelerates the front -- displacement grows faster after 1500Z', () => {
		const front12to15 = frontLeadLon('2026-03-14T15:00:00Z') - frontLeadLon('2026-03-14T12:00:00Z');
		const front15to18 = frontLeadLon('2026-03-14T18:00:00Z') - frontLeadLon('2026-03-14T15:00:00Z');
		// Same 3-hour span; the second segment runs at 22 kt vs 15 kt, so it
		// covers more ground.
		expect(front15to18).toBeGreaterThan(front12to15);
	});

	it('intensifies the front to strong at 1600Z', () => {
		const before = sampleTruthAt(FRONTAL_PRESSURE_MARCH, '2026-03-14T15:00:00Z');
		const after = sampleTruthAt(FRONTAL_PRESSURE_MARCH, '2026-03-14T16:00:00Z');
		expect(before.synoptic.fronts[0]?.intensity).toBe('moderate');
		expect(after.synoptic.fronts[0]?.intensity).toBe('strong');
	});

	it('spawns pre-frontal convection at 1500Z, not before', () => {
		const before = sampleTruthAt(FRONTAL_PRESSURE_MARCH, '2026-03-14T14:00:00Z');
		const at = sampleTruthAt(FRONTAL_PRESSURE_MARCH, '2026-03-14T15:00:00Z');
		expect(before.convection.cells).toEqual([]);
		expect(at.convection.cells.length).toBeGreaterThan(0);
		expect(at.convection.cells.every((c) => c.id.includes('prefront'))).toBe(true);
	});
});

describe('frontal-pressure-march -- product sequences', () => {
	it('emits an hourly METAR sequence at each route station', () => {
		for (const station of FRONTAL_PRESSURE_MARCH.routeStations) {
			const sequence = deriveMetarSequence(FRONTAL_PRESSURE_MARCH, station);
			// 1200Z..2000Z at 60 min -> 9 timestamps.
			expect(sequence).toHaveLength(9);
			for (const metar of sequence) {
				expect(metar.parsed.warnings).toEqual([]);
			}
		}
	});

	it('emits TAFs at successive issue times that round-trip cleanly', () => {
		const tafs = deriveTafSequence(FRONTAL_PRESSURE_MARCH, 'KICT', {
			issueTimes: ['2026-03-14T12:00:00Z', '2026-03-14T15:00:00Z', '2026-03-14T18:00:00Z'],
		});
		expect(tafs).toHaveLength(3);
		for (const taf of tafs) {
			expect(taf.parsed.warnings).toEqual([]);
		}
	});
});

/** Longitude of the front's lead (northernmost) vertex at timestamp `t`. */
function frontLeadLon(t: string): number {
	const sampled = sampleTruthAt(FRONTAL_PRESSURE_MARCH, t);
	const lon = sampled.synoptic.fronts[0]?.points[0]?.[0];
	if (lon === undefined) throw new Error('unreachable');
	return lon;
}
