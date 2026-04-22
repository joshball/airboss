<script lang="ts" module>
export type PanelVariant = 'live' | 'gated';
</script>

<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Standard panel with title + optional subtitle + optional action slot +
 * body, plus an inline error state. Designed to be drop-in compatible with
 * the dashboard's existing TUI PanelShell so the nine panel call sites
 * keep working when they migrate one at a time.
 *
 * The panel header picks up theme-specific treatment automatically:
 *   web -- normal-case sans, regular weight, base-size heading
 *   tui -- uppercase caps-spaced mono, small heading
 *
 * `variant='gated'` dashes the border and mutes everything -- used by
 * placeholder panels so the grid still renders but the user can tell the
 * panel hasn't loaded real data yet.
 */

let {
	title,
	subtitle,
	action,
	variant = 'live',
	error,
	errorMessage,
	children,
}: {
	title: string;
	subtitle?: string;
	action?: Snippet;
	variant?: PanelVariant;
	error?: string;
	errorMessage?: string;
	children: Snippet;
} = $props();

const slugId = $derived(`panel-${title.replace(/\s+/g, '-').toLowerCase()}`);
const fallbackErrorMessage = $derived(`Unable to load ${title.toLowerCase()} -- try refreshing.`);
const resolvedError = $derived(error ? (errorMessage ?? fallbackErrorMessage) : undefined);
</script>

<article
	class="panel"
	class:gated={variant === 'gated'}
	aria-labelledby={slugId}
>
	<header class="ph">
		<div class="hg">
			<h2 id={slugId}>{title}</h2>
			{#if subtitle}
				<p class="sub">{subtitle}</p>
			{/if}
		</div>
		{#if action}
			<div class="action">{@render action()}</div>
		{/if}
	</header>

	<div class="body">
		{#if resolvedError}
			<p class="err" role="alert">{resolvedError}</p>
		{:else}
			{@render children()}
		{/if}
	</div>
</article>

<style>
	.panel {
		background: var(--ab-color-surface-raised);
		border: 1px solid var(--ab-color-border);
		border-radius: var(--ab-radius-md);
		padding: var(--ab-layout-panel-padding);
		display: flex;
		flex-direction: column;
		gap: var(--ab-layout-panel-gap);
		min-width: 0;
		min-height: 0;
		box-shadow: var(--ab-shadow-sm);
	}

	.panel.gated {
		background: var(--ab-color-surface-sunken);
		border-style: dashed;
		border-color: var(--ab-color-border-strong);
		color: var(--ab-color-fg-subtle);
		box-shadow: var(--ab-shadow-none);
	}

	.ph {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
		padding-bottom: var(--ab-space-2xs);
		border-bottom: 1px solid var(--ab-color-border-subtle);
	}

	.panel.gated .ph {
		border-bottom-color: var(--ab-color-border);
	}

	.hg {
		display: flex;
		align-items: baseline;
		gap: var(--ab-space-sm);
		flex-wrap: wrap;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-family: var(--ab-layout-panel-header-family);
		font-size: var(--ab-layout-panel-header-size);
		font-weight: var(--ab-layout-panel-header-weight);
		text-transform: var(--ab-layout-panel-header-transform);
		letter-spacing: var(--ab-layout-panel-header-tracking);
		color: var(--ab-color-fg-muted);
	}

	.panel.gated h2 {
		color: var(--ab-color-fg-faint);
	}

	.sub {
		margin: 0;
		color: var(--ab-color-fg-faint);
		font-size: var(--ab-font-size-xs);
	}

	.action {
		display: flex;
		gap: var(--ab-space-xs);
		flex-shrink: 0;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--ab-space-xs);
		font-size: var(--ab-font-size-sm);
		min-width: 0;
	}

	.err {
		margin: 0;
		padding: var(--ab-space-xs) var(--ab-space-sm);
		background: var(--ab-color-danger-subtle);
		border: 1px solid var(--ab-color-danger-subtle-border);
		border-radius: var(--ab-radius-sm);
		color: var(--ab-color-danger);
		font-size: var(--ab-font-size-xs);
	}
</style>
