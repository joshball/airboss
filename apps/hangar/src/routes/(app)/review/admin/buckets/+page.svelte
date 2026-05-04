<script lang="ts">
import { REVIEW_KIND_LABELS, type ReviewKind, ROUTES } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import Card from '@ab/ui/components/Card.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const crumbs: readonly BreadcrumbItem[] = [
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: 'Admin', href: ROUTES.HANGAR_REVIEW_ADMIN_BUCKETS },
	{ label: 'Buckets' },
];

function summarizeFilter(criteria: PageData['buckets'][number]['filterCriteria']): string {
	const parts: string[] = [];
	if (criteria.kind !== undefined) parts.push(`kind=${criteria.kind}`);
	if (criteria.frontmatterStatus && criteria.frontmatterStatus.length > 0) {
		parts.push(`status in [${criteria.frontmatterStatus.join(', ')}]`);
	}
	if (criteria.reviewStatus && criteria.reviewStatus.length > 0) {
		parts.push(`reviewStatus in [${criteria.reviewStatus.join(', ')}]`);
	}
	if (criteria.noPassingSession === true) parts.push('no passing session');
	return parts.length === 0 ? '(no filters)' : parts.join(' AND ');
}

function kindLabel(kindId: string): string {
	return REVIEW_KIND_LABELS[kindId as ReviewKind] ?? kindId;
}
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<div class="title-row">
		<h1>Buckets</h1>
		<a class="new-link" href={ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_NEW}>+ New bucket</a>
	</div>
	<p class="meta">Aggregations over review items. Each bucket renders as one card on the board with a count badge.</p>
</header>

<Card>
	{#if data.buckets.length === 0}
		<p class="muted">No buckets yet. <a href={ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_NEW}>Create one</a> -- the loader seeds defaults on first boot.</p>
	{:else}
		<table class="bucket-list">
			<thead>
				<tr>
					<th scope="col">Name</th>
					<th scope="col">Kind</th>
					<th scope="col">Filter</th>
					<th scope="col" class="num">Items</th>
					<th scope="col" class="num">Sort</th>
					<th scope="col"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.buckets as b (b.id)}
					<tr>
						<td>{b.name}</td>
						<td><code>{kindLabel(b.kindId)}</code></td>
						<td><code class="filter">{summarizeFilter(b.filterCriteria)}</code></td>
						<td class="num">{b.itemCount}</td>
						<td class="num">{b.sortOrder}</td>
						<td><a href={ROUTES.HANGAR_REVIEW_ADMIN_BUCKET_EDIT(b.id)}>Edit</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</Card>

<style>
	.hd h1 {
		margin: 0 0 var(--space-2xs);
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.new-link {
		display: inline-block;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--link-default);
		text-decoration: none;
	}

	.new-link:hover {
		background: var(--surface-sunken);
	}

	.new-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.meta {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.bucket-list {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--type-ui-label-size);
	}

	.bucket-list th,
	.bucket-list td {
		text-align: left;
		padding: var(--space-2xs) var(--space-sm);
		border-bottom: 1px solid var(--edge-default);
	}

	.bucket-list th {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
		color: var(--ink-muted);
	}

	.bucket-list td.num,
	.bucket-list th.num {
		text-align: right;
		font-family: var(--font-family-mono);
	}

	.filter {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
	}

	.muted {
		color: var(--ink-muted);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
</style>
