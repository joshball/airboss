import { describe, expect, test } from 'vitest';
import { parseQuery } from '../query-parser';
import { loadExternalTools } from './external-tools';

const HOST = { surface: 'global' as const, userId: undefined };

describe('loadExternalTools', () => {
	test('empty query returns []', () => {
		// Empty needle returns [] so filter-only queries (e.g. `mine`, which has
		// no free text but has a library:mine filter) don't flood the External
		// Tools column with the full seed list.
		const rows = loadExternalTools(parseQuery(''), HOST);
		expect(rows).toEqual([]);
	});

	test('substring match narrows by label', () => {
		const rows = loadExternalTools(parseQuery('aviationweather'), HOST);
		expect(rows.some((r) => r.id === 'web-aviationweather-gov')).toBe(true);
	});

	test('match by keyword surfaces multiple weather tools', () => {
		const rows = loadExternalTools(parseQuery('weather'), HOST);
		const ids = new Set(rows.map((r) => r.id));
		expect(ids.has('web-aviationweather-gov')).toBe(true);
		// Windy / Ventusky are community tier and also tagged weather.
		expect(ids.has('web-windy') || ids.has('web-ventusky')).toBe(true);
	});

	test('every row carries a tier label', () => {
		const rows = loadExternalTools(parseQuery('weather'), HOST);
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row.tier).toBeDefined();
			expect(row.tier === 'validated' || row.tier === 'community').toBe(true);
		}
	});

	test('rank bucket is 1 on exact label match', () => {
		const rows = loadExternalTools(parseQuery('aviationweather.gov'), HOST);
		const hit = rows.find((r) => r.id === 'web-aviationweather-gov');
		expect(hit).toBeDefined();
		expect(hit?.rankBucket).toBe(1);
	});
});
