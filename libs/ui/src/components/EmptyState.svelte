<script lang="ts">
import type { Snippet } from 'svelte';

/**
 * "Nothing here yet" panel: title + body text + optional CTA group.
 *
 * Replaces the duplicated `<article class="empty">` /
 * `<div class="empty">` blocks across study app routes ("Your deck is
 * empty", "No scenarios yet", "Not enough calibration data", ...).
 *
 * The container is an `<article>` with `role="status"` so screen readers
 * announce the empty state when it appears (e.g. after a filter clears
 * the list). Pass a different role via `role` if the empty state is
 * gated behind a user action that doesn't need an announcement.
 *
 * Slots:
 *   - `body`    -- additional copy / fine-print beneath the default body
 *                  paragraph; lets routes append context without losing
 *                  the canonical title + body shape.
 *   - `actions` -- CTA buttons (Buttons, links). Wrapped in a row that
 *                  wraps on narrow widths.
 */

let {
	title,
	body,
	bodySnippet,
	actions,
	role = 'status',
}: {
	title: string;
	/**
	 * Primary body paragraph. Use the `bodySnippet` slot when you need
	 * inline links or rich markup.
	 */
	body?: string;
	bodySnippet?: Snippet;
	actions?: Snippet;
	role?: 'status' | 'note' | 'region';
} = $props();
</script>

<article class="empty" {role} data-testid="emptystate-root">
	<h2 data-testid="emptystate-title">{title}</h2>
	{#if bodySnippet}
		<div class="body" data-testid="emptystate-body">{@render bodySnippet()}</div>
	{:else if body}
		<p class="body" data-testid="emptystate-body">{body}</p>
	{/if}
	{#if actions}
		<div class="actions" data-testid="emptystate-actions">{@render actions()}</div>
	{/if}
</article>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-xl) var(--space-lg);
		background: var(--surface-raised);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
		color: var(--ink-body);
		text-align: left;
	}

	h2 {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.body {
		margin: 0;
		color: var(--ink-subtle);
		font-size: var(--font-size-body);
		line-height: 1.5;
		max-width: 60ch;
	}

	.actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		margin-top: var(--space-2xs);
	}
</style>
