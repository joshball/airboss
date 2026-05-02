<script lang="ts">
import FilterBar, { type FilterBarLayout } from '../../src/components/FilterBar.svelte';
import FilterField from '../../src/components/FilterField.svelte';

let {
	ariaLabel = 'Filter test',
	layout,
	columns,
	maxWidth,
	withField = true,
}: {
	ariaLabel?: string;
	layout?: FilterBarLayout;
	columns?: string;
	maxWidth?: string;
	withField?: boolean;
} = $props();
</script>

<FilterBar {ariaLabel} {layout} {columns} {maxWidth}>
	{#if withField}
		<FilterField id="harness-search" label="Search">
			<input id="harness-search" type="search" data-testid="harness-input" />
		</FilterField>
	{/if}
</FilterBar>
