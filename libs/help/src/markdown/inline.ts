/**
 * Inline-level markdown parser.
 *
 * Produces `InlineNode[]` from a single paragraph-scoped string. Supports:
 *
 *   - `**bold**`      -> strong
 *   - `*italic*`      -> em
 *   - `` `code` ``   -> inline code
 *   - `[text](url)`   -> link (external inferred from url protocol)
 *   - `[[display::id]]` -> wikilink
 *   - `\*` escapes    -> literal `*` (and similarly for other markdown chars)
 *
 * No raw HTML passthrough. Plain text segments escape at render time.
 */

import { sourceFromUrl } from '../schema/external-ref';
import type { InlineNode, LinkInline } from './ast';

const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '(', ')', '<', '>', '#', '|']);

interface InlineCursor {
	src: string;
	pos: number;
}

export function parseInline(src: string): InlineNode[] {
	const cursor: InlineCursor = { src, pos: 0 };
	return parseInlineUntil(cursor, null);
}

/**
 * Parse until we hit `end` (a literal delimiter). When `end` is null, parse
 * the entire string.
 */
function parseInlineUntil(cursor: InlineCursor, end: string | null): InlineNode[] {
	const out: InlineNode[] = [];
	let text = '';

	const flushText = (): void => {
		if (text.length > 0) {
			out.push({ kind: 'text', value: text });
			text = '';
		}
	};

	while (cursor.pos < cursor.src.length) {
		if (end !== null && cursor.src.startsWith(end, cursor.pos)) {
			break;
		}

		const ch = cursor.src[cursor.pos];

		if (ch === '\\' && cursor.pos + 1 < cursor.src.length) {
			const next = cursor.src[cursor.pos + 1];
			if (ESCAPABLE.has(next)) {
				text += next;
				cursor.pos += 2;
				continue;
			}
		}

		// Wikilink `[[display::id]]`
		if (ch === '[' && cursor.src[cursor.pos + 1] === '[') {
			const close = cursor.src.indexOf(']]', cursor.pos + 2);
			if (close !== -1) {
				const inner = cursor.src.slice(cursor.pos + 2, close);
				const sep = inner.indexOf('::');
				if (sep !== -1) {
					flushText();
					const display = inner.slice(0, sep);
					const pageId = inner.slice(sep + 2);
					out.push({ kind: 'wikilink', display, pageId });
					cursor.pos = close + 2;
					continue;
				}
			}
		}

		// Link `[text](url)`
		if (ch === '[') {
			const link = tryParseLink(cursor.src, cursor.pos);
			if (link) {
				flushText();
				out.push(link.node);
				cursor.pos = link.end;
				continue;
			}
		}

		// Inline code `` `code` ``
		if (ch === '`') {
			const close = cursor.src.indexOf('`', cursor.pos + 1);
			if (close !== -1) {
				flushText();
				out.push({ kind: 'code', value: cursor.src.slice(cursor.pos + 1, close) });
				cursor.pos = close + 1;
				continue;
			}
		}

		// Bold `**text**`
		if (ch === '*' && cursor.src[cursor.pos + 1] === '*') {
			const close = findUnescaped(cursor.src, '**', cursor.pos + 2);
			if (close !== -1) {
				flushText();
				out.push({ kind: 'strong', children: parseInline(cursor.src.slice(cursor.pos + 2, close)) });
				cursor.pos = close + 2;
				continue;
			}
		}

		// Italic `*text*`
		if (ch === '*') {
			const close = findUnescaped(cursor.src, '*', cursor.pos + 1);
			if (close !== -1 && close > cursor.pos + 1) {
				flushText();
				out.push({ kind: 'em', children: parseInline(cursor.src.slice(cursor.pos + 1, close)) });
				cursor.pos = close + 1;
				continue;
			}
		}

		text += ch;
		cursor.pos += 1;
	}

	flushText();
	return out;
}

/** Locate `needle` in `src` starting at `from`, skipping `\x` escapes. */
function findUnescaped(src: string, needle: string, from: number): number {
	let i = from;
	while (i < src.length) {
		if (src[i] === '\\' && i + 1 < src.length) {
			i += 2;
			continue;
		}
		if (src.startsWith(needle, i)) return i;
		i += 1;
	}
	return -1;
}

interface LinkResult {
	node: LinkInline;
	end: number;
}

function tryParseLink(src: string, start: number): LinkResult | null {
	// src[start] === '['
	let i = start + 1;
	let depth = 1;
	while (i < src.length && depth > 0) {
		const ch = src[i];
		if (ch === '\\' && i + 1 < src.length) {
			i += 2;
			continue;
		}
		if (ch === '[') depth += 1;
		else if (ch === ']') depth -= 1;
		if (depth === 0) break;
		i += 1;
	}
	if (depth !== 0) return null;
	const textEnd = i;
	if (src[textEnd + 1] !== '(') return null;
	const urlStart = textEnd + 2;
	const urlEnd = src.indexOf(')', urlStart);
	if (urlEnd === -1) return null;
	const url = src.slice(urlStart, urlEnd).trim();
	if (url.length === 0) return null;
	const label = src.slice(start + 1, textEnd);
	const children = parseInline(label);
	const external = /^https?:\/\//i.test(url);
	const node: LinkInline = {
		kind: 'link',
		url,
		external,
		children,
	};
	if (external) node.source = sourceFromUrl(url);
	return { node, end: urlEnd + 1 };
}
