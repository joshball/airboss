/**
 * Pure-function tests for the shared bucket admin parser.
 *
 *   - empty / overlong / control-byte / bidi-override names rejected
 *   - kindId membership validated
 *   - sortOrder is a non-negative integer
 *   - advancedJson branch validates at the parser boundary (so the success
 *     branch's `filterCriteria` is genuinely typed, not an unchecked cast)
 *   - structured branch surfaces invalid status / review-status values
 *   - structured branch translates filterNoPassing into noPassingSession
 */

import { describe, expect, it } from 'vitest';
import { type BucketFormValues, parseBucketForm } from './bucket-form';

function emptyValues(overrides: Partial<BucketFormValues> = {}): BucketFormValues {
	return {
		name: 'Bucket A',
		kindId: 'wp_spec',
		sortOrderRaw: '10',
		filterKind: '',
		filterFmStatuses: [],
		filterReviewStatuses: [],
		filterNoPassing: false,
		advancedJson: '',
		...overrides,
	};
}

describe('parseBucketForm -- name', () => {
	it('rejects an empty name', () => {
		const result = parseBucketForm(emptyValues({ name: '' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.name).toMatch(/required/i);
		}
	});

	it('rejects a name longer than 200 characters', () => {
		const result = parseBucketForm(emptyValues({ name: 'a'.repeat(201) }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.name).toMatch(/200 characters/);
		}
	});

	it('rejects a name with a control byte', () => {
		const result = parseBucketForm(emptyValues({ name: 'foo\u0001bar' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.name).toMatch(/disallowed/i);
		}
	});

	it('rejects a name with a bidi-override', () => {
		const result = parseBucketForm(emptyValues({ name: 'foo\u202Ebar' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.name).toMatch(/disallowed/i);
		}
	});

	it('accepts ordinary unicode (not a control byte)', () => {
		const result = parseBucketForm(emptyValues({ name: 'WP Specs -- prêt' }));
		expect('errors' in result).toBe(false);
	});
});

describe('parseBucketForm -- kindId / sortOrder', () => {
	it('rejects an unknown kindId', () => {
		const result = parseBucketForm(emptyValues({ kindId: 'not_a_kind' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.kindId).toBeDefined();
		}
	});

	it('rejects a non-integer sortOrder', () => {
		const result = parseBucketForm(emptyValues({ sortOrderRaw: 'abc' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.sortOrder).toBeDefined();
		}
	});

	it('rejects a negative sortOrder', () => {
		const result = parseBucketForm(emptyValues({ sortOrderRaw: '-1' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.sortOrder).toBeDefined();
		}
	});

	it('accepts a zero sortOrder', () => {
		const result = parseBucketForm(emptyValues({ sortOrderRaw: '0' }));
		expect('errors' in result).toBe(false);
	});
});

describe('parseBucketForm -- advancedJson branch', () => {
	it('surfaces a JSON parse error', () => {
		const result = parseBucketForm(emptyValues({ advancedJson: '{ not json }' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.advancedJson).toMatch(/Invalid JSON/);
		}
	});

	it('rejects a non-object root (array)', () => {
		const result = parseBucketForm(emptyValues({ advancedJson: '[]' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.advancedJson).toMatch(/JSON object/);
		}
	});

	it('rejects an unknown key via the validator', () => {
		const result = parseBucketForm(emptyValues({ advancedJson: '{"evilExtra": 1}' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.advancedJson).toMatch(/unknown key/i);
		}
	});

	it('rejects a wrong-typed value via the validator', () => {
		const result = parseBucketForm(emptyValues({ advancedJson: '{"kind": 42}' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.advancedJson).toMatch(/string/);
		}
	});

	it('parses a valid predicate and surfaces it as filterCriteria', () => {
		const result = parseBucketForm(
			emptyValues({ advancedJson: '{"kind": "wp_spec", "frontmatterStatus": ["unread"]}' }),
		);
		expect('errors' in result).toBe(false);
		if (!('errors' in result)) {
			expect(result.filterCriteria.kind).toBe('wp_spec');
			expect(result.filterCriteria.frontmatterStatus).toEqual(['unread']);
		}
	});
});

describe('parseBucketForm -- structured branch', () => {
	it('rejects an invalid frontmatter status', () => {
		const result = parseBucketForm(emptyValues({ filterFmStatuses: ['unread', 'bogus'] }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.filterFmStatuses).toBeDefined();
		}
	});

	it('rejects an invalid review status', () => {
		const result = parseBucketForm(emptyValues({ filterReviewStatuses: ['pending', 'bogus'] }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.filterReviewStatuses).toBeDefined();
		}
	});

	it('translates filterNoPassing -> noPassingSession: true', () => {
		const result = parseBucketForm(emptyValues({ filterNoPassing: true }));
		expect('errors' in result).toBe(false);
		if (!('errors' in result)) {
			expect(result.filterCriteria.noPassingSession).toBe(true);
		}
	});

	it('returns parsed kindId / sortOrder when no errors', () => {
		const result = parseBucketForm(emptyValues({ kindId: 'knowledge_node', sortOrderRaw: '7' }));
		expect('errors' in result).toBe(false);
		if (!('errors' in result)) {
			expect(result.kindId).toBe('knowledge_node');
			expect(result.sortOrder).toBe(7);
		}
	});

	it('rejects an invalid filterKind narrow', () => {
		const result = parseBucketForm(emptyValues({ filterKind: 'not_a_kind' }));
		expect('errors' in result).toBe(true);
		if ('errors' in result) {
			expect(result.errors.filterKind).toBeDefined();
		}
	});
});
