/**
 * Block-level markdown parser.
 *
 * Produces `MdNode[]` from a markdown body. Supports:
 *
 *   - Headings h2/h3/h4 (`##`, `###`, `####`). h1 is reserved for the page
 *     shell; authors who write `#` get it demoted to h2.
 *   - Paragraphs (blank-line separated).
 *   - Unordered (`-`, `*`) and ordered (`1.`) lists. Nested via 2-space
 *     indent. List items can contain paragraphs, nested lists, and code.
 *   - GFM pipe tables with optional alignment row (`:---`, `---:`, `:---:`).
 *   - Fenced code blocks (```` ```lang `` ``).
 *   - Blockquotes (`> ...`).
 *   - Callout directives (`:::variant [title]` / `:::`). Variants are
 *     validated against `CALLOUT_VARIANTS`. Unclosed callouts throw.
 *   - Figures (`![alt](src "caption")`) -- image on its own line with an
 *     optional quoted caption.
 *   - Horizontal rules (`---`, `***`).
 *
 * The parser strives to be small and predictable. Anything not listed here
 * is treated as a paragraph line.
 */

import { CALLOUT_VARIANTS } from '../validation';
import type { CalloutVariant, InlineNode, MdNode, TableAlign } from './ast';
import { parseInline } from './inline';

const CALLOUT_VARIANT_SET = new Set<string>(CALLOUT_VARIANTS);

export class MarkdownParseError extends Error {
	constructor(
		message: string,
		public line: number,
	) {
		super(`${message} (line ${line})`);
		this.name = 'MarkdownParseError';
	}
}

export function parseBlocks(src: string): MdNode[] {
	const lines = src.replace(/\r\n/g, '\n').split('\n');
	return parseBlockRange(lines, 0, lines.length, 0);
}

function parseBlockRange(lines: readonly string[], start: number, end: number, baseLineNo: number): MdNode[] {
	const out: MdNode[] = [];
	let i = start;

	while (i < end) {
		const line = lines[i];
		const trimmed = line.trim();

		// Blank line -> skip.
		if (trimmed.length === 0) {
			i += 1;
			continue;
		}

		// Horizontal rule.
		if (/^(---|\*\*\*|___)\s*$/.test(trimmed)) {
			out.push({ kind: 'hr' });
			i += 1;
			continue;
		}

		// ATX heading.
		const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
		if (headingMatch) {
			const hashes = headingMatch[1].length;
			const level = Math.min(Math.max(hashes, 2), 4) as 2 | 3 | 4;
			const text = headingMatch[2].trim();
			const children = parseInline(text);
			const id = slugify(text);
			out.push({ kind: 'heading', level, id, children });
			i += 1;
			continue;
		}

		// Fenced code.
		const fenceMatch = /^```\s*([\w-]*)\s*$/.exec(line);
		if (fenceMatch) {
			const lang = fenceMatch[1] ?? '';
			const body: string[] = [];
			i += 1;
			while (i < end && !/^```\s*$/.test(lines[i])) {
				body.push(lines[i]);
				i += 1;
			}
			// Tolerate a missing trailing fence but prefer a real close.
			if (i < end) i += 1;
			out.push({ kind: 'code', lang: lang || 'text', value: body.join('\n') });
			continue;
		}

		// Callout directive `:::variant [title]`.
		const calloutOpen = /^:::\s*([a-z][a-z-]*)\s*(.*)$/i.exec(line);
		if (calloutOpen && calloutOpen[1].toLowerCase() !== 'end') {
			const variantName = calloutOpen[1].toLowerCase();
			if (!CALLOUT_VARIANT_SET.has(variantName)) {
				throw new MarkdownParseError(`Unknown callout variant ':::${variantName}'`, baseLineNo + i + 1);
			}
			const variant = variantName as CalloutVariant;
			const title = calloutOpen[2].trim() || undefined;
			const bodyStart = i + 1;
			let j = bodyStart;
			while (j < end && !/^:::\s*$/.test(lines[j])) {
				// Allow nested callouts to open and close within; match depth.
				const innerOpen = /^:::\s*([a-z][a-z-]*)/i.exec(lines[j]);
				if (innerOpen && innerOpen[1].toLowerCase() !== 'end') {
					// Skip to its close.
					let depth = 1;
					j += 1;
					while (j < end && depth > 0) {
						if (/^:::\s*$/.test(lines[j])) depth -= 1;
						else if (/^:::\s*[a-z]/i.test(lines[j])) depth += 1;
						if (depth === 0) break;
						j += 1;
					}
					j += 1;
					continue;
				}
				j += 1;
			}
			if (j >= end) {
				throw new MarkdownParseError(`Unclosed callout ':::${variant}'`, baseLineNo + i + 1);
			}
			const children = parseBlockRange(lines, bodyStart, j, baseLineNo);
			out.push({ kind: 'callout', variant, title, children });
			i = j + 1;
			continue;
		}

		// Blockquote.
		if (/^>\s?/.test(line)) {
			const bodyLines: string[] = [];
			while (i < end && /^>\s?/.test(lines[i])) {
				bodyLines.push(lines[i].replace(/^>\s?/, ''));
				i += 1;
			}
			const children = parseBlockRange(bodyLines, 0, bodyLines.length, baseLineNo);
			out.push({ kind: 'blockquote', children });
			continue;
		}

		// Figure: `![alt](src "caption")` on its own line.
		const figureMatch = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(line);
		if (figureMatch) {
			const [, alt, src2, caption] = figureMatch;
			out.push({
				kind: 'figure',
				src: src2,
				alt: alt ?? '',
				caption: caption || undefined,
			});
			i += 1;
			continue;
		}

		// GFM pipe table.
		if (isTableStart(lines, i, end)) {
			const { node, consumed } = parseTable(lines, i, end);
			out.push(node);
			i += consumed;
			continue;
		}

		// Lists.
		const listInfo = detectListItem(line);
		if (listInfo) {
			const { node, consumed } = parseList(lines, i, end, baseLineNo);
			out.push(node);
			i += consumed;
			continue;
		}

		// Otherwise: paragraph (collect consecutive non-blank, non-block-start lines).
		const paraLines: string[] = [line];
		let p = i + 1;
		while (p < end) {
			const next = lines[p];
			if (next.trim() === '') break;
			if (isBlockBoundary(next, lines, p, end)) break;
			paraLines.push(next);
			p += 1;
		}
		out.push({ kind: 'paragraph', children: parseInline(paraLines.join(' ')) });
		i = p;
	}

	return out;
}

// ---------- helpers ----------

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.trim()
		.replace(/\s+/g, '-')
		.slice(0, 80);
}

function isBlockBoundary(line: string, lines: readonly string[], i: number, end: number): boolean {
	if (/^#{1,6}\s/.test(line)) return true;
	if (/^```/.test(line)) return true;
	if (/^>\s?/.test(line)) return true;
	if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) return true;
	if (/^:::/.test(line)) return true;
	if (detectListItem(line)) return true;
	if (isTableStart(lines, i, end)) return true;
	return false;
}

interface ListItemInfo {
	ordered: boolean;
	indent: number;
	content: string;
}

function detectListItem(line: string): ListItemInfo | null {
	const ul = /^(\s*)([-*])\s+(.*)$/.exec(line);
	if (ul) return { ordered: false, indent: ul[1].length, content: ul[3] };
	const ol = /^(\s*)\d+\.\s+(.*)$/.exec(line);
	if (ol) return { ordered: true, indent: ol[1].length, content: ol[2] };
	return null;
}

interface ParseListResult {
	node: MdNode;
	consumed: number;
}

function parseList(lines: readonly string[], start: number, end: number, baseLineNo: number): ParseListResult {
	const first = detectListItem(lines[start]);
	if (!first) throw new Error('parseList called on a non-list line');
	const baseIndent = first.indent;
	const ordered = first.ordered;
	const items: MdNode[] = [];
	let i = start;

	while (i < end) {
		const info = detectListItem(lines[i]);
		if (!info || info.indent !== baseIndent || info.ordered !== ordered) break;

		// Collect this item: the content line + continuation lines (indented
		// >= baseIndent+2) until next sibling item or outdent.
		const itemLines: string[] = [info.content];
		let j = i + 1;
		while (j < end) {
			const nextLine = lines[j];
			if (nextLine.trim() === '') {
				// Peek ahead: if the line after is still indented, keep going; else stop.
				const peek = j + 1 < end ? lines[j + 1] : null;
				if (peek === null) break;
				const peekInfo = detectListItem(peek);
				if (peekInfo && peekInfo.indent === baseIndent && peekInfo.ordered === ordered) break;
				if (peek.length === 0 || peek[0] === ' ' || peek[0] === '\t') {
					itemLines.push('');
					j += 1;
					continue;
				}
				break;
			}
			const nextInfo = detectListItem(nextLine);
			if (nextInfo && nextInfo.indent === baseIndent && nextInfo.ordered === ordered) break;
			if (nextInfo && nextInfo.indent > baseIndent) {
				// Nested list line: preserve indentation relative to the inner base.
				itemLines.push(nextLine.slice(baseIndent + 2));
				j += 1;
				continue;
			}
			if (nextLine.startsWith(' '.repeat(baseIndent + 2)) || nextLine.startsWith('\t')) {
				itemLines.push(nextLine.slice(baseIndent + 2));
				j += 1;
				continue;
			}
			// Outdented line that is not a sibling -> item ends.
			break;
		}

		const children = parseBlockRange(itemLines, 0, itemLines.length, baseLineNo);
		// Common shape: single paragraph. Flatten so the list item renders inline-friendly.
		items.push({ kind: 'listItem', children });
		i = j;
	}

	return {
		node: { kind: 'list', ordered, items: items as { kind: 'listItem'; children: MdNode[] }[] },
		consumed: i - start,
	};
}

function isTableStart(lines: readonly string[], i: number, end: number): boolean {
	if (i + 1 >= end) return false;
	const header = lines[i];
	const sep = lines[i + 1];
	if (!header.includes('|')) return false;
	return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(sep);
}

interface ParseTableResult {
	node: MdNode;
	consumed: number;
}

function parseTable(lines: readonly string[], start: number, end: number): ParseTableResult {
	const headerCells = splitTableRow(lines[start]);
	const alignCells = splitTableRow(lines[start + 1]);
	const alignments: TableAlign[] = alignCells.map((cell) => {
		const c = cell.trim();
		const left = c.startsWith(':');
		const right = c.endsWith(':');
		if (left && right) return 'center';
		if (right) return 'right';
		if (left) return 'left';
		return null;
	});

	const header: InlineNode[][] = headerCells.map((c) => parseInline(c.trim()));
	const rows: InlineNode[][][] = [];

	let i = start + 2;
	while (i < end) {
		const line = lines[i];
		if (line.trim().length === 0) break;
		if (!line.includes('|')) break;
		const cells = splitTableRow(line);
		// Pad or truncate to header width.
		const row: InlineNode[][] = [];
		for (let c = 0; c < header.length; c += 1) {
			row.push(parseInline((cells[c] ?? '').trim()));
		}
		rows.push(row);
		i += 1;
	}

	return {
		node: { kind: 'table', alignments, header, rows },
		consumed: i - start,
	};
}

function splitTableRow(line: string): string[] {
	let s = line.trim();
	if (s.startsWith('|')) s = s.slice(1);
	if (s.endsWith('|')) s = s.slice(0, -1);
	// Split on unescaped pipes.
	const out: string[] = [];
	let buf = '';
	for (let i = 0; i < s.length; i += 1) {
		const ch = s[i];
		if (ch === '\\' && i + 1 < s.length) {
			buf += s[i + 1];
			i += 1;
			continue;
		}
		if (ch === '|') {
			out.push(buf);
			buf = '';
			continue;
		}
		buf += ch;
	}
	out.push(buf);
	return out;
}
