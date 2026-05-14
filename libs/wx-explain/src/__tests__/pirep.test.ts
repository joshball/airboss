/**
 * PIREP explain tests. Every catalog PIREP example parses and produces
 * a non-empty annotation list.
 */

import { parsePirep } from '@ab/wx-charts';
import { describe, expect, it } from 'vitest';
import { explainPirep } from '../pirep';
import { pirepExamples } from './catalog-fixtures';

describe('explainPirep', () => {
	it('produces at least one annotation per catalog PIREP example', () => {
		const examples = pirepExamples();
		expect(examples.length).toBeGreaterThan(0);
		for (const ex of examples) {
			const parsed = parsePirep(ex.raw);
			const annotations = explainPirep(parsed);
			expect(annotations.length).toBeGreaterThan(0);
			for (const a of annotations) {
				expect(a.decode.length).toBeGreaterThan(0);
			}
		}
	});

	it('emits a pirep kind annotation (UA or UUA)', () => {
		const examples = pirepExamples();
		for (const ex of examples) {
			const parsed = parsePirep(ex.raw);
			const annotations = explainPirep(parsed);
			const kindAnno = annotations.find((a) => a.family.startsWith('pirep-u'));
			expect(kindAnno).toMatchObject({ family: expect.stringMatching(/^pirep-u/) });
		}
	});
});
