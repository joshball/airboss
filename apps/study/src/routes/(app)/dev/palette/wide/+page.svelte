<script lang="ts">
import CommandPalette from '@ab/help/ui/CommandPalette.svelte';

/**
 * Variant C — wide 4-column grid + right-side detail pane.
 *
 * Mounts the production `CommandPalette` as a dev-only inline view so the
 * visual variant can be A/B'd alongside Variants A and B. The palette here
 * is always "open"; closing it bounces the user back to the variant index.
 */

let open = $state(true);

function back(): void {
	// Close the palette and navigate back to the variant index. The palette's
	// own onClose dismisses without navigation, so we do both here.
	open = false;
	window.location.href = '/dev/palette';
}
</script>

<svelte:head>
	<title>Palette · Variant C (wide) — airboss</title>
</svelte:head>

<header class="page-header">
	<p class="back"><a href="/dev/palette">← back to variants</a></p>
	<h1>Variant C — wide 4-column grid + detail pane</h1>
	<p class="lede">
		Production candidate. Type a query below; the palette appears as a modal centered in the
		viewport. Press <kbd>Esc</kbd> to close (or click the link above to return).
	</p>
</header>

<CommandPalette {open} onClose={back} mode="search" />
{#if !open}
	<p style="text-align:center;color:var(--ink-muted);margin:var(--space-xl) 0">
		Palette closed. <a href="/dev/palette">Back to variants</a>.
	</p>
{/if}

<style>
	.page-header {
		max-width: 56rem;
		margin: 0 auto;
		padding: var(--space-lg) var(--space-xl);
		color: var(--ink-muted);
	}

	.page-header h1 {
		color: var(--ink-body);
		font-size: var(--font-size-xl);
		margin: var(--space-sm) 0;
	}

	.back a {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}

	kbd {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		border: 1px solid var(--edge-default);
		border-bottom-width: 2px;
		border-radius: var(--radius-xs);
		padding: 0 var(--space-2xs);
		background: var(--surface-sunken);
	}
</style>
