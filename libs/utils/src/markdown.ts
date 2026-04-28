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
	if (url.startsWith('/handbooks/')) return `/handbook-asset/${url.slice('/handbooks/'.length)}`;
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
