/**
 * TAF explain tests. Every catalog TAF example parses and produces a
 * non-empty annotation list.
 */

import { parseTaf } from '@ab/wx-charts';
import { describe, expect, it } from 'vitest';
import { explainTaf } from '../taf';
import { tafExamples } from './catalog-fixtures';

describe('explainTaf', () => {
	it('produces at least one annotation per catalog TAF example', () => {
		const examples = tafExamples();
		expect(examples.length).toBeGreaterThan(0);
		for (const ex of examples) {
			const parsed = parseTaf(ex.raw);
			const annotations = explainTaf(parsed);
			expect(annotations.length).toBeGreaterThan(0);
			for (const a of annotations) {
				expect(a.decode.length).toBeGreaterThan(0);
			}
		}
	});

	it('always emits a station + validity annotation', () => {
		const examples = tafExamples();
		for (const ex of examples) {
			const parsed = parseTaf(ex.raw);
			const annotations = explainTaf(parsed);
			expect(annotations.some((a) => a.family === 'station')).toBe(true);
			expect(annotations.some((a) => a.family === 'taf-validity')).toBe(true);
		}
	});
});
