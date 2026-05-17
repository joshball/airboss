/**
 * Phase-2 census adapters -- the seven registry / JSON / code-based corpora.
 *
 * Verifies each adapter returns a schema-valid `CorpusCensus` and that its
 * derived counts equal the known on-disk repo data. The fixture numbers were
 * derived from the actual files on 2026-05-17; if a corpus is re-authored,
 * these update.
 *
 * Each adapter is also covered transitively by the explanatory-rule guard
 * (`explanatory-rule.test.ts`), which iterates every registered adapter and
 * fails the build on an empty metric / gap explanation.
 */

import { describe, expect, it } from 'vitest';
import {
	acsCensus,
	glossaryCensus,
	handbooksCensus,
	simContentCensus,
	sourcesCensus,
	wxChartsCensus,
	wxScenariosCensus,
} from '../server';
import type { CorpusCensus } from '../types';

/** Assert the shared `CorpusCensus` invariants every Phase-2 adapter must hold. */
function expectValidCensusMode(census: CorpusCensus, id: string): void {
	expect(census.id).toBe(id);
	// A Phase-2 adapter is a real Layer-1 census: `census` mode, not `full`.
	expect(census.mode).toBe('census');
	expect(census.pending).toBeUndefined();
	expect(census.label.length).toBeGreaterThan(0);
	expect(census.whatItIs.length).toBeGreaterThan(0);
	expect(census.whyItExists.length).toBeGreaterThan(0);
	expect(census.location.length).toBeGreaterThan(0);
	expect(census.stateRule.length).toBeGreaterThan(0);
	expect(census.docs.length).toBeGreaterThanOrEqual(2);
	for (const doc of census.docs) {
		expect(doc.label.length).toBeGreaterThan(0);
		expect(doc.href.length).toBeGreaterThan(0);
		expect(doc.role.length).toBeGreaterThan(0);
	}
	expect(census.metrics.length).toBeGreaterThan(0);
	for (const metric of census.metrics) {
		expect(metric.whatItMeasures.trim().length).toBeGreaterThan(0);
		expect(metric.whyItMatters.trim().length).toBeGreaterThan(0);
		expect(metric.whatToDo?.text.trim().length).toBeGreaterThan(0);
	}
	// A census-mode adapter fabricates no gaps and no next-list ...
	expect(census.gaps.length).toBe(0);
	expect(census.next.length).toBe(0);
	// ... and carries the honest, labelled Phase-3 Layer-2 placeholder instead.
	expect(census.layerTwoPending).toBeDefined();
	expect(census.layerTwoPending?.message.trim().length).toBeGreaterThan(0);
	expect(census.layerTwoPending?.href.trim().length).toBeGreaterThan(0);
}

describe('wxScenariosCensus', () => {
	const census = wxScenariosCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'wx-scenarios');
	});

	it('inventories all 7 authored wx-engine scenarios', () => {
		expect(census.items.length).toBe(7);
		for (const item of census.items) {
			expect(['contributing', 'dormant']).toContain(item.derivedState);
		}
	});

	it('derives 6 contributing scenarios (frontal-pressure-march is dormant)', () => {
		const contributing = census.items.filter((i) => i.derivedState === 'contributing');
		const dormant = census.items.filter((i) => i.derivedState === 'dormant');
		expect(contributing.length).toBe(6);
		expect(dormant.length).toBe(1);
		expect(dormant[0].id).toBe('frontal-pressure-march');
	});

	it('reports contributing scenarios as 6 / 7', () => {
		const metric = census.metrics.find((m) => m.key === 'contributing-scenarios');
		expect(metric?.value).toBe('6 / 7');
	});
});

describe('handbooksCensus', () => {
	const census = handbooksCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'handbooks');
	});

	it('inventories all 8 ingested handbooks', () => {
		expect(census.items.length).toBe(8);
		for (const item of census.items) {
			expect(['ingested', 'partial']).toContain(item.derivedState);
		}
	});

	it('derives 4 fully-ingested and 4 partial handbooks', () => {
		const ingested = census.items.filter((i) => i.derivedState === 'ingested');
		const partial = census.items.filter((i) => i.derivedState === 'partial');
		expect(ingested.length).toBe(4);
		expect(partial.length).toBe(4);
	});

	it('reports a positive extracted-section total', () => {
		const metric = census.metrics.find((m) => m.key === 'sections');
		expect(typeof metric?.value).toBe('number');
		expect(metric?.value as number).toBeGreaterThan(3000);
	});
});

describe('acsCensus', () => {
	const census = acsCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'acs');
	});

	it('inventories all 5 ACS documents', () => {
		expect(census.items.length).toBe(5);
		for (const item of census.items) {
			expect(['current', 'stale']).toContain(item.derivedState);
		}
	});

	it('derives every ingested ACS as current against the known-latest editions', () => {
		const current = census.items.filter((i) => i.derivedState === 'current');
		expect(current.length).toBe(5);
	});

	it('reports a positive areas-of-operation total', () => {
		const metric = census.metrics.find((m) => m.key === 'areas');
		expect(typeof metric?.value).toBe('number');
		expect(metric?.value as number).toBeGreaterThan(0);
	});
});

describe('sourcesCensus', () => {
	const census = sourcesCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'sources');
	});

	it('inventories all 19 AC / InFO / SAFO source documents', () => {
		expect(census.items.length).toBe(19);
		for (const item of census.items) {
			expect(['linked', 'orphan']).toContain(item.derivedState);
		}
	});

	it('reports the registry breakdown as 9 AC / 4 InFO / 6 SAFO', () => {
		const metric = census.metrics.find((m) => m.key === 'registry-breakdown');
		expect(metric?.value).toBe('9 AC / 4 InFO / 6 SAFO');
	});
});

describe('glossaryCensus', () => {
	const census = glossaryCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'glossary');
	});

	it('inventories the 4 aviation-term glossary entries', () => {
		expect(census.items.length).toBe(4);
		for (const item of census.items) {
			expect(['defined', 'skeleton']).toContain(item.derivedState);
		}
	});

	it('derives 3 skeleton terms and 1 defined term', () => {
		const defined = census.items.filter((i) => i.derivedState === 'defined');
		const skeleton = census.items.filter((i) => i.derivedState === 'skeleton');
		expect(defined.length).toBe(1);
		expect(skeleton.length).toBe(3);
	});

	it('reports a positive page-help glossary term count', () => {
		const metric = census.metrics.find((m) => m.key === 'ui-glossary-terms');
		expect(typeof metric?.value).toBe('number');
		expect(metric?.value as number).toBeGreaterThan(0);
	});
});

describe('wxChartsCensus', () => {
	const census = wxChartsCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'wx-charts');
	});

	it('inventories all 20 chart types', () => {
		expect(census.items.length).toBe(20);
		for (const item of census.items) {
			expect(['rendered', 'rendered-shared-test', 'unrendered']).toContain(item.derivedState);
		}
	});

	it('finds a renderer module for every enumerated chart type', () => {
		const unrendered = census.items.filter((i) => i.derivedState === 'unrendered');
		expect(unrendered.length).toBe(0);
		const metric = census.metrics.find((m) => m.key === 'rendered-chart-types');
		expect(metric?.value).toBe('20 / 20');
	});

	it('classifies the GOES satellite trio as shared-test (they share satellite.test.ts)', () => {
		const sharedTest = census.items.filter((i) => i.derivedState === 'rendered-shared-test');
		const sharedTestIds = new Set(sharedTest.map((i) => i.id));
		expect(sharedTestIds.has('satellite-ir')).toBe(true);
		expect(sharedTestIds.has('satellite-visible')).toBe(true);
		expect(sharedTestIds.has('satellite-water-vapor')).toBe(true);
		// advisory-overlay's renderer module is airmet-sigmet, and
		// airmet-sigmet.test.ts is a dedicated test for it -> `rendered`.
		const advisory = census.items.find((i) => i.id === 'advisory-overlay');
		expect(advisory?.derivedState).toBe('rendered');
	});
});

describe('simContentCensus', () => {
	const census = simContentCensus();

	it('returns a valid census-mode census', () => {
		expectValidCensusMode(census, 'sim-content');
	});

	it('inventories all 19 sim scenarios', () => {
		expect(census.items.length).toBe(19);
		for (const item of census.items) {
			expect(['graded', 'playground']).toContain(item.derivedState);
		}
	});

	it('derives 17 graded scenarios and 2 free-flight playgrounds', () => {
		const graded = census.items.filter((i) => i.derivedState === 'graded');
		const playground = census.items.filter((i) => i.derivedState === 'playground');
		expect(graded.length).toBe(17);
		expect(playground.length).toBe(2);
	});

	it('reports 2 FDM aircraft models', () => {
		const metric = census.metrics.find((m) => m.key === 'aircraft-models');
		expect(metric?.value).toBe(2);
	});
});
