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
 *
 * Dual-theme strategy: Shiki 4's `themes: { light, dark }` option with
 * `defaultColor: false` emits every span with both `--shiki-light` and
 * `--shiki-dark` CSS variables (plus `-bg` variants) and no hardcoded
 * `color` / `background-color`. `MarkdownBody.svelte` resolves those
 * variables to the appropriate palette scoped by the `data-appearance`
 * attribute the theme system already sets on `<html>` before first paint,
 * so code blocks swap in lockstep with the rest of the app and never
 * flash the wrong palette.
 */

import { escapeHtml } from '@ab/utils';

/** Shiki theme name for the light appearance. */
export const SHIKI_THEME_LIGHT = 'github-light';
/** Shiki theme name for the dark appearance. */
export const SHIKI_THEME_DARK = 'github-dark';

/**
 * Legacy export: the light theme name. Retained for code that read the
 * single-theme constant before dual-theme support landed.
 */
export const SHIKI_THEME = SHIKI_THEME_LIGHT;

export const SUPPORTED_LANGS = ['typescript', 'svelte', 'sql', 'bash', 'json', 'text'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

const SUPPORTED_LANG_SET = new Set<string>(SUPPORTED_LANGS);

// Lazy singleton. `createHighlighter` returns a Promise<Highlighter>.
// Keep the import local so non-highlighting renders never touch shiki.
interface ShikiHighlighter {
	codeToHtml(
		code: string,
		options: {
			lang: string;
			themes: { light: string; dark: string };
			defaultColor: false;
		},
	): string;
}

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

async function getHighlighter(): Promise<ShikiHighlighter> {
	if (highlighterPromise !== null) return highlighterPromise;
	highlighterPromise = (async () => {
		const shiki = await import('shiki');
		// Omit the passthrough `text` lang -- Shiki doesn't load it as a real grammar.
		const realLangs = SUPPORTED_LANGS.filter((l) => l !== 'text');
		const h = await shiki.createHighlighter({
			themes: [SHIKI_THEME_LIGHT, SHIKI_THEME_DARK],
			langs: realLangs,
		});
		return h as unknown as ShikiHighlighter;
	})();
	return highlighterPromise;
}

/**
 * Render a code block to syntax-highlighted HTML. Unknown languages and
 * the `text` passthrough produce a plain escaped `<pre><code>` block.
 *
 * The emitted HTML carries `--shiki-light` / `--shiki-dark` CSS variables
 * on every token; CSS in `MarkdownBody.svelte` picks the right one based
 * on the `data-appearance` attribute set by the theme system.
 */
export async function highlight(code: string, lang: string): Promise<string> {
	if (lang === 'text' || lang === '' || !SUPPORTED_LANG_SET.has(lang)) {
		return `<pre class="md-code md-code-plain"><code>${escapeHtml(code)}</code></pre>`;
	}
	const h = await getHighlighter();
	return h.codeToHtml(code, {
		lang,
		themes: { light: SHIKI_THEME_LIGHT, dark: SHIKI_THEME_DARK },
		defaultColor: false,
	});
}
