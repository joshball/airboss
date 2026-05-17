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

describe('block parser -- :::cards directive', () => {
	it('parses a body-bearing :::cards block and captures the YAML body verbatim', () => {
		const src = [
			':::cards',
			'- front: "What does VFR stand for?"',
			'  back: "Visual Flight Rules."',
			'  cardType: basic',
			':::',
		].join('\n');
		const ast = parseBlocks(src);
		expect(ast).toHaveLength(1);
		const node = firstDirective(ast);
		expect(node.name).toBe('cards');
		expect(node.body).toContain('- front: "What does VFR stand for?"');
		expect(node.body).toContain('cardType: basic');
		// The YAML body is NOT walked as nested markdown.
		expect(node.body).not.toMatch(/<p>/);
	});

	it('does NOT reject a body on a :::cards block (it is body-bearing)', () => {
		const src = [':::cards', '- front: "q?"', '  back: "a."', '  cardType: basic', ':::'].join('\n');
		expect(() => parseBlocks(src)).not.toThrow();
	});

	it('rejects an unclosed :::cards directive', () => {
		const src = [':::cards', '- front: "q?"', '  back: "a."', '  cardType: basic'].join('\n');
		expect(() => parseBlocks(src)).toThrow(/Unclosed directive ':::cards'/);
	});

	it('rejects an empty :::cards body', () => {
		expect(() => parseBlocks(':::cards\n:::')).toThrow(/body is empty/);
	});

	it('rejects a :::cards body that is not a YAML sequence', () => {
		const src = [':::cards', 'not a sequence', ':::'].join('\n');
		expect(() => parseBlocks(src)).toThrow(/body validation failed/);
	});

	it('rejects a :::cards entry with a malformed source_authority kind', () => {
		const src = [
			':::cards',
			'- front: "q?"',
			'  back: "a."',
			'  cardType: basic',
			'  source_authority:',
			'    - kind: noaa',
			'      cite: x',
			':::',
		].join('\n');
		expect(() => parseBlocks(src)).toThrow(/SOURCE_AUTHORITY_KIND_VALUES/);
	});

	it('rejects a :::cards entry missing front', () => {
		const src = [':::cards', '- back: "a."', '  cardType: basic', ':::'].join('\n');
		expect(() => parseBlocks(src)).toThrow(/yaml-cards\[0\]\.front is required/);
	});
});

describe('block parser -- :::phase directive', () => {
	it('parses a canonical-phase directive and exposes both body and children', () => {
		const src = [':::phase name="context"', 'Some prose.', '', '- list item', ':::'].join('\n');
		const ast = parseBlocks(src);
		expect(ast).toHaveLength(1);
		const node = firstDirective(ast);
		expect(node.name).toBe('phase');
		expect(node.attrs.name).toBe('context');
		expect(node.body).toContain('Some prose.');
		expect(node.body).toContain('- list item');
		expect(node.children).toBeDefined();
		// The children AST has the prose paragraph and the list as
		// nested nodes (parser produced a real AST, not raw text).
		expect((node.children ?? []).some((c) => c.kind === 'paragraph')).toBe(true);
		expect((node.children ?? []).some((c) => c.kind === 'list')).toBe(true);
	});

	it('accepts every canonical phase name', () => {
		for (const name of ['context', 'problem', 'discover', 'reveal', 'practice', 'connect', 'verify']) {
			const ast = parseBlocks(`:::phase name="${name}"\nbody.\n:::`);
			const node = firstDirective(ast);
			expect(node.attrs.name).toBe(name);
		}
	});

	it('rejects an unknown phase name', () => {
		expect(() => parseBlocks(':::phase name="bogus"\nbody.\n:::')).toThrow(/not one of:/);
	});

	it('rejects a phase missing its name attribute', () => {
		expect(() => parseBlocks(':::phase\nbody.\n:::')).toThrow(/missing required attribute 'name'/);
	});

	it('rejects H1 inside a phase body', () => {
		const src = [':::phase name="context"', '# Disallowed top heading', '', 'Some prose.', ':::'].join('\n');
		expect(() => parseBlocks(src)).toThrow(/contains disallowed heading/);
	});

	it('rejects H2 inside a phase body (the splitter previously used H2 to mark phase boundaries)', () => {
		const src = [':::phase name="context"', '## Sub-section', '', 'Some prose.', ':::'].join('\n');
		expect(() => parseBlocks(src)).toThrow(/contains disallowed heading/);
	});

	it('accepts H3+ headings inside a phase body', () => {
		const src = [
			':::phase name="reveal"',
			'### Worked example',
			'',
			'Body prose.',
			'',
			'#### Detail',
			'',
			'More.',
			':::',
		].join('\n');
		expect(() => parseBlocks(src)).not.toThrow();
	});

	it('reports the absolute line number of a disallowed heading', () => {
		const src = ['', ':::phase name="context"', 'first body line', '## bad heading', ':::'].join('\n');
		// line 4 in the input (1-based)
		expect(() => parseBlocks(src)).toThrow(/line 4/);
	});

	it('rejects an unclosed phase directive', () => {
		const src = [':::phase name="context"', 'body line', ''].join('\n');
		expect(() => parseBlocks(src)).toThrow(/Unclosed directive/);
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

	it('parses :::tip as a callout (the callout family emits a CalloutNode, not a DirectiveNode)', () => {
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

describe('block parser -- inline-closed directive form', () => {
	// A valid single-line YAML-flow cards payload: the inline-closed form
	// needs a body that fits on the opener line, and YAML flow syntax
	// (`[{...}]`) is the canonical single-line cards payload.
	const inlineCards = ':::cards [{front: "q?", back: "a.", cardType: basic}]:::';
	const blockCards = [':::cards', '[{front: "q?", back: "a.", cardType: basic}]', ':::'].join('\n');

	it('parses an inline-closed body-bearing directive (`:::name <body>:::`)', () => {
		const ast = parseBlocks(inlineCards);
		expect(ast).toHaveLength(1);
		const node = firstDirective(ast);
		expect(node.name).toBe('cards');
		expect(node.body).toBe('[{front: "q?", back: "a.", cardType: basic}]');
	});

	it('parses an inline-closed attribute-only directive (`:::chart slug="...":::`)', () => {
		const ast = parseBlocks(':::chart slug="wx-scenarios/frontal-xc-march/surface-analysis":::');
		expect(ast).toHaveLength(1);
		const node = firstDirective(ast);
		expect(node.name).toBe('chart');
		expect(node.attrs.slug).toBe('wx-scenarios/frontal-xc-march/surface-analysis');
		expect(node.body).toBeUndefined();
	});

	it('inline-closed form and block form produce an equivalent AST', () => {
		const inline = parseBlocks(inlineCards);
		const block = parseBlocks(blockCards);
		expect(inline).toEqual(block);
	});

	it('throws when an inline-closed directive is followed by a stray bare `:::`', () => {
		const src = [inlineCards, ':::'].join('\n');
		expect(() => parseBlocks(src)).toThrow(/Unmatched directive close/);
	});

	it('throws on a stray bare `:::` with no directive open', () => {
		expect(() => parseBlocks('A paragraph.\n\n:::')).toThrow(/Unmatched directive close/);
	});

	it('parses an inline-closed callout (the inline content is the body, no title)', () => {
		const ast = parseBlocks(':::note A neutral aside.:::');
		expect(ast).toHaveLength(1);
		expect(ast[0].kind).toBe('callout');
		if (ast[0].kind === 'callout') {
			expect(ast[0].variant).toBe('note');
			expect(ast[0].title).toBeUndefined();
			expect(ast[0].children).toHaveLength(1);
			expect(ast[0].children[0].kind).toBe('paragraph');
		}
	});

	it('runs the per-directive validator on an inline-closed body (`:::cards none:::` fails YAML schema)', () => {
		// `none` is not a YAML sequence -- the cards validator must reject it
		// for the inline form exactly as it would for the block form.
		expect(() => parseBlocks(':::cards none:::')).toThrow(/body validation failed/);
	});

	it('emits an inline-closed directive in document order alongside paragraphs', () => {
		const ast = parseBlocks(`Before.\n\n${inlineCards}\n\nAfter.`);
		expect(ast).toHaveLength(3);
		expect(ast[0].kind).toBe('paragraph');
		expect(ast[1].kind).toBe('directive');
		expect(ast[2].kind).toBe('paragraph');
	});

	it('parses an inline-closed :::cards nested inside a callout body', () => {
		const src = [':::tip Pro move', inlineCards, ':::'].join('\n');
		const ast = parseBlocks(src);
		expect(ast).toHaveLength(1);
		expect(ast[0].kind).toBe('callout');
		if (ast[0].kind === 'callout') {
			expect(ast[0].children.some((c) => c.kind === 'directive')).toBe(true);
		}
	});
});
