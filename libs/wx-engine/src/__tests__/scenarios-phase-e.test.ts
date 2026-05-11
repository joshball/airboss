/**
 * Phase E -- per-scenario integration tests (WXENG-40 / WXENG-50 series).
 *
 * For each of the five scenarios authored in Phase E (summer-thunderstorms-tx,
 * winter-icing-great-lakes, mountain-wave-rockies, marine-stratus-pacific-nw,
 * dense-fog-radiation-central-valley), assert:
 *
 *   - chart count is exactly 17 (12 single + 5 TAF timelines per route)
 *   - product counts match the per-scenario spec table in
 *     `docs/work-packages/wx-engine/spec.md`
 *   - commentary count is inside the [8, 15] band
 *   - every knowledge-node id resolves under `course/knowledge/weather/`
 *   - per-archetype invariants (specific knowledge-node citations, METAR
 *     ceiling / visibility limits, PIREP intensity floors, diurnal anchor)
 *
 * The tests run against `generateScenario({ kind: ... })` only -- no
 * filesystem reads, no chart-render side effects. The per-scenario
 * regression baselines live in `data/wx-scenarios/<slug>/products/` and are
 * exercised by the round-trip check in Phase F.
 */

import { describe, expect, it } from 'vitest';
import { validateAllKnowledgeNodes } from '../commentary/knowledge-link';
import { generateScenario, type ScenarioBundle } from '../engine';

interface ScenarioExpect {
	slug:
		| 'summer-thunderstorms-tx'
		| 'winter-icing-great-lakes'
		| 'mountain-wave-rockies'
		| 'marine-stratus-pacific-nw'
		| 'dense-fog-radiation-central-valley';
	metars: number;
	tafs: number;
	airmets: number;
	fb: 0 | 1;
	pireps: number;
}

const SCENARIO_EXPECT: ScenarioExpect[] = [
	{ slug: 'summer-thunderstorms-tx', metars: 5, tafs: 5, airmets: 4, fb: 1, pireps: 4 },
	{ slug: 'winter-icing-great-lakes', metars: 5, tafs: 5, airmets: 4, fb: 1, pireps: 3 },
	{ slug: 'mountain-wave-rockies', metars: 5, tafs: 5, airmets: 3, fb: 1, pireps: 4 },
	{ slug: 'marine-stratus-pacific-nw', metars: 5, tafs: 5, airmets: 2, fb: 1, pireps: 2 },
	{ slug: 'dense-fog-radiation-central-valley', metars: 5, tafs: 5, airmets: 2, fb: 1, pireps: 2 },
];

const EXPECTED_CHART_COUNT = 17;
const COMMENTARY_MIN = 8;
const COMMENTARY_MAX = 15;

describe.each(SCENARIO_EXPECT)('scenario integration -- $slug', (spec) => {
	const bundle: ScenarioBundle = generateScenario({ kind: spec.slug });

	it('produces 17 chart artifacts', () => {
		expect(bundle.charts.length).toBe(EXPECTED_CHART_COUNT);
	});

	it('produces the spec-table product counts', () => {
		expect(bundle.products.metars.length).toBe(spec.metars);
		expect(bundle.products.tafs.length).toBe(spec.tafs);
		expect(bundle.products.airmets.length).toBe(spec.airmets);
		expect(bundle.products.fbGrid === null ? 0 : 1).toBe(spec.fb);
		expect(bundle.products.pireps.length).toBe(spec.pireps);
	});

	it('emits commentary count inside [8, 15]', () => {
		expect(bundle.commentary.length).toBeGreaterThanOrEqual(COMMENTARY_MIN);
		expect(bundle.commentary.length).toBeLessThanOrEqual(COMMENTARY_MAX);
	});

	it('every knowledge-node id resolves to a real corpus directory', () => {
		const report = validateAllKnowledgeNodes(bundle.commentary);
		expect(report.unresolved).toEqual([]);
		expect(report.calloutIds).toEqual([]);
	});
});

describe('summer-thunderstorms-tx archetype invariants', () => {
	const bundle = generateScenario({ kind: 'summer-thunderstorms-tx' });

	it('commentary cites wx-thunderstorm-hazards at least once', () => {
		const cited = bundle.commentary.flatMap((c) => c.knowledgeNodeIds);
		expect(cited).toContain('wx-thunderstorm-hazards');
	});
});

describe('winter-icing-great-lakes archetype invariants', () => {
	const bundle = generateScenario({ kind: 'winter-icing-great-lakes' });

	it('commentary cites wx-icing-types-and-avoidance at least once', () => {
		const cited = bundle.commentary.flatMap((c) => c.knowledgeNodeIds);
		expect(cited).toContain('wx-icing-types-and-avoidance');
	});
});

describe('mountain-wave-rockies archetype invariants', () => {
	const bundle = generateScenario({ kind: 'mountain-wave-rockies' });

	it('at least one PIREP carries SEV intensity', () => {
		const intensities = bundle.products.pireps.map((p) => p.parsed.turbulence?.intensity ?? null);
		expect(intensities).toContain('SEV');
	});

	it('commentary cites wx-turbulence-types at least once', () => {
		const cited = bundle.commentary.flatMap((c) => c.knowledgeNodeIds);
		expect(cited).toContain('wx-turbulence-types');
	});
});

describe('marine-stratus-pacific-nw archetype invariants', () => {
	const bundle = generateScenario({ kind: 'marine-stratus-pacific-nw' });

	it('coastal METAR ceilings (KMRY / KSFO / KOAK) are <= 1500 ft AGL', () => {
		const coastal = ['KMRY', 'KSFO', 'KOAK'];
		for (const icao of coastal) {
			const m = bundle.products.metars.find((x) => x.parsed.station === icao);
			expect(m).toBeDefined();
			if (m === undefined) throw new Error(`missing METAR for ${icao}`);
			const lowest = lowestCeilingFt(m.parsed.clouds);
			expect(lowest).not.toBeNull();
			if (lowest === null) throw new Error('unreachable');
			expect(lowest).toBeLessThanOrEqual(1500);
		}
	});

	it('commentary cites wx-fog-and-visibility-obstructions at least once', () => {
		const cited = bundle.commentary.flatMap((c) => c.knowledgeNodeIds);
		expect(cited).toContain('wx-fog-and-visibility-obstructions');
	});
});

describe('dense-fog-radiation-central-valley archetype invariants', () => {
	const bundle = generateScenario({ kind: 'dense-fog-radiation-central-valley' });

	it('valley METAR visibilities (KFAT / KSCK / KMOD / KMER) are < 1 SM', () => {
		const valley = ['KFAT', 'KSCK', 'KMOD', 'KMER'];
		for (const icao of valley) {
			const m = bundle.products.metars.find((x) => x.parsed.station === icao);
			expect(m).toBeDefined();
			if (m === undefined) throw new Error(`missing METAR for ${icao}`);
			expect(m.parsed.visibilitySM).not.toBeNull();
			if (m.parsed.visibilitySM === null || m.parsed.visibilitySM === undefined) throw new Error('unreachable');
			expect(m.parsed.visibilitySM).toBeLessThan(1);
		}
	});

	it('commentary references the diurnal inversion mechanism in reason text', () => {
		const reasons = bundle.commentary.map((c) => c.reason.toLowerCase()).join(' \n ');
		const mentions = ['inversion', 'nocturnal', 'diurnal'];
		const found = mentions.some((m) => reasons.includes(m));
		expect(found).toBe(true);
	});
});

/**
 * Extract the lowest cloud-base in feet from a parsed METAR's cloud layers.
 * Returns `null` when no layered cover is present (SKC / CLR) or every layer
 * lacks a base altitude.
 */
function lowestCeilingFt(layers: readonly { cover: string; heightFtAgl: number | null }[] | null): number | null {
	if (layers === null || layers.length === 0) return null;
	let lowest: number | null = null;
	for (const layer of layers) {
		if (layer.heightFtAgl === null) continue;
		if (lowest === null || layer.heightFtAgl < lowest) lowest = layer.heightFtAgl;
	}
	return lowest;
}
