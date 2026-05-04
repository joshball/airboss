/**
 * Pure-string tests for `safelyMarkSnippet`. The DB-driven `searchDocs`
 * has end-to-end coverage via the loader integration test; here we focus
 * on the post-escape contract because it is the security gate that keeps
 * `{@html}` on the client safe.
 */

import { describe, expect, test } from 'vitest';
import { MARK_CLOSE_SENTINEL, MARK_OPEN_SENTINEL, safelyMarkSnippet } from './docs-search';

describe('safelyMarkSnippet', () => {
	test('escapes raw `<` / `>` / `&` characters that survive ts_headline', () => {
		const out = safelyMarkSnippet('alert(<script>x</script>) & more');
		expect(out).not.toContain('<script>');
		expect(out).toContain('&lt;script&gt;');
		expect(out).toContain('&amp;');
	});

	test('preserves <mark> markers from the sentinel pair', () => {
		const raw = `pre ${MARK_OPEN_SENTINEL}match${MARK_CLOSE_SENTINEL} post`;
		const out = safelyMarkSnippet(raw);
		expect(out).toBe('pre <mark>match</mark> post');
	});

	test('handles multiple highlight runs', () => {
		const raw = `${MARK_OPEN_SENTINEL}a${MARK_CLOSE_SENTINEL} mid ${MARK_OPEN_SENTINEL}b${MARK_CLOSE_SENTINEL}`;
		const out = safelyMarkSnippet(raw);
		expect(out).toBe('<mark>a</mark> mid <mark>b</mark>');
	});

	test('escapes attribute-injection characters even when wrapped in marks', () => {
		const raw = `${MARK_OPEN_SENTINEL}<img onerror="x">${MARK_CLOSE_SENTINEL}`;
		const out = safelyMarkSnippet(raw);
		expect(out).not.toContain('<img');
		expect(out).toContain('&lt;img');
		expect(out).toContain('<mark>');
		expect(out).toContain('</mark>');
	});

	test('passes through plain text without modification', () => {
		const out = safelyMarkSnippet('plain old text');
		expect(out).toBe('plain old text');
	});

	test('escapes `"` and `\'` characters', () => {
		const out = safelyMarkSnippet(`a "b" 'c'`);
		expect(out).not.toContain('"b"');
		expect(out).toContain('&quot;');
		expect(out).toContain('&#39;');
	});
});
