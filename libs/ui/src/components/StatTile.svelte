<script lang="ts" module>
export type StatTileTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Key / value tile for dashboard-style stat grids. Label on top, big
 * numeric-forward value in the middle, optional sub line for context.
 *
 * Pass `href` to make the whole tile a link -- the review flagged
 * non-clickable tiles as a UX smell, so the primitive makes "clickable"
 * the default expectation when a destination exists.
 */

let {
	label,
	value,
	sub,
	href,
	tone = 'neutral',
	ariaLabel,
	valueSnippet,
}: {
	label: string;
	value: string | number;
	sub?: string;
	href?: string;
	tone?: StatTileTone;
	ariaLabel?: string;
	valueSnippet?: Snippet;
} = $props();

const Tag = $derived(href ? 'a' : 'div');
</script>

<svelte:element
	this={Tag}
	class="tile t-{tone}"
	class:linked={href !== undefined}
	href={href}
	aria-label={ariaLabel}
>
	<span class="label">{label}</span>
	<span class="value">
		{#if valueSnippet}
			{@render valueSnippet()}
		{:else}
			{value}
		{/if}
	</span>
	{#if sub}
		<span class="sub">{sub}</span>
	{/if}
</svelte:element>

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-2xs);
		padding: var(--ab-space-sm) var(--ab-space-md);
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-sm);
		color: inherit;
		text-decoration: none;
		min-width: 0;
		transition:
			background var(--ab-transition-fast),
			border-color var(--ab-transition-fast);
	}

	.tile.linked {
		cursor: pointer;
	}

	.tile.linked:hover {
		background: var(--ab-color-surface-sunken);
		border-color: var(--ab-color-border-strong);
	}

	.tile.linked:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--ab-color-focus-ring);
	}

	.label {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-faint);
		text-transform: uppercase;
		letter-spacing: var(--ab-letter-spacing-caps);
		font-weight: var(--ab-font-weight-semibold);
	}

	.value {
		font-size: var(--ab-font-size-xl);
		font-weight: var(--ab-font-weight-bold);
		font-variant-numeric: tabular-nums;
		line-height: var(--ab-line-height-tight);
		color: var(--ab-color-fg);
	}

	.sub {
		font-size: var(--ab-font-size-xs);
		color: var(--ab-color-fg-subtle);
	}

	.t-primary .value { color: var(--ab-color-primary); }
	.t-success .value { color: var(--ab-color-success); }
	.t-warning .value { color: var(--ab-color-warning); }
	.t-danger .value  { color: var(--ab-color-danger); }
</style>
