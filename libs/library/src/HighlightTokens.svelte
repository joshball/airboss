<script lang="ts" module>
import type { Snippet } from 'svelte';

/**
 * `<HighlightTokens>` -- emits the eight `--highlight-*` CSS variables on
 * a wrapper `<div>` so the rich-reader's SelectionToolbar + AnnotationLayer
 * can paint highlight overlays via tokens (theme-lint approved) instead of
 * inline OKLCH literals.
 *
 * Mirrors `<ReadableScope>`: a thin wrapper that lifts a small per-feature
 * theme contribution onto the cascade. The values themselves live here as
 * lightweight constants -- a future ADR can promote them into the full
 * theme contract if a theme needs to override them.
 *
 * The `swatch` is the opaque chip used in the picker; the `wash` is the
 * semi-transparent paint applied over the body. Wash uses a low alpha so
 * the body text underneath stays readable. Hue / lightness chosen for
 * visibility against both light and dark themes.
 */

export interface HighlightTokensProps {
	readonly children: Snippet;
}
</script>

<script lang="ts">
let { children }: HighlightTokensProps = $props();

const TOKENS = {
	yellow: 'oklch(0.92 0.14 95 / 0.85)',
	yellowWash: 'oklch(0.92 0.14 95 / 0.4)',
	blue: 'oklch(0.85 0.13 230 / 0.85)',
	blueWash: 'oklch(0.85 0.13 230 / 0.35)',
	green: 'oklch(0.85 0.14 145 / 0.85)',
	greenWash: 'oklch(0.85 0.14 145 / 0.35)',
	pink: 'oklch(0.85 0.14 350 / 0.85)',
	pinkWash: 'oklch(0.85 0.14 350 / 0.35)',
} as const;
</script>

<div
	class="highlight-scope"
	style:--highlight-yellow={TOKENS.yellow}
	style:--highlight-yellow-wash={TOKENS.yellowWash}
	style:--highlight-blue={TOKENS.blue}
	style:--highlight-blue-wash={TOKENS.blueWash}
	style:--highlight-green={TOKENS.green}
	style:--highlight-green-wash={TOKENS.greenWash}
	style:--highlight-pink={TOKENS.pink}
	style:--highlight-pink-wash={TOKENS.pinkWash}
>
	{@render children()}
</div>

<style>
	.highlight-scope {
		display: contents;
	}
</style>
