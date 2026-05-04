<script lang="ts" module>
export interface BucketCardItem {
	readonly id: string;
	readonly title: string;
	readonly href: string;
}

export interface BucketCardProps {
	readonly bucketId: string;
	readonly title: string;
	readonly kindLabel: string;
	readonly count: number;
	/** First N items shown in the inline drawer; full list is reachable via
	 * `bucketHref` when count > drawer items. */
	readonly drawerItems: ReadonlyArray<BucketCardItem>;
	/** Total count -- used to decide whether to show the "Show all" link. */
	readonly bucketHref: string;
	readonly drawerLimit: number;
}
</script>

<script lang="ts">
/**
 * Aggregating bucket card -- title + count + expand chevron + inline
 * drawer. Buckets do NOT drag (they aggregate; their column is derived).
 * Click the title row to toggle the drawer. The drawer lists the bucket's
 * first N items with deep links to per-kind review views; "Show in full
 * list" routes to the bucket detail page when more remain.
 */

let { bucketId, title, kindLabel, count, drawerItems, bucketHref, drawerLimit }: BucketCardProps = $props();

let open = $state(false);
const drawerId = $derived(`bucket-drawer-${bucketId}`);
const overflow = $derived(count > drawerItems.length);
</script>

<article class="card" data-bucket-id={bucketId}>
	<button
		type="button"
		class="head"
		aria-expanded={open}
		aria-controls={drawerId}
		onclick={() => (open = !open)}
	>
		<span class="title">{title}</span>
		<span class="badges">
			<span class="kind">{kindLabel}</span>
			<span class="count">{count}</span>
			<span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
		</span>
	</button>
	{#if open}
		<ul class="drawer" id={drawerId}>
			{#if drawerItems.length === 0}
				<li class="empty">No items in this bucket.</li>
			{:else}
				{#each drawerItems as item (item.id)}
					<li>
						<a href={item.href} class="drawer-link">{item.title}</a>
					</li>
				{/each}
				{#if overflow}
					<li class="show-all">
						<a href={bucketHref}>Show all {count} in full list</a>
					</li>
				{:else if drawerItems.length > 0 && drawerLimit < count}
					<li class="show-all">
						<a href={bucketHref}>Show full list</a>
					</li>
				{/if}
			{/if}
		</ul>
	{/if}
</article>

<style>
	.card {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2xs);
		padding: var(--space-sm);
		border: 0;
		background: transparent;
		color: var(--ink-body);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.head:hover {
		background: var(--surface-sunken);
	}

	.head:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.title {
		font-weight: var(--type-ui-control-weight);
	}

	.badges {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.kind {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.count {
		color: var(--ink-body);
		font-family: var(--font-family-mono);
		font-weight: var(--type-ui-control-weight);
		padding: 0 var(--space-2xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
	}

	.chev {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.drawer {
		list-style: none;
		padding: var(--space-xs) var(--space-sm) var(--space-sm);
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
		border-top: 1px solid var(--edge-default);
	}

	.drawer .empty {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
	}

	.drawer-link {
		color: var(--link-default);
		text-decoration: none;
		font-size: var(--type-ui-label-size);
	}

	.drawer-link:hover {
		text-decoration: underline;
	}

	.show-all {
		margin-top: var(--space-2xs);
		font-size: var(--type-ui-caption-size);
	}

	.show-all a {
		color: var(--link-default);
	}
</style>
