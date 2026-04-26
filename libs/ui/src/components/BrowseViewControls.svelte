<script lang="ts" module>
export interface BrowseViewControlsOption<V extends string | number> {
	value: V;
	label: string;
}

export interface BrowseViewControlsProps<G extends string, S extends string | number> {
	/** Current group-by value. */
	groupBy: G;
	/** Allowed group-by values. */
	groupByOptions: BrowseViewControlsOption<G>[];
	/** Called with the new group-by value; the page navigates. */
	onGroupBy: (value: G) => void;
	/** Current page size. */
	pageSize: S;
	/** Allowed page sizes. */
	pageSizeOptions: BrowseViewControlsOption<S>[];
	/** Called with the new page size; the page navigates. */
	onPageSize: (value: S) => void;
}
</script>

<script lang="ts" generics="G extends string, S extends string | number">
let {
	groupBy,
	groupByOptions,
	onGroupBy,
	pageSize,
	pageSizeOptions,
	onPageSize,
}: BrowseViewControlsProps<G, S> = $props();
</script>

<div class="view-controls" aria-label="View options" data-testid="browseviewcontrols-root">
	<div class="view-control">
		<label for="vc-group">Group by</label>
		<select
			id="vc-group"
			value={groupBy}
			data-testid="browseviewcontrols-groupby"
			onchange={(e) => onGroupBy((e.currentTarget as HTMLSelectElement).value as G)}
		>
			{#each groupByOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
	<div class="view-control">
		<label for="vc-size">Per page</label>
		<select
			id="vc-size"
			value={pageSize}
			data-testid="browseviewcontrols-pagesize"
			onchange={(e) => {
				const raw = (e.currentTarget as HTMLSelectElement).value;
				const isNumber = typeof pageSizeOptions[0]?.value === 'number';
				onPageSize((isNumber ? Number(raw) : raw) as S);
			}}
		>
			{#each pageSizeOptions as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>
	</div>
</div>

<style>
	.view-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-lg);
		align-items: center;
		padding: 0 var(--space-2xs);
	}

	.view-control {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.view-control label {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.view-control select {
		font: inherit;
		padding: var(--space-2xs) var(--space-sm);
		border: 1px solid var(--edge-strong);
		border-radius: var(--radius-sm);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}
</style>
