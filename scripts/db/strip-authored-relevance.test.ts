/**
 * Unit tests for the strip-authored-relevance Gate B script.
 */

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripAuthoredRelevance, stripRelevanceFromFrontmatter } from './strip-authored-relevance';

describe('stripRelevanceFromFrontmatter', () => {
	it('returns null when relevance is absent', () => {
		const yaml = ['id: aero-foo', 'title: Foo', 'domain: aerodynamics'].join('\n');
		expect(stripRelevanceFromFrontmatter(yaml)).toBeNull();
	});

	it('removes a single-line relevance scalar', () => {
		const yaml = ['id: aero-foo', 'relevance: legacy', 'domain: aerodynamics'].join('\n');
		const result = stripRelevanceFromFrontmatter(yaml);
		expect(result).toBe('id: aero-foo\ndomain: aerodynamics');
	});

	it('removes a list-form relevance block', () => {
		const yaml = [
			'id: aero-foo',
			'relevance:',
			'  - cert: private',
			'    bloom: apply',
			'    priority: critical',
			'  - cert: commercial',
			'    bloom: apply',
			'domain: aerodynamics',
		].join('\n');
		const result = stripRelevanceFromFrontmatter(yaml);
		expect(result).toBe('id: aero-foo\ndomain: aerodynamics');
	});

	it('removes a relevance block as the last frontmatter key', () => {
		const yaml = ['id: aero-foo', 'domain: aerodynamics', 'relevance:', '  - cert: private'].join('\n');
		const result = stripRelevanceFromFrontmatter(yaml);
		expect(result).toBe('id: aero-foo\ndomain: aerodynamics');
	});

	it('preserves frontmatter ordering and other fields verbatim', () => {
		const yaml = [
			'id: aero-foo',
			'title: Four Forces',
			'cross_domains: [safety-accident-analysis]',
			'',
			'relevance:',
			'  - cert: private',
			'    bloom: understand',
			'',
			'requires:',
			'  - aero-air-pressure',
		].join('\n');
		const result = stripRelevanceFromFrontmatter(yaml);
		expect(result).toBe(
			[
				'id: aero-foo',
				'title: Four Forces',
				'cross_domains: [safety-accident-analysis]',
				'',
				'requires:',
				'  - aero-air-pressure',
			].join('\n'),
		);
	});
});

describe('stripAuthoredRelevance', () => {
	function makeTmpKnowledgeRoot(files: Record<string, string>): string {
		const root = mkdtempSync(join(tmpdir(), 'strip-relevance-'));
		for (const [rel, content] of Object.entries(files)) {
			const full = join(root, rel);
			mkdirSync(join(full, '..'), { recursive: true });
			writeFileSync(full, content);
		}
		return root;
	}

	it('reports zero modifications when no files carry relevance (current authoring state)', () => {
		const root = makeTmpKnowledgeRoot({
			'aero/foo/node.md': '---\nid: aero-foo\ntitle: Foo\n---\n\nbody\n',
			'proc/bar/node.md': '---\nid: proc-bar\ntitle: Bar\n---\n\nbody\n',
		});
		const report = stripAuthoredRelevance({ root });
		expect(report.scanned).toBe(2);
		expect(report.modified).toBe(0);
		expect(report.modifiedPaths).toEqual([]);
	});

	it('rewrites files that carry a relevance block, leaves others untouched', () => {
		const withRelevance =
			'---\nid: aero-foo\ntitle: Foo\nrelevance:\n  - cert: private\n    bloom: apply\n---\n\nbody\n';
		const without = '---\nid: proc-bar\ntitle: Bar\n---\n\nbody\n';
		const root = makeTmpKnowledgeRoot({
			'aero/foo/node.md': withRelevance,
			'proc/bar/node.md': without,
		});
		const report = stripAuthoredRelevance({ root });
		expect(report.scanned).toBe(2);
		expect(report.modified).toBe(1);
		const fooPath = join(root, 'aero/foo/node.md');
		const fooNow = readFileSync(fooPath, 'utf8');
		expect(fooNow).toBe('---\nid: aero-foo\ntitle: Foo\n---\n\nbody\n');
		const barPath = join(root, 'proc/bar/node.md');
		expect(readFileSync(barPath, 'utf8')).toBe(without);
	});

	it('is idempotent: re-running modifies nothing', () => {
		const withRelevance =
			'---\nid: aero-foo\ntitle: Foo\nrelevance:\n  - cert: private\n    bloom: apply\n---\n\nbody\n';
		const root = makeTmpKnowledgeRoot({ 'aero/foo/node.md': withRelevance });
		const first = stripAuthoredRelevance({ root });
		expect(first.modified).toBe(1);
		const second = stripAuthoredRelevance({ root });
		expect(second.modified).toBe(0);
	});

	it('respects --dry-run by leaving files untouched on disk', () => {
		const withRelevance = '---\nid: aero-foo\ntitle: Foo\nrelevance:\n  - cert: private\n---\n\nbody\n';
		const root = makeTmpKnowledgeRoot({ 'aero/foo/node.md': withRelevance });
		const report = stripAuthoredRelevance({ root, dryRun: true });
		expect(report.modified).toBe(1);
		const path = join(root, 'aero/foo/node.md');
		expect(readFileSync(path, 'utf8')).toBe(withRelevance);
	});
});
