<script lang="ts">
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<section class="review-shell">
	{@render children()}
</section>

<style>
	.review-shell {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}
</style>
