<script lang="ts" module>
import type { Tone } from '@ab/themes';
export type StatTileTone = Tone;
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
	tone = 'default',
	ariaLabel,
	valueSnippet,
}: {
	label: string;
	value: string | number;
	sub?: string;
	href?: string;
	tone?: Tone;
	ariaLabel?: string;
	valueSnippet?: Snippet;
} = $props();
</script>

{#snippet body()}
	<span class="label" data-testid="stattile-label">{label}</span>
	<span class="value" data-testid="stattile-value">
		{#if valueSnippet}
			{@render valueSnippet()}
		{:else}
			{value}
		{/if}
	</span>
	{#if sub}
		<span class="sub" data-testid="stattile-sub">{sub}</span>
	{/if}
{/snippet}

{#if href}
	<a
		class="tile t-{tone} linked"
		{href}
		aria-label={ariaLabel}
		data-testid="stattile-root"
		data-tone={tone}
		data-linked="true"
	>
		{@render body()}
	</a>
{:else}
	<div
		class="tile t-{tone}"
		aria-label={ariaLabel}
		data-testid="stattile-root"
		data-tone={tone}
		data-linked="false"
	>
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
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
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

	.t-featured .value { color: var(--action-default); }
	.t-info     .value { color: var(--signal-info); }
	.t-success  .value { color: var(--signal-success); }
	.t-warning  .value { color: var(--signal-warning); }
	.t-danger   .value { color: var(--action-hazard); }
	.t-muted    .value { color: var(--ink-subtle); }
	.t-accent   .value { color: var(--accent-code); }
</style>
