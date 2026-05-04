/**
 * Pure-string tests for `isDocsPathAllowed`. The filesystem walker has
 * test coverage via the loader integration test; here we focus on the
 * path-validation predicate's contract because it's the security gate
 * that keeps `/docs/[...path]` from escaping the allow-list.
 */

import { describe, expect, it } from 'vitest';
import { isDocsPathAllowed } from './docs-tree';

describe('isDocsPathAllowed', () => {
	it('accepts paths under DOCS_SEARCH_ROOTS that end in .md', () => {
		expect(isDocsPathAllowed('docs/work/NOW.md')).toBe(true);
		expect(isDocsPathAllowed('course/knowledge/airspace/vfr-weather-minimums/node.md')).toBe(true);
		expect(isDocsPathAllowed('handbooks/phak/chapter-1.md')).toBe(true);
		expect(isDocsPathAllowed('regulations/14-91/91-3.md')).toBe(true);
	});

	it('rejects paths containing parent traversal (..)', () => {
		expect(isDocsPathAllowed('docs/../etc/passwd.md')).toBe(false);
		expect(isDocsPathAllowed('../docs/x.md')).toBe(false);
		expect(isDocsPathAllowed('docs/foo/..secret.md')).toBe(false);
	});

	it('rejects non-md files', () => {
		expect(isDocsPathAllowed('docs/work/NOW.txt')).toBe(false);
		expect(isDocsPathAllowed('docs/work/NOW')).toBe(false);
	});

	it('rejects paths outside the allow-list', () => {
		expect(isDocsPathAllowed('apps/hangar/src/routes/login/+page.svelte')).toBe(false);
		expect(isDocsPathAllowed('libs/constants/src/routes.ts')).toBe(false);
		expect(isDocsPathAllowed('foo.md')).toBe(false);
	});

	it('rejects exactly a root (a directory, not a file)', () => {
		expect(isDocsPathAllowed('docs')).toBe(false);
		expect(isDocsPathAllowed('course')).toBe(false);
	});

	it('rejects empty input', () => {
		expect(isDocsPathAllowed('')).toBe(false);
	});
});
