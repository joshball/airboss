/**
 * Phase F test plan -- validate harness.
 *
 * Covers `libs/wx-engine/src/validate/{round-trip,consistency}.ts` against
 * the production scenarios. The harness is the load-bearing primitive the
 * CLI wraps; these specs lock the invariants so regressions in the engine,
 * the scenario literals, or the consistency rules surface here before the
 * CLI step.
 */

import { WX_SCENARIO_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { generateScenario } from '../engine';
import { runConsistency } from '../validate/consistency';
import { runRoundTrip, summarizeRoundTrip } from '../validate/round-trip';

describe('runRoundTrip', () => {
	it('reports 0 failures for every production scenario', () => {
		for (const slug of WX_SCENARIO_VALUES) {
			const bundle = generateScenario({ kind: slug });
			const report = runRoundTrip(bundle);
			expect(report.scenarioId).toBe(slug);
			expect(report.totalFailures).toBe(0);
		}
	});

	it('emits one ProductRoundTripResult per product kind even with empty arrays', () => {
		const bundle = generateScenario({ kind: 'frontal-xc-march' });
		const report = runRoundTrip(bundle);
		const kinds = report.results.map((r) => r.kind).sort();
		expect(kinds).toEqual(['airmet', 'fb', 'metar', 'pirep', 'taf']);
	});

	it('reports a non-zero count for each populated product kind', () => {
		const bundle = generateScenario({ kind: 'frontal-xc-march' });
		const report = runRoundTrip(bundle);
		const counts = Object.fromEntries(report.results.map((r) => [r.kind, r.count]));
		expect(counts.metar).toBeGreaterThan(0);
		expect(counts.taf).toBeGreaterThan(0);
		expect(counts.airmet).toBeGreaterThan(0);
		expect(counts.fb).toBe(1);
	});

	it('flags an injected parser warning with station context', () => {
		const bundle = generateScenario({ kind: 'frontal-xc-march' });
		// Mutate one METAR's raw to a known-bad value to confirm the harness
		// surfaces the failure with the correct station label. The wx-charts
		// METAR parser emits `unparseable wind token` warnings on `/////KT`
		// (sensor-out shape); injecting this canonical bad token reliably
		// fires a warning without touching the rest of the parse.
		const target = bundle.products.metars[0];
		expect(target).toBeDefined();
		if (target === undefined) return;
		const station = target.parsed.station;
		const broken = { ...target, raw: target.raw.replace(/\b\d{5}(G\d{2,3})?KT\b/, '/////KT') };
		const mutated = {
			...bundle,
			products: { ...bundle.products, metars: [broken, ...bundle.products.metars.slice(1)] },
		};
		const report = runRoundTrip(mutated);
		expect(report.totalFailures).toBeGreaterThan(0);
		const metarFailures = report.results.find((r) => r.kind === 'metar');
		expect(metarFailures).toBeDefined();
		if (metarFailures === undefined) return;
		expect(metarFailures.failures.length).toBeGreaterThan(0);
		expect(metarFailures.failures[0]?.label).toBe(station);
	});
});

describe('summarizeRoundTrip', () => {
	it('agrees with runRoundTrip on a clean bundle', () => {
		const bundle = generateScenario({ kind: 'frontal-xc-march' });
		const full = runRoundTrip(bundle);
		const summary = summarizeRoundTrip(bundle);
		expect(summary.totalFailures).toBe(full.totalFailures);
		expect(summary.scenarioId).toBe(full.scenarioId);
		const sumKinds = summary.results.map((r) => `${r.kind}:${r.count}`).sort();
		const fullKinds = full.results.map((r) => `${r.kind}:${r.count}`).sort();
		expect(sumKinds).toEqual(fullKinds);
	});
});

describe('runConsistency', () => {
	it('returns zero issues for every production scenario', () => {
		for (const slug of WX_SCENARIO_VALUES) {
			const bundle = generateScenario({ kind: slug });
			const report = runConsistency(bundle);
			expect(report.scenarioId).toBe(slug);
			expect(report.issues).toEqual([]);
		}
	});

	it('exercises every consistency rule at least once across the production set', () => {
		const seenRules = new Set<string>();
		for (const slug of WX_SCENARIO_VALUES) {
			const bundle = generateScenario({ kind: slug });
			const report = runConsistency(bundle);
			if (report.counts.windsVsIsobars.checked > 0) seenRules.add('winds-vs-isobars');
			if (report.counts.tafFmVsFront.checked > 0) seenRules.add('taf-fm-vs-front');
			if (report.counts.airmetRingVsHazard.checked > 0) seenRules.add('airmet-ring-vs-hazard');
			if (report.counts.airmetRingClosure.checked > 0) seenRules.add('airmet-ring-closure');
			if (report.counts.pirepVsHazard.checked > 0) seenRules.add('pirep-vs-hazard');
		}
		// Not every rule fires on every scenario (some have no TAF FMs, some
		// have no fronts), but across all six the union covers every rule.
		expect([...seenRules].sort()).toEqual([
			'airmet-ring-closure',
			'airmet-ring-vs-hazard',
			'pirep-vs-hazard',
			'taf-fm-vs-front',
			'winds-vs-isobars',
		]);
	});

	it('flags an AIRMET orphan (advisory without matching hazard zone)', () => {
		const bundle = generateScenario({ kind: 'frontal-xc-march' });
		const first = bundle.products.airmets[0];
		expect(first).toBeDefined();
		if (first === undefined) return;
		const orphan = { ...first, id: 'ORPHAN', fromHazardZoneId: 'HZ-NON-EXISTENT' };
		const mutated = {
			...bundle,
			products: { ...bundle.products, airmets: [...bundle.products.airmets, orphan] },
		};
		const report = runConsistency(mutated);
		const orphans = report.issues.filter(
			(i) => i.rule === 'airmet-ring-vs-hazard' && i.hazardZoneId === 'HZ-NON-EXISTENT',
		);
		expect(orphans.length).toBeGreaterThan(0);
	});

	it('flags an unclosed AIRMET ring', () => {
		const bundle = generateScenario({ kind: 'frontal-xc-march' });
		const first = bundle.products.airmets[0];
		expect(first).toBeDefined();
		if (first === undefined) return;
		const ring = first.rings[0];
		expect(ring).toBeDefined();
		if (ring === undefined) return;
		const broken = { ...first, rings: [ring.slice(0, -1)] };
		const mutated = {
			...bundle,
			products: { ...bundle.products, airmets: [broken, ...bundle.products.airmets.slice(1)] },
		};
		const report = runConsistency(mutated);
		const closure = report.issues.filter((i) => i.rule === 'airmet-ring-closure');
		expect(closure.length).toBeGreaterThan(0);
	});
});
