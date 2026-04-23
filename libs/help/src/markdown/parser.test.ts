import { describe, expect, it } from 'vitest';
import type { HeadingNode, ListNode, MdNode, TableNode } from './ast';
import { MarkdownParseError, parseBlocks } from './block';
import { parseInline } from './inline';

function firstOfKind<K extends MdNode['kind']>(nodes: MdNode[], kind: K): Extract<MdNode, { kind: K }> {
	const match = nodes.find((n) => n.kind === kind);
	if (!match) throw new Error(`expected a '${kind}' node`);
	return match as Extract<MdNode, { kind: K }>;
}

describe('block parser', () => {
	it('parses h2/h3/h4 headings and slugifies ids', () => {
		const ast = parseBlocks('## Hello World\n\n### Deeper\n\n#### Deepest Yet');
		expect(ast).toHaveLength(3);
		const h2 = ast[0] as HeadingNode;
		expect(h2.kind).toBe('heading');
		expect(h2.level).toBe(2);
		expect(h2.id).toBe('hello-world');
		expect((ast[1] as HeadingNode).level).toBe(3);
		expect((ast[2] as HeadingNode).level).toBe(4);
	});

	it('demotes h1 to h2 (page shell owns h1)', () => {
		const [node] = parseBlocks('# Legacy H1');
		expect((node as HeadingNode).level).toBe(2);
	});

	it('parses paragraphs across consecutive non-blank lines', () => {
		const ast = parseBlocks('first line\nsecond line\n\nnew para');
		expect(ast).toHaveLength(2);
		expect(ast[0].kind).toBe('paragraph');
		expect(ast[1].kind).toBe('paragraph');
	});

	it('parses unordered lists', () => {
		const ast = parseBlocks('- one\n- two\n- three');
		expect(ast).toHaveLength(1);
		const list = ast[0] as ListNode;
		expect(list.kind).toBe('list');
		expect(list.ordered).toBe(false);
		expect(list.items).toHaveLength(3);
	});

	it('parses ordered lists', () => {
		const ast = parseBlocks('1. one\n2. two');
		const list = ast[0] as ListNode;
		expect(list.ordered).toBe(true);
		expect(list.items).toHaveLength(2);
	});

	it('parses nested lists via 2-space indent', () => {
		const ast = parseBlocks('- outer\n  - inner\n- sibling');
		const list = ast[0] as ListNode;
		expect(list.items).toHaveLength(2);
		const firstItem = list.items[0];
		// Nested list shows up as a child of the first item.
		const nested = firstItem.children.find((c) => c.kind === 'list') as ListNode | undefined;
		expect(nested).toBeDefined();
		expect(nested?.items).toHaveLength(1);
	});

	it('parses fenced code with lang', () => {
		const ast = parseBlocks('```typescript\nconst x = 1;\n```');
		expect(ast[0].kind).toBe('code');
		if (ast[0].kind === 'code') {
			expect(ast[0].lang).toBe('typescript');
			expect(ast[0].value).toBe('const x = 1;');
		}
	});

	it('treats a langless fence as lang="text"', () => {
		const ast = parseBlocks('```\nplain\n```');
		if (ast[0].kind === 'code') expect(ast[0].lang).toBe('text');
	});

	it('parses blockquotes with nested blocks', () => {
		const ast = parseBlocks('> a quoted paragraph\n> second line');
		expect(ast[0].kind).toBe('blockquote');
	});

	it('parses GFM tables with alignments', () => {
		const src = '| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |';
		const ast = parseBlocks(src);
		const table = firstOfKind(ast, 'table') as TableNode;
		expect(table.alignments).toEqual(['left', 'center', 'right']);
		expect(table.header).toHaveLength(3);
		expect(table.rows).toHaveLength(1);
	});

	it('parses callouts with known variants', () => {
		const ast = parseBlocks(':::tip\ninner body\n:::');
		expect(ast[0].kind).toBe('callout');
		if (ast[0].kind === 'callout') {
			expect(ast[0].variant).toBe('tip');
			expect(ast[0].children).toHaveLength(1);
		}
	});

	it('parses callouts with an optional title', () => {
		const ast = parseBlocks(':::warn Be careful\ndetails\n:::');
		if (ast[0].kind === 'callout') expect(ast[0].title).toBe('Be careful');
	});

	it('throws on unknown callout variants', () => {
		expect(() => parseBlocks(':::bogus\nx\n:::')).toThrow(MarkdownParseError);
	});

	it('throws on unclosed callouts', () => {
		expect(() => parseBlocks(':::tip\nno close here')).toThrow(MarkdownParseError);
	});

	it('parses figures', () => {
		const ast = parseBlocks('![cover](/static/cover.png "The cover")');
		expect(ast[0].kind).toBe('figure');
		if (ast[0].kind === 'figure') {
			expect(ast[0].src).toBe('/static/cover.png');
			expect(ast[0].caption).toBe('The cover');
		}
	});

	it('parses hr', () => {
		const ast = parseBlocks('---');
		expect(ast[0].kind).toBe('hr');
	});
});

describe('inline parser', () => {
	it('parses plain text', () => {
		expect(parseInline('hello world')).toEqual([{ kind: 'text', value: 'hello world' }]);
	});

	it('parses bold and italic', () => {
		const nodes = parseInline('**bold** and *italic*');
		expect(nodes[0].kind).toBe('strong');
		expect(nodes[2].kind).toBe('em');
	});

	it('parses inline code', () => {
		const nodes = parseInline('use `bun install`');
		const code = nodes.find((n) => n.kind === 'code');
		expect(code).toBeDefined();
	});

	it('parses external links with source inference', () => {
		const nodes = parseInline('See [FSRS](https://en.wikipedia.org/wiki/FSRS).');
		const link = nodes.find((n) => n.kind === 'link');
		expect(link).toBeDefined();
		if (link && link.kind === 'link') {
			expect(link.external).toBe(true);
			expect(link.source).toBe('wikipedia');
			expect(link.url).toBe('https://en.wikipedia.org/wiki/FSRS');
		}
	});

	it('parses internal (relative) links as non-external', () => {
		const nodes = parseInline('see [home](/dashboard)');
		const link = nodes.find((n) => n.kind === 'link');
		if (link && link.kind === 'link') {
			expect(link.external).toBe(false);
			expect(link.source).toBeUndefined();
		}
	});

	it('parses wikilinks', () => {
		const nodes = parseInline('learn [[FSRS::concept-fsrs]] today');
		const wiki = nodes.find((n) => n.kind === 'wikilink');
		expect(wiki).toBeDefined();
		if (wiki && wiki.kind === 'wikilink') {
			expect(wiki.display).toBe('FSRS');
			expect(wiki.pageId).toBe('concept-fsrs');
		}
	});

	it('respects escape sequences', () => {
		const nodes = parseInline('not \\*italic\\* here');
		expect(nodes).toHaveLength(1);
		expect(nodes[0]).toEqual({ kind: 'text', value: 'not *italic* here' });
	});
});
