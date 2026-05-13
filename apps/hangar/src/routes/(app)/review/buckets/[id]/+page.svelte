<script lang="ts">
import { REVIEW_KIND_LABELS, type ReviewKind, ROUTES } from '@ab/constants';
import Breadcrumbs, { type BreadcrumbItem } from '@ab/ui/components/Breadcrumbs.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const crumbs = $derived<readonly BreadcrumbItem[]>([
	{ label: 'Review board', href: ROUTES.HANGAR_REVIEW },
	{ label: data.bucket.name },
]);

const kindLabel = $derived(REVIEW_KIND_LABELS[data.bucket.kindId as ReviewKind] ?? data.bucket.kindId);

function statusPillClass(value: string | null | undefined): string {
	if (!value) return 'pill';
	const lc = value.toLowerCase();
	if (lc === 'done') return 'pill pill-done';
	if (lc === 'reading' || lc === 'in-progress') return 'pill pill-progress';
	if (lc === 'pending') return 'pill pill-pending';
	if (lc === 'unread') return 'pill pill-unread';
	return 'pill';
}
</script>

<Breadcrumbs items={crumbs} />

<header class="hd">
	<h1>{data.bucket.name}</h1>
	<p class="muted">
		Kind: <code>{kindLabel}</code> · {data.items.length.toLocaleString()} items.
		<a class="back-link" href={ROUTES.HANGAR_REVIEW}>← Back to board</a>
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
					<span class="row-meta">
						<span class="ref">{item.ref}</span>
						<span class="pills">
							{#if item.frontmatterStatus}
								<span class={statusPillClass(item.frontmatterStatus)} aria-label={`status: ${item.frontmatterStatus}`}>
									<span class="pill-axis">status:</span> {item.frontmatterStatus}
								</span>
							{/if}
							{#if item.reviewStatus}
								<span class={statusPillClass(item.reviewStatus)} aria-label={`review: ${item.reviewStatus}`}>
									<span class="pill-axis">review:</span> {item.reviewStatus}
								</span>
							{/if}
						</span>
					</span>
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

	.back-link {
		margin-left: var(--space-md);
		color: var(--link-default);
	}

	.back-link:hover {
		color: var(--link-hover);
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
		flex-direction: column;
		gap: var(--space-2xs);
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

	.row-meta {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-md);
		font-size: var(--type-ui-caption-size);
	}

	.ref {
		color: var(--ink-muted);
		font-family: var(--font-family-mono);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		flex: 1;
	}

	.pills {
		display: flex;
		gap: var(--space-3xs);
		flex-wrap: wrap;
	}

	.pill {
		display: inline-flex;
		gap: var(--space-3xs);
		align-items: baseline;
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		background: var(--surface-sunken);
		font-family: var(--font-family-mono);
	}

	.pill-axis {
		color: var(--ink-muted);
	}

	.pill-done {
		background: var(--signal-success-wash);
		color: var(--signal-success-deep-ink);
	}

	.pill-progress {
		background: var(--signal-info-wash);
		color: var(--signal-info-deep-ink);
	}

	.pill-pending {
		background: var(--signal-info-wash);
		color: var(--signal-info-deep-ink);
	}

	.pill-unread {
		background: var(--signal-warning-wash);
		color: var(--signal-warning-deep-ink);
	}
</style>
