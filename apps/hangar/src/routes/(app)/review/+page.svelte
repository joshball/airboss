<script lang="ts">
import {
	filterItemsByCriteria,
	getDerivedColumnName,
	type HangarBoardColumnRow,
	type HangarReviewBucketRow,
	type HangarReviewItemRow,
	resolveItemColumnId,
} from '@ab/bc-hangar';
import {
	REVIEW_BOARD_FILTER_LABELS,
	REVIEW_BOARD_FILTER_VALUES,
	REVIEW_BUCKET_DRAWER_LIMIT,
	REVIEW_KIND_LABELS,
	type ReviewBoardFilter,
	type ReviewKind,
	ROUTES,
} from '@ab/constants';
import BoardColumn from '@ab/ui/components/BoardColumn.svelte';
import BucketCard, { type BucketCardItem } from '@ab/ui/components/BucketCard.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ItemCard from '@ab/ui/components/ItemCard.svelte';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

let topFilter = $state<ReviewBoardFilter>('all');
let kindFilter = $state<ReviewKind | 'all'>('all');
let textFilter = $state('');
let runningLoader = $state(false);
let lastError = $state<string | null>(null);

const passingSet = $derived<ReadonlySet<string>>(new Set(data.passingItemIds));

/**
 * Apply the top-of-board filter chips to the loaded item set. The bucket
 * drawer + per-column item cards both consume this filtered list. Server
 * side already has the items; filter is `$derived` so chip changes have
 * zero round-trip cost.
 */
const filteredItems = $derived(applyFilters(data.items, topFilter, kindFilter, textFilter));

function applyFilters(
	items: ReadonlyArray<HangarReviewItemRow>,
	chip: ReviewBoardFilter,
	kind: ReviewKind | 'all',
	text: string,
): ReadonlyArray<HangarReviewItemRow> {
	const lc = text.trim().toLowerCase();
	return items.filter((item) => {
		if (chip === 'reviews' && item.kindId === 'ad_hoc') return false;
		if (chip === 'tasks' && item.kindId !== 'ad_hoc') return false;
		if (kind !== 'all' && item.kindId !== kind) return false;
		if (lc !== '') {
			const hay = `${item.title} ${item.ref}`.toLowerCase();
			if (!hay.includes(lc)) return false;
		}
		return true;
	});
}

interface ColumnGrouped {
	readonly column: HangarBoardColumnRow;
	readonly items: ReadonlyArray<HangarReviewItemRow>;
	readonly buckets: ReadonlyArray<{
		readonly bucket: HangarReviewBucketRow;
		readonly count: number;
		readonly drawerItems: ReadonlyArray<BucketCardItem>;
	}>;
}

/**
 * Group filtered items + buckets by their effective column. Bucket
 * placement is derived from `getDerivedColumnName(majorityFrontmatterStatus)`
 * across the bucket's matching items -- a bucket sits in the column where
 * most of its items live. Empty buckets default to Backlog.
 */
const columnsGrouped = $derived<ReadonlyArray<ColumnGrouped>>(buildColumnsGrouped());

function buildColumnsGrouped(): ReadonlyArray<ColumnGrouped> {
	const itemsByColumn = new Map<string, HangarReviewItemRow[]>();
	for (const col of data.columns) itemsByColumn.set(col.id, []);
	for (const item of filteredItems) {
		const cid = resolveItemColumnId(item, data.columns);
		const list = itemsByColumn.get(cid);
		if (list) list.push(item);
	}
	const bucketsByColumn = new Map<
		string,
		Array<{ bucket: HangarReviewBucketRow; count: number; drawerItems: BucketCardItem[] }>
	>();
	for (const col of data.columns) bucketsByColumn.set(col.id, []);
	for (const bucket of data.buckets) {
		const matching = filterItemsByCriteria(filteredItems, bucket.filterCriteria, passingSet);
		// Compute the bucket's home column: majority of the matching items'
		// derived columns. With zero matches, default to Backlog.
		const tally = new Map<string, number>();
		for (const item of matching) {
			const name = getDerivedColumnName(item.frontmatterStatus, item.reviewStatus);
			tally.set(name, (tally.get(name) ?? 0) + 1);
		}
		let homeName: string = 'Backlog';
		let topCount = -1;
		for (const [name, c] of tally) {
			if (c > topCount) {
				topCount = c;
				homeName = name;
			}
		}
		const homeCol = data.columns.find((c) => c.name === homeName) ?? data.columns[0];
		if (!homeCol) continue;
		const drawer: BucketCardItem[] = matching.slice(0, REVIEW_BUCKET_DRAWER_LIMIT).map((item) => ({
			id: item.id,
			title: item.title,
			href: ROUTES.HANGAR_REVIEW_ITEM(item.id),
		}));
		const list = bucketsByColumn.get(homeCol.id);
		if (list) list.push({ bucket, count: matching.length, drawerItems: drawer });
	}
	return data.columns.map((column) => ({
		column,
		items: itemsByColumn.get(column.id) ?? [],
		buckets: bucketsByColumn.get(column.id) ?? [],
	}));
}

const moveTargets = $derived(data.columns.map((col) => ({ id: col.id, name: col.name })));

const kindFilterOptions = $derived<ReadonlyArray<{ value: ReviewKind | 'all'; label: string }>>([
	{ value: 'all' as const, label: 'All kinds' },
	...data.kinds.map((k) => ({ value: k.id as ReviewKind, label: REVIEW_KIND_LABELS[k.id as ReviewKind] ?? k.label })),
]);

function hrefForItem(item: HangarReviewItemRow): string {
	return ROUTES.HANGAR_REVIEW_ITEM(item.id);
}

function performMove(itemId: string, toColumnId: string) {
	const fd = new FormData();
	fd.append('itemId', itemId);
	fd.append('toColumnId', toColumnId);
	void fetch(`?/move`, { method: 'POST', body: fd })
		.then(async (res) => {
			if (!res.ok) {
				lastError = `Move failed (HTTP ${res.status}).`;
				return;
			}
			const result = (await res.json()) as { type: string; data?: string };
			if (result.type === 'failure') {
				lastError = 'Move failed -- frontmatter could not be written.';
			} else {
				lastError = null;
			}
			await invalidateAll();
		})
		.catch((err) => {
			lastError = err instanceof Error ? err.message : 'Move failed.';
		});
}
</script>

<header class="board-head">
	<div class="title-row">
		<h1>Hangar Review</h1>
		<form
			method="POST"
			action="?/runLoader"
			use:enhance={() => {
				runningLoader = true;
				return async ({ update }) => {
					try {
						await update();
						await invalidateAll();
					} finally {
						runningLoader = false;
					}
				};
			}}
		>
			<Button type="submit" variant="secondary" loading={runningLoader} loadingLabel="Refreshing...">
				Refresh
			</Button>
		</form>
	</div>

	<div class="filter-bar" role="toolbar" aria-label="Board filters">
		<div class="chip-group" role="radiogroup" aria-label="Card type filter">
			{#each REVIEW_BOARD_FILTER_VALUES as value (value)}
				<button
					type="button"
					class="chip"
					class:active={topFilter === value}
					role="radio"
					aria-checked={topFilter === value}
					onclick={() => (topFilter = value)}
				>
					{REVIEW_BOARD_FILTER_LABELS[value]}
				</button>
			{/each}
		</div>
		<label class="kind-select">
			<span class="visually-hidden">Kind</span>
			<select bind:value={kindFilter}>
				{#each kindFilterOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</label>
		<label class="text-search">
			<span class="visually-hidden">Search</span>
			<input type="search" placeholder="Filter by title or ref..." bind:value={textFilter} />
		</label>
	</div>

	{#if form?.ranLoader}
		{#if form.ok}
			<p class="status-line" role="status">
				Loader: <strong>{form.added.toLocaleString()}</strong> added,
				<strong>{form.updated.toLocaleString()}</strong> updated,
				<strong>{form.removed.toLocaleString()}</strong> removed
				in {(form.durationMs / 1000).toFixed(1)} s.
			</p>
		{:else}
			<p class="status-line error" role="alert">Loader failed: {form.error}</p>
		{/if}
	{/if}
	{#if lastError}
		<p class="status-line error" role="alert">{lastError}</p>
	{/if}
</header>

<section class="columns" aria-label="Review board columns">
	{#each columnsGrouped as col (col.column.id)}
		<BoardColumn
			columnId={col.column.id}
			name={col.column.name}
			count={col.items.length + col.buckets.reduce((s, b) => s + b.count, 0)}
			onDrop={(cardId) => performMove(cardId, col.column.id)}
		>
			{#each col.buckets as entry (entry.bucket.id)}
				<BucketCard
					bucketId={entry.bucket.id}
					title={entry.bucket.name}
					kindLabel={REVIEW_KIND_LABELS[entry.bucket.kindId as ReviewKind] ?? entry.bucket.kindId}
					count={entry.count}
					drawerItems={entry.drawerItems}
					bucketHref={ROUTES.HANGAR_REVIEW_BUCKET(entry.bucket.id)}
					drawerLimit={REVIEW_BUCKET_DRAWER_LIMIT}
				/>
			{/each}
			{#each col.items as item (item.id)}
				<ItemCard
					itemId={item.id}
					title={item.title}
					kindLabel={REVIEW_KIND_LABELS[item.kindId as ReviewKind] ?? item.kindId}
					ref={item.ref}
					href={hrefForItem(item)}
					frontmatterStatus={item.frontmatterStatus}
					reviewStatus={item.reviewStatus}
					moveTargets={moveTargets}
					currentColumnId={col.column.id}
					onMove={(toId) => performMove(item.id, toId)}
				/>
			{/each}
			{#if col.items.length === 0 && col.buckets.length === 0}
				<p class="muted empty">No items.</p>
			{/if}
		</BoardColumn>
	{/each}
</section>

<style>
	.board-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.title-row h1 {
		margin: 0;
	}

	.filter-bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-md);
		align-items: center;
	}

	.chip-group {
		display: flex;
		gap: var(--space-2xs);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
		padding: var(--space-3xs);
	}

	.chip {
		border: 0;
		padding: var(--space-2xs) var(--space-md);
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		cursor: pointer;
	}

	.chip.active {
		background: var(--surface-panel);
		color: var(--ink-body);
		font-weight: var(--type-ui-control-weight);
	}

	.chip:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.kind-select select,
	.text-search input {
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
		font: inherit;
	}

	.text-search input {
		min-width: 16rem;
	}

	.text-search input:focus-visible,
	.kind-select select:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
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

	.status-line {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.status-line.error {
		color: var(--signal-danger-ink);
	}

	.columns {
		display: flex;
		gap: var(--space-md);
		overflow-x: auto;
		align-items: flex-start;
	}

	.muted.empty {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-style: italic;
		margin: 0;
	}
</style>
