/**
 * Phase D test plan -- Socratic commentary derivation
 * (WXENG-30, WXENG-31, WXENG-32, WXENG-34).
 *
 * - generateScenario emits 8-15 callouts for the spike scenario.
 * - Every callout's knowledgeNodeIds array is non-empty.
 * - Every callout's target.chartSlug (when present) matches an entry in
 *   bundle.charts.
 * - Every knowledge-node id resolves against course/knowledge/weather/.
 * - mode:'socratic' callouts open with What/Why/How.
 * - Each callout's reason text cites a SPECIFIC named truth-model element
 *   (named pressure system id, named front id, named hazard zone id, named
 *   convective cell id). No template placeholders.
 * - A synthetic truth model with no hazards and no upper-level jet still
 *   fires the front-crossing + warm-sector + post-frontal gust subset.
 */

import { describe, expect, it } from 'vitest';
import { validateAllKnowledgeNodes } from '../commentary/knowledge-link';
import { deriveCommentary } from '../commentary/socratic';
import type { CommentaryCallout } from '../commentary/types';
import { generateScenario } from '../engine';
import type { TruthModel } from '../truth/types';

const BUNDLE = generateScenario({ kind: 'frontal-xc-march' });

const CALLOUT_COUNT_MIN = 8;
const CALLOUT_COUNT_MAX = 15;

describe('Phase D -- deriveCommentary (frontal-xc-march)', () => {
	it('emits between 8 and 15 callouts (WXENG-30)', () => {
		expect(BUNDLE.commentary.length).toBeGreaterThanOrEqual(CALLOUT_COUNT_MIN);
		expect(BUNDLE.commentary.length).toBeLessThanOrEqual(CALLOUT_COUNT_MAX);
	});

	it('every callout carries a non-empty question + observation + reason', () => {
		for (const c of BUNDLE.commentary) {
			expect(c.question.length).toBeGreaterThan(0);
			expect(c.observation.length).toBeGreaterThan(0);
			expect(c.reason.length).toBeGreaterThan(0);
		}
	});

	it('every callout carries a non-empty knowledgeNodeIds array', () => {
		for (const c of BUNDLE.commentary) {
			expect(c.knowledgeNodeIds.length).toBeGreaterThan(0);
		}
	});

	it("every callout's target.chartSlug matches an entry in bundle.charts (WXENG-31)", () => {
		const slugSet = new Set(BUNDLE.charts.map((c) => c.slug));
		for (const c of BUNDLE.commentary) {
			if (c.target.chartSlug !== undefined) {
				expect(slugSet.has(c.target.chartSlug)).toBe(true);
			}
		}
	});

	it('every knowledge-node id resolves against course/knowledge/weather/ (WXENG-32)', () => {
		const report = validateAllKnowledgeNodes(BUNDLE.commentary);
		expect(report.unresolved).toEqual([]);
		expect(report.calloutIds).toEqual([]);
	});

	it('every callout id is unique', () => {
		const ids = BUNDLE.commentary.map((c) => c.id);
		const uniq = new Set(ids);
		expect(uniq.size).toBe(ids.length);
	});

	it("mode:'socratic' questions open with What/Why/How (WXENG-34)", () => {
		const socratic = BUNDLE.commentary.filter((c) => c.mode === 'socratic');
		expect(socratic.length).toBeGreaterThanOrEqual(3);
		for (const c of socratic) {
			const opener = c.question
				.trim()
				.split(/\s+/)[0]
				?.replace(/[^A-Za-z]/g, '');
			expect(opener).toBeDefined();
			expect(['What', 'Why', 'How', 'Where']).toContain(opener);
		}
	});

	it('each reason cites a named truth-model element (WXENG-34)', () => {
		// Sample three socratic callouts and assert the reason cites at least
		// one of the named truth-model elements (named front id from the
		// scenario, named pressure system id, named hazard zone id, named
		// air-mass classification token, named convective cell id, or a
		// pressure value in millibars).
		const truth = BUNDLE.truth;
		const namedTokens: string[] = [
			...truth.synoptic.fronts.map((f) => f.id),
			...truth.synoptic.pressureSystems.map((p) => p.id),
			...truth.hazardZones.map((hz) => hz.id),
			...truth.airMasses.map((m) => m.classification),
			...truth.convection.cells.map((c) => c.id),
		];
		const mbRegex = /\d{3,4}\s*mb\b/i;
		const socratic = BUNDLE.commentary.filter((c) => c.mode === 'socratic');
		expect(socratic.length).toBeGreaterThanOrEqual(3);
		// Walk EVERY socratic callout so we don't rely on which 3 we sample.
		for (const c of socratic) {
			const hasNamedToken = namedTokens.some((t) => c.reason.includes(t));
			const hasMb = mbRegex.test(c.reason);
			expect(hasNamedToken || hasMb).toBe(true);
		}
	});

	it("no callout reason uses the unspecified template placeholder 'the air mass'", () => {
		// "the air mass" without a named classification is the canonical
		// placeholder the validator forbids; classification tokens (cP, mT, etc)
		// distinguish allowed usage from forbidden.
		for (const c of BUNDLE.commentary) {
			expect(c.reason.toLowerCase()).not.toMatch(/the air mass\b(?! mT| cP| mP| cT| cA)/);
		}
	});
});

// ----------------------------------------------------------------------
// Synthetic-truth tests: exercise the rule set against a minimal model.
// ----------------------------------------------------------------------

function buildSyntheticTruth(overrides?: Partial<TruthModel>): TruthModel {
	const base: TruthModel = {
		scenarioId: 'synthetic-test',
		validAt: '2026-04-01T18:00:00Z',
		primaryTimeZone: 'America/Chicago',
		narrative: 'Synthetic scenario for unit testing the commentary rule set.',
		stations: {
			KAAA: { icao: 'KAAA', lon: -90.5, lat: 38.0, elevationFt: 500, name: 'Warm Sector Field' },
			KBBB: { icao: 'KBBB', lon: -91.5, lat: 40.0, elevationFt: 500, name: 'Cold Sector Field' },
		},
		synoptic: {
			pressureSystems: [
				{
					id: 'L-test',
					kind: 'L',
					lon: -92,
					lat: 42,
					centralPressureMb: 1000,
					motionDegTrue: 90,
					motionKt: 20,
				},
				{
					id: 'H-test',
					kind: 'H',
					lon: -100,
					lat: 35,
					centralPressureMb: 1020,
					motionDegTrue: 90,
					motionKt: 10,
				},
			],
			fronts: [
				{
					id: 'F-test',
					kind: 'cold',
					points: [
						[-91, 36],
						[-91, 42],
					],
					pipSide: 'E',
					motionDegTrue: 90,
					motionKt: 20,
					intensity: 'moderate',
				},
			],
		},
		airMasses: [
			{
				id: 'AM-warm-test',
				classification: 'mT',
				polygon: [
					[-91, 35],
					[-85, 35],
					[-85, 43],
					[-91, 43],
					[-91, 35],
				],
				surfaceTempC: 20,
				surfaceDewpointC: 16,
				stability: 'conditionally-unstable',
				surfaceWindDirDeg: 180,
				surfaceWindKt: 12,
				meanCloudCover: 'BKN',
				meanCloudBaseFtAgl: 4000,
				meanCloudTopFtAgl: 12000,
			},
			{
				id: 'AM-cold-test',
				classification: 'cP',
				polygon: [
					[-95, 35],
					[-91, 35],
					[-91, 43],
					[-95, 43],
					[-95, 35],
				],
				surfaceTempC: 5,
				surfaceDewpointC: -3,
				stability: 'stable',
				surfaceWindDirDeg: 320,
				surfaceWindKt: 18,
				meanCloudCover: 'OVC',
				meanCloudBaseFtAgl: 2500,
				meanCloudTopFtAgl: 7000,
			},
		],
		upperLevel: {
			jetAxis: [
				[-100, 38],
				[-90, 42],
			],
			jetMaxKt: 60, // below jet-exit threshold
			windByAltitude: [{ altitudeFt: 3000, meanDirDeg: 270, meanSpeedKt: 20, meanTempC: 5 }],
		},
		convection: {
			cells: [],
			frontalBand: null,
			capeJperKgByStation: {},
		},
		diurnal: {
			solarNoonUtcHour: 18,
			mixingHeightFtMsl: 4000,
			nocturnalInversion: false,
		},
		hazardZones: [],
		terrain: { ridges: [] },
		routeStations: ['KAAA', 'KBBB'],
		fbStations: ['KAAA'],
		tafValidHours: 12,
	};
	return { ...base, ...(overrides ?? {}) };
}

describe('Phase D -- deriveCommentary (synthetic minimal scenario)', () => {
	it('fires front-crossing + warm-sector + post-frontal gust callouts on a minimal scenario', () => {
		const truth = buildSyntheticTruth();
		// Synthetic products + charts: just enough shape for the rule set to find
		// the necessary chart slugs.
		const callouts = deriveCommentary(
			truth,
			{ metars: [], tafs: [], airmets: [], fbGrid: null, pireps: [] },
			[
				{ slug: 'wx-scenario-synthetic-test-surface-analysis', spec: {}, sources: [] },
				{ slug: 'wx-scenario-synthetic-test-prog-12hr', spec: {}, sources: [] },
				{ slug: 'wx-scenario-synthetic-test-airmet-sigmet', spec: {}, sources: [] },
				{ slug: 'wx-scenario-synthetic-test-pirep-plot', spec: {}, sources: [] },
				{ slug: 'wx-scenario-synthetic-test-winds-aloft', spec: {}, sources: [] },
			],
			'synthetic-test',
		);

		// Expected to fire: front-crossing (KBBB is post-frontal),
		// pre-frontal warm-sector (KAAA southernmost warm), post-frontal gust
		// (KBBB only cold station), isobar gradient (L-test + H-test present).
		// Not firing: TAF FM (no TAFs supplied), AIRMET (no hazards),
		// convective cells (none), PIREP corroboration (no pireps),
		// jet exit (jetMaxKt < 80), diurnal (no inversion).
		const ids = new Set(callouts.map((c) => c.id));
		expect(ids.has('wxc-synthetic-test-front-crossing-KBBB')).toBe(true);
		expect(ids.has('wxc-synthetic-test-pre-frontal-warm-sector-KAAA')).toBe(true);
		expect(ids.has('wxc-synthetic-test-post-frontal-gust-KBBB')).toBe(true);
		expect(ids.has('wxc-synthetic-test-isobar-gradient')).toBe(true);
		// Total: front-crossing + warm + gust + isobar = 4 callouts.
		expect(callouts.length).toBe(4);
	});

	it('fires the jet-exit callout when jetMaxKt > 80', () => {
		const truth = buildSyntheticTruth({
			upperLevel: {
				jetAxis: [
					[-100, 38],
					[-90, 42],
				],
				jetMaxKt: 110,
				windByAltitude: [{ altitudeFt: 3000, meanDirDeg: 270, meanSpeedKt: 20, meanTempC: 5 }],
			},
		});
		const callouts = deriveCommentary(
			truth,
			{ metars: [], tafs: [], airmets: [], fbGrid: null, pireps: [] },
			[{ slug: 'wx-scenario-synthetic-test-winds-aloft', spec: {}, sources: [] }],
			'synthetic-test',
		);
		const jet = callouts.find((c) => c.id === 'wxc-synthetic-test-jet-exit');
		expect(jet).toBeDefined();
		if (jet === undefined) throw new Error('jet exit callout missing');
		expect(jet.target.chartSlug).toBe('wx-scenario-synthetic-test-winds-aloft');
		expect(jet.target.kind).toBe('fb-row');
	});

	it('fires the diurnal callout when nocturnalInversion === true', () => {
		const truth = buildSyntheticTruth({
			diurnal: {
				solarNoonUtcHour: 19,
				mixingHeightFtMsl: 200,
				nocturnalInversion: true,
			},
		});
		const callouts = deriveCommentary(
			truth,
			{ metars: [], tafs: [], airmets: [], fbGrid: null, pireps: [] },
			[{ slug: 'wx-scenario-synthetic-test-surface-analysis', spec: {}, sources: [] }],
			'synthetic-test',
		);
		const diurnal = callouts.find((c) => c.id === 'wxc-synthetic-test-diurnal-inversion');
		expect(diurnal).toBeDefined();
		if (diurnal === undefined) throw new Error('diurnal callout missing');
		expect(diurnal.target.chartSlug).toBe('wx-scenario-synthetic-test-surface-analysis');
	});

	it('every callout id is stable across runs', () => {
		const truth = buildSyntheticTruth();
		const callouts1 = deriveCommentary(
			truth,
			{ metars: [], tafs: [], airmets: [], fbGrid: null, pireps: [] },
			[
				{ slug: 'wx-scenario-synthetic-test-surface-analysis', spec: {}, sources: [] },
				{ slug: 'wx-scenario-synthetic-test-airmet-sigmet', spec: {}, sources: [] },
			],
			'synthetic-test',
		);
		const callouts2 = deriveCommentary(
			truth,
			{ metars: [], tafs: [], airmets: [], fbGrid: null, pireps: [] },
			[
				{ slug: 'wx-scenario-synthetic-test-surface-analysis', spec: {}, sources: [] },
				{ slug: 'wx-scenario-synthetic-test-airmet-sigmet', spec: {}, sources: [] },
			],
			'synthetic-test',
		);
		expect(callouts1.map((c) => c.id)).toEqual(callouts2.map((c) => c.id));
	});
});

// Type-only assertion: the public type re-exports compile.
const _typeProbe: CommentaryCallout = {
	id: 'p',
	target: { kind: 'metar', elementId: 'KAAA' },
	mode: 'socratic',
	question: 'Why?',
	observation: '.',
	reason: '.',
	knowledgeNodeIds: ['wx-airmasses-and-fronts'],
};
void _typeProbe;
