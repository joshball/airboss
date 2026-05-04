<script lang="ts">
import { REVIEW_KIND_LABELS, type ReviewKind, ROUTES } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Buckets' },
	{ label: data.bucket.name },
]);

const kindLabel = $derived(REVIEW_KIND_LABELS[data.bucket.kindId as ReviewKind] ?? data.bucket.kindId);
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>{data.bucket.name}</h1>
	<p class="muted">
		Kind: <code>{kindLabel}</code> · {data.items.length.toLocaleString()} items.
	</p>
</header>

{#if data.items.length === 0}
	<p class="muted empty">No items match this bucket's criteria right now.</p>
{:else}
	<ul class="item-list">
		{#each data.items as item (item.id)}
			<li>
				<a href={ROUTES.HANGAR_REVIEW_ITEM(item.id)} class="item-link">
					<span class="title">{item.title}</span>
					<span class="ref">{item.ref}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.muted {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.muted.empty {
		font-style: italic;
	}

	.item-list {
		list-style: none;
		padding: 0;
		margin: var(--space-md) 0 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.item-link {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-sm);
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		text-decoration: none;
		color: var(--ink-body);
	}

	.item-link:hover {
		background: var(--surface-sunken);
	}

	.title {
		font-weight: var(--type-ui-control-weight);
	}

	.ref {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}
</style>
