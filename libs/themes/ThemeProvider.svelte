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
 * The wrapper uses `display: contents` so it does not participate in
 * layout; only `data-theme` is meaningful. Token values cascade to
 * descendants via CSS custom-property inheritance and via
 * `[data-theme='x'] *` selectors in `tokens.css`. If you need a paint
 * surface (background, border, padding), wrap children in a `Card` or
 * `PanelShell` primitive -- do not style this wrapper; `display: contents`
 * drops it from the box tree.
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
