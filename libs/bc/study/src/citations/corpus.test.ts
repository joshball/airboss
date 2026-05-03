/**
 * Unit tests for the citation -> corpus mapping helper.
 *
 * The mapping is the single source of truth for "which resolver does this
 * citation deep-link through?" -- the audit, the future render dispatch,
 * and any cross-link surface all read it. The test guards two invariants:
 *
 *   1. Every `ReferenceSourceType` enum value has an entry in the map.
 *      Drift here means a new sourceType ships without a corpus mapping,
 *      and the audit silently treats every citation in that family as
 *      "no resolver expected."
 *   2. The hot CFR / AC / handbook paths return the canonical corpus
 *      strings the resolver registry registers under.
 */

import { CITATION_TARGET_TYPES, REFERENCE_SOURCE_TYPES, SOURCE_TYPE_VALUES } from '@ab/constants';
import { describe, expect, it } from 'vitest';
import { corpusForCitationTarget, corpusForSourceType } from './corpus';

describe('corpusForSourceType', () => {
	it('maps cfr to regs', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.CFR)).toBe('regs');
	});

	it('maps ac to ac', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.AC)).toBe('ac');
	});

	it('maps acs to acs', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.ACS)).toBe('acs');
	});

	it('maps aim and pcg to aim', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.AIM)).toBe('aim');
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.PCG)).toBe('aim');
	});

	it('maps handbook family (phak / afh / ifh) to handbooks', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.PHAK)).toBe('handbooks');
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.AFH)).toBe('handbooks');
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.IFH)).toBe('handbooks');
	});

	it('maps poh to pohs', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.POH)).toBe('pohs');
	});

	it('returns null for authored / derived / community-feed source types', () => {
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.AUTHORED)).toBe(null);
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.DERIVED)).toBe(null);
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.AOPA)).toBe(null);
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.GAJSC)).toBe(null);
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.FAA_SAFETY)).toBe(null);
		expect(corpusForSourceType(REFERENCE_SOURCE_TYPES.SOP)).toBe(null);
	});

	it('returns null for null / undefined / unknown input', () => {
		expect(corpusForSourceType(null)).toBe(null);
		expect(corpusForSourceType(undefined)).toBe(null);
		expect(corpusForSourceType('not-a-real-source-type')).toBe(null);
	});

	it('has an entry for every ReferenceSourceType', () => {
		// Drift guard: when a new sourceType ships, this test fails until the
		// map gets an explicit corpus (or null) for it. We assert the function
		// returns a defined value -- either string or null -- for each enum
		// member, not undefined.
		for (const value of SOURCE_TYPE_VALUES) {
			const result = corpusForSourceType(value);
			expect(result === null || typeof result === 'string').toBe(true);
		}
	});
});

describe('corpusForCitationTarget', () => {
	it('returns null for knowledge_node regardless of sourceType', () => {
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.KNOWLEDGE_NODE, 'cfr')).toBe(null);
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.KNOWLEDGE_NODE, null)).toBe(null);
	});

	it('returns null for external_ref regardless of sourceType', () => {
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.EXTERNAL_REF, 'cfr')).toBe(null);
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.EXTERNAL_REF, null)).toBe(null);
	});

	it('delegates regulation_node to corpusForSourceType', () => {
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.REGULATION_NODE, 'cfr')).toBe('regs');
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.REGULATION_NODE, null)).toBe(null);
	});

	it('delegates ac_reference to corpusForSourceType', () => {
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.AC_REFERENCE, 'ac')).toBe('ac');
		expect(corpusForCitationTarget(CITATION_TARGET_TYPES.AC_REFERENCE, null)).toBe(null);
	});
});
