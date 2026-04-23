/**
 * Shiki-backed code highlighter for the help-library renderer.
 *
 * SSR strategy: the `parseMarkdown` entry point is async and runs during
 * server-side load (`+page.ts` SvelteKit universal load runs server-side
 * on first request). Each code block in the resulting AST carries a
 * pre-rendered `highlighted` HTML string, which the MarkdownBody component
 * renders via `{@html}`. Client-side navigation re-invokes `+page.ts`,
 * which again runs Shiki -- the dynamic import caches in-module, so repeat
 * renders within a session avoid re-downloading the WASM grammar.
 *
 * Shiki's WASM + grammar JSON are lazy-loaded (dynamic `import('shiki')`)
 * so a page with no fenced code blocks never pulls the highlighter into
 * the server module graph on the synchronous path.
 */

import { escapeHtml } from '@ab/utils';

export const SHIKI_THEME = 'github-light';

export const SUPPORTED_LANGS = ['typescript', 'svelte', 'sql', 'bash', 'json', 'text'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const SUPPORTED_LANG_SET = new Set<string>(SUPPORTED_LANGS);

// Lazy singleton. `createHighlighter` returns a Promise<Highlighter>.
// Keep the import local so non-highlighting renders never touch shiki.
interface ShikiHighlighter {
	codeToHtml(code: string, options: { lang: string; theme: string }): string;
}

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

async function getHighlighter(): Promise<ShikiHighlighter> {
	if (highlighterPromise !== null) return highlighterPromise;
	highlighterPromise = (async () => {
		const shiki = await import('shiki');
		// Omit the passthrough `text` lang -- Shiki doesn't load it as a real grammar.
		const realLangs = SUPPORTED_LANGS.filter((l) => l !== 'text');
		const h = await shiki.createHighlighter({
			themes: [SHIKI_THEME],
			langs: realLangs,
		});
		return h as ShikiHighlighter;
	})();
	return highlighterPromise;
}

/**
 * Render a code block to syntax-highlighted HTML. Unknown languages and
 * the `text` passthrough produce a plain escaped `<pre><code>` block.
 */
export async function highlight(code: string, lang: string): Promise<string> {
	if (lang === 'text' || lang === '' || !SUPPORTED_LANG_SET.has(lang)) {
		return `<pre class="md-code md-code-plain"><code>${escapeHtml(code)}</code></pre>`;
	}
	const h = await getHighlighter();
	return h.codeToHtml(code, { lang, theme: SHIKI_THEME });
}
