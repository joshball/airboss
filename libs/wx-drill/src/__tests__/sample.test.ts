/**
 * Sampler unit tests. Use synthetic scenario snapshots so the test stays
 * decoupled from the wx-engine -- the sampler is the unit under test, not
 * the truth model.
 */

import { describe, expect, it } from 'vitest';
import { buildPack, type CatalogFamiliesByProduct } from '../sample';
import type { ScenarioSnapshot } from '../snapshot';
import type { DrillPackArgs } from '../types';

const SYNTH_CATALOG: CatalogFamiliesByProduct = {
	metar: ['wind', 'visibility', 'sky-condition', 'temp-dew', 'altimeter'],
	taf: ['validity', 'wind', 'visibility'],
	pirep: ['airframe', 'altitude'],
	fb: ['altitude-wind', 'altitude-temp'],
	airmet: ['sigmet-conv', 'airmet-tango'],
};

function fakeSnapshot(slug = 'frontal-xc-march'): ScenarioSnapshot {
	return {
		slug: slug as ScenarioSnapshot['slug'],
		metars: [
			{
				icao: 'KICT',
				raw: 'KICT 121753Z 28019G31KT 10SM FEW250 24/M02 A2999',
				annotations: [
					{ token: '28019G31KT', family: 'wind', decode: 'wind 280 at 19 gust 31' },
					{ token: '10SM', family: 'visibility', decode: '10 statute miles visibility' },
					{ token: 'FEW250', family: 'sky-condition', decode: 'few layer at 25,000 ft' },
					{ token: '24/M02', family: 'temp-dew', decode: 'temp 24, dew -2' },
					{ token: 'A2999', family: 'altimeter', decode: 'altimeter 29.99 inHg' },
				],
			},
		],
		tafs: [
			{
				icao: 'KICT',
				raw: 'TAF KICT 121120Z 1212/1318 28015G25KT P6SM SCT250',
				annotations: [
					{ token: '1212/1318', family: 'validity', decode: 'valid 12/12-13/18Z' },
					{ token: '28015G25KT', family: 'wind', decode: 'wind 280 at 15 gust 25' },
					{ token: 'P6SM', family: 'visibility', decode: '> 6 sm vis' },
				],
			},
		],
		pireps: [
			{
				raw: 'UA /OV KICT270020 /TM 1830 /FL080 /TP C172 /TA 05',
				annotations: [
					{ token: '/TP C172', family: 'airframe', decode: 'Cessna 172' },
					{ token: '/FL080', family: 'altitude', decode: '8000 ft MSL' },
				],
			},
		],
		fbItems: {
			raw: 'FT 3000 6000 9000\nKICT 2715+05 2725-00 2735-08',
			annotations: [
				{ token: '2725-00', family: 'altitude-wind', decode: 'wind 270 at 25 kt' },
				{ token: '2725-00', family: 'altitude-temp', decode: 'temp 0 C' },
			],
		},
		airmets: [
			{
				id: 'WST-1',
				annotations: [{ token: 'SIGMET-CONV', family: 'sigmet-conv', decode: 'convective SIGMET' }],
			},
		],
	};
}

const baseArgs: DrillPackArgs = {
	count: 5,
	products: ['metar', 'taf'],
	layout: 'interleaved',
	seed: 42,
	fromScenarios: 'all',
	coverage: 'balanced',
};

describe('buildPack', () => {
	it('produces a deterministic pack for a given seed', () => {
		const snapshots = [fakeSnapshot()];
		const a = buildPack({ args: baseArgs, snapshots, catalog: SYNTH_CATALOG });
		const b = buildPack({ args: baseArgs, snapshots, catalog: SYNTH_CATALOG });
		expect(a.items.length).toBe(b.items.length);
		for (let i = 0; i < a.items.length; i += 1) {
			expect(a.items[i]?.raw).toBe(b.items[i]?.raw);
			expect(a.items[i]?.product).toBe(b.items[i]?.product);
		}
	});

	it('respects the requested item count up to pool availability', () => {
		const snapshots = [fakeSnapshot()];
		const pack = buildPack({ args: { ...baseArgs, count: 3 }, snapshots, catalog: SYNTH_CATALOG });
		expect(pack.items.length).toBe(3);
	});

	it('returns empty when no eligible candidates', () => {
		const empty: ScenarioSnapshot = {
			slug: 'frontal-xc-march',
			metars: [],
			tafs: [],
			pireps: [],
			fbItems: null,
			airmets: [],
		};
		const pack = buildPack({ args: baseArgs, snapshots: [empty], catalog: SYNTH_CATALOG });
		expect(pack.items.length).toBe(0);
	});

	it('reports per-product family coverage in coverageReport', () => {
		const snapshots = [fakeSnapshot()];
		const pack = buildPack({
			args: { ...baseArgs, count: 10, products: ['metar', 'taf'], coverage: 'balanced' },
			snapshots,
			catalog: SYNTH_CATALOG,
		});
		// METAR has 5 families + TAF has 3 -> total 8.
		expect(pack.coverageReport.totalFamilies).toBe(8);
		// We covered at least one METAR family (the synthetic METAR has 5).
		expect(pack.coverageReport.coveredFamilies).toBeGreaterThan(0);
	});

	it('only samples products in the requested product list', () => {
		const snapshots = [fakeSnapshot()];
		const pack = buildPack({
			args: { ...baseArgs, products: ['pirep'], count: 3 },
			snapshots,
			catalog: SYNTH_CATALOG,
		});
		for (const item of pack.items) {
			expect(item.product).toBe('pirep');
		}
	});

	it("random coverage doesn't drive the candidate scoring loop", () => {
		const snapshots = [fakeSnapshot()];
		const pack = buildPack({
			args: { ...baseArgs, coverage: 'random', count: 4 },
			snapshots,
			catalog: SYNTH_CATALOG,
		});
		expect(pack.items.length).toBe(4);
	});
});
