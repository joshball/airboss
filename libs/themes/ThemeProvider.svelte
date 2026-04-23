<script lang="ts">
import type { Snippet } from 'svelte';
import type { AppearanceMode, ThemeId } from './contract';
import { DEFAULT_THEME_ID } from './resolve';

/**
 * Sets `data-theme`, `data-appearance`, and optionally `data-layout` on a
 * wrapper that uses `display: contents` so it doesn't participate in layout.
 * Descendants inherit tokens via CSS custom-property cascade and via
 * `[data-theme='<id>']` selectors in the emitted tokens stylesheet.
 *
 * Nest providers freely -- the inner attributes override the outer for its
 * subtree. Study's `(app)` layout places the provider *inside* `<main>` so
 * chrome (nav, identity menu) stays on the base theme while the active
 * surface re-skins the content area.
 */

let {
	theme = DEFAULT_THEME_ID,
	appearance = 'light',
	layout,
	children,
}: {
	theme?: ThemeId;
	appearance?: AppearanceMode;
	layout?: string;
	children: Snippet;
} = $props();
</script>

<div data-theme={theme} data-appearance={appearance} data-layout={layout} class="ab-theme">
	{@render children()}
</div>

<style>
	.ab-theme {
		display: contents;
	}
</style>
