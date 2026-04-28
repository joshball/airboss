/**
 * Pure-function tests for the source form pipeline.
 */

import { describe, expect, it } from 'vitest';
import { validateSourceForm } from './source-form';

function buildForm(overrides: Partial<Record<string, string>> = {}): FormData {
	const form = new FormData();
	form.set('id', 'test-src');
	form.set('type', 'cfr');
	form.set('title', 'Test Source');
	form.set('version', 'v1');
	form.set('url', 'https://example.test/source');
	form.set('path', 'data/sources/test.xml');
	form.set('format', 'xml');
	form.set('checksum', 'pending-download');
	form.set('downloadedAt', 'pending-download');
	form.set('sizeBytes', '');
	form.set('locatorShape', '{}');
	for (const [k, v] of Object.entries(overrides)) {
		if (v === undefined) continue;
		form.set(k, v);
	}
	return form;
}

describe('validateSourceForm', () => {
	it('accepts the happy path', () => {
		const result = validateSourceForm(buildForm());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.id).toBe('test-src');
			expect(result.input.format).toBe('xml');
			expect(result.locatorShape).toBeNull();
		}
	});

	it('parses a non-empty locator shape', () => {
		const form = buildForm({ locatorShape: '{"part": "number"}' });
		const result = validateSourceForm(form);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.locatorShape).toEqual({ part: 'number' });
		}
	});

	it('rejects a non-http URL', () => {
		const result = validateSourceForm(buildForm({ url: 'ftp://example.test' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.fieldErrors.url).toBeDefined();
	});

	it('rejects negative sizeBytes', () => {
		const result = validateSourceForm(buildForm({ sizeBytes: '-5' }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.errors.fieldErrors.sizeBytes).toBeDefined();
	});

	it('accepts integer sizeBytes', () => {
		const result = validateSourceForm(buildForm({ sizeBytes: '1024' }));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.input.sizeBytes).toBe(1024);
	});

	it('flags missing required fields with per-field errors', () => {
		const form = buildForm({ title: '', id: '', url: '' });
		const result = validateSourceForm(form);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors).toHaveProperty('title');
			expect(result.errors.fieldErrors).toHaveProperty('id');
			expect(result.errors.fieldErrors).toHaveProperty('url');
		}
	});

	// -------- wp-hangar-non-textual: binary-visual branch --------

	function buildBinaryVisualForm(overrides: Partial<Record<string, string>> = {}): FormData {
		return buildForm({
			id: 'sectional-denver',
			type: 'sectional',
			title: 'Denver VFR Sectional Chart',
			version: 'pending-download',
			url: 'https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip',
			path: 'data/sources/sectional/sectional-denver',
			format: 'geotiff-zip',
			bv_region: 'Denver',
			bv_index_url: 'https://aeronav.faa.gov/visual/',
			bv_cadence_days: '56',
			...overrides,
		});
	}

	it('accepts a binary-visual (sectional) source with structured locator fields', () => {
		const result = validateSourceForm(buildBinaryVisualForm());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.format).toBe('geotiff-zip');
			expect(result.locatorShape).toEqual({
				kind: 'binary-visual',
				region: 'Denver',
				index_url: 'https://aeronav.faa.gov/visual/',
				cadence_days: 56,
			});
		}
	});

	it('rejects binary-visual source when region is missing', () => {
		const result = validateSourceForm(buildBinaryVisualForm({ bv_region: '' }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors).toHaveProperty('bv_region');
		}
	});

	it('rejects binary-visual source when index URL is missing', () => {
		const result = validateSourceForm(buildBinaryVisualForm({ bv_index_url: '' }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors).toHaveProperty('bv_index_url');
		}
	});

	it('rejects binary-visual source when cadence is non-positive', () => {
		const result = validateSourceForm(buildBinaryVisualForm({ bv_cadence_days: '0' }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors).toHaveProperty('bv_cadence_days');
		}
	});

	it('omits cadence from locator when left blank (resolver uses default)', () => {
		const result = validateSourceForm(buildBinaryVisualForm({ bv_cadence_days: '' }));
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.locatorShape).toEqual({
				kind: 'binary-visual',
				region: 'Denver',
				index_url: 'https://aeronav.faa.gov/visual/',
			});
		}
	});
});
