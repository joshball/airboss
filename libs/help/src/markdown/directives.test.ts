/**
 * Block parser -- `:::chart` and `:::scenario` directive coverage.
 *
 * The parent parser tests cover callouts + tables + lists; this file is
 * dedicated to the component-mount directive syntax added so course-step
 * body_md can embed `<CourseStepChart>` and `<ScenarioPanel>` inline.
 */

import { describe, expect, it } from 'vitest';
import type { DirectiveNode, MdNode } from './ast';
import { MarkdownParseError, parseBlocks } from './block';

function firstDirective(nodes: MdNode[]): DirectiveNode {
	const match = nodes.find((n) => n.kind === 'directive');
	if (!match) throw new Error('expected a directive node');
	return match as DirectiveNode;
}

describe('block parser -- :::chart directive', () => {
	it('parses a scenario-family chart slug', () => {
		const ast = parseBlocks(':::chart slug="wx-scenarios/frontal-xc-march/surface-analysis"\n:::');
		expect(ast).toHaveLength(1);
		const node = firstDirective(ast);
		expect(node.name).toBe('chart');
		expect(node.attrs).toMatchObject({ slug: 'wx-scenarios/frontal-xc-march/surface-analysis' });
	});

	it('parses a reference-fixtures chart slug', () => {
		const ast = parseBlocks(':::chart slug="reference-fixtures/wx-surface-analysis-2024-12-23-12z"\n:::');
		const node = firstDirective(ast);
		expect(node.name).toBe('chart');
		expect(node.attrs.slug).toBe('reference-fixtures/wx-surface-analysis-2024-12-23-12z');
	});

	it('rejects a chart slug that does not start with a known family prefix', () => {
		expect(() => parseBlocks(':::chart slug="wx-surface-analysis-2024-12-23-12z"\n:::')).toThrow(MarkdownParseError);
	});

	it('rejects a chart slug containing uppercase', () => {
		expect(() => parseBlocks(':::chart slug="wx-scenarios/Frontal/surface-analysis"\n:::')).toThrow(MarkdownParseError);
	});

	it('rejects a chart directive missing slug', () => {
		expect(() => parseBlocks(':::chart\n:::')).toThrow(/missing required attribute 'slug'/);
	});

	it('rejects a chart directive with an empty slug', () => {
		expect(() => parseBlocks(':::chart slug=""\n:::')).toThrow(/missing required attribute 'slug'/);
	});
});

describe('block parser -- :::scenario directive', () => {
	it('parses a registered scenario slug', () => {
		const ast = parseBlocks(':::scenario slug="frontal-xc-march"\n:::');
		const node = firstDirective(ast);
		expect(node.name).toBe('scenario');
		expect(node.attrs.slug).toBe('frontal-xc-march');
	});

	it('rejects an unregistered scenario slug', () => {
		expect(() => parseBlocks(':::scenario slug="not-a-real-scenario"\n:::')).toThrow(/not a registered wx scenario/);
	});

	it('rejects a scenario directive missing slug', () => {
		expect(() => parseBlocks(':::scenario\n:::')).toThrow(/missing required attribute 'slug'/);
	});
});

describe('block parser -- directive syntax', () => {
	it('tolerates a blank line between opener and close', () => {
		const ast = parseBlocks(':::chart slug="wx-scenarios/frontal-xc-march/cva"\n\n:::');
		expect(ast).toHaveLength(1);
		expect(ast[0].kind).toBe('directive');
	});

	it('rejects a directive with body content (use a callout if you want body)', () => {
		expect(() => parseBlocks(':::chart slug="wx-scenarios/frontal-xc-march/cva"\nbody text\n:::')).toThrow(
			/must not contain a body/,
		);
	});

	it('rejects an unclosed directive', () => {
		expect(() => parseBlocks(':::chart slug="wx-scenarios/frontal-xc-march/cva"\n')).toThrow(/Unclosed directive/);
	});

	it('rejects a malformed attribute (unquoted value)', () => {
		expect(() => parseBlocks(':::chart slug=wx-scenarios/x/y\n:::')).toThrow(/attribute parse failure/);
	});

	it('rejects a directive that names an unknown directive (and not a callout variant)', () => {
		expect(() => parseBlocks(':::unknown-directive slug="x"\n:::')).toThrow(/Unknown directive/);
	});

	it('still parses :::tip as a callout (directive table does not capture callouts)', () => {
		const ast = parseBlocks(':::tip A friendly title\nbody paragraph\n:::');
		expect(ast).toHaveLength(1);
		expect(ast[0].kind).toBe('callout');
	});

	it('emits directives in document order alongside paragraphs', () => {
		const ast = parseBlocks(
			'Pre-paragraph.\n\n:::chart slug="wx-scenarios/frontal-xc-march/surface-analysis"\n:::\n\nPost-paragraph.',
		);
		expect(ast).toHaveLength(3);
		expect(ast[0].kind).toBe('paragraph');
		expect(ast[1].kind).toBe('directive');
		expect(ast[2].kind).toBe('paragraph');
	});
});
