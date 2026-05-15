import { ROUTES } from '@ab/constants';

/**
 * Minimal, safe markdown-to-HTML renderer for knowledge-graph phase bodies.
 *
 * Deliberately small: knowledge nodes author well-formed markdown with a known
 * vocabulary (paragraphs, headings H3-H4, lists, inline code, bold/italic,
 * links, fenced code blocks) and we want zero third-party surface area before
 * the renderer is locked in. All text is HTML-escaped; no raw HTML passthrough.
 *
 * Not goals:
 * - CommonMark completeness (no tables, reference links, setext headings, HR)
 * - Syntax highlighting (fenced code blocks render as `<pre><code>` verbatim)
 * - Auto-linking (explicit `[text](url)` is the only supported link form)
 *
 * The deliberate limitation keeps the surface area small. When authors need
 * features that aren't supported, the right move is to extend this renderer
 * with tests, not to add a dependency.
 */

const HTML_ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

export function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/**
 * Escape a value for safe interpolation inside a double-quoted HTML attribute.
 * Mirrors the helper in libs/sources/src/render/modes/web.ts; kept local so
 * this BC-free renderer doesn't need a cross-lib import. The protocol allow-list
 * already filters `javascript:` etc.; this layer ensures a URL containing `"`
 * cannot break out of the `href=`/`src=` attribute and inject an event handler.
 */
function escapeAttr(s: string): string {
	return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

// Inline replacements are applied in order, each on an already-html-escaped
// string. We keep the set intentionally small.
function renderInline(text: string): string {
	let out = escapeHtml(text);
	// Inline code: `code` -> <code>code</code>
	out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
	// Bold: **text** -> <strong>text</strong>
	out = out.replace(/\*\*([^*]+)\*\*/g, (_m, inner: string) => `<strong>${inner}</strong>`);
	// Italic: *text* -> <em>text</em> (run after bold so stars are gone)
	out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, lead: string, inner: string) => `${lead}<em>${inner}</em>`);
	// Links: [text](url) -> <a href="url">text</a>. Only http(s) and relative.
	// Negative lookbehind on `!` so image syntax is left for a dedicated pass.
	out = out.replace(/(^|[^!])\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, lead: string, label: string, url: string) => {
		const safe = /^(https?:\/\/|\/|#|mailto:)/.test(url) ? url : '#';
		return `${lead}<a href="${escapeAttr(safe)}">${label}</a>`;
	});
	return out;
}

/**
 * Rewrite `/handbooks/<rest>` to `/handbook-asset/<rest>`. The handbook
 * markdown corpus stores asset references with the repo-relative `/handbooks/`
 * prefix; runtime delivery routes through the streaming endpoint at
 * `/handbook-asset/[...path]`. Other URLs pass through unchanged.
 */
function rewriteHandbookAssetUrl(url: string): string {
	if (url.startsWith('/handbooks/')) return ROUTES.HANDBOOK_ASSET(url.slice('/handbooks/'.length));
	return url;
}

/**
 * Extract every image URL referenced via markdown `![alt](url)` syntax.
 *
 * Used by the handbook reader to dedup the manifest's figure list against
 * figures already rendered inline in the section body. URLs are returned
 * exactly as authored (no `/handbooks/` -> `/handbook-asset/` rewriting), so
 * callers can match against either canonical form by passing both through
 * `normalizeHandbookAssetPath`.
 */
export function extractImageUrls(md: string): string[] {
	const urls: string[] = [];
	const re = /!\[[\s\S]*?\]\(([^)\s]+)\)/g;
	let match: RegExpExecArray | null = re.exec(md);
	while (match !== null) {
		if (match[1]) urls.push(match[1]);
		match = re.exec(md);
	}
	return urls;
}

/**
 * Find a `Figure X-Y` reference in a chunk of text and return the ordinal as
 * a normalised string. Matches `Figure 2-5`, `Figure 12-3` (handbook style),
 * and `Figure 2-5.` / `Figure 2-5,` (with trailing punctuation). Returns the
 * ordinal piece (`2-5`) or `null` when no figure reference is present.
 *
 * Lifted out of `RenderedSection` so the regex is one-place-only and easy to
 * unit test against new handbook section bodies as they're ingested.
 */
const FIGURE_REF_RE = /Figure\s+(\d+(?:-\d+)?(?:\.[A-Z])?)/g;
export function findFigureReferences(text: string): readonly string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	const re = new RegExp(FIGURE_REF_RE.source, 'g');
	let match: RegExpExecArray | null = re.exec(text);
	while (match !== null) {
		const ord = match[1];
		if (ord !== undefined && !seen.has(ord)) {
			seen.add(ord);
			out.push(ord);
		}
		match = re.exec(text);
	}
	return out;
}

/**
 * Inject `![caption](assetPath)` blocks into the body markdown at the first
 * paragraph that references each figure. The renderer already converts block
 * image syntax to `<figure>`, so injection is a simple string splice rather
 * than HTML manipulation.
 *
 * Algorithm:
 *
 * 1. Split body into paragraph blocks (blank-line separated).
 * 2. For each paragraph, find any `Figure X-Y` references the figures map
 *    knows about. Append the corresponding `![caption](path)` blocks after
 *    the paragraph's blank-line break.
 * 3. Each figure is injected at most once, even if the section's prose
 *    references it multiple times. A figure that isn't referenced anywhere
 *    in the body is left for the caller to render at the bottom.
 *
 * Returns:
 *   - `body`: the markdown with inline image blocks spliced in at first ref.
 *   - `injected`: ordinal-keyed set of figures injected into the body.
 *
 * Whether to render unused figures at the bottom is the caller's call -- this
 * helper just picks up the first-reference work.
 */
export function injectFigureRefs(
	body: string,
	figuresByOrdinal: ReadonlyMap<string, { caption: string; assetPath: string }>,
): { body: string; injected: ReadonlySet<string> } {
	if (figuresByOrdinal.size === 0) return { body, injected: new Set() };

	const paragraphs = body.split(/\n{2,}/);
	const injected = new Set<string>();
	const out: string[] = [];

	for (const para of paragraphs) {
		out.push(para);
		const ords = findFigureReferences(para);
		for (const ord of ords) {
			if (injected.has(ord)) continue;
			const fig = figuresByOrdinal.get(ord);
			if (fig === undefined) continue;
			injected.add(ord);
			// Reserve a path prefix the asset streamer recognises -- if the figure's
			// `assetPath` already starts with `handbooks/` (the seed convention), we
			// preserve the absolute leading slash by ensuring exactly one. Otherwise
			// we pass the path through unchanged for the caller's URL rewriter.
			const url = fig.assetPath.startsWith('/') ? fig.assetPath : `/${fig.assetPath}`;
			out.push(`![${fig.caption.replace(/[\r\n]+/g, ' ').trim()}](${url})`);
		}
	}

	return { body: out.join('\n\n'), injected };
}

/**
 * One parsed `key: value` entry from a leading YAML frontmatter block. The
 * order of the array preserves the operator's authoring order so the metadata
 * disclosure UI can render the keys exactly as written.
 */
export interface FrontmatterEntry {
	readonly key: string;
	readonly value: string;
}

/**
 * Result of `parseFrontmatter`. `entries` is the parsed key-value pairs in
 * source order (empty when no frontmatter was present or parsing failed);
 * `body` is the markdown after the closing `---` fence.
 *
 * Parsing is deliberately permissive: this is not a full YAML implementation.
 * Handbook section frontmatter is flat `key: value` pairs (strings, numbers,
 * URLs, hyphenated FAA page tokens). Anything more complex (lists, nested
 * objects, multi-line scalars) is treated as malformed and the entry is
 * skipped. If no entries can be extracted from a fenced block, the helper
 * falls back to "no frontmatter found" and the body is left unchanged.
 */
export interface ParsedFrontmatter {
	readonly entries: ReadonlyArray<FrontmatterEntry>;
	readonly body: string;
}

/**
 * Parse a leading YAML frontmatter block (`---\n...\n---\n`) from a markdown
 * string. The handbook-section seed produces section bodies whose first lines
 * are a YAML metadata block describing the source PDF; the renderer needs the
 * block stripped from the body (so it doesn't leak as paragraph text) AND the
 * parsed contents available so a "Metadata" disclosure panel can surface the
 * operator-authored fields (`source_url`, `faa_pages`, etc.).
 *
 * No-op when the input does not start with `---` followed by a newline; never
 * strips anything past the first closing fence so a body that legitimately
 * starts with a horizontal rule (`---` on its own line followed by content
 * not framed as YAML) is left intact when there is no closing fence.
 *
 * Returns `{ entries: [], body: md }` for inputs without frontmatter or with
 * malformed frontmatter (e.g. unclosed fence, no parseable lines). The caller
 * uses an empty `entries` array as the signal to skip rendering the panel.
 */
export function parseFrontmatter(md: string): ParsedFrontmatter {
	if (!md.startsWith('---')) return { entries: [], body: md };
	// Require a newline after the opening fence so a body like `--- foo` is not
	// mistaken for frontmatter. The opening fence can be `---\n` or `---\r\n`.
	const afterOpen = md.charCodeAt(3);
	if (afterOpen !== 0x0a /* \n */ && afterOpen !== 0x0d /* \r */) return { entries: [], body: md };
	const end = md.indexOf('\n---', 3);
	if (end < 0) return { entries: [], body: md };
	// Slice past `\n---` and any trailing newline characters before the body.
	// Handles repeated LF or CRLF newlines (frontmatter-then-blank-line is the
	// canonical author-side shape).
	const body = md.slice(end + 4).replace(/^(?:\r?\n)+/, '');
	const inner = md.slice(4, end); // between the opening fence + opening newline and the `\n---` close
	const entries = parseFlatYamlEntries(inner);
	return { entries, body };
}

/**
 * Strip a leading YAML frontmatter block from a markdown string. Thin wrapper
 * around `parseFrontmatter` that discards the parsed entries; preserved for
 * call sites that only need the body (e.g. tests that pre-date the parser).
 */
export function stripFrontmatter(md: string): string {
	return parseFrontmatter(md).body;
}

/**
 * Parse a flat YAML key-value block. Handles:
 *
 *   - `key: value` (whitespace around the colon trimmed)
 *   - quoted values (`key: "value"`, `key: 'value'`) -- quotes stripped
 *   - empty values (`key:` -> empty string)
 *   - URLs and hyphenated values (split on the FIRST colon, not every colon)
 *
 * Lines that don't match the `^\s*[A-Za-z0-9_-]+\s*:` shape are skipped (so
 * comments, blank lines, and YAML directives don't break parsing). Repeated
 * keys: last write wins for the value, but order is preserved at first
 * occurrence (matches YAML's typical interpretation closely enough for the
 * operator-authored frontmatter we render).
 */
function parseFlatYamlEntries(block: string): ReadonlyArray<FrontmatterEntry> {
	const entries: FrontmatterEntry[] = [];
	const indexByKey = new Map<string, number>();
	for (const rawLine of block.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('#')) continue;
		const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
		if (!match) continue;
		const key = match[1] ?? '';
		const rawValue = (match[2] ?? '').trim();
		if (key === '') continue;
		const value = stripYamlScalarQuotes(rawValue);
		const existing = indexByKey.get(key);
		if (existing !== undefined) {
			entries[existing] = { key, value };
		} else {
			indexByKey.set(key, entries.length);
			entries.push({ key, value });
		}
	}
	return entries;
}

function stripYamlScalarQuotes(value: string): string {
	if (value.length >= 2) {
		const first = value.charAt(0);
		const last = value.charAt(value.length - 1);
		if (first === '"' && last === '"') {
			return value.slice(1, -1);
		}
		if (first === "'" && last === "'") {
			// YAML single-quote escape: doubled single quote -> literal apostrophe.
			return value.slice(1, -1).replace(/''/g, "'");
		}
	}
	return value;
}

/**
 * Pure-string transform: rewrite the value of one frontmatter field, or add
 * the field if missing. Preserves all other frontmatter lines and the body
 * verbatim. If the source has no frontmatter block, prepends one with the
 * single key.
 *
 * Quoting policy: values that contain a colon, are bare YAML keywords
 * (`true`, `false`, `null`, `yes`, `no`), look numeric, or start with whitespace
 * are wrapped in single quotes; everything else is written bare. Single quotes
 * inside the value are doubled per YAML's single-quote escape rule. Values are
 * normalised to never carry a leading or trailing newline; pass `\n` literals
 * via a multi-line scalar (out of scope -- this helper is for short scalars).
 *
 * Round-trips: `parseFrontmatter(setFrontmatterField(md, k, v)).entries` always
 * contains `(k, v)`.
 */
export function setFrontmatterField(md: string, field: string, value: string): string {
	if (!isValidFrontmatterKey(field)) {
		throw new Error(`setFrontmatterField: invalid key '${field}'. Keys must match /^[A-Za-z0-9_-]+$/.`);
	}
	const formatted = `${field}: ${formatYamlScalarValue(value)}`;
	// Detect dominant EOL of the input so a CRLF-authored file stays CRLF
	// after rewrite. Mixed-EOL files (CRLF in the body, LF in the
	// frontmatter) are rare; we prefer CRLF when any CRLF appears so the
	// dominant convention wins.
	const eol = md.includes('\r\n') ? '\r\n' : '\n';
	// No leading frontmatter at all -> prepend a fresh block.
	if (!md.startsWith('---') || (md.charCodeAt(3) !== 0x0a && md.charCodeAt(3) !== 0x0d)) {
		return `---${eol}${formatted}${eol}---${eol}${eol}${md}`;
	}
	const end = md.indexOf('\n---', 3);
	if (end < 0) {
		// Malformed (no closing fence). Treat as no frontmatter; prepend one.
		return `---${eol}${formatted}${eol}---${eol}${eol}${md}`;
	}
	const head = md.slice(0, end + 1); // up to and including the `\n` before the closing `---`
	const tail = md.slice(end + 1); // `---\n...rest...`
	// Split on \r?\n so CRLF lines drop the trailing \r in `lines`. We then
	// rejoin with the detected EOL so the rewritten / inserted line and the
	// preserved lines all share one convention.
	const lines = head.split(/\r?\n/);
	// `lines[0]` is the opening `---`; `lines[lines.length - 1]` is empty (the trailing
	// newline of `head`). Walk the inner lines, find every occurrence of the key,
	// rewrite the first and drop the rest -- duplicates would otherwise let
	// `parseFrontmatter`'s "last write wins" rule mask the rewrite.
	const keyPattern = new RegExp(`^\\s*${escapeRegExp(field)}\\s*:`);
	let replaced = false;
	for (let i = 1; i < lines.length - 1; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		if (!keyPattern.test(line)) continue;
		if (!replaced) {
			lines[i] = formatted;
			replaced = true;
		} else {
			// Drop the duplicate so the post-condition `parseFrontmatter(...)
			// .entries` always contains exactly one (key, value).
			lines.splice(i, 1);
			i -= 1;
		}
	}
	if (!replaced) {
		// Append before the closing fence.
		lines.splice(lines.length - 1, 0, formatted);
	}
	return lines.join(eol) + tail;
}

/**
 * Pure-string batch variant of `setFrontmatterField`. Applies updates in
 * insertion order; the last write to a key wins.
 */
export function setFrontmatterFields(md: string, updates: Readonly<Record<string, string>>): string {
	let out = md;
	for (const [key, value] of Object.entries(updates)) {
		out = setFrontmatterField(out, key, value);
	}
	return out;
}

function isValidFrontmatterKey(key: string): boolean {
	return /^[A-Za-z0-9_-]+$/.test(key);
}

const YAML_RESERVED_BARE_VALUES: ReadonlySet<string> = new Set([
	'true',
	'false',
	'null',
	'yes',
	'no',
	'~',
	'',
	'True',
	'False',
	'Null',
	'Yes',
	'No',
	'TRUE',
	'FALSE',
	'NULL',
	'YES',
	'NO',
]);

/**
 * YAML 1.1 / 1.2 treats these characters as reserved when they appear at the
 * START of a value: alias (`*`), anchor (`&`), tag (`!`), reserved (`@`),
 * directive (`%`), folded (`>`), literal (`|`), flow (`[`/`]`/`{`/`}`/`,`),
 * and the comment (`#`) marker is also unsafe in mid-value (already covered
 * by the `includes('#')` rule). Quote them to keep external YAML parsers
 * (gray-matter, js-yaml, IDE frontmatter linters) happy.
 */
const YAML_RESERVED_LEADING_CHAR = /^[*&!@`%>|[\]{},]/;

function formatYamlScalarValue(value: string): string {
	const needsQuote =
		value === '' ||
		value !== value.trim() ||
		value.includes(':') ||
		value.includes('#') ||
		value.includes('\n') ||
		value.includes("'") ||
		value.includes('"') ||
		YAML_RESERVED_BARE_VALUES.has(value) ||
		YAML_RESERVED_LEADING_CHAR.test(value) ||
		/^-?\d+(\.\d+)?$/.test(value);
	if (!needsQuote) return value;
	// Single-quote the value; double internal single quotes (YAML escape).
	return `'${value.replace(/'/g, "''")}'`;
}

function escapeRegExp(literal: string): string {
	return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Drop the body's leading H1 line when it duplicates the section title. The
 * section-render path emits the title in a `<h1>` from the page title field;
 * if the body's first non-blank line is also a top-level heading naming the
 * same thing, the page renders the title twice. This helper removes that one
 * duplicate, preserving any subsequent H1s and all other heading levels.
 *
 * Match is case-insensitive and whitespace-normalised so cosmetic differences
 * (extra spaces, capitalised vs title-case) still dedupe.
 */
export function dedupeFirstHeading(md: string, title: string): string {
	const lines = md.split('\n');
	let i = 0;
	while (i < lines.length && lines[i]?.trim() === '') i++;
	const leadingBlanks = i;
	const firstLine = lines[i];
	if (firstLine === undefined) return md;
	const headingMatch = firstLine.match(/^#\s+(.*)$/);
	if (!headingMatch) return md;
	const headingText = (headingMatch[1] ?? '').trim();
	if (normalizeHeading(headingText) !== normalizeHeading(title)) return md;
	// Drop the heading line, the optional blank line beneath it, and the
	// leading blank lines that preceded the heading -- both sides of the
	// duplicate heading are visual noise once the heading is gone.
	lines.splice(i, 1);
	if (lines[i]?.trim() === '') lines.splice(i, 1);
	if (leadingBlanks > 0) lines.splice(0, leadingBlanks);
	return lines.join('\n');
}

function normalizeHeading(s: string): string {
	return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Normalize a handbook asset path to a comparable canonical form by stripping
 * the optional leading `/handbooks/`, `handbooks/`, `/handbook-asset/`, or
 * `handbook-asset/` prefix. The resulting path is asset-relative and stable
 * across both the markdown corpus convention and the runtime serving route.
 */
export function normalizeHandbookAssetPath(path: string): string {
	const trimmed = path.replace(/^\/+/, '');
	if (trimmed.startsWith('handbooks/')) return trimmed.slice('handbooks/'.length);
	if (trimmed.startsWith('handbook-asset/')) return trimmed.slice('handbook-asset/'.length);
	return trimmed;
}

// ---------------------------------------------------------------------------
// Allow-listed inline HTML (tables, captions, etc.) inside section bodies.
// ---------------------------------------------------------------------------

/**
 * Tag names that survive `sanitizeInlineHtml`. The handbook extractor authors a
 * `<div class="handbook-table">` wrapper around `<table>` blocks pulled from
 * the source PDF; we allow the table descendants plus the wrapper itself.
 *
 * `script`, `iframe`, `style`, `object`, `embed`, and event-handler attributes
 * are stripped. Anything else (links, images, generic divs not on the list)
 * is dropped wholesale rather than partially escaped, so the escape path is
 * narrow and easy to audit.
 */
const ALLOWED_HTML_TAGS = new Set([
	'div',
	'table',
	'thead',
	'tbody',
	'tfoot',
	'tr',
	'th',
	'td',
	'caption',
	'colgroup',
	'col',
]);

/**
 * Per-tag attribute allow-list. Only attributes safe to interpolate verbatim
 * (no URL handling, no event handlers) appear here. `class`, `data-*`, simple
 * geometry attributes for tables. `data-source` carries the path back to the
 * standalone table HTML file the extractor wrote alongside the section.
 */
const ALLOWED_HTML_ATTRS: Record<string, ReadonlyArray<string>> = {
	div: ['class', 'data-source'],
	table: ['class'],
	thead: [],
	tbody: [],
	tfoot: [],
	tr: [],
	th: ['colspan', 'rowspan', 'scope'],
	td: ['colspan', 'rowspan'],
	caption: [],
	colgroup: ['span'],
	col: ['span'],
};

/**
 * Rewrite the `data-source="/handbooks/<rest>"` attribute on `<div class="handbook-table">`
 * wrappers to `/handbook-asset/<rest>` so the "open original" link in the
 * caption resolves through the asset streamer rather than 404'ing on a
 * static path that doesn't exist on the runtime origin.
 */
const HANDBOOK_TABLE_DATA_SOURCE_RE = /\bdata-source\s*=\s*"([^"]+)"/i;
function rewriteDataSourceAttr(attrs: string): string {
	return attrs.replace(HANDBOOK_TABLE_DATA_SOURCE_RE, (_m, raw: string) => {
		const safe = rewriteHandbookAssetUrl(raw);
		return `data-source="${escapeAttr(safe)}"`;
	});
}

/**
 * Re-emit a single tag (open or close) honouring the allow-list. Returns the
 * empty string when the tag is not allowed; the surrounding text walker drops
 * the disallowed tag entirely (and continues consuming text inside, since this
 * is a small reader-only sanitiser, not a full DOM tree builder).
 *
 * Open tags retain only allow-listed attributes. Self-closing forms preserve
 * the trailing `/`. The matching tag-name pattern matches alphabetic-only
 * names so XML-namespaced tags (`<svg:foo>`) and exotic constructs cannot
 * sneak through. Comments and processing instructions are stripped.
 */
const TAG_OPEN_RE = /^<([a-z][a-z0-9]*)\b([^>]*?)(\/?)>$/i;
const TAG_CLOSE_RE = /^<\/([a-z][a-z0-9]*)\s*>$/i;
const ATTR_RE = /([a-z][a-z0-9-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;

function emitOpenTag(tag: string, attrs: string, selfClose: boolean): string {
	const lower = tag.toLowerCase();
	if (!ALLOWED_HTML_TAGS.has(lower)) return '';
	const allowedAttrs = ALLOWED_HTML_ATTRS[lower] ?? [];
	const rewritten = lower === 'div' ? rewriteDataSourceAttr(attrs) : attrs;
	const out: string[] = [];
	const re = new RegExp(ATTR_RE.source, 'gi');
	let match: RegExpExecArray | null = re.exec(rewritten);
	while (match !== null) {
		const name = (match[1] ?? '').toLowerCase();
		if (allowedAttrs.includes(name)) {
			const value = match[2] ?? match[3] ?? match[4] ?? '';
			out.push(`${name}="${escapeAttr(value)}"`);
		}
		match = re.exec(rewritten);
	}
	const attrPart = out.length === 0 ? '' : ` ${out.join(' ')}`;
	const closer = selfClose ? ' /' : '';
	return `<${lower}${attrPart}${closer}>`;
}

function emitCloseTag(tag: string): string {
	const lower = tag.toLowerCase();
	if (!ALLOWED_HTML_TAGS.has(lower)) return '';
	return `</${lower}>`;
}

/**
 * Tags that carry executable / styling payload. When we encounter one of these
 * we drop the open tag AND swallow everything up to its matching close tag,
 * so a `<script>alert(1)</script>` doesn't leave the inner script body on the
 * page as visible text.
 *
 * Deliberately a small set: anything else falls through to "drop the tag,
 * keep child text" which is the right call for generic disallowed structural
 * tags (e.g. a stray `<span>` inside a `<td>` should not eat the cell text).
 */
const SCRIPTLIKE_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template']);

/**
 * Sanitize a chunk of inline HTML by walking tag-by-tag and emitting only the
 * subset on the allow-list. Text outside tags is HTML-escaped so a stray `<`
 * inside a `<caption>` block doesn't break out of the surrounding markup.
 *
 * Deliberately tag-walk based, not a full HTML parser: the input is
 * extractor-authored from FAA tables, not arbitrary user content. Anything
 * exotic (CDATA, SGML comments with embedded `>`, doctype) gets stripped.
 *
 * `<script>` / `<style>` / `<iframe>` (etc.) are treated specially: the
 * matching close tag is found and the entire run between is discarded so the
 * inner payload doesn't surface as visible text.
 *
 * Used by `renderMarkdown` to pass `<div class="handbook-table">...</div>`
 * blocks through unchanged-modulo-allowlist while keeping the inline-image
 * and inline-text passes safe.
 */
export function sanitizeInlineHtml(html: string): string {
	const out: string[] = [];
	let i = 0;
	const len = html.length;
	while (i < len) {
		const lt = html.indexOf('<', i);
		if (lt < 0) {
			out.push(escapeHtml(html.slice(i)));
			break;
		}
		if (lt > i) out.push(escapeHtml(html.slice(i, lt)));
		// Strip HTML comments wholesale.
		if (html.startsWith('<!--', lt)) {
			const end = html.indexOf('-->', lt + 4);
			i = end < 0 ? len : end + 3;
			continue;
		}
		const gt = html.indexOf('>', lt);
		if (gt < 0) {
			// Stray `<` with no closing -- escape and bail.
			out.push(escapeHtml(html.slice(lt)));
			break;
		}
		const raw = html.slice(lt, gt + 1);
		const close = raw.match(TAG_CLOSE_RE);
		if (close?.[1]) {
			out.push(emitCloseTag(close[1]));
			i = gt + 1;
			continue;
		}
		const open = raw.match(TAG_OPEN_RE);
		if (open?.[1] !== undefined) {
			const tag = open[1].toLowerCase();
			const attrs = open[2] ?? '';
			const selfClose = (open[3] ?? '') === '/';
			// Script-like tags: discard the entire body up to the matching
			// close tag so the script body doesn't render as visible text.
			if (SCRIPTLIKE_TAGS.has(tag) && !selfClose) {
				const closeRe = new RegExp(`<\\/${tag}\\s*>`, 'i');
				const rest = html.slice(gt + 1);
				const closeMatch = rest.match(closeRe);
				if (closeMatch?.index !== undefined) {
					i = gt + 1 + closeMatch.index + closeMatch[0].length;
				} else {
					i = len;
				}
				continue;
			}
			out.push(emitOpenTag(tag, attrs, selfClose));
			i = gt + 1;
			continue;
		}
		// Unrecognised: drop the tag and continue past it.
		i = gt + 1;
	}
	return out.join('');
}

/**
 * Tags whose opening on a line marks the start of a block-level HTML chunk
 * inside section markdown. Used by `renderMarkdown` to peel the chunk out of
 * the markdown stream (so its inner contents aren't run through the inline
 * paragraph/list parsers) before sanitising it through `sanitizeInlineHtml`.
 *
 * Kept narrow on purpose: the handbook extractor only emits `<div class="handbook-table">`
 * wrappers and bare `<table>` siblings. Other block tags fall through to the
 * markdown paragraph path where their `<` characters are escaped as text.
 */
const HTML_BLOCK_OPENERS = ['div', 'table'] as const;

/**
 * Append a small "Open original" anchor inside each `<div class="handbook-table">`
 * wrapper, reading the wrapper's `data-source` attribute. The anchor lands
 * immediately before the closing `</div>` so the table renders first and the
 * link sits visually below it. When no caption / no data-source is present
 * (defensive: shouldn't happen for extractor-authored content), the input is
 * returned unchanged.
 *
 * Run AFTER `sanitizeInlineHtml`, which has already rewritten `data-source`
 * from `/handbooks/` to `/handbook-asset/`. The anchor uses the rewritten
 * URL directly so it streams the standalone HTML through the asset endpoint.
 */
function injectOpenOriginalLink(html: string): string {
	return html.replace(
		/<div\s+class="handbook-table"\s+data-source="([^"]+)"\s*>([\s\S]*?)<\/div>/gi,
		(_m, dataSource: string, inner: string) => {
			const safeHref = escapeAttr(dataSource);
			const link = `<a class="handbook-table-source" href="${safeHref}" target="_blank" rel="noopener noreferrer">Open original table</a>`;
			return `<div class="handbook-table" data-source="${safeHref}">${inner}${link}</div>`;
		},
	);
}

/**
 * One handbook-table block found in a section body: the original asset path
 * the extractor wrote (via `data-source` on the wrapper), plus the wrapper's
 * caption (when present) so a "table N" hint can render alongside the
 * "open original" link in the RenderedSection.
 */
export interface HandbookTableLink {
	readonly assetPath: string;
	readonly caption: string;
}

/**
 * Extract every `data-source` attribute from `<div class="handbook-table">`
 * wrappers in a markdown body. Used by the section reader to surface "open
 * original" links pointing at the standalone HTML the extractor wrote
 * alongside the section markdown. Returns an empty array when no wrapper is
 * present.
 *
 * Two-pass: locate each wrapper open + matching close, then probe the inner
 * span for an optional `<caption>...</caption>`. Splitting the lookups avoids
 * the regex-with-optional-capture pitfall where a lazy outer match prefers
 * to skip the optional caption group entirely, leaving the caption empty
 * even though the source HTML carries one.
 */
const HANDBOOK_TABLE_OPEN_RE = /<div\s+class\s*=\s*"handbook-table"[^>]*\bdata-source\s*=\s*"([^"]+)"[^>]*>/gi;
const HANDBOOK_TABLE_CAPTION_RE = /<caption\b[^>]*>([\s\S]*?)<\/caption>/i;
export function extractHandbookTableLinks(md: string): readonly HandbookTableLink[] {
	const out: HandbookTableLink[] = [];
	const re = new RegExp(HANDBOOK_TABLE_OPEN_RE.source, 'gi');
	let match: RegExpExecArray | null = re.exec(md);
	while (match !== null) {
		const assetPath = match[1] ?? '';
		// Find the matching close `</div>` from the open tag's end position.
		// Tracks nested `<div>` opens defensively even though the extractor
		// authors a flat one-deep wrapper.
		const startInside = match.index + match[0].length;
		const closeIdx = findMatchingClose(md, startInside, 'div');
		const inside = closeIdx === -1 ? md.slice(startInside) : md.slice(startInside, closeIdx);
		const capMatch = inside.match(HANDBOOK_TABLE_CAPTION_RE);
		const captionRaw = (capMatch?.[1] ?? '').trim();
		const caption = captionRaw.replace(/\s+/g, ' ').slice(0, 200);
		if (assetPath !== '') out.push({ assetPath, caption });
		match = re.exec(md);
	}
	return out;
}

/**
 * Walk forward from `start` looking for the matching close tag for `tag`,
 * tracking nesting depth. Returns the index of the matching `</tag>` start,
 * or `-1` if no match is found before end of input.
 */
function findMatchingClose(s: string, start: number, tag: string): number {
	const re = new RegExp(`<(\\/?)${tag}\\b[^>]*>`, 'gi');
	re.lastIndex = start;
	let depth = 1;
	let m: RegExpExecArray | null = re.exec(s);
	while (m !== null) {
		const isClose = m[1] === '/';
		depth += isClose ? -1 : 1;
		if (depth === 0) return m.index;
		m = re.exec(s);
	}
	return -1;
}

/**
 * Options for `renderMarkdown`.
 *
 * - `minHeadingLevel` -- minimum HTML heading level for ATX headings. Default
 *   is `3` because the knowledge-graph phase pipeline reserves H1/H2 for
 *   upstream splitting. Surfaces that render whole files (the `/docs` browser)
 *   pass `1` so a top-level `# Title` becomes `<h1>` and the visual hierarchy
 *   is preserved.
 * - `headingIds` -- when `true`, emit GFM-style slug `id` attributes on every
 *   heading so intra-doc `[link](#section-anchor)` links resolve. Default is
 *   `true` (rendering whole-file docs is the dominant use case).
 */
export interface RenderMarkdownOptions {
	readonly minHeadingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
	readonly headingIds?: boolean;
}

/**
 * Slugify heading text using the GFM convention: lowercase, replace
 * non-alphanumerics with `-`, collapse runs, trim leading/trailing `-`.
 * Exported so tests / link rewriters can produce the same anchor a heading
 * gets.
 */
export function slugifyHeading(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/**
 * Convert markdown to HTML. Supports:
 * - ATX headings `#`-`######` (level floor controlled by `minHeadingLevel`)
 * - Paragraphs (blank-line separated)
 * - Unordered lists (`- `, `* `)
 * - Ordered lists (`1. `, `2. `, ...)
 * - GFM pipe tables (`| col | col |` + `| --- | --- |`)
 * - Fenced code blocks with ``` (language hint is attached as a class)
 * - Inline: code, bold, italic, links
 */
export function renderMarkdown(md: string, options: RenderMarkdownOptions = {}): string {
	const minHeadingLevel = options.minHeadingLevel ?? 3;
	const headingIds = options.headingIds ?? true;
	const lines = md.replace(/\r\n/g, '\n').split('\n');
	const html: string[] = [];
	let i = 0;

	type ListKind = 'ul' | 'ol';
	let openList: ListKind | null = null;
	let paragraph: string[] = [];

	const closeParagraph = (): void => {
		if (paragraph.length === 0) return;
		const text = paragraph.join(' ').trim();
		paragraph = [];
		if (text.length === 0) return;
		html.push(`<p>${renderInline(text)}</p>`);
	};

	const closeList = (): void => {
		if (openList === null) return;
		html.push(`</${openList}>`);
		openList = null;
	};

	// Block-level HTML chunk -- a line that opens with `<div ...>` or `<table ...>`
	// and whose closing tag appears on a later line. The whole span is pulled
	// out of the markdown stream and run through `sanitizeInlineHtml` so a
	// `<table>` block from the handbook extractor renders as a real table
	// instead of escaped text or an inert paragraph.
	//
	// Returns `null` when the line doesn't open a recognised block, or when
	// the opening tag's matching close isn't found before the end of input.
	// In the no-match case the caller falls back to the paragraph path, which
	// HTML-escapes the `<` so it renders as visible text -- safe by default.
	const tryHtmlBlock = (start: number): { html: string; consumed: number } | null => {
		const first = lines[start];
		if (first === undefined) return null;
		const openMatch = first.match(/^<([a-z][a-z0-9]*)\b/i);
		if (!openMatch) return null;
		const tag = (openMatch[1] ?? '').toLowerCase();
		if (!HTML_BLOCK_OPENERS.includes(tag as (typeof HTML_BLOCK_OPENERS)[number])) return null;
		// Walk line-by-line, tracking nesting depth on the same tag name. A
		// `<table>` inside a `<div class="handbook-table">` increments depth on
		// the div line and decrements on the matching `</div>` only; nested
		// occurrences of the same tag are rare in extractor output but safer to
		// support than not.
		const openRe = new RegExp(`<${tag}\\b`, 'gi');
		const closeRe = new RegExp(`</${tag}\\s*>`, 'gi');
		let depth = 0;
		let cursor = start;
		const buffer: string[] = [];
		while (cursor < lines.length) {
			const ln = lines[cursor];
			buffer.push(ln);
			depth += (ln.match(openRe)?.length ?? 0) - (ln.match(closeRe)?.length ?? 0);
			if (depth <= 0 && cursor > start) {
				// Multi-line block closed -- include this line.
				const sanitized = sanitizeInlineHtml(buffer.join('\n'));
				return { html: injectOpenOriginalLink(sanitized), consumed: cursor - start + 1 };
			}
			if (depth <= 0 && cursor === start) {
				// Single-line block (`<table>...</table>` on one line). Only
				// honour it if there's actually a close on this line.
				if (closeRe.test(ln)) {
					const sanitized = sanitizeInlineHtml(buffer.join('\n'));
					return { html: injectOpenOriginalLink(sanitized), consumed: 1 };
				}
				// Otherwise depth could be 0 at the start because the open
				// regex didn't match the (already-confirmed) opener -- bump
				// depth to keep scanning forward.
				depth = 1;
			}
			cursor++;
		}
		// Unclosed block -- bail and let the paragraph path handle it.
		return null;
	};

	// GFM pipe table -- a header row, a separator row, then zero+ body rows.
	//
	//     | col1 | col2 |
	//     | ---- | ---- |
	//     | a    | b    |
	//
	// The separator row is what marks the block as a table (vs a stack of
	// pipe-bearing paragraphs). Cells split on `|` after stripping a leading /
	// trailing pipe; cell content is run through `renderInline` so `**bold**`
	// and `[links]()` inside cells work. Alignment is detected from the
	// separator row (`:--`, `--:`, `:-:`).
	const tryGfmTable = (start: number): { html: string; consumed: number } | null => {
		const headerLine = lines[start];
		if (headerLine === undefined || !headerLine.includes('|')) return null;
		const sepLine = lines[start + 1];
		if (sepLine === undefined) return null;
		const headerCells = parsePipeRow(headerLine);
		if (headerCells === null) return null;
		const sepSpec = parseSeparatorRow(sepLine, headerCells.length);
		if (sepSpec === null) return null;
		const bodyRows: string[][] = [];
		let cursor = start + 2;
		while (cursor < lines.length) {
			const ln = lines[cursor];
			if (ln === undefined) break;
			if (ln.trim() === '') break;
			const row = parsePipeRow(ln);
			if (row === null) break;
			bodyRows.push(row);
			cursor++;
		}
		const out: string[] = ['<table>', '<thead><tr>'];
		for (let c = 0; c < headerCells.length; c++) {
			const cell = headerCells[c] ?? '';
			const align = sepSpec[c];
			const styleAttr = align ? ` style="text-align: ${align};"` : '';
			out.push(`<th${styleAttr}>${renderInline(cell)}</th>`);
		}
		out.push('</tr></thead>');
		if (bodyRows.length > 0) out.push('<tbody>');
		for (const row of bodyRows) {
			out.push('<tr>');
			for (let c = 0; c < headerCells.length; c++) {
				const cell = row[c] ?? '';
				const align = sepSpec[c];
				const styleAttr = align ? ` style="text-align: ${align};"` : '';
				out.push(`<td${styleAttr}>${renderInline(cell)}</td>`);
			}
			out.push('</tr>');
		}
		if (bodyRows.length > 0) out.push('</tbody>');
		out.push('</table>');
		return { html: out.join(''), consumed: cursor - start };
	};

	// Block-level image markdown -- a line that begins with `![` and whose
	// `![alt](url)` token may continue across multiple soft-wrapped lines until
	// the closing `)`. Renders as a `<figure>` so it survives intact regardless
	// of the surrounding paragraph state and round-trips alt text into a
	// caption.
	const tryImageBlock = (start: number): { html: string; consumed: number } | null => {
		const first = lines[start];
		if (first === undefined || !first.startsWith('![')) return null;
		// Greedily collect lines until we close the `)` of the URL group.
		let buffer = first;
		let cursor = start;
		while (!/\]\([^)\s]+\)\s*$/.test(buffer.replace(/\s+$/, ''))) {
			cursor++;
			if (cursor >= lines.length) return null;
			buffer += `\n${lines[cursor]}`;
		}
		const match = buffer.match(/^!\[([\s\S]*?)\]\(([^)\s]+)\)\s*$/);
		if (!match) return null;
		const [, altRaw = '', urlRaw = ''] = match;
		const alt = altRaw.replace(/\s+/g, ' ').trim();
		const url = rewriteHandbookAssetUrl(urlRaw);
		const safeUrl = /^(https?:\/\/|\/|#)/.test(url) ? url : '#';
		const safeAttrUrl = escapeAttr(safeUrl);
		const safeAttrAlt = escapeAttr(alt);
		const safeAlt = escapeHtml(alt);
		const figure = `<figure class="md-figure"><img src="${safeAttrUrl}" alt="${safeAttrAlt}" loading="lazy" />${alt ? `<figcaption>${safeAlt}</figcaption>` : ''}</figure>`;
		return { html: figure, consumed: cursor - start + 1 };
	};

	while (i < lines.length) {
		const raw = lines[i];
		const line = raw.replace(/\s+$/, '');

		// Block-level HTML chunk: `<div class="handbook-table">...</div>` and
		// bare `<table>` blocks pass through `sanitizeInlineHtml` rather than
		// the markdown paragraph parser. Detected before the inline-image
		// pass because a div-wrapped table line begins with `<` and would
		// otherwise fall into the default paragraph branch.
		const htmlBlock = line.startsWith('<') ? tryHtmlBlock(i) : null;
		if (htmlBlock) {
			closeParagraph();
			closeList();
			html.push(htmlBlock.html);
			i += htmlBlock.consumed;
			continue;
		}

		// Block-level image: `![alt](url)` on its own line. Rendered as <figure>.
		const imgBlock = line.startsWith('![') ? tryImageBlock(i) : null;
		if (imgBlock) {
			closeParagraph();
			closeList();
			html.push(imgBlock.html);
			i += imgBlock.consumed;
			continue;
		}

		// GFM pipe table -- detect by looking ahead at the separator row.
		const tableBlock = line.includes('|') ? tryGfmTable(i) : null;
		if (tableBlock) {
			closeParagraph();
			closeList();
			html.push(tableBlock.html);
			i += tableBlock.consumed;
			continue;
		}

		// `:::cards` directive (and the historical ```yaml-cards fenced
		// block it replaces) -- data-only payload, never rendered.
		//
		// Cards surface via the spaced-repetition review queue, not inline
		// on the knowledge node. The seed orchestrator parses the YAML at
		// build time to materialise `study.card` rows; on the rendered
		// page we want the YAML to disappear so the prose around the
		// `## Practice` heading reads as authored.
		//
		// The richer `@ab/help` directive parser handles `:::cards`
		// alongside `:::chart` / `:::scenario` for course-step bodies;
		// this minimal renderer reproduces just the cards-strip behaviour
		// so the `/reference/knowledge/[slug]/learn/` page (which uses
		// `renderMarkdown` from `@ab/utils`) stays in sync.
		if (line === ':::cards' || line.startsWith(':::cards ')) {
			closeParagraph();
			closeList();
			i++;
			while (i < lines.length && !/^:::\s*$/.test(lines[i])) i++;
			if (i < lines.length) i++; // skip closing fence
			continue;
		}

		// `:::phase name="..."` directive -- structural wrapper around a
		// knowledge-node phase body. The phase title is rendered upstream
		// (the page emits a `<h3>` from `KNOWLEDGE_PHASE_LABELS` per
		// phase). For the minimal renderer the directive is invisible:
		// we drop the opener line and the matching closer, and let the
		// main loop continue rendering the body lines as ordinary
		// markdown. The richer `@ab/help` parser walks `:::phase` into a
		// nested AST; this renderer only sees a knowledge-node phase
		// body once the upstream splitter has already removed the
		// wrapper, so this branch is mostly defence in depth -- if a
		// caller renders an un-split body (e.g., docs browser stumbling
		// onto a knowledge node), the directive markers don't leak as
		// text.
		if (line === ':::phase' || line.startsWith(':::phase ')) {
			closeParagraph();
			closeList();
			i++;
			continue;
		}

		// Standalone `:::` closer. Bare `:::` on its own line is the
		// closer for an opened directive (callout / phase / cards).
		// `:::cards` consumes its own closer; the orphan-closer case
		// here covers `:::phase` (whose body we deliberately leave for
		// the main loop to render) plus defence in depth for any other
		// directive whose closer would otherwise emit as `<p>:::</p>`.
		if (/^:::\s*$/.test(line)) {
			closeParagraph();
			closeList();
			i++;
			continue;
		}

		// Fenced code block.
		const fenceOpen = line.match(/^```\s*([\w-]*)\s*$/);
		if (fenceOpen) {
			closeParagraph();
			closeList();
			const lang = fenceOpen[1] ?? '';
			// Historical `yaml-cards` fence stayed in the body during the
			// migration window; treat it identically to a `:::cards` block
			// and emit nothing. The `bun run check`-time guard
			// (`scripts/lint/check-no-yaml-cards-fences.ts`) prevents new
			// occurrences but the renderer stays safe if one slips back in.
			if (lang === 'yaml-cards') {
				i++;
				while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
				if (i < lines.length) i++;
				continue;
			}
			const body: string[] = [];
			i++;
			while (i < lines.length && !/^```\s*$/.test(lines[i])) {
				body.push(lines[i]);
				i++;
			}
			// Skip the closing fence if present; tolerate missing trailing fence.
			if (i < lines.length) i++;
			const escaped = escapeHtml(body.join('\n'));
			const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
			html.push(`<pre><code${cls}>${escaped}</code></pre>`);
			continue;
		}

		// Blank line closes paragraphs and lists.
		if (line.trim() === '') {
			closeParagraph();
			closeList();
			i++;
			continue;
		}

		// ATX headings. The `minHeadingLevel` option floors the emitted level;
		// the default of 3 matches the knowledge-graph phase pipeline (which
		// reserves H1/H2 for upstream splitting). The `/docs` browser passes
		// `1` so a top-level `# Title` becomes a real `<h1>`. Headings get
		// GFM-style slug `id` attributes when `headingIds` is true so
		// `[link](#section)` references inside the same doc resolve.
		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			closeParagraph();
			closeList();
			const text = heading[2].trim();
			const level = Math.max(minHeadingLevel, heading[1].length);
			const idAttr = headingIds ? ` id="${escapeAttr(slugifyHeading(text))}"` : '';
			html.push(`<h${level}${idAttr}>${renderInline(text)}</h${level}>`);
			i++;
			continue;
		}

		// Unordered list item.
		const ul = line.match(/^[-*]\s+(.*)$/);
		if (ul) {
			closeParagraph();
			if (openList !== 'ul') {
				closeList();
				html.push('<ul>');
				openList = 'ul';
			}
			html.push(`<li>${renderInline(ul[1])}</li>`);
			i++;
			continue;
		}

		// Ordered list item.
		const ol = line.match(/^\d+\.\s+(.*)$/);
		if (ol) {
			closeParagraph();
			if (openList !== 'ol') {
				closeList();
				html.push('<ol>');
				openList = 'ol';
			}
			html.push(`<li>${renderInline(ol[1])}</li>`);
			i++;
			continue;
		}

		// Default: paragraph line.
		closeList();
		paragraph.push(line);
		i++;
	}

	closeParagraph();
	closeList();
	return html.join('\n');
}

/**
 * Parse one pipe-table row into its cell-text array. Returns `null` when the
 * line has no pipes (i.e. is not a row). Leading and trailing pipes are
 * optional. Cells are trimmed; backslash-escaped pipes (`\|`) inside cell
 * content are preserved as a literal `|`.
 */
function parsePipeRow(line: string): string[] | null {
	const trimmed = line.trim();
	if (!trimmed.includes('|')) return null;
	// Strip a single leading and trailing pipe (with optional surrounding
	// whitespace) so the split below produces N cells, not N+2 with empties.
	const inner = trimmed.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
	if (inner === '') return null;
	const cells: string[] = [];
	let buf = '';
	for (let p = 0; p < inner.length; p++) {
		const ch = inner.charAt(p);
		if (ch === '\\' && inner.charAt(p + 1) === '|') {
			buf += '|';
			p += 1;
			continue;
		}
		if (ch === '|') {
			cells.push(buf.trim());
			buf = '';
			continue;
		}
		buf += ch;
	}
	cells.push(buf.trim());
	return cells;
}

/**
 * Parse a GFM table separator row into a per-column alignment array. Returns
 * `null` when the row is not a valid separator (wrong number of cells, or any
 * cell that doesn't match `^:?-+:?$`). Alignment is `'left'`, `'center'`, or
 * `'right'`, or `null` for unaligned columns.
 */
function parseSeparatorRow(line: string, expectedCols: number): Array<'left' | 'center' | 'right' | null> | null {
	const cells = parsePipeRow(line);
	if (cells === null || cells.length !== expectedCols) return null;
	const out: Array<'left' | 'center' | 'right' | null> = [];
	for (const cell of cells) {
		const trimmed = cell.trim();
		if (!/^:?-+:?$/.test(trimmed)) return null;
		const startsColon = trimmed.startsWith(':');
		const endsColon = trimmed.endsWith(':');
		if (startsColon && endsColon) out.push('center');
		else if (endsColon) out.push('right');
		else if (startsColon) out.push('left');
		else out.push(null);
	}
	return out;
}
