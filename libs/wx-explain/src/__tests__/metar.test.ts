/**
 * METAR explain tests. Every catalog METAR example parses cleanly and
 * produces a non-empty annotation list. Every annotation has a decode.
 */

import { parseMetar } from '@ab/wx-charts';
import { generateScenario } from '@ab/wx-engine/server';
import { describe, expect, it } from 'vitest';
import { explainMetar } from '../metar';
import { metarExamples } from './catalog-fixtures';

describe('explainMetar', () => {
	it('produces at least one annotation for every catalog METAR example', () => {
		const examples = metarExamples();
		expect(examples.length).toBeGreaterThan(0);
		for (const ex of examples) {
			const parsed = parseMetar(ex.raw);
			const annotations = explainMetar(parsed);
			expect(annotations.length).toBeGreaterThan(0);
			for (const a of annotations) {
				expect(a.decode.length).toBeGreaterThan(0);
				expect(a.token.length).toBeGreaterThan(0);
				expect(a.family.length).toBeGreaterThan(0);
			}
		}
	});

	it('decodes calm wind as wind-calm with 00000KT token', () => {
		const parsed = parseMetar('KSFO 121153Z 00000KT 10SM SKC 10/06 A3018');
		const annotations = explainMetar(parsed);
		const calm = annotations.find((a) => a.family === 'wind-calm');
		expect(calm).toMatchObject({ token: '00000KT' });
		expect(calm?.decode).toMatch(/calm/);
	});

	it('decodes gust group with gust factor', () => {
		const parsed = parseMetar('KMDW 121753Z 28019G31KT 7SM FEW040 06/M03 A2987');
		const annotations = explainMetar(parsed);
		const gust = annotations.find((a) => a.family === 'wind-gust');
		expect(gust?.decode).toMatch(/gust/i);
		expect(gust?.decode).toMatch(/12/); // gust factor 31 - 19 = 12 kt
	});

	it('decodes vertical visibility (VV) sky condition', () => {
		const parsed = parseMetar('KFAR 121753Z 36006KT 1/4SM FG VV002 M01/M02 A3025');
		const annotations = explainMetar(parsed);
		const vv = annotations.find((a) => a.family === 'sky-vv');
		expect(vv).toMatchObject({ token: 'VV002' });
		expect(vv?.decode).toMatch(/obscured/);
	});

	it('flags narrow temp-dew spread as saturation territory', () => {
		const parsed = parseMetar('KSMO 121553Z 24007KT 8SM OVC008 18/17 A2998');
		const annotations = explainMetar(parsed);
		const t = annotations.find((a) => a.family === 'temp-narrow-spread');
		expect(t?.decode).toMatch(/saturation/);
	});

	it('flags low altimeter as approaching low pressure', () => {
		const parsed = parseMetar('KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978');
		const annotations = explainMetar(parsed);
		const alt = annotations.find((a) => a.family === 'altimeter-low');
		expect(alt?.decode).toMatch(/low/);
	});

	it('decodes heavy thunderstorm rain (+TSRA)', () => {
		const parsed = parseMetar('KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978');
		const annotations = explainMetar(parsed);
		const tsra = annotations.find((a) => a.token === '+TSRA');
		expect(tsra?.decode).toMatch(/heavy.*thunderstorm/);
	});

	it('tags a CB cloud layer with the sky-cb family and a cumulonimbus decode', () => {
		const parsed = parseMetar('KOKC 122253Z 17012G24KT 4SM +TSRA BKN025CB OVC050 24/22 A2978');
		const annotations = explainMetar(parsed);
		const cb = annotations.find((a) => a.family === 'sky-cb');
		expect(cb).toMatchObject({ token: 'BKN025CB' });
		expect(cb?.decode).toMatch(/cumulonimbus/i);
	});

	it('attaches the convective why line to a station under a cell (engine pipeline)', () => {
		// End-to-end: a real generated scenario whose convective stations
		// emit `+TSRA BKN...CB`. The truth-aware `why` must fire for both the
		// TS weather token and the CB cloud layer.
		const bundle = generateScenario({ kind: 'summer-thunderstorms-tx' });
		const convectiveMetar = bundle.products.metars.find((m) => m.raw.includes('TS'));
		expect(convectiveMetar).toBeDefined();
		if (!convectiveMetar) throw new Error('no convective METAR in summer-thunderstorms-tx');
		const parsed = parseMetar(convectiveMetar.raw);
		const annotations = explainMetar(parsed, bundle.truth);
		const tsWhy = annotations.find((a) => a.token.includes('TS') && a.why !== undefined);
		expect(tsWhy?.why).toMatch(/convective cell/i);
		const cbWhy = annotations.find((a) => a.family === 'sky-cb' && a.why !== undefined);
		expect(cbWhy?.why).toMatch(/convective cell/i);
	});
});
