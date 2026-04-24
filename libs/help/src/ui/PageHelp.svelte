<script lang="ts">
/**
 * Per-page help affordance. Renders a chicklet link in the page header that
 * navigates to `/help/<pageId>`. If the page id doesn't exist in the registry,
 * renders nothing (with a dev-only warning) so authors notice during
 * development without silently shipping broken help links.
 *
 * Variants:
 *   - `icon+text` (default): renders `[? Help]` inside a pill-shaped chicklet.
 *   - `icon`: renders `[?]` glyph inside the same chicklet. Reserved for future
 *     tight contexts; a bare unframed `?` is not permitted anywhere.
 *
 * Phase 1 of the page-help story ships link-first (not a drawer) per the
 * work-package design doc. Drawer support is a follow-up package.
 */

import { HELP_TRIGGER_LABELS, ROUTES } from '@ab/constants';
import { helpRegistry } from '../registry';

let {
	pageId,
	label = HELP_TRIGGER_LABELS.PAGE,
	variant = 'icon+text',
}: {
	pageId: string;
	label?: string;
	variant?: 'icon' | 'icon+text';
} = $props();

const page = $derived(helpRegistry.getById(pageId));
const exists = $derived(page !== undefined);
const accessibleLabel = $derived(label ? `Help: ${label}` : 'Help for this page');

$effect(() => {
	if (!exists && import.meta.env.DEV) {
		// biome-ignore lint/suspicious/noConsole: dev-only authoring guard
		console.warn(`PageHelp: no help page registered for id '${pageId}'.`);
	}
});
</script>

{#if exists}
	<a
		href={ROUTES.HELP_ID(pageId)}
		class="pagehelp"
		class:icon-only={variant === 'icon'}
		aria-label={accessibleLabel}
		title={accessibleLabel}
	>
		<span class="glyph" aria-hidden="true">?</span>
		{#if variant === 'icon+text' && label}
			<span class="label">{label}</span>
		{/if}
	</a>
{/if}

<style>
	.pagehelp {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2xs);
		height: 1.75rem;
		padding: 0 var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink-subtle);
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		text-decoration: none;
		line-height: 1;
		transition:
			color var(--motion-fast),
			border-color var(--motion-fast),
			background var(--motion-fast);
	}

	.pagehelp.icon-only {
		width: 1.75rem;
		padding: 0;
	}

	.glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: var(--radius-pill);
	}

	.label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
	}

	.pagehelp:hover {
		color: var(--action-default);
		border-color: var(--edge-strong);
		background: var(--surface-sunken);
	}

	.pagehelp:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
</style>
