<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * Top-of-page header primitive: optional eyebrow line, h1 title with
 * optional inline help/badge slot, optional subtitle, optional right-side
 * actions slot.
 *
 * Replaces the duplicated `<header class="hd">` pattern (h1 + .sub + .quick)
 * across study app routes. Pages that need extra chrome inside the
 * header (counter buttons, breadcrumb badges, dl-style meta) keep their
 * bespoke headers; this primitive is for the canonical title + subtitle
 * + actions shape.
 *
 * Slots:
 *   - `titleSuffix` -- inline node beside the h1 (e.g. PageHelp, badge)
 *   - `actions`     -- right-aligned action group (Buttons, ConfirmAction)
 *
 * The container is a semantic `<header>` and the title is always an `<h1>`
 * to preserve a single page-level heading per route.
 */

let {
	title,
	subtitle,
	subtitleSnippet,
	eyebrow,
	eyebrowSnippet,
	titleSuffix,
	actions,
	actionsLabel = 'Page actions',
}: {
	title: string;
	/**
	 * Plain-text subtitle. For markup (badges, links inside the line) use
	 * `subtitleSnippet` instead.
	 */
	subtitle?: string;
	subtitleSnippet?: Snippet;
	/**
	 * Plain-text eyebrow above the title (uppercased mono caption). For
	 * markup (e.g. crumb-style "Help / Concepts" navigation) use
	 * `eyebrowSnippet`.
	 */
	eyebrow?: string;
	eyebrowSnippet?: Snippet;
	titleSuffix?: Snippet;
	actions?: Snippet;
	/**
	 * `aria-label` applied to the `<nav>` wrapper around `actions`. Defaults
	 * to "Page actions"; pass a more specific label (e.g. "Quick actions")
	 * when the action group is the route's primary affordance.
	 */
	actionsLabel?: string;
} = $props();
</script>

<header class="hd" data-testid="pageheader-root">
	<div class="lead">
		{#if eyebrowSnippet}
			<div class="eyebrow" data-testid="pageheader-eyebrow">{@render eyebrowSnippet()}</div>
		{:else if eyebrow}
			<p class="eyebrow" data-testid="pageheader-eyebrow">{eyebrow}</p>
		{/if}
		<div class="title-row">
			<h1 data-testid="pageheader-title">{title}</h1>
			{#if titleSuffix}
				{@render titleSuffix()}
			{/if}
		</div>
		{#if subtitleSnippet}
			<div class="sub" data-testid="pageheader-subtitle">{@render subtitleSnippet()}</div>
		{:else if subtitle}
			<p class="sub" data-testid="pageheader-subtitle">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<nav class="actions" aria-label={actionsLabel} data-testid="pageheader-actions">
			{@render actions()}
		</nav>
	{/if}
</header>

<style>
	.hd {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-lg);
		flex-wrap: wrap;
	}

	.lead {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		min-width: 0;
	}

	.eyebrow {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		font-family: var(--font-family-mono);
		letter-spacing: var(--letter-spacing-caps);
		text-transform: uppercase;
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	h1 {
		margin: 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-semibold);
		letter-spacing: var(--letter-spacing-tight);
		color: var(--ink-body);
	}

	.sub {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-body);
		max-width: 60ch;
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}
</style>
