/**
 * Unit tests for the pure projection helpers in `cards-public.ts`.
 *
 * `composePublicCardCitations` carries the public-page citation policy:
 * external_ref hrefs pass through, every other target type renders as text.
 * The asynchronous reads (`getPublicCard`) are covered by the public-card
 * route integration tests; this suite locks down the pure mapping so the
 * policy doesn't drift quietly.
 */

import { CITATION_TARGET_TYPES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { composePublicCardCitations } from './cards-public';

describe('composePublicCardCitations', () => {
	it('passes through external_ref href and label', () => {
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_1' },
				target: {
					type: CITATION_TARGET_TYPES.EXTERNAL_REF,
					label: 'FAA AIM 5-4-7',
					detail: 'External reference',
					href: 'https://www.faa.gov/example',
				},
			},
		]);

		expect(result).toEqual([
			{
				id: 'cit_1',
				label: 'FAA AIM 5-4-7',
				detail: 'External reference',
				href: 'https://www.faa.gov/example',
			},
		]);
	});

	it('drops href on internal target types so the public page renders text only', () => {
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_2' },
				target: {
					type: CITATION_TARGET_TYPES.REGULATION_NODE,
					label: '14 CFR 91.155',
					detail: 'Regulation',
					href: '/internal/should-not-leak',
				},
			},
			{
				citation: { id: 'cit_3' },
				target: {
					type: CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
					label: 'VFR weather minimums',
					detail: 'Knowledge node',
				},
			},
			{
				citation: { id: 'cit_4' },
				target: {
					type: CITATION_TARGET_TYPES.AC_REFERENCE,
					label: 'AC 91-78',
					detail: 'Advisory circular',
				},
			},
		]);

		expect(result).toHaveLength(3);
		for (const row of result) {
			expect(row.href).toBeNull();
		}
		expect(result[0]).toEqual({
			id: 'cit_2',
			label: '14 CFR 91.155',
			detail: 'Regulation',
			href: null,
		});
	});

	it('drops external_ref href when it is missing', () => {
		// Defensive: if the target builder forgets to set href on an
		// external_ref row, we render text rather than a broken link.
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_5' },
				target: {
					type: CITATION_TARGET_TYPES.EXTERNAL_REF,
					label: 'Bare title',
					detail: 'External reference',
				},
			},
		]);

		expect(result[0].href).toBeNull();
	});

	it('coerces missing detail to null', () => {
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_6' },
				target: {
					type: CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
					label: 'Some node',
				},
			},
		]);

		expect(result[0].detail).toBeNull();
	});

	it('returns an empty array for an empty input', () => {
		expect(composePublicCardCitations([])).toEqual([]);
	});
});
