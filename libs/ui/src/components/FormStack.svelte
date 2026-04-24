<script lang="ts">
/**
 * Vertical form layout with consistent spacing. Exists to replace ad-hoc
 * `.form { display: flex; gap: ... }` repeated across forms. All spacing via
 * role tokens; no hard-coded pixels.
 *
 * Ported from airboss-firc `libs/ui/src/components/FormStack.svelte`. Same shape,
 * airboss tokens.
 */

import type { Snippet } from 'svelte';

interface Props {
	/** Gap size. `md` matches the typical form-field vertical rhythm. */
	gap?: 'sm' | 'md' | 'lg';
	/** Render as a <form> element (with `method` / `action`) or a bare <div>. */
	as?: 'form' | 'div';
	method?: 'GET' | 'POST';
	action?: string;
	enctype?: string;
	ariaLabel?: string;
	children: Snippet;
}

const { gap = 'md', as = 'div', method, action, enctype, ariaLabel, children }: Props = $props();
</script>

{#if as === 'form'}
	<form class="stack gap-{gap}" {method} {action} {enctype} aria-label={ariaLabel}>
		{@render children()}
	</form>
{:else}
	<div class="stack gap-{gap}" aria-label={ariaLabel}>
		{@render children()}
	</div>
{/if}

<style>
	.stack {
		display: flex;
		flex-direction: column;
	}

	.gap-sm { gap: var(--space-sm); }
	.gap-md { gap: var(--space-md); }
	.gap-lg { gap: var(--space-lg); }
</style>
