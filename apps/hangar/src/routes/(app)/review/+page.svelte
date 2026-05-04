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
	REVIEW_BOARD_COLUMN_NAMES,
	REVIEW_BOARD_FILTER_ANNOUNCE_DEBOUNCE_MS,
	REVIEW_BOARD_FILTER_LABELS,
	REVIEW_BOARD_FILTER_VALUES,
	REVIEW_BOARD_QUERY_PARAMS,
	REVIEW_BOARD_STATUS_FILTER_LABELS,
	REVIEW_BOARD_STATUS_FILTER_VALUES,
	REVIEW_BOARD_TOAST_DISMISS_MS,
	REVIEW_BUCKET_DRAWER_LIMIT,
	REVIEW_KIND_LABELS,
	REVIEW_KIND_VALUES,
	type ReviewBoardFilter,
	type ReviewBoardStatusFilter,
	type ReviewKind,
	ROUTES,
} from '@ab/constants';
import BoardColumn from '@ab/ui/components/BoardColumn.svelte';
import BucketCard, { type BucketCardItem } from '@ab/ui/components/BucketCard.svelte';
import Button from '@ab/ui/components/Button.svelte';
import ItemCard from '@ab/ui/components/ItemCard.svelte';
import type { ActionResult } from '@sveltejs/kit';
import { applyAction, deserialize, enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import type { ActionData, PageData } from './$types';

let { data, form }: { data: PageData; form: ActionData } = $props();

const initialUrl = page.url;
let topFilter = $state<ReviewBoardFilter>(parseTop(initialUrl.searchParams.get(REVIEW_BOARD_QUERY_PARAMS.TOP)));
let kindFilter = $state<ReviewKind | 'all'>(parseKind(initialUrl.searchParams.get(REVIEW_BOARD_QUERY_PARAMS.KIND)));
let statusFilter = $state<ReviewBoardStatusFilter>(
	parseStatus(initialUrl.searchParams.get(REVIEW_BOARD_QUERY_PARAMS.STATUS)),
);
let textFilter = $state(initialUrl.searchParams.get(REVIEW_BOARD_QUERY_PARAMS.TEXT) ?? '');
let hideDone = $state(initialUrl.searchParams.get(REVIEW_BOARD_QUERY_PARAMS.HIDE_DONE) === '1');

let runningLoader = $state(false);
let loaderStatus = $state<{ kind: 'success' | 'error'; message: string } | null>(null);
let lastError = $state<string | null>(null);
let liveAnnounce = $state(''); // for `aria-live=polite` move/result announcements
let resultCountAnnounce = $state(''); // debounced filter count announcer
let dragSourceColumnId = $state<string | null>(null);

// Build the passing-session set as a `$derived` of `data.passingItemIds`.
// Using `$state` + `$effect` would re-fire on every load, which is fine but
// adds a write that the derived already does for free.
const passingSet = $derived<ReadonlySet<string>>(new Set(data.passingItemIds));

function parseTop(v: string | null): ReviewBoardFilter {
	return v && (REVIEW_BOARD_FILTER_VALUES as readonly string[]).includes(v) ? (v as ReviewBoardFilter) : 'all';
}

function parseKind(v: string | null): ReviewKind | 'all' {
	if (v === 'all' || v === null) return 'all';
	return (REVIEW_KIND_VALUES as readonly string[]).includes(v) ? (v as ReviewKind) : 'all';
}

function parseStatus(v: string | null): ReviewBoardStatusFilter {
	return v && (REVIEW_BOARD_STATUS_FILTER_VALUES as readonly string[]).includes(v)
		? (v as ReviewBoardStatusFilter)
		: 'all';
}

/**
 * Apply the top-of-board filter chips, kind selector, status selector, and
 * free-text search to the loaded item set. The bucket drawer + per-column
 * item cards both consume this filtered list.
 */
const filteredItems = $derived(applyFilters(data.items, topFilter, kindFilter, statusFilter, textFilter));

function applyFilters(
	items: ReadonlyArray<HangarReviewItemRow>,
	chip: ReviewBoardFilter,
	kind: ReviewKind | 'all',
	status: ReviewBoardStatusFilter,
	text: string,
): ReadonlyArray<HangarReviewItemRow> {
	const lc = text.trim().toLowerCase();
	return items.filter((item) => {
		if (chip === 'reviews' && item.kindId === 'ad_hoc') return false;
		if (chip === 'tasks' && item.kindId !== 'ad_hoc') return false;
		if (kind !== 'all' && item.kindId !== kind) return false;
		if (status === 'no-status') {
			if (item.frontmatterStatus !== null) return false;
		} else if (status !== 'all') {
			if (item.frontmatterStatus !== status) return false;
		}
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
		readonly totalCount: number;
		readonly drawerItems: ReadonlyArray<BucketCardItem>;
	}>;
	readonly totalCount: number;
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
	const itemsByColumnTotal = new Map<string, number>();
	for (const col of data.columns) {
		itemsByColumn.set(col.id, []);
		itemsByColumnTotal.set(col.id, 0);
	}
	for (const item of filteredItems) {
		const cid = resolveItemColumnId(item, data.columns);
		const list = itemsByColumn.get(cid);
		if (list) list.push(item);
	}
	for (const item of data.items) {
		const cid = resolveItemColumnId(item, data.columns);
		itemsByColumnTotal.set(cid, (itemsByColumnTotal.get(cid) ?? 0) + 1);
	}
	const bucketsByColumn = new Map<
		string,
		Array<{
			bucket: HangarReviewBucketRow;
			count: number;
			totalCount: number;
			drawerItems: BucketCardItem[];
		}>
	>();
	for (const col of data.columns) bucketsByColumn.set(col.id, []);
	for (const bucket of data.buckets) {
		const matching = filterItemsByCriteria(filteredItems, bucket.filterCriteria, passingSet);
		const totalMatching = filterItemsByCriteria(data.items, bucket.filterCriteria, passingSet);
		// Compute the bucket's home column: majority of the matching items'
		// derived columns. With zero matches, default to Backlog.
		const tally = new Map<string, number>();
		for (const item of matching) {
			const name = getDerivedColumnName(item.frontmatterStatus, item.reviewStatus);
			tally.set(name, (tally.get(name) ?? 0) + 1);
		}
		let homeName: string = REVIEW_BOARD_COLUMN_NAMES.BACKLOG;
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
		if (list) {
			list.push({ bucket, count: matching.length, totalCount: totalMatching.length, drawerItems: drawer });
		}
	}
	return data.columns.map((column) => ({
		column,
		items: itemsByColumn.get(column.id) ?? [],
		buckets: bucketsByColumn.get(column.id) ?? [],
		totalCount: itemsByColumnTotal.get(column.id) ?? 0,
	}));
}

const moveTargets = $derived(data.columns.map((col) => ({ id: col.id, name: col.name })));

const kindFilterOptions = $derived<ReadonlyArray<{ value: ReviewKind | 'all'; label: string }>>([
	{ value: 'all' as const, label: 'All kinds' },
	...data.kinds.map((k) => ({
		value: toReviewKind(k.id),
		label: REVIEW_KIND_LABELS[toReviewKind(k.id)] ?? k.label,
	})),
]);

function toReviewKind(value: string): ReviewKind {
	if ((REVIEW_KIND_VALUES as readonly string[]).includes(value)) return value as ReviewKind;
	// Defensive fallback: an unknown kind in the DB should never reach this
	// surface (the seeder is the only writer), but cast safely if it does.
	return 'ad_hoc';
}

function hrefForItem(item: HangarReviewItemRow): string {
	return ROUTES.HANGAR_REVIEW_ITEM(item.id);
}

function totalUnfilteredCount() {
	return data.items.length;
}

const isAnyFilterActive = $derived(
	topFilter !== 'all' || kindFilter !== 'all' || statusFilter !== 'all' || textFilter.trim() !== '',
);

function clearAllFilters() {
	topFilter = 'all';
	kindFilter = 'all';
	statusFilter = 'all';
	textFilter = '';
}

const visibleColumns = $derived(
	hideDone ? columnsGrouped.filter((c) => c.column.name !== REVIEW_BOARD_COLUMN_NAMES.DONE) : columnsGrouped,
);

/**
 * Drag-and-drop submission via SvelteKit's form-action contract. We POST to
 * `?/move` with `Accept: application/json` + `x-sveltekit-action: true` so
 * the server returns an `ActionResult` JSON envelope, decode the response
 * via `deserialize()` (devalue, not JSON.parse), and call `applyAction()`
 * so `form` re-renders correctly. Without these headers SvelteKit responds
 * with HTML / 303 and `await res.json()` throws -- which was the root cause
 * of "Move failed: Unexpected token <" toasts firing on every successful
 * drag in the prior implementation.
 */
async function performMove(itemId: string, toColumnId: string, title: string, columnName: string) {
	lastError = null;
	const fd = new FormData();
	fd.append('itemId', itemId);
	fd.append('toColumnId', toColumnId);
	let result: ActionResult;
	try {
		const res = await fetch('?/move', {
			method: 'POST',
			headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
			body: fd,
		});
		result = deserialize(await res.text()) as ActionResult;
	} catch (err) {
		lastError = err instanceof Error ? err.message : 'Move failed.';
		liveAnnounce = `Move failed: ${lastError}`;
		return;
	}
	if (result.type === 'failure') {
		const data = (result.data ?? {}) as { move?: string };
		const reason = data.move ?? 'Move failed.';
		lastError = reason;
		liveAnnounce = `Move failed: ${reason}`;
	} else if (result.type === 'error') {
		const reason = result.error instanceof Error ? result.error.message : 'Move failed.';
		lastError = reason;
		liveAnnounce = `Move failed: ${reason}`;
	} else {
		lastError = null;
		liveAnnounce = `Moved "${title}" to ${columnName}.`;
	}
	await applyAction(result);
	await invalidateAll();
	// Restore focus to the moved card by id after the page rerenders. The card
	// outer <article> has `tabindex="-1"` so it's programmatically focusable
	// without becoming a tab-stop.
	queueMicrotask(() => {
		const card = document.getElementById(`item-card-${itemId}`);
		if (card instanceof HTMLElement) card.focus();
	});
}

function dismissLastError() {
	lastError = null;
}

function dismissLoaderStatus() {
	loaderStatus = null;
}

// URL persistence: write filter state into searchParams via history
// `replaceState` so reload + share-link + back-button all preserve the
// reviewer's view without clobbering history with every keystroke.
$effect(() => {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	const params = url.searchParams;
	setOrDelete(params, REVIEW_BOARD_QUERY_PARAMS.TOP, topFilter === 'all' ? null : topFilter);
	setOrDelete(params, REVIEW_BOARD_QUERY_PARAMS.KIND, kindFilter === 'all' ? null : kindFilter);
	setOrDelete(params, REVIEW_BOARD_QUERY_PARAMS.STATUS, statusFilter === 'all' ? null : statusFilter);
	setOrDelete(params, REVIEW_BOARD_QUERY_PARAMS.TEXT, textFilter.trim() === '' ? null : textFilter);
	setOrDelete(params, REVIEW_BOARD_QUERY_PARAMS.HIDE_DONE, hideDone ? '1' : null);
	const next = `${url.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
	if (next !== window.location.pathname + window.location.search) {
		window.history.replaceState(window.history.state, '', next);
	}
});

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
	if (value === null) params.delete(key);
	else params.set(key, value);
}

// Debounced filter-count announcement -- AT users get one announcement per
// settled filter rather than one per keystroke.
let announceTimer: ReturnType<typeof setTimeout> | null = null;
$effect(() => {
	const filteredLen = filteredItems.length;
	const totalLen = totalUnfilteredCount();
	if (announceTimer !== null) clearTimeout(announceTimer);
	announceTimer = setTimeout(() => {
		resultCountAnnounce = `Showing ${filteredLen} of ${totalLen} items.`;
	}, REVIEW_BOARD_FILTER_ANNOUNCE_DEBOUNCE_MS);
	return () => {
		if (announceTimer !== null) {
			clearTimeout(announceTimer);
			announceTimer = null;
		}
	};
});

// Auto-dismiss loader success status (preserves explicit failures so the
// user can see what went wrong).
$effect(() => {
	const status = loaderStatus;
	if (!status || status.kind !== 'success') return;
	const t = setTimeout(() => {
		loaderStatus = null;
	}, REVIEW_BOARD_TOAST_DISMISS_MS);
	return () => clearTimeout(t);
});

// Bridge the form-action loader result into the dismissable surface.
$effect(() => {
	if (!form?.ranLoader) return;
	if (form.ok) {
		loaderStatus = {
			kind: 'success',
			message: `Loader: ${form.added.toLocaleString()} added, ${form.updated.toLocaleString()} updated, ${form.removed.toLocaleString()} removed in ${(form.durationMs / 1000).toFixed(1)} s.`,
		};
	} else {
		loaderStatus = { kind: 'error', message: `Loader failed: ${form.error}` };
	}
});

function clearTextFilter() {
	textFilter = '';
}

function onCardDragStart(columnId: string) {
	dragSourceColumnId = columnId;
}

function onCardDragEnd() {
	dragSourceColumnId = null;
}
</script>

<header class="board-head">
	<div class="title-row">
		<h1>Hangar Review</h1>
	</div>

	<div class="filter-bar" role="toolbar" aria-label="Board filters">
		<div class="chip-group" aria-label="Card type filter">
			{#each REVIEW_BOARD_FILTER_VALUES as value (value)}
				<button
					type="button"
					class="chip"
					class:active={topFilter === value}
					aria-pressed={topFilter === value}
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
		<label class="status-select">
			<span class="visually-hidden">Status</span>
			<select bind:value={statusFilter}>
				{#each REVIEW_BOARD_STATUS_FILTER_VALUES as value (value)}
					<option value={value}>{REVIEW_BOARD_STATUS_FILTER_LABELS[value]}</option>
				{/each}
			</select>
		</label>
		<label class="text-search">
			<span class="visually-hidden">Search title or ref</span>
			<span class="search-wrap">
				<input
					type="search"
					placeholder="Filter by title or ref..."
					aria-describedby="text-search-hint"
					bind:value={textFilter}
				/>
				{#if textFilter.length > 0}
					<button type="button" class="clear-search" aria-label="Clear search" onclick={clearTextFilter}>×</button>
				{/if}
				<span id="text-search-hint" class="visually-hidden">Filters card titles and reference paths.</span>
			</span>
		</label>
		<label class="toggle">
			<input type="checkbox" bind:checked={hideDone} />
			Hide Done
		</label>
		{#if isAnyFilterActive || hideDone}
			<button type="button" class="clear-all" onclick={clearAllFilters}>Clear filters</button>
		{/if}
		<form
			method="POST"
			action="?/runLoader"
			class="loader-form"
			use:enhance={() => {
				runningLoader = true;
				lastError = null;
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
			<Button type="submit" variant="secondary" loading={runningLoader} loadingLabel="Refreshing...">Refresh</Button>
		</form>
	</div>

	<p class="result-count" aria-hidden="true">
		Showing <strong>{filteredItems.length.toLocaleString()}</strong> of {totalUnfilteredCount().toLocaleString()} items.
	</p>

	{#if filteredItems.length === 0 && totalUnfilteredCount() > 0}
		<div class="no-matches" role="status">
			<p>No items match these filters.</p>
			<button type="button" onclick={clearAllFilters}>Clear filters</button>
		</div>
	{/if}

	{#if loaderStatus}
		<div class="toast" class:toast-error={loaderStatus.kind === 'error'} role="status">
			<span>{loaderStatus.message}</span>
			<button type="button" class="dismiss" aria-label="Dismiss" onclick={dismissLoaderStatus}>×</button>
		</div>
	{/if}
	{#if lastError !== null}
		<div class="toast toast-error" role="status">
			<span>{lastError}</span>
			<button type="button" class="dismiss" aria-label="Dismiss" onclick={dismissLastError}>×</button>
		</div>
	{/if}
</header>

<!-- Polite live regions: separated so an action announcement and the
     debounced filter-count announcement don't shadow each other. -->
<div class="visually-hidden" aria-live="polite" role="status">{liveAnnounce}</div>
<div class="visually-hidden" aria-live="polite" role="status">{resultCountAnnounce}</div>

<section class="columns" aria-label="Review board columns">
	{#each visibleColumns as col (col.column.id)}
		<BoardColumn
			columnId={col.column.id}
			name={col.column.name}
			count={col.items.length + col.buckets.reduce((s, b) => s + b.count, 0)}
			totalCount={col.totalCount}
			isSourceColumn={dragSourceColumnId === col.column.id}
			onDrop={(cardId) => {
				const moved = data.items.find((it) => it.id === cardId);
				const title = moved?.title ?? cardId;
				performMove(cardId, col.column.id, title, col.column.name);
			}}
		>
			{#each col.buckets as entry (entry.bucket.id)}
				<li>
					<BucketCard
						bucketId={entry.bucket.id}
						title={entry.bucket.name}
						kindLabel={REVIEW_KIND_LABELS[toReviewKind(entry.bucket.kindId)] ?? entry.bucket.kindId}
						count={entry.count}
						totalCount={entry.totalCount}
						drawerItems={entry.drawerItems}
						bucketHref={ROUTES.HANGAR_REVIEW_BUCKET(entry.bucket.id)}
						drawerLimit={REVIEW_BUCKET_DRAWER_LIMIT}
					/>
				</li>
			{/each}
			{#each col.items as item (item.id)}
				<li>
					<ItemCard
						itemId={item.id}
						title={item.title}
						kindLabel={REVIEW_KIND_LABELS[toReviewKind(item.kindId)] ?? item.kindId}
						ref={item.ref}
						href={hrefForItem(item)}
						frontmatterStatus={item.frontmatterStatus}
						reviewStatus={item.reviewStatus}
						moveTargets={moveTargets}
						currentColumnId={col.column.id}
						onDragStartCard={onCardDragStart}
						onDragEndCard={onCardDragEnd}
						onMove={(toId) => performMove(item.id, toId, item.title, col.column.name)}
					/>
				</li>
			{/each}
			{#if col.items.length === 0 && col.buckets.length === 0}
				<li class="empty-li"><p class="muted empty">No items.</p></li>
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
		font-size: var(--type-ui-label-size);
		cursor: pointer;
		min-height: 1.75rem;
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
	.status-select select,
	.search-wrap input {
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		background: var(--surface-panel);
		color: var(--ink-body);
		font: inherit;
		min-height: 2rem;
	}

	.search-wrap {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.search-wrap input {
		min-width: 16rem;
		padding-right: var(--space-xl);
	}

	.clear-search {
		position: absolute;
		right: var(--space-3xs);
		top: 50%;
		transform: translateY(-50%);
		background: transparent;
		border: 0;
		color: var(--ink-muted);
		cursor: pointer;
		font-size: var(--type-ui-control-size);
		padding: 0 var(--space-2xs);
	}

	.clear-search:hover {
		color: var(--ink-body);
	}

	.clear-search:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		font-size: var(--type-ui-label-size);
		color: var(--ink-body);
	}

	.clear-all {
		background: transparent;
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		color: var(--ink-muted);
		font: inherit;
		cursor: pointer;
		min-height: 2rem;
	}

	.clear-all:hover {
		background: var(--surface-sunken);
		color: var(--ink-body);
	}

	.loader-form {
		margin-left: auto;
	}

	.search-wrap input:focus-visible,
	.kind-select select:focus-visible,
	.status-select select:focus-visible {
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

	.result-count {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.result-count strong {
		color: var(--ink-body);
	}

	.no-matches {
		display: flex;
		gap: var(--space-md);
		align-items: center;
		padding: var(--space-md);
		background: var(--surface-sunken);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-md);
	}

	.no-matches p {
		margin: 0;
		color: var(--ink-body);
	}

	.no-matches button {
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
		font: inherit;
		cursor: pointer;
		color: var(--ink-body);
	}

	.toast {
		display: flex;
		gap: var(--space-md);
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--ink-body);
		font-size: var(--type-ui-label-size);
	}

	.toast.toast-error {
		background: var(--signal-danger-wash);
		color: var(--signal-danger-ink);
		border-color: var(--signal-danger-ink);
	}

	.toast .dismiss {
		background: transparent;
		border: 0;
		color: inherit;
		cursor: pointer;
		font-size: var(--type-ui-control-size);
	}

	.toast .dismiss:hover {
		opacity: 0.75;
	}

	.toast .dismiss:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}

	.columns {
		display: flex;
		gap: var(--space-md);
		overflow-x: auto;
		align-items: flex-start;
	}

	.empty-li {
		list-style: none;
	}

	.muted.empty {
		color: var(--ink-muted);
		font-size: var(--type-ui-caption-size);
		font-style: italic;
		margin: 0;
	}

	@media (max-width: 720px) {
		.title-row {
			flex-wrap: wrap;
			gap: var(--space-sm);
		}

		.loader-form {
			margin-left: 0;
		}

		.search-wrap input {
			min-width: 12rem;
		}
	}
</style>
