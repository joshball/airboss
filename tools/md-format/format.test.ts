import { describe, expect, it } from 'vitest';
import { formatMarkdown } from './format';

describe('formatMarkdown', () => {
	it('aligns pipe-tables with mixed-width cells', () => {
		const input = ['| a | longer header | x |', '|---|---|---|', '| 1 | 2 | three |'].join('\n');
		const out = formatMarkdown(input);
		const lines = out.split('\n').filter((l) => l.startsWith('|'));
		expect(lines).toHaveLength(3);
		// Every row's pipe positions match.
		const positions = (line: string): number[] => {
			const ps: number[] = [];
			for (let i = 0; i < line.length; i += 1) if (line[i] === '|') ps.push(i);
			return ps;
		};
		expect(positions(lines[0] ?? '')).toEqual(positions(lines[1] ?? ''));
		expect(positions(lines[1] ?? '')).toEqual(positions(lines[2] ?? ''));
	});

	it('leaves tables inside code fences alone', () => {
		const input = ['```text', '| a | b |', '|---|---|', '| 1 | 2 |', '```', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toContain('| a | b |');
		expect(out).toContain('|---|---|');
		expect(out).toContain('| 1 | 2 |');
	});

	it('adds blank line before and after headings (MD022)', () => {
		const input = ['intro paragraph', '## Heading', 'next paragraph', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toMatch(/intro paragraph\n\n## Heading\n\nnext paragraph/);
	});

	it('adds blank line before lists (MD032)', () => {
		const input = ['intro', '- item 1', '- item 2', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toMatch(/intro\n\n- item 1\n- item 2/);
	});

	it('adds language tag to bare fences (MD040)', () => {
		const input = ['```', 'some code', '```', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toMatch(/^```text$/m);
	});

	it('preserves existing fence languages', () => {
		const input = ['```typescript', 'let x = 1;', '```', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toMatch(/^```typescript$/m);
		expect(out).not.toMatch(/```text/);
	});

	it('preserves YAML frontmatter unchanged', () => {
		const input = ['---', 'title: Foo', 'date: 2026-01-01', '---', '', '# Body', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toMatch(/^---\ntitle: Foo\ndate: 2026-01-01\n---/);
	});

	it('returns identical output for already-clean input', () => {
		const input = ['# Title', '', 'Paragraph.', '', '## Section', '', '- item', '- item', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toBe(input);
	});

	it('handles a clean pipe-table without changes (idempotent)', () => {
		const input = ['| a   | b   |', '| --- | --- |', '| 1   | 2   |', ''].join('\n');
		const out = formatMarkdown(input);
		// Round-trip should be stable.
		expect(formatMarkdown(out)).toBe(out);
	});

	it('leaves a pipe block with no separator row verbatim (not a real table)', () => {
		// Ingested FAA PDFs often have stray bare `|` lines -- a table that
		// failed to extract cleanly. With no GFM separator row the block is
		// not a table; aligning it would oscillate between passes.
		const input = ['intro', '', '|', '|', '|', '', 'outro', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toContain('\n|\n|\n|\n');
	});

	it('leaves a degenerate all-empty pipe block verbatim', () => {
		const input = ['text', '', '|  |', '|  |', '|  |', '', 'more', ''].join('\n');
		const out = formatMarkdown(input);
		expect(out).toContain('\n|  |\n|  |\n|  |\n');
	});

	it('is idempotent on a non-table pipe block (the regression that motivated the fix)', () => {
		const input = ['# H', '', '|', '|', '|', '', 'body', ''].join('\n');
		const pass1 = formatMarkdown(input);
		const pass2 = formatMarkdown(pass1);
		expect(pass2).toBe(pass1);
	});

	it('still aligns a real table that follows a stray pipe block', () => {
		const input = ['intro', '', '|', '|', '', '| a | b |', '| --- | --- |', '| longer | x |', ''].join('\n');
		const out = formatMarkdown(input);
		// The stray `|` lines pass through; the real table below is aligned.
		expect(out).toContain('\n|\n|\n');
		const tableLines = out.split('\n').filter((l) => l.startsWith('| '));
		expect(tableLines[0]).toBe('| a      | b   |');
		expect(formatMarkdown(out)).toBe(out);
	});
});
