/**
 * Reference-tag enum tests. Pins the closed-enum values + labels so a
 * deletion or rename has to ride a code review (and a test update).
 */

import { describe, expect, it } from 'vitest';
import { AVIATION_TOPIC_LABELS, AVIATION_TOPIC_MAX, AVIATION_TOPIC_VALUES, type AviationTopic } from './reference-tags';

describe('AVIATION_TOPICS', () => {
	it('includes the 9 topic values added in the 2026-05 enum extension', () => {
		const expected: readonly AviationTopic[] = [
			'definitions',
			'airworthiness',
			'operations',
			'instrument-procedures',
			'commercial-operations',
			'rotorcraft',
			'accident-reporting',
			'security',
			'equipment',
		];
		for (const value of expected) {
			expect(AVIATION_TOPIC_VALUES).toContain(value);
		}
	});

	it('has a non-empty human label for every topic value', () => {
		for (const value of AVIATION_TOPIC_VALUES) {
			const label = AVIATION_TOPIC_LABELS[value];
			expect(typeof label).toBe('string');
			expect(label.length).toBeGreaterThan(0);
		}
	});

	it('AVIATION_TOPIC_MAX is at least 5 -- Part 91 needs five topics for full scope', () => {
		expect(AVIATION_TOPIC_MAX).toBeGreaterThanOrEqual(5);
	});
});
