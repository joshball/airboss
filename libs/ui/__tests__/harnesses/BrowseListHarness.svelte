<script lang="ts">
import BrowseList, { type BrowseListGroup } from '../../src/components/BrowseList.svelte';

interface Item {
	id: string;
	name: string;
}

let { groups }: { groups: BrowseListGroup<Item>[] } = $props();
</script>

<BrowseList {groups}>
	{#snippet item(it: Item)}
		<li data-testid={`harness-item-${it.id}`}>{it.name}</li>
	{/snippet}
</BrowseList>
