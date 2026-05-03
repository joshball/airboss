<script lang="ts" module>
export type DividerOrientation = 'horizontal' | 'vertical';
</script>

<script lang="ts">
/**
 * Semantic divider. Horizontal (default) or vertical; optional `inset`
 * prop pulls the line away from container edges for list separators.
 *
 * Horizontal renders as a native `<hr>` so AT exposes the platform-default
 * separator semantics with no role attribute required. Vertical renders as
 * `<div role="separator">` because HTML's `<hr>` is hardcoded horizontal.
 */

let {
	orientation = 'horizontal',
	inset = false,
	ariaLabel,
}: {
	orientation?: DividerOrientation;
	inset?: boolean;
	ariaLabel?: string;
} = $props();
</script>

{#if orientation === 'horizontal'}
	<hr
		class="div o-horizontal"
		class:inset
		aria-label={ariaLabel}
		data-testid="divider-root"
		data-orientation="horizontal"
	/>
{:else}
	<div
		class="div o-vertical"
		class:inset
		role="separator"
		aria-orientation="vertical"
		aria-label={ariaLabel}
		data-testid="divider-root"
		data-orientation="vertical"
	></div>
{/if}

<style>
	.div {
		background: var(--edge-default);
		flex-shrink: 0;
	}

	hr.div {
		/* Reset the UA-default <hr> styling so visual rendering matches the
		   prior <div role="separator"> shape exactly. */
		border: 0;
		margin: 0;
		padding: 0;
	}

	.o-horizontal {
		height: 1px;
		width: 100%;
	}

	.o-vertical {
		width: 1px;
		height: 100%;
		align-self: stretch;
	}

	.o-horizontal.inset {
		margin: 0 var(--space-md);
		width: calc(100% - 2 * var(--space-md));
	}

	.o-vertical.inset {
		margin: var(--space-md) 0;
		height: calc(100% - 2 * var(--space-md));
	}
</style>
