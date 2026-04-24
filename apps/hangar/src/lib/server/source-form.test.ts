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
});
