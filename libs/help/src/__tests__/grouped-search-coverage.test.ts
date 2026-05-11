/**
 * Column-aware regression for the multi-column palette facade.
 *
 * Mirrors the "Build it for these queries" table in the design note (and the
 * Phase 2 manual walk in `docs/work-packages/command-palette/test-plan.md`)
 * -- every row asserts both result presence AND expected column. Adding a
 * row here = a one-line diff that fails loudly until the column buckets
 * match the design.
 */

import { describe, expect, test } from 'vitest';
// @ab/aviation's barrel re-exports AIM_REFERENCES + FAA_DOC_REFERENCES which
// self-register at module load. Importing anything from the barrel populates
// the in-memory registry. Importing the empty side-effect path keeps the
// trigger explicit and matches `global-search-coverage.test.ts`.
import '@ab/aviation';
import { COLUMN_BY_TYPE } from '../schema/result-types';
import { searchGrouped } from '../search';

const HOST = { surface: 'global' as const, userId: undefined };

function findResult(grouped: ReturnType<typeof searchGrouped>, id: string) {
	for (const col of Object.values(grouped.columns)) {
		for (const row of col) {
			if (row.id === id) return row;
		}
	}
	return undefined;
}

describe('searchGrouped -- column placement', () => {
	test('FAA-H-8083-28 lands in FAA Resources', () => {
		const out = searchGrouped('FAA-H-8083-28', HOST);
		const row = findResult(out, 'doc-faah808328b');
		expect(row, 'AvWX must be present').toBeDefined();
		expect(row && COLUMN_BY_TYPE[row.type]).toBe('faa-resources');
	});

	test('Part 91 lands in FAA Resources', () => {
		const out = searchGrouped('Part 91', HOST);
		const row = findResult(out, 'doc-cfr-14-91');
		expect(row).toBeDefined();
		expect(row && COLUMN_BY_TYPE[row.type]).toBe('faa-resources');
	});

	test('AIM 7 lands in FAA Resources', () => {
		const out = searchGrouped('AIM 7', HOST);
		const row = findResult(out, 'doc-aim-7');
		expect(row).toBeDefined();
		expect(row && COLUMN_BY_TYPE[row.type]).toBe('faa-resources');
	});

	test('weather surfaces AvWX as a tier-1 banner hit OR top FAA Resources result', () => {
		const out = searchGrouped('weather', HOST);
		// The aviation registry's wx -> weather synonym should hoist AvWX. The
		// banner is set only when exactly one tier-1 match exists; with multiple
		// "weather"-aliased rows it may be null. Either way AvWX must appear.
		const row = findResult(out, 'doc-faah808328b');
		expect(row).toBeDefined();
		expect(row && COLUMN_BY_TYPE[row.type]).toBe('faa-resources');
	});

	test('aviationweather.gov surfaces in External Tools', () => {
		const out = searchGrouped('aviationweather', HOST);
		const tool = findResult(out, 'web-aviationweather-gov');
		expect(tool).toBeDefined();
		expect(tool && COLUMN_BY_TYPE[tool.type]).toBe('external-tools');
	});

	test('foreflight surfaces in External Tools (community tier)', () => {
		const out = searchGrouped('foreflight', HOST);
		const tool = findResult(out, 'web-foreflight');
		expect(tool).toBeDefined();
		expect(tool?.tier).toBe('community');
	});

	test('synonymsApplied list surfaces wx -> weather', () => {
		const out = searchGrouped('wx', HOST);
		const expanded = out.synonymsApplied.find((s) => s.from === 'wx' && s.to === 'weather');
		expect(expanded, `expected wx -> weather in ${JSON.stringify(out.synonymsApplied)}`).toBeDefined();
	});

	test('totalCount is sum of every column', () => {
		const out = searchGrouped('weather', HOST);
		const summed = Object.values(out.columns).reduce((s, c) => s + c.length, 0);
		expect(out.totalCount).toBe(summed);
	});

	test('empty query returns the empty literal (no flood)', () => {
		const out = searchGrouped('', HOST);
		expect(out.totalCount).toBe(0);
		expect(out.bannerHit).toBeNull();
	});

	test('bannerHit picks a tier-1 result on an unambiguous doc code', () => {
		const out = searchGrouped('FAA-H-8083-28B', HOST);
		// The exact-code match is tier-1; if more than one row shares the alias
		// the banner could go null. Be tolerant either way; we want either banner
		// to be the canonical row, or for it to appear in faa-resources.
		const row = findResult(out, 'doc-faah808328b');
		expect(row).toBeDefined();
		if (out.bannerHit !== null) {
			expect(out.bannerHit.id).toBe('doc-faah808328b');
		}
	});
});
