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
	out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
		const safe = /^(https?:\/\/|\/|#|mailto:)/.test(url) ? url : '#';
		return `<a href="${safe}">${label}</a>`;
	});
	return out;
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

	while (i < lines.length) {
		const raw = lines[i];
		const line = raw.replace(/\s+$/, '');

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
