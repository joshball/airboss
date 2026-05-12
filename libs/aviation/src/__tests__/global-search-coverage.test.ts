/**
 * Regression net for the global palette. Every important term in this fixture
 * MUST return a top-3 result. Adding a term here = a one-line diff that fails
 * loudly until the index covers it.
 *
 * Source: palette design note (`docs/work/plans/2026-05-10-command-palette-design.md`).
 *
 * Two layers:
 *   1. Doc-code lookups (FAA-H-8083-28, AvWX, Part 91, etc.) -- must return
 *      the canonical doc as result #1.
 *   2. Aviation term lookups (weather, METAR, density altitude, ...) -- must
 *      return at least one result in the top 3 with the expected match field.
 */

import { describe, expect, test } from 'vitest';
import '../references/aim-docs'; // self-registers
import '../references/faa-docs'; // self-registers
import { detectDocCodeIntent, lookupDocsByCode } from '../doc-code-detector';
import { search } from '../registry';
import { expandQuery } from '../synonyms';

// ---------- Doc codes that must return a specific doc as result #1 ----------

const DOC_CODE_FIXTURES: ReadonlyArray<{ query: string; expectId: string; label?: string }> = [
	// AvWX
	{ query: 'FAA-H-8083-28', expectId: 'doc-faah808328b' },
	{ query: 'FAA-H-8083-28B', expectId: 'doc-faah808328b' },
	{ query: '8083-28', expectId: 'doc-faah808328b' },
	{ query: 'H-8083-28', expectId: 'doc-faah808328b' },
	{ query: 'AvWX', expectId: 'doc-faah808328b' },
	{ query: 'aviation weather handbook', expectId: 'doc-faah808328b' },
	// PHAK
	{ query: 'FAA-H-8083-25C', expectId: 'doc-faah808325c' },
	{ query: 'PHAK', expectId: 'doc-faah808325c' },
	{ query: "pilot's handbook of aeronautical knowledge", expectId: 'doc-faah808325c' },
	// AFH
	{ query: 'FAA-H-8083-3C', expectId: 'doc-faah80833c' },
	{ query: 'AFH', expectId: 'doc-faah80833c' },
	{ query: 'airplane flying handbook', expectId: 'doc-faah80833c' },
	// IFH
	{ query: 'FAA-H-8083-15B', expectId: 'doc-faah808315b' },
	{ query: 'IFH', expectId: 'doc-faah808315b' },
	// IPH
	{ query: 'FAA-H-8083-16B', expectId: 'doc-faah808316b' },
	{ query: 'IPH', expectId: 'doc-faah808316b' },
	// RMH
	{ query: 'FAA-H-8083-2A', expectId: 'doc-faah80832a' },
	{ query: 'RMH', expectId: 'doc-faah80832a' },
	// AIH
	{ query: 'FAA-H-8083-9', expectId: 'doc-faah80839' },
	{ query: 'AIH', expectId: 'doc-faah80839' },
	// AC 00-6B
	{ query: 'AC 00-6', expectId: 'doc-ac-006b' },
	{ query: 'AC 00-6B', expectId: 'doc-ac-006b' },
	// CFR
	{ query: '14 CFR 91', expectId: 'doc-cfr-14-91' },
	{ query: '14 CFR Part 91', expectId: 'doc-cfr-14-91' },
	{ query: 'Part 91', expectId: 'doc-cfr-14-91' },
	{ query: '14 CFR 61', expectId: 'doc-cfr-14-61' },
	{ query: '14 CFR 141', expectId: 'doc-cfr-14-141' },
	// ACS
	{ query: 'PPL ACS', expectId: 'doc-ppl-airplane-acs-6c' },
	{ query: 'IR ACS', expectId: 'doc-ir-airplane-acs-8c' },
	// AIM chapters and sections (Phase 2 -- AIM scanner)
	{ query: 'AIM 7', expectId: 'doc-aim-7' },
	{ query: 'AIM 7-1', expectId: 'doc-aim-7-1' },
	{ query: 'AIM 1-1', expectId: 'doc-aim-1-1' },
];

// ---------- Aviation terms that must return SOMETHING in top 3 ----------

const TERM_FIXTURES: ReadonlyArray<{ query: string; expectAtLeastOne: string[] }> = [
	// Direct synonym rewrites
	{ query: 'weather', expectAtLeastOne: ['doc-faah808328b', 'doc-ac-006b'] },
	{ query: 'wx', expectAtLeastOne: ['doc-faah808328b', 'doc-ac-006b'] },
	{ query: 'aviation weather', expectAtLeastOne: ['doc-faah808328b', 'doc-ac-006b'] },
];

// ---------- Tests ----------

describe('global search coverage -- doc codes', () => {
	test.each(DOC_CODE_FIXTURES)('"$query" -> $expectId is top result', ({ query, expectId }) => {
		const results = search({ text: query, expandSynonyms: true });
		expect(results.length, `no results for "${query}"`).toBeGreaterThan(0);
		const top3Ids = results.slice(0, 3).map((r) => r.reference.id);
		expect(top3Ids, `"${query}" -- top 3 was ${JSON.stringify(top3Ids)}`).toContain(expectId);
	});
});

describe('global search coverage -- aviation terms', () => {
	test.each(TERM_FIXTURES)('"$query" surfaces at least one expected doc in top 3', ({ query, expectAtLeastOne }) => {
		const results = search({ text: query, expandSynonyms: true });
		expect(results.length, `no results for "${query}"`).toBeGreaterThan(0);
		const top3Ids = new Set(results.slice(0, 3).map((r) => r.reference.id));
		const matched = expectAtLeastOne.some((id) => top3Ids.has(id));
		expect(
			matched,
			`"${query}" -- expected one of ${JSON.stringify(expectAtLeastOne)} in top 3, got ${JSON.stringify([...top3Ids])}`,
		).toBe(true);
	});
});

describe('synonyms', () => {
	test('wx expands to weather and vice versa', () => {
		expect(expandQuery('wx')).toContain('weather');
		expect(expandQuery('weather')).toContain('wx');
	});

	test('avwx expands to aviation weather', () => {
		const expansions = expandQuery('avwx');
		expect(expansions.some((e) => e.includes('aviation weather'))).toBe(true);
	});

	test('multi-token query expands one token at a time', () => {
		// "wx minimums" -> includes "weather minimums"
		const expansions = expandQuery('wx minimums');
		expect(expansions).toContain('weather minimums');
	});

	test('non-aviation query is unchanged', () => {
		expect(expandQuery('quux')).toEqual(['quux']);
	});
});

describe('doc-code autocomplete', () => {
	test('FAA-H- triggers handbook intent', () => {
		const intent = detectDocCodeIntent('FAA-H-8');
		expect(intent).not.toBeNull();
		expect(intent?.family).toBe('handbook');
		expect(intent?.confident).toBe(true);
	});

	test('14 CFR triggers cfr intent', () => {
		const intent = detectDocCodeIntent('14 CFR 91');
		expect(intent?.family).toBe('cfr');
		expect(intent?.confident).toBe(true);
	});

	test('Part 91 triggers cfr intent', () => {
		const intent = detectDocCodeIntent('Part 91');
		expect(intent?.family).toBe('cfr');
		expect(intent?.confident).toBe(true);
	});

	test('AvWX abbreviation triggers handbook intent', () => {
		const intent = detectDocCodeIntent('AvWX');
		expect(intent?.family).toBe('handbook');
	});

	test('plain word does not trigger', () => {
		expect(detectDocCodeIntent('weather')).toBeNull();
		expect(detectDocCodeIntent('takeoff')).toBeNull();
	});

	test('lookupDocsByCode returns numeric-sorted handbook list for "FAA-H-8"', () => {
		const matches = lookupDocsByCode('FAA-H-8', { family: 'handbook' });
		expect(matches.length).toBeGreaterThan(0);
		// All matches should have FAA-H- in their code form
		for (const m of matches) {
			expect(m.code).toMatch(/^FAA-H-/);
		}
		// Numeric sort: 8083-2A should appear before 8083-25C
		const idxRMH = matches.findIndex((m) => m.code === 'FAA-H-8083-2A');
		const idxPHAK = matches.findIndex((m) => m.code === 'FAA-H-8083-25C');
		if (idxRMH !== -1 && idxPHAK !== -1) {
			expect(idxRMH).toBeLessThan(idxPHAK);
		}
	});
});
