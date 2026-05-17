/**
 * Temporal-drill generator unit tests. Use a synthetic `TemporalDrillBundle`
 * so the test stays decoupled from the wx-engine -- the pure generators are
 * the unit under test, not the truth model.
 */

import { describe, expect, it } from 'vitest';
import { buildTemporalPack, renderTemporalDrillMarkdown } from '../temporal-drill';
import type { TemporalDrillBundle } from '../temporal-types';

/**
 * A two-station, four-hour synthetic bundle. KICT sees a thunderstorm pass
 * (1500Z -> 1600Z); the front moves ESE so by 1500Z KDDC is post-frontal.
 */
function syntheticBundle(): TemporalDrillBundle {
	return {
		scenarioSlug: 'frontal-pressure-march',
		label: 'Accelerating Cold Front',
		window: { start: '2026-03-14T13:00:00Z', end: '2026-03-14T16:00:00Z', stepMinutes: 60 },
		metars: [
			// KICT: 1413->1414 steady, 1414->1415 wind shift (a distractor change),
			// 1415->1416 the storm arrives (+TSRA, ceiling drop -- the answer).
			{
				at: '2026-03-14T13:00:00Z',
				zulu: '1413Z',
				station: 'KICT',
				raw: 'KICT 141353Z 19013KT 10SM SCT050 16/12 A2966',
			},
			{
				at: '2026-03-14T14:00:00Z',
				zulu: '1414Z',
				station: 'KICT',
				raw: 'KICT 141453Z 19013KT 10SM SCT050 16/12 A2966',
			},
			{
				at: '2026-03-14T15:00:00Z',
				zulu: '1415Z',
				station: 'KICT',
				raw: 'KICT 141553Z 21015KT 10SM SCT050 16/12 A2966',
			},
			{
				at: '2026-03-14T16:00:00Z',
				zulu: '1416Z',
				station: 'KICT',
				raw: 'KICT 141653Z 21015G23KT 3SM +TSRA BKN015 OVC060 16/12 A2966',
			},
			{
				at: '2026-03-14T13:00:00Z',
				zulu: '1413Z',
				station: 'KDDC',
				raw: 'KDDC 141353Z 32020KT 6SM BKN030 05/M03 A2980',
			},
			{
				at: '2026-03-14T14:00:00Z',
				zulu: '1414Z',
				station: 'KDDC',
				raw: 'KDDC 141453Z 32020KT 6SM BKN030 05/M03 A2980',
			},
			{
				at: '2026-03-14T15:00:00Z',
				zulu: '1415Z',
				station: 'KDDC',
				raw: 'KDDC 141553Z 32025KT 6SM BKN030 05/M03 A2980',
			},
			{
				at: '2026-03-14T16:00:00Z',
				zulu: '1416Z',
				station: 'KDDC',
				raw: 'KDDC 141653Z 32025KT 6SM BKN030 05/M03 A2980',
			},
		],
		tafs: [
			{
				issuedAt: '2026-03-14T12:00:00Z',
				issuedZulu: '1412Z',
				station: 'KICT',
				raw: 'TAF KICT 141200Z 1412/1420 19013KT 6SM SCT050',
			},
		],
		snapshots: [
			{
				at: '2026-03-14T15:00:00Z',
				zulu: '1415Z',
				fronts: [
					{
						id: 'cf-1',
						kind: 'cold',
						// Front lies near lon -98: KDDC (-99.97) is west = post-frontal,
						// KICT (-97.43) is east = pre-frontal (pip side).
						points: [
							[-98.0, 39.0],
							[-98.0, 37.0],
							[-98.0, 35.0],
						],
						pipSide: 'E',
					},
				],
			},
			{
				at: '2026-03-14T16:00:00Z',
				zulu: '1416Z',
				fronts: [
					{
						id: 'cf-1',
						kind: 'cold',
						points: [
							[-97.5, 39.0],
							[-97.5, 37.0],
							[-97.5, 35.0],
						],
						pipSide: 'E',
					},
				],
			},
		],
		stations: [
			{ icao: 'KICT', lon: -97.43, lat: 37.65, name: 'Wichita' },
			{ icao: 'KDDC', lon: -99.97, lat: 37.76, name: 'Dodge City' },
			{ icao: 'KFOE', lon: -95.66, lat: 38.95, name: 'Topeka Forbes' },
		],
	};
}

describe('buildTemporalPack', () => {
	it('generates a sequence-change exercise that names the actual METAR delta', () => {
		const pack = buildTemporalPack({ bundles: [syntheticBundle()], seed: 7 });
		const seq = pack.exercises.find((e) => e.kind === 'sequence-change');
		expect(seq).toBeDefined();
		if (seq === undefined) return;
		expect(seq.products).toHaveLength(3);
		const correct = seq.options.find((o) => o.correct);
		expect(correct).toBeDefined();
		// The 1415Z -> 1416Z transition at KICT begins +TSRA and drops the ceiling.
		expect(correct?.text).toMatch(/\+TSRA began/);
		expect(correct?.text).toMatch(/ceiling/);
		// Exactly one correct option.
		expect(seq.options.filter((o) => o.correct)).toHaveLength(1);
	});

	it('generates a taf-vs-actuals exercise comparing the issue-time TAF to the last METAR', () => {
		const pack = buildTemporalPack({ bundles: [syntheticBundle()], seed: 7 });
		const taf = pack.exercises.find((e) => e.kind === 'taf-vs-actuals');
		expect(taf).toBeDefined();
		if (taf === undefined) return;
		expect(taf.products).toHaveLength(2);
		expect(taf.products[0]?.label).toMatch(/TAF/);
		expect(taf.options.filter((o) => o.correct)).toHaveLength(1);
		expect(taf.explanation).toMatch(/1412Z TAF/);
	});

	it('generates a front-position exercise that picks the post-frontal airport', () => {
		const pack = buildTemporalPack({ bundles: [syntheticBundle()], seed: 7 });
		const front = pack.exercises.find((e) => e.kind === 'front-position');
		expect(front).toBeDefined();
		if (front === undefined) return;
		const correct = front.options.find((o) => o.correct);
		// KDDC is west of the front polyline -> post-frontal -> the answer.
		expect(correct?.text).toMatch(/KDDC/);
		expect(front.options.filter((o) => o.correct)).toHaveLength(1);
	});

	it('is deterministic for a fixed (bundle, seed)', () => {
		const a = buildTemporalPack({ bundles: [syntheticBundle()], seed: 42 });
		const b = buildTemporalPack({ bundles: [syntheticBundle()], seed: 42 });
		expect(a.exercises.map((e) => `${e.kind}:${e.prompt}`)).toEqual(b.exercises.map((e) => `${e.kind}:${e.prompt}`));
		// Option ordering is also stable.
		expect(a.exercises[0]?.options.map((o) => o.text)).toEqual(b.exercises[0]?.options.map((o) => o.text));
	});

	it('round-robins kinds so a count trim keeps every kind represented', () => {
		const pack = buildTemporalPack({ bundles: [syntheticBundle()], seed: 1, count: 3 });
		expect(pack.exercises).toHaveLength(3);
		const kinds = new Set(pack.exercises.map((e) => e.kind));
		// One bundle yields one of each kind; a count of 3 keeps all three.
		expect(kinds.size).toBe(3);
	});

	it('re-indexes exercises contiguously from zero', () => {
		const pack = buildTemporalPack({ bundles: [syntheticBundle()], seed: 1 });
		expect(pack.exercises.map((e) => e.index)).toEqual(pack.exercises.map((_, i) => i));
	});
});

describe('renderTemporalDrillMarkdown', () => {
	it('renders every exercise with prompt, options, and explanation', () => {
		const pack = buildTemporalPack({ bundles: [syntheticBundle()], seed: 7 });
		const md = renderTemporalDrillMarkdown(pack);
		expect(md).toMatch(/# Temporal weather drill/);
		for (const ex of pack.exercises) {
			expect(md).toContain(ex.prompt);
			expect(md).toContain(ex.explanation);
		}
		// The correct option is marked with a checked box.
		expect(md).toMatch(/- \[x\] /);
	});
});
