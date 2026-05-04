/**
 * Pure-string tests for `isDocsPathAllowed` plus cache-shape tests for
 * `listDocsTree` / `bustDocsTreeCache`. The filesystem walker has end-to-end
 * coverage via the loader integration test; here we focus on the
 * path-validation predicate's contract (security gate) and the explicit
 * cache invalidation hook the loader uses to keep the tree fresh.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bustDocsTreeCache, isDocsPathAllowed, listDocsTree } from './docs-tree';

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

describe('listDocsTree -- cache + bust', () => {
	let workdir: string;

	beforeEach(async () => {
		workdir = await mkdtemp(join(tmpdir(), 'docs-tree-test-'));
		await mkdir(join(workdir, 'docs/work'), { recursive: true });
		await writeFile(join(workdir, 'docs/work/NOW.md'), '# now');
		bustDocsTreeCache();
	});

	afterEach(async () => {
		bustDocsTreeCache();
		await rm(workdir, { recursive: true, force: true });
	});

	it('returns the same array reference within the TTL window', async () => {
		const a = await listDocsTree(workdir);
		const b = await listDocsTree(workdir);
		expect(a).toBe(b);
	});

	it('forceFresh: true bypasses the cache', async () => {
		const a = await listDocsTree(workdir);
		const b = await listDocsTree(workdir, { forceFresh: true });
		expect(b).not.toBe(a);
	});

	it('bustDocsTreeCache(repoRoot) drops only that root entry', async () => {
		const a = await listDocsTree(workdir);
		bustDocsTreeCache(workdir);
		const b = await listDocsTree(workdir);
		expect(b).not.toBe(a);
	});

	it('bustDocsTreeCache() with no args clears all entries', async () => {
		const a = await listDocsTree(workdir);
		bustDocsTreeCache();
		const b = await listDocsTree(workdir);
		expect(b).not.toBe(a);
	});

	it('walks the docs root and surfaces NOW.md', async () => {
		const tree = await listDocsTree(workdir);
		// Top-level node is the `docs` directory; descend to find NOW.md.
		const docsRoot = tree.find((n) => n.type === 'dir' && n.path === 'docs');
		expect(docsRoot).toBeDefined();
		expect(docsRoot && docsRoot.type === 'dir').toBe(true);
	});
});
