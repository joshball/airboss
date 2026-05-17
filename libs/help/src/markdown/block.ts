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
 *   - Directives (`:::name ...` / `:::`), four families owned by the
 *     `@ab/constants` registry: attribute-only (`chart`, `scenario`),
 *     data-payload-body (`cards`), nested-markdown-body (`phase`), and
 *     the variant-named callout family (`tip` / `warn` / `note` /
 *     `example`). Body-bearing directives may also be closed inline on
 *     the opener line with a trailing `:::` (e.g. `:::cards none:::`).
 *     Unknown directive names and unclosed directives throw.
 *   - Figures (`![alt](src "caption")`) -- image on its own line with an
 *     optional quoted caption.
 *   - Horizontal rules (`---`, `***`).
 *
 * The parser strives to be small and predictable. Anything not listed here
 * is treated as a paragraph line.
 */

import { parseCardsYaml } from '@ab/bc-study';
import {
	KNOWLEDGE_PHASE_VALUES,
	MARKDOWN_CALLOUT_VARIANT_VALUES,
	MARKDOWN_DIRECTIVE_ALL_NAMES,
	MARKDOWN_DIRECTIVE_BODY_BEARING,
	MARKDOWN_DIRECTIVE_NAMES,
	MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY,
	MARKDOWN_DIRECTIVE_REQUIRED_ATTRS,
	type MarkdownDirectiveName,
	WX_CHART_SLUG_REGEX,
	WX_SCENARIO_VALUES,
} from '@ab/constants';
import type { CalloutVariant, InlineNode, MdNode, TableAlign } from './ast';
import { ESCAPABLE, parseInline } from './inline';

// The callout family + the other three directive families all live in the
// `@ab/constants` registry. `DIRECTIVE_NAME_SET` is every legal directive
// name across all four families -- the `:::name` opener is recognised
// against it, then `CALLOUT_VARIANT_SET` selects the callout parse path
// (variant-named family) versus the `DirectiveNode`-emitting path.
const CALLOUT_VARIANT_SET = new Set<string>(MARKDOWN_CALLOUT_VARIANT_VALUES);
const DIRECTIVE_NAME_SET = new Set<string>(MARKDOWN_DIRECTIVE_ALL_NAMES);
const DIRECTIVE_BODY_BEARING_SET: ReadonlySet<string> = MARKDOWN_DIRECTIVE_BODY_BEARING;
const DIRECTIVE_NESTED_MARKDOWN_BODY_SET: ReadonlySet<string> = MARKDOWN_DIRECTIVE_NESTED_MARKDOWN_BODY;
const WX_SCENARIO_SLUG_SET = new Set<string>(WX_SCENARIO_VALUES);
const KNOWLEDGE_PHASE_VALUE_SET = new Set<string>(KNOWLEDGE_PHASE_VALUES);

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

		// Bare `:::` close token at the top of the loop is unmatched: every
		// directive / callout body scan consumes its own closing `:::`, so a
		// `:::` that reaches here closes nothing. Throw rather than emit it as
		// a stray paragraph (this also catches an inline-closed directive
		// followed by an orphaned `:::` line).
		if (/^:::\s*$/.test(line)) {
			throw new MarkdownParseError("Unmatched directive close ':::' (no directive is open)", baseLineNo + i + 1);
		}

		// Directive opener (`:::name ...`). One opener, four families owned by
		// the `@ab/constants` registry:
		//
		//   - Attribute-only (chart, scenario): MUST close on the next
		//     non-blank line. Any body content is rejected because the
		//     renderer mounts a component parameterised by attrs alone.
		//   - Data-payload body (cards): the lines between opener and
		//     closer are collected verbatim into `node.body` and handed
		//     to the per-directive validator (e.g. `parseCardsYaml`).
		//     The body is a typed payload (YAML); it is NOT walked as
		//     nested markdown.
		//   - Nested-markdown body (phase): the body IS authored
		//     markdown. We capture it into `node.body` AND recursively
		//     parse it through the same block parser, populating
		//     `node.children` with the resulting `MdNode[]`. Splitters
		//     consume `body`; renderers consume `children`.
		//   - Variant-named callout family (tip, warn, note, example):
		//     the name IS the variant; the body is nested markdown. The
		//     parser emits a `CalloutNode` (kind: 'callout') keyed on the
		//     variant rather than a generic `DirectiveNode`.
		//
		// A body-bearing directive may also be closed INLINE on the opener
		// line with a trailing `:::` (e.g. `:::cards none:::`); the block
		// form and the inline-closed form parse to an equivalent node.
		//
		// `DIRECTIVE_NAME_SET` recognises the opener; `CALLOUT_VARIANT_SET`
		// selects the callout path; within the directive path
		// `DIRECTIVE_BODY_BEARING_SET` selects body vs no-body and
		// `DIRECTIVE_NESTED_MARKDOWN_BODY_SET` selects nested-markdown vs
		// typed-payload.
		const calloutOpen = /^:::\s*([a-z][a-z-]*)\s*(.*)$/i.exec(line);
		if (calloutOpen && calloutOpen[1].toLowerCase() !== 'end') {
			const variantName = calloutOpen[1].toLowerCase();
			const rawRemainder = calloutOpen[2];
			// Inline-closed form: the opener line ends with a trailing `:::`.
			// The content between the directive name and that trailing `:::`
			// is the inline body (empty when the line is `:::name:::`).
			const inlineCloseMatch = /^(.*?)\s*:::\s*$/.exec(rawRemainder);
			const isInlineClosed = inlineCloseMatch !== null;
			const remainder = isInlineClosed ? inlineCloseMatch[1] : rawRemainder;

			if (DIRECTIVE_NAME_SET.has(variantName)) {
				const isCallout = CALLOUT_VARIANT_SET.has(variantName);
				const openerLine = baseLineNo + i + 1;

				if (isCallout) {
					// Variant-named callout directive. The body is nested
					// markdown; the parser emits a `CalloutNode`.
					const variant = variantName as CalloutVariant;
					if (isInlineClosed) {
						// `:::tip body text:::` -- the inline content is the body;
						// the inline form carries no title.
						const children = parseBlocks(remainder);
						out.push({ kind: 'callout', variant, title: undefined, children });
						i += 1;
						continue;
					}
					const title = remainder.trim() || undefined;
					const bodyStart = i + 1;
					let j = bodyStart;
					while (j < end && !/^:::\s*$/.test(lines[j])) {
						// Allow nested directives / callouts to open and close
						// within; match depth so the callout's own closing `:::`
						// is found. An inline-closed nested directive
						// (`:::name ...:::` on one line) is self-contained -- it
						// neither opens nor closes a multi-line block, so it does
						// not affect depth.
						const innerOpen = /^:::\s*([a-z][a-z-]*)/i.exec(lines[j]);
						if (innerOpen && innerOpen[1].toLowerCase() !== 'end' && !isInlineClosedDirectiveLine(lines[j])) {
							// Skip to its close.
							let depth = 1;
							j += 1;
							while (j < end && depth > 0) {
								if (/^:::\s*$/.test(lines[j])) depth -= 1;
								else if (/^:::\s*[a-z]/i.test(lines[j]) && !isInlineClosedDirectiveLine(lines[j])) depth += 1;
								if (depth === 0) break;
								j += 1;
							}
							j += 1;
							continue;
						}
						j += 1;
					}
					if (j >= end) {
						throw new MarkdownParseError(`Unclosed callout ':::${variant}'`, openerLine);
					}
					const children = parseBlockRange(lines, bodyStart, j, baseLineNo);
					out.push({ kind: 'callout', variant, title, children });
					i = j + 1;
					continue;
				}

				const bodyStart = i + 1;
				const bodyBearing = DIRECTIVE_BODY_BEARING_SET.has(variantName);
				if (bodyBearing) {
					if (isInlineClosed) {
						// Inline-closed body-bearing directive (`:::cards none:::`).
						// The opener line is the whole directive. A body-bearing
						// directive is defined by its body, so the inline content
						// between `:::name` and the trailing `:::` IS the body; the
						// inline form carries no attributes. Block form
						// (`:::name\n<body>\n:::`) and inline form parse to an
						// equivalent node. The per-directive validator still runs
						// on the inline body (so `:::cards none:::` fails the YAML
						// schema exactly as the block form would).
						const attrs: Record<string, string> = {};
						const body = remainder;
						validateDirective(variantName as MarkdownDirectiveName, attrs, openerLine, body, baseLineNo + i + 1);
						if (DIRECTIVE_NESTED_MARKDOWN_BODY_SET.has(variantName)) {
							const children = parseBlocks(body);
							out.push({ kind: 'directive', name: variantName, attrs, body, children });
						} else {
							out.push({ kind: 'directive', name: variantName, attrs, body });
						}
						i += 1;
						continue;
					}
					const attrs = parseDirectiveAttrs(remainder, openerLine);
					let j = bodyStart;
					const bodyLines: string[] = [];
					while (j < end && !/^:::\s*$/.test(lines[j])) {
						bodyLines.push(lines[j]);
						j += 1;
					}
					if (j >= end) {
						throw new MarkdownParseError(`Unclosed directive ':::${variantName}'`, openerLine);
					}
					const body = bodyLines.join('\n');
					validateDirective(variantName as MarkdownDirectiveName, attrs, openerLine, body, baseLineNo + bodyStart);
					// Nested-markdown directives (e.g. `:::phase`) get the body
					// walked through the same block parser so renderers can mount
					// a real AST without re-parsing. `body` stays set in parallel
					// so splitters that consume the raw text (e.g., the knowledge
					// node phase splitter in `@ab/bc-study`) don't need to walk
					// the AST back to a string.
					if (DIRECTIVE_NESTED_MARKDOWN_BODY_SET.has(variantName)) {
						const children = parseBlockRange(lines, bodyStart, j, baseLineNo);
						out.push({ kind: 'directive', name: variantName, attrs, body, children });
					} else {
						out.push({ kind: 'directive', name: variantName, attrs, body });
					}
					i = j + 1;
					continue;
				}
				// Attribute-only directive (`chart`, `scenario`). Defined by its
				// attribute bag; the body is always empty. The remainder holds
				// the `key="value"` pairs in both the block and inline-closed
				// forms.
				const attrs = parseDirectiveAttrs(remainder, openerLine);
				validateDirective(variantName as MarkdownDirectiveName, attrs, openerLine);
				if (isInlineClosed) {
					// Attribute-only directive closed inline (`:::chart slug="x":::`).
					// There is no body to scan; the opener line is the whole node.
					out.push({ kind: 'directive', name: variantName, attrs });
					i += 1;
					continue;
				}
				let j = bodyStart;
				while (j < end && !/^:::\s*$/.test(lines[j])) {
					// Tolerate a single blank line between opener and close; reject
					// any actual content (an attribute-only directive's body is
					// undefined behaviour).
					if (lines[j].trim().length !== 0) {
						throw new MarkdownParseError(
							`Directive ':::${variantName}' must not contain a body; close with ':::' immediately.`,
							baseLineNo + j + 1,
						);
					}
					j += 1;
				}
				if (j >= end) {
					throw new MarkdownParseError(`Unclosed directive ':::${variantName}'`, openerLine);
				}
				out.push({ kind: 'directive', name: variantName, attrs });
				i = j + 1;
				continue;
			}

			throw new MarkdownParseError(`Unknown directive ':::${variantName}'`, baseLineNo + i + 1);
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

/**
 * True when `line` is an inline-closed directive opener: `:::name ...:::`
 * on a single line (the opener and its closing `:::` are on the same
 * line). Such a line is self-contained -- it neither opens nor closes a
 * multi-line block, so the nested-callout depth scan must treat it as
 * neutral. A bare close (`:::`) is not an opener and returns false.
 */
function isInlineClosedDirectiveLine(line: string): boolean {
	return /^:::\s*[a-z][a-z-]*(\s.*)?:::\s*$/i.test(line);
}

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

/**
 * Parse an attribute list from a directive opener.
 *
 * Input is the text after `:::name`, e.g. `slug="wx-scenarios/..." foo="bar"`.
 * Returns `{ slug: '...', foo: 'bar' }`. Whitespace around `=` is allowed.
 * Values must be double-quoted; backslash escapes inside the quoted value
 * are forwarded as-is (the renderer's slug regex rejects anything but
 * `[a-z0-9-/]`, so escapes never appear in practice).
 *
 * Throws `MarkdownParseError` on malformed input: unquoted values, unclosed
 * quotes, or duplicate keys.
 */
function parseDirectiveAttrs(rest: string, line: number): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /([a-z][a-z0-9-]*)\s*=\s*"((?:[^"\\]|\\.)*)"/giy;
	let pos = 0;
	while (pos < rest.length) {
		// Skip leading whitespace before each pair.
		while (pos < rest.length && (rest[pos] === ' ' || rest[pos] === '\t')) pos += 1;
		if (pos >= rest.length) break;
		re.lastIndex = pos;
		const m = re.exec(rest);
		if (m === null || m.index !== pos) {
			throw new MarkdownParseError(
				`Directive attribute parse failure near \`${rest.slice(pos).slice(0, 32)}\` (expected key="value")`,
				line,
			);
		}
		const key = m[1].toLowerCase();
		if (key in out) {
			throw new MarkdownParseError(`Duplicate directive attribute '${key}'`, line);
		}
		out[key] = m[2];
		pos = re.lastIndex;
	}
	return out;
}

/**
 * Per-directive validation: required attribute keys + value shape +
 * (for body-bearing directives) payload schema or body shape.
 *
 * Runs after `parseDirectiveAttrs` so we know the attribute bag is at
 * least syntactically well-formed. The slug checks here mirror the
 * runtime helpers (`WX_CHART_SLUG_REGEX`, `WX_SCENARIO_VALUES`) so an
 * authored typo fails at parse time, not at render. `:::cards` parses
 * its body via the shared `parseCardsYaml` (re-exported from
 * `@ab/bc-study`) so the markdown parser and the seed orchestrator
 * agree on schema. `:::phase` validates the `name` attribute against
 * `KNOWLEDGE_PHASE_VALUES` and rejects H1/H2 headings inside the body
 * (the phase title itself is auto-rendered as an H3 by the knowledge
 * node renderer, sourced from `KNOWLEDGE_PHASE_LABELS`).
 *
 * `bodyStartIndex` is the 0-based index of the first body line in the
 * caller's `lines` array; it's used to compute absolute line numbers
 * for in-body errors (e.g., a disallowed heading). When the directive
 * has no body, the parameter is ignored.
 */
function validateDirective(
	name: MarkdownDirectiveName,
	attrs: Record<string, string>,
	line: number,
	body?: string,
	bodyStartIndex?: number,
): void {
	for (const required of MARKDOWN_DIRECTIVE_REQUIRED_ATTRS[name]) {
		if (!(required in attrs) || attrs[required].length === 0) {
			throw new MarkdownParseError(`Directive ':::${name}' is missing required attribute '${required}'`, line);
		}
	}
	if (name === MARKDOWN_DIRECTIVE_NAMES.CHART) {
		const slug = attrs.slug;
		if (!WX_CHART_SLUG_REGEX.test(slug)) {
			throw new MarkdownParseError(
				`Directive ':::chart' slug '${slug}' is not a valid wx-charts slug (expected wx-scenarios/<id>/<kind> or reference-fixtures/<id>)`,
				line,
			);
		}
	}
	if (name === MARKDOWN_DIRECTIVE_NAMES.SCENARIO) {
		const slug = attrs.slug;
		if (!WX_SCENARIO_SLUG_SET.has(slug)) {
			throw new MarkdownParseError(`Directive ':::scenario' slug '${slug}' is not a registered wx scenario`, line);
		}
	}
	if (name === MARKDOWN_DIRECTIVE_NAMES.CARDS) {
		// Body is always defined for body-bearing directives -- the parser
		// path that calls validateDirective with a body sets it from the
		// captured lines. An empty body is rejected here so an empty
		// `:::cards\n:::` opener fails at parse time instead of silently
		// emitting zero cards.
		const payload = body ?? '';
		if (payload.trim().length === 0) {
			throw new MarkdownParseError(`Directive ':::cards' body is empty; expected a YAML sequence of cards.`, line);
		}
		try {
			parseCardsYaml(payload, `:::cards (line ${line})`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			throw new MarkdownParseError(`Directive ':::cards' body validation failed: ${message}`, line);
		}
	}
	if (name === MARKDOWN_DIRECTIVE_NAMES.PHASE) {
		const phaseName = attrs.name;
		if (!KNOWLEDGE_PHASE_VALUE_SET.has(phaseName)) {
			const allowed = [...KNOWLEDGE_PHASE_VALUE_SET].join(', ');
			throw new MarkdownParseError(`Directive ':::phase' name "${phaseName}" is not one of: ${allowed}`, line);
		}
		// H1/H2 are reserved for the page shell and the knowledge-node
		// phase splitter respectively; inside a `:::phase` body the highest
		// allowed heading is H3. Walk the raw body lines so the error can
		// cite the exact authored line.
		const bodyText = body ?? '';
		if (bodyText.length > 0) {
			const bodyLines = bodyText.split('\n');
			for (let k = 0; k < bodyLines.length; k++) {
				const bl = bodyLines[k] ?? '';
				const headingMatch = /^(#{1,2})\s+(.*)$/.exec(bl);
				if (!headingMatch) continue;
				const headingText = headingMatch[2].trim();
				const absoluteLine = (bodyStartIndex ?? 0) + k + 1;
				throw new MarkdownParseError(
					`Directive ':::phase' (name="${phaseName}") body contains disallowed heading "${headingMatch[1]} ${headingText}"; use ### or deeper.`,
					absoluteLine,
				);
			}
		}
	}
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
			const next = s[i + 1] as string;
			if (ESCAPABLE.has(next)) {
				// Escape sequence: emit only the escaped char.
				buf += next;
				i += 1;
				continue;
			}
			// Not an escape: keep the backslash literal and fall through to
			// process `next` on the following iteration.
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
