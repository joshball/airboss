<script lang="ts">
import FilterCard from '../../src/components/FilterCard.svelte';

let {
	resetHref,
	applyLabel,
	resetLabel,
	withHidden = false,
}: { resetHref: string; applyLabel?: string; resetLabel?: string; withHidden?: boolean } = $props();
</script>

{#if withHidden}
	<FilterCard {resetHref} {applyLabel} {resetLabel}>
		{#snippet hidden()}<input type="hidden" name="page" value="1" data-testid="harness-hidden-page" />{/snippet}
		{#snippet controls()}<div class="filter" data-testid="harness-filter-control">control</div>{/snippet}
	</FilterCard>
{:else}
	<FilterCard {resetHref} {applyLabel} {resetLabel}>
		{#snippet controls()}<div class="filter" data-testid="harness-filter-control">control</div>{/snippet}
	</FilterCard>
{/if}
