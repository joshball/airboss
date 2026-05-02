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
	/**
	 * Stable key extractor for an item, used as the `{#each}` key. Without it,
	 * BrowseList falls back to `item.id` when present, otherwise to the item
	 * value itself -- which thrashes the DOM whenever the parent re-renders
	 * with freshly-mapped objects (lost focus, lost local DOM state). All
	 * library/study consumers pass `{ id: string }`-shaped rows; provide
	 * `keyOf` explicitly when item identity isn't carried by `id`.
	 */
	keyOf?: (item: T) => string | number;
}
</script>

<script lang="ts" generics="T">
let { groups, item, ariaLabel = 'Results', keyOf }: BrowseListProps<T> = $props();

function pickKey(it: T): string | number {
	if (keyOf) return keyOf(it);
	const candidate = (it as { id?: string | number }).id;
	if (candidate !== undefined && (typeof candidate === 'string' || typeof candidate === 'number')) return candidate;
	// Last-resort: fall back to the value itself. Stable for primitives;
	// brittle for freshly-mapped objects (every render = new key).
	return it as unknown as string;
}
</script>

{#each groups as group (group.key)}
	{#if group.label}
		<h2 class="group-heading" data-testid={`browselist-group-heading-${group.key}`}>
			<span>{group.label}</span>
			<span class="group-count" data-testid={`browselist-group-count-${group.key}`}>{group.items.length}</span>
		</h2>
	{/if}
	<ul class="list" aria-label={ariaLabel} data-testid={`browselist-list-${group.key}`} data-group-key={group.key}>
		{#each group.items as it (pickKey(it))}
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
