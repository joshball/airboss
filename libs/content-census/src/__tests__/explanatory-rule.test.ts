/**
 * The explanatory-rule guard -- the mechanical enforcement of the
 * explanatory-surface requirement.
 *
 * For EVERY registered corpus adapter, this iterates every `CensusMetric`
 * and every `CensusGap` and FAILS the build if any of them ships an empty
 * `whatItMeasures` or `whyItMatters`. A bare number with no explanation is a
 * spec violation; this test makes it impossible to merge one.
 *
 * It also asserts the overview helpers and registry stay consistent: 14
 * corpora, ids unique, and each corpus reduces to a sane overview row.
 */

import { describe, expect, it } from 'vitest';
import { CORPUS_REGISTRY, toOverviewRow } from '../index';
import { censusAll } from '../server';

const ALL_CENSUS = censusAll();

describe('explanatory-rule guard', () => {
	it('covers all 14 corpora with unique ids', () => {
		expect(CORPUS_REGISTRY.length).toBe(14);
		expect(ALL_CENSUS.length).toBe(14);
		const ids = new Set(ALL_CENSUS.map((c) => c.id));
		expect(ids.size).toBe(14);
	});

	it('ships the full adapters -- wx-catalog, knowledge-nodes, and cards', () => {
		// wx-catalog is the Phase-1 reference drill-down; knowledge-nodes and
		// cards have gained a real Phase-3 gap view + next-list.
		const full = ALL_CENSUS.filter((c) => c.mode === 'full');
		const ids = full.map((c) => c.id).sort();
		expect(ids).toEqual(['cards', 'knowledge-nodes', 'wx-catalog']);
	});

	it('ships every still-Layer-1 corpus as a real census-mode adapter', () => {
		const censusMode = ALL_CENSUS.filter((c) => c.mode === 'census');
		const ids = censusMode.map((c) => c.id).sort();
		// knowledge-nodes and cards have graduated to `full` mode (Phase-3 gap
		// view); the remaining eleven Phase-2 corpora are still Layer-1-only.
		expect(ids).toEqual([
			'acs',
			'adrs',
			'glossary',
			'handbooks',
			'regulations',
			'sim-content',
			'sources',
			'vision',
			'work-packages',
			'wx-charts',
			'wx-scenarios',
		]);
	});

	it('gives every census-mode corpus a real inventory and a Layer-2 placeholder', () => {
		for (const census of ALL_CENSUS.filter((c) => c.mode === 'census')) {
			// A census-mode adapter has real items and metrics ...
			expect(census.items.length, `${census.id} items`).toBeGreaterThan(0);
			expect(census.metrics.length, `${census.id} metrics`).toBeGreaterThan(0);
			// ... but does NOT fabricate gaps or a next-list ...
			expect(census.gaps.length, `${census.id} gaps`).toBe(0);
			expect(census.next.length, `${census.id} next`).toBe(0);
			// ... and carries the labelled Phase-3 placeholder instead.
			expect(census.layerTwoPending, `${census.id} layerTwoPending`).toBeDefined();
			expect(census.layerTwoPending?.message.trim().length).toBeGreaterThan(0);
			expect(census.layerTwoPending?.href.trim().length).toBeGreaterThan(0);
		}
	});

	for (const census of ALL_CENSUS) {
		describe(`corpus: ${census.id}`, () => {
			it('has non-empty identity prose', () => {
				expect(census.label.trim().length).toBeGreaterThan(0);
				expect(census.whatItIs.trim().length).toBeGreaterThan(0);
				expect(census.whyItExists.trim().length).toBeGreaterThan(0);
				expect(census.location.trim().length).toBeGreaterThan(0);
				expect(census.stateRule.trim().length).toBeGreaterThan(0);
			});

			it('every metric carries a non-empty what-it-measures and why-it-matters', () => {
				for (const metric of census.metrics) {
					expect(metric.whatItMeasures.trim().length, `${census.id}/${metric.key} whatItMeasures`).toBeGreaterThan(0);
					expect(metric.whyItMatters.trim().length, `${census.id}/${metric.key} whyItMatters`).toBeGreaterThan(0);
				}
			});

			it('every gap carries a non-empty what / why / do triad', () => {
				for (const gap of census.gaps) {
					expect(gap.whatItMeasures.trim().length, `${census.id} gap "${gap.title}" whatItMeasures`).toBeGreaterThan(0);
					expect(gap.whyItMatters.trim().length, `${census.id} gap "${gap.title}" whyItMatters`).toBeGreaterThan(0);
					expect(gap.whatToDo.text.trim().length, `${census.id} gap "${gap.title}" whatToDo`).toBeGreaterThan(0);
				}
			});

			it('reduces to a coherent overview row', () => {
				const row = toOverviewRow(census);
				expect(row.id).toBe(census.id);
				expect(row.health.label.trim().length).toBeGreaterThan(0);
				expect(row.health.rule.trim().length).toBeGreaterThan(0);
				if (census.mode === 'stub') {
					// A stub corpus must NOT fabricate a count or a distribution.
					expect(row.itemCount).toBeNull();
					expect(row.stateDistribution.length).toBe(0);
					expect(row.health.level).toBe('pending');
				} else {
					expect(row.itemCount).toBe(census.items.length);
				}
			});
		});
	}
});
