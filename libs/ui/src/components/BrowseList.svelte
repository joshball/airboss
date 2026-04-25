<script lang="ts" module>
export interface BrowseListGroup<T> {
	/** Stable key for the group; used as `{#each}` key. Empty string when ungrouped. */
	key: string;
	/** Heading text; empty string suppresses the heading. */
	label: string;
	/** Items in the group. */
	items: T[];
}

export interface BrowseListProps<T> {
	/** One or more groups. For an ungrouped flat list, pass a single group with empty `key` + `label`. */
	groups: BrowseListGroup<T>[];
	/** Renderer for one item. */
	item: import('svelte').Snippet<[T]>;
	/** ARIA label override for screen readers. Default: "Results". */
	ariaLabel?: string;
}
</script>

<script lang="ts" generics="T">
let { groups, item, ariaLabel = 'Results' }: BrowseListProps<T> = $props();
</script>

{#each groups as group (group.key)}
	{#if group.label}
		<h2 class="group-heading">
			<span>{group.label}</span>
			<span class="group-count">{group.items.length}</span>
		</h2>
	{/if}
	<ul class="list" aria-label={ariaLabel}>
		{#each group.items as it (it)}
			{@render item(it)}
		{/each}
	</ul>
{/each}

<style>
	.list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.group-heading {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		margin: var(--space-md) 0 var(--space-xs);
		font-size: var(--type-heading-3-size);
		color: var(--ink-body);
		letter-spacing: -0.01em;
	}

	.group-count {
		color: var(--ink-subtle);
		font-size: var(--type-ui-label-size);
		font-weight: 500;
	}
</style>
