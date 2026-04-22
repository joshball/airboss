/**
 * `SourceMeta` schema validation.
 */

import { describe, expect, it } from 'vitest';
import { isSourceMeta, metaPathFor } from './meta';
import { SOURCES } from './registry';

describe('isSourceMeta', () => {
	const validMeta = {
		sourceId: 'cfr-14',
		version: 'revised-2026-01-01',
		url: 'https://example.com/cfr.xml',
		checksum: 'abcd1234',
		downloadedAt: '2026-04-22T12:00:00.000Z',
		format: 'xml' as const,
		sizeBytes: 12345,
	};

	it('accepts a well-formed SourceMeta', () => {
		expect(isSourceMeta(validMeta)).toBe(true);
	});

	it('rejects null', () => {
		expect(isSourceMeta(null)).toBe(false);
	});

	it('rejects a non-object', () => {
		expect(isSourceMeta('hello')).toBe(false);
	});

	it('rejects when a required field is missing', () => {
		const { sourceId: _omit, ...rest } = validMeta;
		expect(isSourceMeta(rest)).toBe(false);
	});

	it('rejects when format is not in the allowed set', () => {
		expect(isSourceMeta({ ...validMeta, format: 'docx' })).toBe(false);
	});

	it('rejects when sizeBytes is non-numeric', () => {
		expect(isSourceMeta({ ...validMeta, sizeBytes: 'big' })).toBe(false);
	});

	it('accepts every declared format value', () => {
		for (const format of ['xml', 'pdf', 'html', 'txt', 'json', 'csv'] as const) {
			expect(isSourceMeta({ ...validMeta, format })).toBe(true);
		}
	});
});

describe('metaPathFor', () => {
	it('places .meta.json next to each registered source', () => {
		const cfr = SOURCES.find((s) => s.id === 'cfr-14');
		expect(cfr).toBeTruthy();
		if (!cfr) return;
		expect(metaPathFor(cfr)).toBe(`${cfr.path}.meta.json`);
	});
});
