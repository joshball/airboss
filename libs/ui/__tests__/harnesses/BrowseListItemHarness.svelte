<script lang="ts">
import BrowseListItem from '../../src/components/BrowseListItem.svelte';

let {
	href,
	id,
	justCreated = false,
	titleText = 'Title',
	withMeta = false,
	withStats = false,
	withExtra = false,
	withTrailing = false,
}: {
	href: string;
	id?: string;
	justCreated?: boolean;
	titleText?: string;
	withMeta?: boolean;
	withStats?: boolean;
	withExtra?: boolean;
	withTrailing?: boolean;
} = $props();
</script>

{#if withMeta && withStats && withExtra && withTrailing}
	<BrowseListItem {href} {id} {justCreated}>
		{#snippet title()}{titleText}{/snippet}
		{#snippet meta()}<span data-testid="harness-bli-meta">m</span>{/snippet}
		{#snippet stats()}<span data-testid="harness-bli-stats">s</span>{/snippet}
		{#snippet extra()}<span data-testid="harness-bli-extra">e</span>{/snippet}
		{#snippet trailing()}<span data-testid="harness-bli-trailing">t</span>{/snippet}
	</BrowseListItem>
{:else}
	<BrowseListItem {href} {id} {justCreated}>
		{#snippet title()}{titleText}{/snippet}
	</BrowseListItem>
{/if}
