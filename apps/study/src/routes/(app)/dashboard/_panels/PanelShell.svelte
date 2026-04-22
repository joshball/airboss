<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Shared styling + error-boundary shell for dashboard panels. Every panel
 * wraps its content in this so the visual rhythm stays consistent and so the
 * "Unable to load" message has the same shape regardless of which panel
 * threw.
 *
 * `variant = 'gated'` muts the panel (placeholder) so gated panels are
 * visibly distinct from live ones but still carry their headline + body.
 *
 * TUI styling: tight padding, uppercase/letter-spaced headers, subdued
 * borders. Dashed border stays the gated marker.
 */

type Variant = 'live' | 'gated';

let {
	title,
	subtitle,
	action,
	variant = 'live',
	error,
	children,
}: {
	title: string;
	subtitle?: string;
	action?: Snippet;
	variant?: Variant;
	error?: string;
	children: Snippet;
} = $props();
</script>

<article
	class="panel"
	class:gated={variant === 'gated'}
	aria-labelledby={`panel-${title.replace(/\s+/g, '-').toLowerCase()}`}
>
	<header class="ph">
		<div class="hg">
			<h2 id={`panel-${title.replace(/\s+/g, '-').toLowerCase()}`}>{title}</h2>
			{#if subtitle}
				<p class="sub">{subtitle}</p>
			{/if}
		</div>
		{#if action}
			<div class="action">{@render action()}</div>
		{/if}
	</header>

	<div class="body">
		{#if error}
			<p class="err" role="alert">Unable to load {title.toLowerCase()} -- try refreshing.</p>
		{:else}
			{@render children()}
		{/if}
	</div>
</article>

<style>
	.panel {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 2px;
		padding: 0.5rem 0.625rem 0.625rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
		min-height: 0;
	}

	.panel.gated {
		background: #f8fafc;
		border-style: dashed;
		border-color: #cbd5e1;
		color: #64748b;
	}

	.ph {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		padding-bottom: 0.25rem;
		border-bottom: 1px solid #f1f5f9;
	}

	.panel.gated .ph {
		border-bottom-color: #e2e8f0;
	}

	.hg {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: 0.6875rem;
		color: #475569;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;
	}

	.panel.gated h2 {
		color: #94a3b8;
	}

	.sub {
		margin: 0;
		color: #94a3b8;
		font-size: 0.6875rem;
		letter-spacing: 0.01em;
	}

	.action {
		display: flex;
		gap: 0.375rem;
		flex-shrink: 0;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.8125rem;
		min-width: 0;
	}

	.err {
		margin: 0;
		padding: 0.375rem 0.5rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 2px;
		color: #b91c1c;
		font-size: 0.75rem;
	}
</style>
