<script lang="ts" module>
export type DividerOrientation = 'horizontal' | 'vertical';
</script>

<script lang="ts">
/**
 * Semantic divider. Horizontal (default) or vertical; optional `inset`
 * prop pulls the line away from container edges for list separators.
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

const aria = $derived(orientation === 'vertical' ? 'vertical' : 'horizontal');
</script>

<div
	class="div o-{orientation}"
	class:inset
	role="separator"
	aria-orientation={aria}
	aria-label={ariaLabel}
></div>

<style>
	.div {
		background: var(--edge-default);
		flex-shrink: 0;
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
