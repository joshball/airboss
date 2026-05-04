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
	/** Total (unfiltered) bucket count; renders as "count of total" when present
	 * and not equal to count, so a filter narrowing the bucket doesn't hide the
	 * baseline. */
	readonly totalCount?: number | null;
	/** First N items shown in the inline drawer; full list is reachable via
	 * `bucketHref` when count > drawer items. */
	readonly drawerItems: ReadonlyArray<BucketCardItem>;
	/** Total -- used to decide whether to show the "Show all" link. */
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
 *
 * The bucket card surface is styled with a sunken background + folder icon
 * so it visually reads as an aggregator, distinct from the leaf `ItemCard`s
 * that share the column.
 */

let {
	bucketId,
	title,
	kindLabel,
	count,
	totalCount = null,
	drawerItems,
	bucketHref,
	drawerLimit: _drawerLimit,
}: BucketCardProps = $props();

let open = $state(false);
const drawerId = $derived(`bucket-drawer-${bucketId}`);
const overflow = $derived(count > drawerItems.length);
const showTotal = $derived(typeof totalCount === 'number' && totalCount !== count);
const countLabel = $derived(showTotal ? `${count} of ${totalCount}` : `${count}`);
</script>

<article class="card" data-bucket-id={bucketId}>
	<h3 class="card-title">
		<button type="button" class="head" aria-expanded={open} aria-controls={drawerId} onclick={() => (open = !open)}>
			<span class="folder" aria-hidden="true">
				<!-- Folder glyph telegraphs "this row is an aggregator, not a leaf item" -->
				<svg viewBox="0 0 16 16" width="14" height="14" focusable="false">
					<path
						fill="currentColor"
						d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.086a1 1 0 0 1 .707.293L7.914 3.4A1 1 0 0 0 8.621 3.7H13a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 13 12.7H3a1.5 1.5 0 0 1-1.5-1.5v-7.7Z"
					/>
				</svg>
			</span>
			<span class="title">{title}</span>
			<span class="badges">
				<span class="kind">{kindLabel}</span>
				<span class="count">{countLabel}</span>
				<span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
			</span>
		</button>
	</h3>
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
				{/if}
			{/if}
		</ul>
	{/if}
</article>

<style>
	.card {
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-left: 3px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.card-title {
		margin: 0;
		font: inherit;
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
		min-height: 2.5rem;
	}

	.head:hover {
		background: var(--surface-panel);
	}

	.head:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	.folder {
		color: var(--ink-muted);
		display: inline-flex;
		flex-shrink: 0;
	}

	.title {
		font-weight: var(--type-ui-control-weight);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		background: var(--surface-panel);
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
		background: var(--surface-panel);
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
