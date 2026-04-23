<script lang="ts">
/**
 * Per-page help affordance. Renders a small `?` link in the page header
 * that navigates to `/help/<pageId>`. If the page id doesn't exist in the
 * registry, renders nothing (with a dev-only warning) so authors notice
 * during development without silently shipping broken help links.
 *
 * Phase 1 of the page-help story ships link-first (not a drawer) per the
 * work-package design doc. Drawer support is a follow-up package.
 */

import { ROUTES } from '@ab/constants';
import { helpRegistry } from '../registry';

let {
	pageId,
	label = 'Help for this page',
}: {
	pageId: string;
	label?: string;
} = $props();

const page = $derived(helpRegistry.getById(pageId));
const exists = $derived(page !== undefined);

$effect(() => {
	if (!exists && import.meta.env.DEV) {
		// biome-ignore lint/suspicious/noConsole: dev-only authoring guard
		console.warn(`PageHelp: no help page registered for id '${pageId}'.`);
	}
});
</script>

{#if exists}
	<a href={ROUTES.HELP_ID(pageId)} class="pagehelp" aria-label={label} title={label}>
		<span aria-hidden="true">?</span>
	</a>
{/if}

<style>
	.pagehelp {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		border: 1px solid var(--ab-color-border);
		border-radius: 999px;
		background: var(--ab-color-surface);
		color: var(--ab-color-fg-subtle);
		font-size: var(--ab-font-size-sm);
		font-weight: var(--ab-font-weight-semibold);
		text-decoration: none;
		line-height: 1;
		transition:
			color var(--ab-transition-fast),
			border-color var(--ab-transition-fast),
			background var(--ab-transition-fast);
	}

	.pagehelp:hover {
		color: var(--ab-color-primary);
		border-color: var(--ab-color-primary);
		background: var(--ab-color-primary-subtle);
	}

	.pagehelp:focus-visible {
		outline: var(--ab-focus-ring-width) solid var(--ab-focus-ring);
		outline-offset: var(--ab-focus-ring-offset);
	}
</style>
