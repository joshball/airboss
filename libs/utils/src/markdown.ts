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
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			return value.slice(1, -1);
		}
	}
	return value;
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

/**
 * Convert markdown to HTML. Supports:
 * - ATX headings `###`, `####` (H2 is reserved for phase splitting upstream)
 * - Paragraphs (blank-line separated)
 * - Unordered lists (`- `, `* `)
 * - Ordered lists (`1. `, `2. `, ...)
 * - Fenced code blocks with ``` (language hint is attached as a class)
 * - Inline: code, bold, italic, links
 */
export function renderMarkdown(md: string): string {
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

		// Block-level image: `![alt](url)` on its own line. Rendered as <figure>.
		const imgBlock = line.startsWith('![') ? tryImageBlock(i) : null;
		if (imgBlock) {
			closeParagraph();
			closeList();
			html.push(imgBlock.html);
			i += imgBlock.consumed;
			continue;
		}

		// Fenced code block.
		const fenceOpen = line.match(/^```\s*([\w-]*)\s*$/);
		if (fenceOpen) {
			closeParagraph();
			closeList();
			const lang = fenceOpen[1] ?? '';
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

		// ATX headings. H1/H2 belong to phase-splitting upstream; inside a phase
		// body we render H3/H4/H5/H6. A H1/H2 inside a body is demoted to H3
		// rather than silently dropped.
		const heading = line.match(/^(#{1,6})\s+(.*)$/);
		if (heading) {
			closeParagraph();
			closeList();
			const level = Math.max(3, heading[1].length);
			html.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
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
