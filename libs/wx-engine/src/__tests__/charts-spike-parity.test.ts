/**
 * Phase C integration test (WXENG-20 + WXENG-21).
 *
 * Walks `generateScenario({ kind: 'frontal-xc-march' })`, asserts:
 *
 *   - The bundle emits exactly 17 chart artifacts in the deterministic
 *     ordering documented in design.md.
 *   - Each emitted spec validates against the wx-charts library's
 *     per-chart Zod schema (`CHART_RENDERERS[spec.type].schema`).
 *   - Slugs are unique and follow `wx-scenarios/<scenario-id>/<chart-kind>[-<station>]`
 *     per ADR 027 PR 3.
 *   - Every chart artifact has at least one source with a cache-relative
 *     path, and every `cache://...` URI in the spec is backed by an
 *     artifact source path so the bundle writer's cache mirror keeps the
 *     chart-build CLI consistent.
 */

import { CHART_RENDERERS } from '@ab/wx-charts/server';
import { type ChartArtifact, generateScenario } from '@ab/wx-engine/server';
import { describe, expect, it } from 'vitest';

const EXPECTED_ORDER = [
	'wx-scenarios/frontal-xc-march/surface-analysis',
	'wx-scenarios/frontal-xc-march/prog-12hr',
	'wx-scenarios/frontal-xc-march/airmet-sigmet',
	'wx-scenarios/frontal-xc-march/metar-plot',
	'wx-scenarios/frontal-xc-march/pirep-plot',
	'wx-scenarios/frontal-xc-march/winds-aloft',
	'wx-scenarios/frontal-xc-march/taf-kstl',
	'wx-scenarios/frontal-xc-march/taf-kcps',
	'wx-scenarios/frontal-xc-march/taf-kspi',
	'wx-scenarios/frontal-xc-march/taf-kmli',
	'wx-scenarios/frontal-xc-march/taf-kord',
	'wx-scenarios/frontal-xc-march/gfa',
	'wx-scenarios/frontal-xc-march/convective-outlook',
	'wx-scenarios/frontal-xc-march/cva',
	'wx-scenarios/frontal-xc-march/freezing-level',
	'wx-scenarios/frontal-xc-march/g-airmet-icing',
	'wx-scenarios/frontal-xc-march/g-airmet-turbulence',
] as const;

interface MinSpec {
	type: string;
}

function specType(chart: ChartArtifact): string {
	const spec = chart.spec as MinSpec;
	return spec.type;
}

describe('Phase C -- charts-spike-parity', () => {
	const bundle = generateScenario({ kind: 'frontal-xc-march' });
	const charts = bundle.charts;

	it('emits exactly 17 chart artifacts (WXENG-21)', () => {
		expect(charts.length).toBe(17);
	});

	it('emits the canonical chart ordering (WXENG-21)', () => {
		const slugs = charts.map((c) => c.slug);
		expect(slugs).toEqual([...EXPECTED_ORDER]);
	});

	it('emits no duplicate slugs', () => {
		const slugs = charts.map((c) => c.slug);
		const unique = new Set(slugs);
		expect(unique.size).toBe(slugs.length);
	});

	it.each(
		EXPECTED_ORDER.map((slug, i) => [slug, i] as const),
	)('spec for %s passes the wx-charts schema (WXENG-20)', (slug, idx) => {
		const chart = charts[idx];
		expect(chart).toBeDefined();
		if (chart === undefined) throw new Error(`missing chart at index ${idx}`);
		expect(chart.slug).toBe(slug);
		const renderer = CHART_RENDERERS[specType(chart) as keyof typeof CHART_RENDERERS];
		expect(renderer).toBeDefined();
		expect(() => renderer.schema.parse(chart.spec)).not.toThrow();
	});

	it('every chart carries at least one source with a cache-relative path', () => {
		for (const chart of charts) {
			expect(chart.sources.length).toBeGreaterThan(0);
			for (const src of chart.sources) {
				expect(src.path.startsWith('scenarios/frontal-xc-march/')).toBe(true);
				expect(src.bytes.length).toBeGreaterThan(0);
			}
		}
	});

	it('every cache:// URI in spec.sources matches the artifact source path', () => {
		for (const chart of charts) {
			const sourcePaths = new Set(chart.sources.map((s) => `cache://${s.path}`));
			const sourcesField = (chart.spec as { sources: Record<string, string> }).sources;
			for (const uri of Object.values(sourcesField)) {
				expect(sourcePaths.has(uri)).toBe(true);
			}
		}
	});
});
