<script lang="ts">
import type { Snippet } from 'svelte';
import type { AppearanceMode, ThemeId } from './contract';
import { DEFAULT_APPEARANCE, DEFAULT_THEME } from './resolve';

/**
 * Sets `data-theme`, `data-appearance`, and `data-layout` on a wrapper
 * div. Descendants pick up the tokens scoped under
 * `[data-theme='...'][data-appearance='...']` in the generated tokens
 * CSS.
 *
 * The wrapper uses `display: contents` so it doesn't participate in
 * layout -- only the data attributes are meaningful. To paint a
 * surface (background, padding, borders) wrap children in a `Card`
 * or `PanelShell`.
 *
 * Nest providers freely: an inner `data-theme` overrides the outer for
 * its subtree. The `(app)/+layout.svelte` puts this inside `<main>` so
 * the nav stays on the outer theme while the main content can switch
 * to flightdeck on `/dashboard`.
 */

let {
	theme = DEFAULT_THEME,
	appearance = DEFAULT_APPEARANCE,
	layout = 'reading',
	children,
}: {
	theme?: ThemeId;
	appearance?: AppearanceMode;
	layout?: string;
	children: Snippet;
} = $props();
</script>

<div
	data-theme={theme}
	data-appearance={appearance}
	data-layout={layout}
	data-testid="themeprovider-root"
	class="ab-theme"
>
	{@render children()}
</div>

<style>
	.ab-theme {
		display: contents;
	}
</style>
