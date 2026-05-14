/**
 * METAR explain tests. Every catalog METAR example parses cleanly and
 * produces a non-empty annotation list. Every annotation has a decode.
 */

import { parseMetar } from '@ab/wx-charts';
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
});
