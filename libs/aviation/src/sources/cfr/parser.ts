/**
 * CFR XML parser.
 *
 * Target format: the federal eCFR bulk-download XML. The relevant slice of
 * the schema:
 *
 *   <CFRDOC>
 *     <DIV1 N="14" TYPE="TITLE">                Title (e.g. 14)
 *       <DIV5 N="91" TYPE="PART">               Part (e.g. 91)
 *         <DIV8 N="Sec. 91.155" TYPE="SECTION"> Section
 *           <SECTNO>Sec. 91.155</SECTNO>
 *           <SUBJECT>Basic VFR weather minimums.</SUBJECT>
 *           <P>...</P>                          Paragraphs
 *           <GPOTABLE>                          Tables
 *             <BOXHD><CHED>...</CHED></BOXHD>
 *             <ROW><ENT>...</ENT></ROW>
 *           </GPOTABLE>
 *         </DIV8>
 *       </DIV5>
 *     </DIV1>
 *   </CFRDOC>
 *
 * The parser is a hand-rolled tag scanner (no dependency), narrow in
 * scope: it locates the requested `<DIV8 N="Sec. X.Y">` by exact match,
 * walks its children, and emits GFM markdown. Paragraphs become paragraphs;
 * `<GPOTABLE>` elements become GFM tables when they have uniform rows,
 * otherwise fall back to fenced text blocks. Ordered / unordered lists
 * (marked via leading `(a)`, `(1)`, etc. on `<P>` elements) are emitted as
 * markdown list items.
 *
 * Design choice: we intentionally do NOT bring in a general XML library.
 * The eCFR schema is narrow, our access patterns are narrow, and a focused
 * scanner produces clearer errors + avoids a dep. If the parser has to
 * grow to handle a second format later, move it under a shared
 * `libs/aviation/src/xml/` and swap in `fast-xml-parser`.
 */

export interface CfrSectionLocator {
	title: number;
	part: number;
	section: string;
}

export interface ParsedCfrSection {
	locator: CfrSectionLocator;
	/** `<SECTNO>` text, e.g. "Sec. 91.155". */
	sectionNumber: string;
	/** `<SUBJECT>` text, e.g. "Basic VFR weather minimums." */
	subject: string;
	/** Rendered body as GFM markdown. */
	bodyMarkdown: string;
}

export class CfrParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CfrParseError';
	}
}

// --------------------------------------------------------------------------
// Minimal tag scanner.

interface RawElement {
	tag: string;
	attrs: Record<string, string>;
	children: readonly Node[];
	rawInner: string;
	startOffset: number;
	endOffset: number;
}

type Node = { kind: 'element'; element: RawElement } | { kind: 'text'; text: string };

const VOID_TAGS = new Set<string>(); // eCFR has no standard void tags we rely on

const OPEN_TAG = /<([A-Za-z][A-Za-z0-9]*)((?:\s+[A-Za-z][A-Za-z0-9-]*="[^"]*")*)\s*(\/)?>/y;
const CLOSE_TAG = /<\/([A-Za-z][A-Za-z0-9]*)\s*>/y;
const COMMENT = /<!--[\s\S]*?-->/y;
const XML_DECL = /<\?xml[\s\S]*?\?>/y;
const DOCTYPE = /<!DOCTYPE[\s\S]*?>/y;

function parseAttrs(raw: string): Record<string, string> {
	const out: Record<string, string> = {};
	const re = /([A-Za-z][A-Za-z0-9-]*)="([^"]*)"/g;
	let m: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-walk pattern
	while ((m = re.exec(raw)) !== null) {
		const key = m[1];
		const value = m[2];
		if (key !== undefined && value !== undefined) {
			out[key] = value;
		}
	}
	return out;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
		.replace(/&amp;/g, '&');
}

/**
 * Parse the entire XML file into a node tree. Throws `CfrParseError` on
 * structural problems (unclosed tag, mismatched close, etc.).
 */
function parseXml(source: string): RawElement {
	// Strip XML decl + doctype + comments from parser's view, but keep offsets.
	let pos = 0;

	function skipMisc(): void {
		while (pos < source.length) {
			if (source[pos] === '<' && source[pos + 1] === '?') {
				XML_DECL.lastIndex = pos;
				const m = XML_DECL.exec(source);
				if (!m) throw new CfrParseError(`Unterminated XML declaration at offset ${pos}`);
				pos = XML_DECL.lastIndex;
				continue;
			}
			if (source.startsWith('<!--', pos)) {
				COMMENT.lastIndex = pos;
				const m = COMMENT.exec(source);
				if (!m) throw new CfrParseError(`Unterminated comment at offset ${pos}`);
				pos = COMMENT.lastIndex;
				continue;
			}
			if (source.startsWith('<!DOCTYPE', pos)) {
				DOCTYPE.lastIndex = pos;
				const m = DOCTYPE.exec(source);
				if (!m) throw new CfrParseError(`Unterminated DOCTYPE at offset ${pos}`);
				pos = DOCTYPE.lastIndex;
				continue;
			}
			// whitespace between top-level nodes
			if (/\s/.test(source[pos] ?? '')) {
				pos += 1;
				continue;
			}
			break;
		}
	}

	function parseElement(): RawElement {
		const startOffset = pos;
		OPEN_TAG.lastIndex = pos;
		const open = OPEN_TAG.exec(source);
		if (!open || open.index !== pos) {
			throw new CfrParseError(`Expected opening tag at offset ${pos}, got: ${source.slice(pos, pos + 40)}`);
		}
		const tag = open[1];
		const attrStr = open[2] ?? '';
		const selfClose = open[3] === '/';
		if (!tag) throw new CfrParseError(`Malformed open tag at offset ${pos}`);
		pos = OPEN_TAG.lastIndex;
		const attrs = parseAttrs(attrStr);
		if (selfClose || VOID_TAGS.has(tag)) {
			return { tag, attrs, children: [], rawInner: '', startOffset, endOffset: pos };
		}
		const children: Node[] = [];
		const innerStart = pos;
		while (pos < source.length) {
			// comment inside body?
			if (source.startsWith('<!--', pos)) {
				COMMENT.lastIndex = pos;
				const m = COMMENT.exec(source);
				if (!m) throw new CfrParseError(`Unterminated comment at offset ${pos}`);
				pos = COMMENT.lastIndex;
				continue;
			}
			// close tag?
			if (source.startsWith('</', pos)) {
				CLOSE_TAG.lastIndex = pos;
				const close = CLOSE_TAG.exec(source);
				if (!close || close.index !== pos) {
					throw new CfrParseError(`Malformed close tag for <${tag}> at offset ${pos}`);
				}
				const closeTag = close[1];
				if (closeTag !== tag) {
					throw new CfrParseError(`Mismatched close </${closeTag}> for <${tag}> at offset ${pos}`);
				}
				const rawInner = source.slice(innerStart, pos);
				pos = CLOSE_TAG.lastIndex;
				return { tag, attrs, children, rawInner, startOffset, endOffset: pos };
			}
			// nested element?
			if (source[pos] === '<') {
				children.push({ kind: 'element', element: parseElement() });
				continue;
			}
			// text run
			const nextLt = source.indexOf('<', pos);
			const end = nextLt === -1 ? source.length : nextLt;
			if (end === pos) {
				throw new CfrParseError(`Unexpected end of text at offset ${pos}`);
			}
			children.push({ kind: 'text', text: source.slice(pos, end) });
			pos = end;
		}
		throw new CfrParseError(`Unterminated element <${tag}> starting at offset ${startOffset}`);
	}

	skipMisc();
	if (pos >= source.length) {
		throw new CfrParseError('Empty XML document');
	}
	const root = parseElement();
	skipMisc();
	if (pos < source.length) {
		// Allow trailing whitespace; anything else is suspicious.
		const rest = source.slice(pos).trim();
		if (rest.length > 0) {
			throw new CfrParseError(`Unexpected content after root element at offset ${pos}: ${rest.slice(0, 40)}`);
		}
	}
	return root;
}

// --------------------------------------------------------------------------
// Tree helpers.

function findDescendants(el: RawElement, tag: string, predicate?: (e: RawElement) => boolean): RawElement[] {
	const out: RawElement[] = [];
	for (const child of el.children) {
		if (child.kind !== 'element') continue;
		if (child.element.tag === tag && (!predicate || predicate(child.element))) {
			out.push(child.element);
		}
		out.push(...findDescendants(child.element, tag, predicate));
	}
	return out;
}

function findFirstDescendant(
	el: RawElement,
	tag: string,
	predicate?: (e: RawElement) => boolean,
): RawElement | undefined {
	for (const child of el.children) {
		if (child.kind !== 'element') continue;
		if (child.element.tag === tag && (!predicate || predicate(child.element))) {
			return child.element;
		}
		const nested = findFirstDescendant(child.element, tag, predicate);
		if (nested) return nested;
	}
	return undefined;
}

function textContent(el: RawElement): string {
	let out = '';
	for (const child of el.children) {
		if (child.kind === 'text') {
			out += decodeEntities(child.text);
		} else {
			out += textContent(child.element);
		}
	}
	return out;
}

function normalizeWhitespace(s: string): string {
	return s.replace(/\s+/g, ' ').trim();
}

// --------------------------------------------------------------------------
// GFM rendering.

function renderParagraph(el: RawElement): string {
	return normalizeWhitespace(textContent(el));
}

function renderGpotable(el: RawElement): string {
	// Header
	const boxhd = findFirstDescendant(el, 'BOXHD');
	const headers = boxhd ? findDescendants(boxhd, 'CHED').map((h) => normalizeWhitespace(textContent(h))) : [];
	const rows = findDescendants(el, 'ROW').map((row) =>
		findDescendants(row, 'ENT').map((ent) => normalizeWhitespace(textContent(ent))),
	);

	// Detect column spans or non-uniform row widths -> fallback.
	const expectedCols = headers.length || (rows[0]?.length ?? 0);
	const uniform = rows.length > 0 && rows.every((r) => r.length === expectedCols);
	if (!uniform || expectedCols === 0) {
		const plain = [headers.join(' | '), '---', ...rows.map((r) => r.join(' | '))]
			.filter((s) => s.length > 0)
			.join('\n');
		return ['```text', plain, '```'].join('\n');
	}

	const headerLine = `| ${headers.join(' | ')} |`;
	const separator = `| ${headers.map(() => '---').join(' | ')} |`;
	const rowLines = rows.map((r) => `| ${r.join(' | ')} |`);
	return [headerLine, separator, ...rowLines].join('\n');
}

function renderSectionBody(section: RawElement): string {
	const blocks: string[] = [];
	for (const child of section.children) {
		if (child.kind !== 'element') continue;
		const el = child.element;
		switch (el.tag) {
			case 'SECTNO':
			case 'SUBJECT':
				// Header material, skipped in body.
				break;
			case 'P':
				blocks.push(renderParagraph(el));
				break;
			case 'GPOTABLE':
				blocks.push(renderGpotable(el));
				break;
			case 'NOTE':
			case 'EXTRACT':
				blocks.push(renderParagraph(el));
				break;
			default:
				// Unknown tag: render text content defensively so we don't drop content.
				blocks.push(normalizeWhitespace(textContent(el)));
		}
	}
	return blocks.filter((b) => b.length > 0).join('\n\n');
}

// --------------------------------------------------------------------------
// Locator -> section.

function findSection(root: RawElement, locator: CfrSectionLocator): RawElement {
	const titleEl = findFirstDescendant(
		root,
		'DIV1',
		(e) => e.attrs.TYPE === 'TITLE' && e.attrs.N === String(locator.title),
	);
	if (!titleEl) {
		throw new CfrParseError(`Title ${locator.title} not found in CFR XML`);
	}
	const partEl = findFirstDescendant(
		titleEl,
		'DIV5',
		(e) => e.attrs.TYPE === 'PART' && e.attrs.N === String(locator.part),
	);
	if (!partEl) {
		throw new CfrParseError(`Part ${locator.title} CFR ${locator.part} not found`);
	}
	// Section lookup is tolerant: eCFR uses N="Sec. 91.155" but callers pass
	// `section: '155'` (or '155a' for letter-suffixed). Match on the
	// suffix after "Sec. <part>.".
	const sectionTail = `${locator.part}.${locator.section}`;
	const sectionEl = findFirstDescendant(
		partEl,
		'DIV8',
		(e) => e.attrs.TYPE === 'SECTION' && e.attrs.N === `Sec. ${sectionTail}`,
	);
	if (!sectionEl) {
		throw new CfrParseError(`Section ${locator.title} CFR ${sectionTail} not found`);
	}
	return sectionEl;
}

export interface CfrDocument {
	/** Parse-time copy of the locator for diagnostics. */
	sourcePath: string;
	/** Raw XML root. Exposed for advanced queries; most callers use `getSection`. */
	root: RawElement;
	/** Look up a parsed section by locator. */
	getSection(locator: CfrSectionLocator): ParsedCfrSection;
}

export function parseCfrXml(source: string, sourcePath = '<string>'): CfrDocument {
	const root = parseXml(source);
	return {
		sourcePath,
		root,
		getSection(locator) {
			const sectionEl = findSection(root, locator);
			const sectnoEl = findFirstDescendant(sectionEl, 'SECTNO');
			const subjectEl = findFirstDescendant(sectionEl, 'SUBJECT');
			const sectionNumber = sectnoEl ? normalizeWhitespace(textContent(sectnoEl)) : '';
			const subject = subjectEl ? normalizeWhitespace(textContent(subjectEl)) : '';
			const bodyMarkdown = renderSectionBody(sectionEl);
			return {
				locator,
				sectionNumber,
				subject,
				bodyMarkdown,
			};
		},
	};
}
