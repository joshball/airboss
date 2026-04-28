/**
 * Pure-function tests for the reference form pipeline. Validates the happy
 * path, Zod failure surfacing, citation JSON parsing, and the
 * conditional-phase gate (CFR + procedure require phaseOfFlight).
 */

import { describe, expect, it } from 'vitest';
import { parseCitations, validateReferenceForm } from './reference-form';

function buildForm(overrides: Partial<Record<string, string | readonly string[]>> = {}): FormData {
	const form = new FormData();
	form.set('id', 'test-ref');
	form.set('displayName', 'Test Reference');
	form.set('paraphrase', 'Minimal body.');
	form.set('aliases', 'alt-1, alt-2');
	form.set('keywords', '');
	form.set('sourceType', 'cfr');
	form.append('aviationTopic', 'regulations');
	form.set('flightRules', 'both');
	form.set('knowledgeKind', 'reference');
	form.set('citations', '[]');
	form.set('related', '');
	for (const [key, value] of Object.entries(overrides)) {
		if (value === undefined) continue;
		// Reset any pre-existing values at this key before applying overrides.
		form.delete(key);
		if (Array.isArray(value)) {
			for (const v of value) form.append(key, v);
		} else {
			form.set(key, value as string);
		}
	}
	return form;
}

describe('validateReferenceForm', () => {
	it('accepts a minimal valid form', () => {
		const result = validateReferenceForm(buildForm());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.input.id).toBe('test-ref');
			expect(result.input.tags.sourceType).toBe('cfr');
			expect(result.input.tags.aviationTopic).toEqual(['regulations']);
			expect(result.input.aliases).toEqual(['alt-1', 'alt-2']);
		}
	});

	it('surfaces per-field errors for an empty form', () => {
		const form = new FormData();
		form.set('citations', '[]');
		const result = validateReferenceForm(form);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors).toHaveProperty('id');
			expect(result.errors.fieldErrors).toHaveProperty('displayName');
		}
	});

	it('enforces the conditional-phase gate (procedure -> phaseOfFlight required)', () => {
		const form = buildForm({ knowledgeKind: 'procedure', sourceType: 'cfr' });
		const result = validateReferenceForm(form);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors['tags.phaseOfFlight']).toBeDefined();
		}
	});

	it('accepts a procedure reference that includes phaseOfFlight', () => {
		const form = buildForm({ knowledgeKind: 'procedure' });
		form.append('phaseOfFlight', 'takeoff');
		const result = validateReferenceForm(form);
		expect(result.ok).toBe(true);
	});

	it('flags an invalid id slug', () => {
		const form = buildForm({ id: 'Not Valid!' });
		const result = validateReferenceForm(form);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors.id).toBeDefined();
		}
	});

	it('bubbles a citations JSON error into fieldErrors.sources', () => {
		const form = buildForm({ citations: 'not json' });
		const result = validateReferenceForm(form);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.fieldErrors.sources).toBe('Citations must be valid JSON');
		}
	});
});

describe('parseCitations', () => {
	it('returns empty array for blank input', () => {
		expect(parseCitations('')).toEqual({ citations: [], error: null });
		expect(parseCitations('  ')).toEqual({ citations: [], error: null });
	});

	it('parses well-formed citations', () => {
		const input = JSON.stringify([
			{ sourceId: 'cfr-14', locator: { title: 14, part: 91, section: '155' } },
			{ sourceId: 'aim-2026-01', locator: { chapter: 7 }, url: 'https://example.test/foo' },
		]);
		const result = parseCitations(input);
		expect(result.error).toBeNull();
		expect(result.citations.length).toBe(2);
		expect(result.citations[0]).toEqual({
			sourceId: 'cfr-14',
			locator: { title: 14, part: 91, section: '155' },
			url: undefined,
		});
		expect(result.citations[1]?.url).toBe('https://example.test/foo');
	});

	it('rejects non-array JSON', () => {
		const result = parseCitations('{"sourceId":"cfr-14"}');
		expect(result.error).toBe('Citations must be a JSON array');
	});

	it('requires sourceId on each entry', () => {
		const result = parseCitations(JSON.stringify([{ locator: { a: 1 } }]));
		expect(result.error).toMatch(/sourceId/);
	});
});
