<script lang="ts">
import Tabs, { type TabItem } from '../../src/components/Tabs.svelte';

let {
	tabs,
	active = $bindable(''),
	ariaLabel,
}: {
	tabs: TabItem[];
	active?: string;
	ariaLabel?: string;
} = $props();
</script>

<Tabs {tabs} bind:active {ariaLabel}>
	{#snippet panel(id: string)}
		<span data-testid={`harness-panel-${id}`}>panel for {id}</span>
	{/snippet}
</Tabs>
