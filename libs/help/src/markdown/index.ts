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
export { highlight, SUPPORTED_LANGS, type SupportedLang } from './highlight';

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
	// Collect every code node up front so independent highlight calls run
	// in parallel via `Promise.all` -- Shiki holds no per-call state once
	// the highlighter is warm, so each block highlights independently and
	// the total cost is `max(per-block-highlight-time)` instead of the sum.
	// Container kinds (callout / blockquote / list) recurse synchronously
	// here; their leaf code nodes feed the same shared collection.
	const codeNodes: Array<Extract<MdNode, { kind: 'code' }>> = [];
	const visit = (siblings: MdNode[]): void => {
		for (const node of siblings) {
			if (node.kind === 'code') {
				codeNodes.push(node);
				continue;
			}
			if (node.kind === 'callout' || node.kind === 'blockquote') {
				visit(node.children);
				continue;
			}
			if (node.kind === 'list') {
				for (const item of node.items) {
					visit(item.children);
				}
			}
		}
	};
	visit(nodes);
	if (codeNodes.length === 0) return;
	await Promise.all(
		codeNodes.map(async (node) => {
			node.highlighted = await highlight(node.value, node.lang);
		}),
	);
}
