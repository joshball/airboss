/**
 * MarkdownBody DOM contract -- renders the AST-produced block nodes.
 *
 * Pre-parsed AST nodes are passed in directly; we don't run parseMarkdown
 * here. Goal is to verify the renderer wires headings, paragraphs, code,
 * and that it does not pass `<script>` text through as an executable tag.
 */

import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { MdNode } from '../src/markdown/ast';
import MarkdownBody from '../src/ui/MarkdownBody.svelte';

afterEach(() => {
	cleanup();
});

describe('MarkdownBody', () => {
	it('renders root container with the testid', () => {
		render(MarkdownBody, { nodes: [] });
		expect(screen.getByTestId('markdownbody-root')).toBeTruthy();
	});

	it('renders an h2 from a heading node', () => {
		const nodes: MdNode[] = [{ kind: 'heading', level: 2, id: 'intro', children: [{ kind: 'text', value: 'Intro' }] }];
		const { container } = render(MarkdownBody, { nodes });
		const h2 = container.querySelector('h2#intro');
		expect(h2).not.toBeNull();
		expect(h2?.textContent).toBe('Intro');
	});

	it('renders a paragraph with inline strong/em text', () => {
		const nodes: MdNode[] = [
			{
				kind: 'paragraph',
				children: [
					{ kind: 'text', value: 'A ' },
					{ kind: 'strong', children: [{ kind: 'text', value: 'bold' }] },
					{ kind: 'text', value: ' and ' },
					{ kind: 'em', children: [{ kind: 'text', value: 'italic' }] },
					{ kind: 'text', value: ' word.' },
				],
			},
		];
		const { container } = render(MarkdownBody, { nodes });
		const p = container.querySelector('p.md-p');
		expect(p?.textContent).toBe('A bold and italic word.');
		expect(container.querySelector('strong')?.textContent).toBe('bold');
		expect(container.querySelector('em')?.textContent).toBe('italic');
	});

	it('does not execute a literal "<script>" string passed through text nodes', () => {
		const nodes: MdNode[] = [
			{
				kind: 'paragraph',
				children: [{ kind: 'text', value: '<script>window.__pwn = true;</script>' }],
			},
		];
		render(MarkdownBody, { nodes });
		expect((window as unknown as { __pwn?: boolean }).__pwn).not.toBe(true);
	});
});
