/**
 * section-text.ts -- DOM and markdown projection helpers.
 *
 * Vitest runs in happy-dom mode for this file (project default for `.svelte`-
 * adjacent libs) which gives us a real `document.createRange` so the round-
 * trip test can assert that captured offsets index back into the projected
 * plain text exactly.
 */

// @vitest-environment happy-dom

import { captureAnchor, reanchor } from '@ab/utils';
import { describe, expect, it } from 'vitest';
import { plainTextFromElement, plainTextFromMarkdown, rangeToOffsets } from './section-text';

function buildBody(html: string): HTMLElement {
	const wrap = document.createElement('div');
	wrap.innerHTML = html;
	return wrap;
}

describe('plainTextFromElement', () => {
	it('concatenates text content with paragraph newlines', () => {
		const root = buildBody('<p>First paragraph.</p><p>Second paragraph.</p>');
		const text = plainTextFromElement(root);
		expect(text).toContain('First paragraph.');
		expect(text).toContain('Second paragraph.');
		// Paragraph breaks survive in the projection.
		expect(text.indexOf('\n')).toBeGreaterThan(0);
	});

	it('skips script and style descendants', () => {
		const root = buildBody('<p>Visible.<script>alert(1)</script><style>.x{}</style></p>');
		expect(plainTextFromElement(root)).toContain('Visible.');
		expect(plainTextFromElement(root)).not.toContain('alert');
		expect(plainTextFromElement(root)).not.toContain('.x{');
	});

	it('emits a newline for <br>', () => {
		const root = buildBody('<p>Line one<br>Line two</p>');
		const text = plainTextFromElement(root);
		expect(text).toContain('Line one\nLine two');
	});
});

describe('rangeToOffsets', () => {
	it('round-trips a captured anchor through plainTextFromElement', () => {
		const root = buildBody('<p>The quick brown <em>fox</em> jumps over the lazy dog.</p>');
		const projection = plainTextFromElement(root);
		const em = root.querySelector('em');
		expect(em).not.toBeNull();
		if (!em) return;
		const range = document.createRange();
		range.setStart(em.firstChild as Node, 0);
		range.setEnd(em.firstChild as Node, 3);
		const offsets = rangeToOffsets(root, range);
		expect(offsets).not.toBeNull();
		if (!offsets) return;
		expect(projection.slice(offsets.start, offsets.end)).toBe('fox');

		// And the captured anchor reanchors back to the same range.
		const anchor = captureAnchor(projection, offsets);
		const restored = reanchor(projection, anchor);
		expect(restored).toEqual(offsets);
	});

	it('returns null when the range is outside the root', () => {
		const root = buildBody('<p>Body.</p>');
		const stray = document.createElement('span');
		stray.textContent = 'outside';
		document.body.appendChild(stray);
		const range = document.createRange();
		range.selectNodeContents(stray);
		expect(rangeToOffsets(root, range)).toBeNull();
		stray.remove();
	});
});

describe('plainTextFromMarkdown', () => {
	it('strips emphasis, links, code, and headings', () => {
		const md = `# Title\n\nThis **bold** and *italic* and \`code\` and [link](http://example.com).`;
		const out = plainTextFromMarkdown(md);
		expect(out).not.toContain('#');
		expect(out).not.toContain('**');
		expect(out).not.toContain('`');
		expect(out).not.toContain('](http');
		expect(out).toContain('Title');
		expect(out).toContain('bold');
		expect(out).toContain('italic');
		expect(out).toContain('code');
		expect(out).toContain('link');
	});

	it('drops YAML frontmatter', () => {
		const md = `---\nfoo: 1\nbar: two\n---\nBody starts here.`;
		const out = plainTextFromMarkdown(md);
		expect(out).not.toContain('foo:');
		expect(out).toContain('Body starts here.');
	});

	it('keeps fenced code-block content', () => {
		const md = '```js\nconsole.log(1);\n```';
		const out = plainTextFromMarkdown(md);
		expect(out).toContain('console.log(1);');
		expect(out).not.toContain('```');
	});
});
