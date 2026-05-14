/**
 * FB explain tests. Every catalog FB example parses and produces a
 * non-empty annotation list.
 */

import { parseFbGrid } from '@ab/wx-charts';
import { describe, expect, it } from 'vitest';
import { explainFb } from '../fb';
import { fbExamples } from './catalog-fixtures';

describe('explainFb', () => {
	it('produces at least one annotation per catalog FB example', () => {
		const examples = fbExamples();
		expect(examples.length).toBeGreaterThan(0);
		for (const ex of examples) {
			const parsed = parseFbGrid(ex.raw);
			const annotations = explainFb(parsed);
			expect(annotations.length).toBeGreaterThan(0);
			for (const a of annotations) {
				expect(a.decode.length).toBeGreaterThan(0);
			}
		}
	});

	it('always emits the FB bulletin header annotation', () => {
		const examples = fbExamples();
		for (const ex of examples) {
			const parsed = parseFbGrid(ex.raw);
			const annotations = explainFb(parsed);
			expect(annotations.some((a) => a.family === 'fb-bulletin')).toBe(true);
		}
	});
});
