/**
 * Plain-text projection of a `<RenderedSection>` body
 * (wp-flightbag-rich-reader).
 *
 * Both the SelectionToolbar (capture) and AnnotationLayer (paint) need a
 * deterministic plain-text view of the body so anchors round-trip
 * losslessly. Two callers, one helper.
 *
 * Two projections live here:
 *
 *   - `plainTextFromElement(el)` -- DOM mode. Walks a DOM subtree and
 *     concatenates text nodes the same way `Range.toString()` /
 *     `Node.textContent` do. Used inside the browser.
 *   - `plainTextFromMarkdown(md)` -- server mode. Strips markdown formatting
 *     so a server-rendered loader can pre-compute the projection without
 *     re-rendering HTML. Cheap; used when reanchoring on `+page.server.ts`.
 *
 * The two projections aren't 100% byte-identical -- markdown stripping can
 * leave a different whitespace shape than browser DOM extraction -- but the
 * `reanchor` matcher's prefix/suffix tolerance covers the residual drift.
 * The DOM projection is the one the SelectionToolbar uses for capture, so
 * round-tripping a freshly-captured anchor is always exact.
 */

/**
 * Concatenate the text content of every Text descendant of `root`. Mirrors
 * what `Range.toString()` returns for a range that selects all of `root`,
 * which keeps capture-time offsets compatible with paint-time offsets.
 *
 * Block-level elements get a single newline separator inserted after them
 * so paragraph breaks survive in the projection -- otherwise back-to-back
 * paragraphs look like one long sentence and the prefix/suffix matcher
 * loses signal.
 */
export function plainTextFromElement(root: Element): string {
	const out: string[] = [];
	walkElement(root, out);
	return out.join('');
}

const BLOCK_TAGS = new Set([
	'P',
	'DIV',
	'SECTION',
	'ARTICLE',
	'HEADER',
	'FOOTER',
	'NAV',
	'ASIDE',
	'H1',
	'H2',
	'H3',
	'H4',
	'H5',
	'H6',
	'UL',
	'OL',
	'LI',
	'BLOCKQUOTE',
	'PRE',
	'TABLE',
	'TR',
	'TBODY',
	'THEAD',
	'TFOOT',
	'FIGURE',
	'FIGCAPTION',
	'HR',
	'BR',
]);

function walkElement(node: Node, out: string[]): void {
	if (node.nodeType === 3 /* TEXT_NODE */) {
		out.push(node.nodeValue ?? '');
		return;
	}
	if (node.nodeType !== 1 /* ELEMENT_NODE */) return;
	const el = node as Element;
	const tag = el.tagName;
	if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
	if (tag === 'BR') {
		out.push('\n');
		return;
	}
	for (const child of Array.from(el.childNodes)) walkElement(child, out);
	if (BLOCK_TAGS.has(tag)) out.push('\n');
}

/**
 * Map a `Range` to its `[start, end]` offsets in `plainTextFromElement(root)`.
 *
 * Walks `root` in document order, accumulating the byte length the projection
 * would emit, and snapshots the running total as soon as the walker passes
 * `range.startContainer` / `range.endContainer`. The math mirrors
 * `walkElement` exactly so a captured `[start, end]` round-trips through
 * `plainTextFromElement(root).slice(start, end)` and reproduces
 * `range.toString()` (modulo block-tag newlines that the range never
 * straddles).
 *
 * Returns null when either container is not a descendant of `root` (the
 * caller selected outside the body) or when the offsets are otherwise
 * invalid.
 */
export function rangeToOffsets(root: Element, range: Range): { start: number; end: number } | null {
	const start = nodePositionInPlainText(root, range.startContainer, range.startOffset);
	const end = nodePositionInPlainText(root, range.endContainer, range.endOffset);
	if (start === null || end === null) return null;
	if (end < start) return { start: end, end: start };
	return { start, end };
}

function nodePositionInPlainText(root: Node, target: Node, targetOffset: number): number | null {
	if (!root.contains(target)) return null;
	const state = { offset: 0, found: false, position: 0 };
	walkForPosition(root, target, targetOffset, state);
	return state.found ? state.position : null;
}

interface PositionWalkState {
	offset: number;
	found: boolean;
	position: number;
}

function walkForPosition(node: Node, target: Node, targetOffset: number, state: PositionWalkState): void {
	if (state.found) return;
	if (node.nodeType === 3 /* TEXT_NODE */) {
		if (node === target) {
			state.position = state.offset + Math.min(targetOffset, (node.nodeValue ?? '').length);
			state.found = true;
			return;
		}
		state.offset += (node.nodeValue ?? '').length;
		return;
	}
	if (node.nodeType !== 1) return;
	const el = node as Element;
	const tag = el.tagName;
	if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
	if (tag === 'BR') {
		if (node === target) {
			state.position = state.offset;
			state.found = true;
			return;
		}
		state.offset += 1;
		return;
	}
	if (node === target) {
		// Range endpoint addressing an element node: walk into the element's
		// childNodes up to `targetOffset`, then snapshot. SVG / weird host
		// elements without childNodes fall through to the block-tag append.
		const children = Array.from(el.childNodes);
		const stop = Math.min(targetOffset, children.length);
		for (let i = 0; i < stop; i++) {
			const child = children[i];
			if (child !== undefined) walkSubtreeForOffset(child, state);
		}
		state.position = state.offset;
		state.found = true;
		return;
	}
	for (const child of Array.from(el.childNodes)) {
		walkForPosition(child, target, targetOffset, state);
		if (state.found) return;
	}
	if (BLOCK_TAGS.has(tag)) state.offset += 1;
}

function walkSubtreeForOffset(node: Node, state: PositionWalkState): void {
	if (node.nodeType === 3 /* TEXT_NODE */) {
		state.offset += (node.nodeValue ?? '').length;
		return;
	}
	if (node.nodeType !== 1) return;
	const el = node as Element;
	const tag = el.tagName;
	if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
	if (tag === 'BR') {
		state.offset += 1;
		return;
	}
	for (const child of Array.from(el.childNodes)) walkSubtreeForOffset(child, state);
	if (BLOCK_TAGS.has(tag)) state.offset += 1;
}

/**
 * Strip markdown formatting so a server-side renderer can pre-compute the
 * projection without going through the full HTML pipeline. Best-effort: we
 * remove image syntax, strip emphasis markers, drop fence delimiters, drop
 * inline code backticks, and collapse link syntax to its visible text.
 *
 * Frontmatter (`---` blocks at the top) is dropped to match the runtime
 * renderer's behavior.
 */
export function plainTextFromMarkdown(md: string): string {
	let body = md;
	// Drop YAML frontmatter.
	if (body.startsWith('---\n')) {
		const end = body.indexOf('\n---', 4);
		if (end !== -1) {
			const after = body.indexOf('\n', end + 4);
			body = after === -1 ? '' : body.slice(after + 1);
		}
	}
	// Strip fenced code-block fences but keep the inner text.
	body = body.replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```/g, (_, inner: string) => inner);
	// Image syntax `![alt](url)` -> alt text.
	body = body.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt: string) => alt);
	// Link syntax `[text](url)` -> text.
	body = body.replace(/\[([^\]]+)\]\([^)]+\)/g, (_, text: string) => text);
	// Inline code -- drop the backticks, keep the inside.
	body = body.replace(/`([^`]+)`/g, (_, inner: string) => inner);
	// Bold / italic markers (**, __, *, _).
	body = body.replace(/\*\*([^*]+)\*\*/g, (_, inner: string) => inner);
	body = body.replace(/__([^_]+)__/g, (_, inner: string) => inner);
	body = body.replace(/\*([^*]+)\*/g, (_, inner: string) => inner);
	body = body.replace(/_([^_]+)_/g, (_, inner: string) => inner);
	// Strikethrough.
	body = body.replace(/~~([^~]+)~~/g, (_, inner: string) => inner);
	// Heading markers (`# ` etc.) at line start.
	body = body.replace(/^#{1,6}\s+/gm, '');
	// List bullets / numbering at line start.
	body = body.replace(/^\s*[-*+]\s+/gm, '');
	body = body.replace(/^\s*\d+\.\s+/gm, '');
	// Blockquote markers.
	body = body.replace(/^\s*>\s?/gm, '');
	// Horizontal rules.
	body = body.replace(/^\s*[-*_]{3,}\s*$/gm, '');
	return body;
}
