/**
 * Unit tests for the pure projection helpers in `cards-public.ts`.
 *
 * `composePublicCardCitations` carries the public-page citation policy.
 * Stage-5 (WP `stage5-citation-deeplink`) flipped the rule: every kind of
 * citation can now carry an href on the public page (flightbag + knowledge
 * detail are public surfaces). Only the legacy `regulation_node` /
 * `ac_reference` types -- backed by `hangar.reference` rows that have no
 * canonical airboss-ref URI -- continue to render as text. `targetExternal`
 * stays true only for `external_ref` so the chip render layer keeps
 * external links opening in a new tab.
 */

import { CITATION_TARGET_TYPES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { composePublicCardCitations } from './cards-public';

describe('composePublicCardCitations', () => {
	it('passes through external_ref href and flags it as targetExternal', () => {
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
				targetExternal: true,
			},
		]);
	});

	it('passes through reference_section href as an in-app same-tab link', () => {
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_2' },
				target: {
					type: CITATION_TARGET_TYPES.REFERENCE_SECTION,
					label: '14 CFR §91.103 -- Preflight action',
					detail: 'CFR',
					href: '/cfr/14/91/103',
				},
			},
		]);

		expect(result[0]).toEqual({
			id: 'cit_2',
			label: '14 CFR §91.103 -- Preflight action',
			detail: 'CFR',
			href: '/cfr/14/91/103',
			targetExternal: false,
		});
	});

	it('passes through knowledge_node href as an in-app same-tab link', () => {
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_3' },
				target: {
					type: CITATION_TARGET_TYPES.KNOWLEDGE_NODE,
					label: 'VFR weather minimums',
					detail: 'Knowledge node',
					href: '/knowledge/vfr-weather-minimums',
				},
			},
		]);

		expect(result[0]).toEqual({
			id: 'cit_3',
			label: 'VFR weather minimums',
			detail: 'Knowledge node',
			href: '/knowledge/vfr-weather-minimums',
			targetExternal: false,
		});
	});

	it('drops href on legacy regulation_node / ac_reference targets', () => {
		// These rows back to `hangar.reference`, which has no canonical
		// airboss-ref URI to dispatch through. Migration 2 retires the types
		// entirely; until then the policy is "text only" so we don't ship
		// a broken link.
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_4' },
				target: {
					type: CITATION_TARGET_TYPES.REGULATION_NODE,
					label: '14 CFR 91.155',
					detail: 'Regulation',
					href: '/internal/should-not-leak',
				},
			},
			{
				citation: { id: 'cit_5' },
				target: {
					type: CITATION_TARGET_TYPES.AC_REFERENCE,
					label: 'AC 91-78',
					detail: 'Advisory circular',
				},
			},
		]);

		for (const row of result) {
			expect(row.href).toBeNull();
			expect(row.targetExternal).toBe(false);
		}
	});

	it('drops external_ref href when it is missing', () => {
		// Defensive: if the target builder forgets to set href on an
		// external_ref row, we render text rather than a broken link.
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_6' },
				target: {
					type: CITATION_TARGET_TYPES.EXTERNAL_REF,
					label: 'Bare title',
					detail: 'External reference',
				},
			},
		]);

		expect(result[0].href).toBeNull();
		// Even with no href, the type stays external -- the chip render
		// reads `targetExternal` to decide opening behaviour, but with a
		// null href the chip falls through to a `<span>`.
		expect(result[0].targetExternal).toBe(true);
	});

	it('coerces missing detail to null', () => {
		const result = composePublicCardCitations([
			{
				citation: { id: 'cit_7' },
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
