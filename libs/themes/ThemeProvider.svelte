<script lang="ts">
import type { Snippet } from 'svelte';
import { DEFAULT_THEME, type ThemeName } from './resolve';

/**
 * Sets `data-theme` on a wrapper div so descendant components pick up the
 * tokens scoped under `[data-theme='web'|'tui']` in `tokens.css`.
 *
 * Nest providers freely -- the inner `data-theme` overrides the outer for
 * its subtree. The (app) layout uses this to keep most routes on `web`
 * while wrapping `/dashboard` in a `tui` provider.
 *
 * The wrapper is a plain block-level div so token-scoped styles
 * (background, color, font-family applied to `[data-theme]` in tokens.css)
 * actually paint. The wrapper inherits sizing from its parent via `width:
 * 100%` so it doesn't accidentally collapse.
 */

let {
	theme = DEFAULT_THEME,
	children,
}: {
	theme?: ThemeName;
	children: Snippet;
} = $props();
</script>

<div data-theme={theme} class="ab-theme">
	{@render children()}
</div>

<style>
	.ab-theme {
		display: contents;
	}
</style>
