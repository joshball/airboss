/**
 * Public entry for the help-library markdown renderer.
 *
 * `parseMarkdown(body)` produces an `MdNode[]` AST with each code block
 * pre-highlighted via Shiki. Callers (help page loaders + section render
 * wrappers) pass the AST to `<MarkdownBody>`, which walks nodes and
 * mounts the right Svelte primitives per kind.
 */

import type { MdNode } from './ast';
import { parseBlocks } from './block';
import { highlight } from './highlight';

export type { CalloutVariant, InlineNode, MdNode, TableAlign } from './ast';
export { MarkdownParseError } from './block';
export { highlight, SHIKI_THEME, SUPPORTED_LANGS, type SupportedLang } from './highlight';

/**
 * Parse a markdown body, pre-highlight all code blocks, and return the AST.
 * The returned tree is plain JSON-serialisable data; load functions can
 * forward it from server to client without re-parsing.
 */
export async function parseMarkdown(body: string): Promise<MdNode[]> {
	const ast = parseBlocks(body);
	await highlightAll(ast);
	return ast;
}

async function highlightAll(nodes: MdNode[]): Promise<void> {
	for (const node of nodes) {
		if (node.kind === 'code') {
			node.highlighted = await highlight(node.value, node.lang);
			continue;
		}
		if (node.kind === 'callout' || node.kind === 'blockquote') {
			await highlightAll(node.children);
			continue;
		}
		if (node.kind === 'list') {
			for (const item of node.items) {
				await highlightAll(item.children);
			}
		}
	}
}
