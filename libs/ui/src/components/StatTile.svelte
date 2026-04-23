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

</script>

{#snippet body()}
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
{/snippet}

{#if href}
	<a class="tile t-{tone} linked" {href} aria-label={ariaLabel}>
		{@render body()}
	</a>
{:else}
	<div class="tile t-{tone}" aria-label={ariaLabel}>
		{@render body()}
	</div>
{/if}

<style>
	.tile {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
		min-width: 0;
		transition:
			background var(--motion-fast),
			border-color var(--motion-fast);
	}

	.tile.linked {
		cursor: pointer;
	}

	.tile.linked:hover {
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.tile.linked:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.label {
		font-size: var(--font-size-xs);
		color: var(--ink-faint);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		font-weight: var(--font-weight-semibold);
	}

	.value {
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-bold);
		font-variant-numeric: tabular-nums;
		line-height: var(--line-height-tight);
		color: var(--ink-body);
	}

	.sub {
		font-size: var(--font-size-xs);
		color: var(--ink-subtle);
	}

	.t-primary .value { color: var(--action-default); }
	.t-success .value { color: var(--signal-success); }
	.t-warning .value { color: var(--signal-warning); }
	.t-danger .value  { color: var(--action-hazard); }
</style>
