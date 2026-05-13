<script lang="ts">
import { HIDDEN_BY_DEFAULT_WHEN_EMPTY, type TypeBucket, TYPE_BUCKET_LABELS, TYPE_BUCKET_ORDER } from '../schema/type-buckets';

/**
 * Vertical type-nav (left column). One row per bucket with a count.
 *
 * The selected bucket drives the middle result column. Buckets with zero
 * hits still render so the user sees what's NOT matching -- except for
 * `app-help`, which is `HIDDEN_BY_DEFAULT_WHEN_EMPTY` and only surfaces
 * when explicitly selected or when no other bucket has results.
 *
 * Narrow viewport: the parent palette switches this from a vertical
 * column to a horizontal scrolling chip row via CSS at < 900px.
 *
 * Source of truth: `design/mockups/search/mockup-02-new-layout.md`
 * ("Left column: type nav").
 */

interface Props {
	/** Per-bucket count (0 for empty buckets is allowed). */
	counts: Record<TypeBucket, number>;
	/** Currently-selected bucket. */
	selected: TypeBucket;
	onSelect: (bucket: TypeBucket) => void;
}

let { counts, selected, onSelect }: Props = $props();

const totalNonHidden = $derived<number>(
	TYPE_BUCKET_ORDER.filter((b) => !HIDDEN_BY_DEFAULT_WHEN_EMPTY.has(b)).reduce(
		(sum, b) => sum + (counts[b] ?? 0),
		0,
	),
);

const visibleBuckets = $derived<readonly TypeBucket[]>(
	TYPE_BUCKET_ORDER.filter((b) => {
		const count = counts[b] ?? 0;
		if (count > 0) return true;
		if (!HIDDEN_BY_DEFAULT_WHEN_EMPTY.has(b)) return true;
		// Hidden-when-empty buckets surface when EVERY other bucket is empty
		// (so the user sees app-help as the last-resort surface) or when
		// they're already selected (so click-to-select is reversible).
		if (selected === b) return true;
		if (totalNonHidden === 0) return true;
		return false;
	}),
);
</script>

<nav
	class="type-nav"
	aria-label="Result types"
	data-testid="palette-type-nav"
>
	<ul>
		{#each visibleBuckets as bucket (bucket)}
			{@const count = counts[bucket] ?? 0}
			{@const isSelected = bucket === selected}
			<li>
				<button
					type="button"
					class="bucket"
					class:selected={isSelected}
					data-bucket={bucket}
					data-count={count}
					aria-pressed={isSelected ? 'true' : 'false'}
					onclick={() => onSelect(bucket)}
					data-testid="palette-type-nav-button"
				>
					<span class="label">{TYPE_BUCKET_LABELS[bucket]}</span>
					<span class="count" aria-label="{count} results">{count}</span>
				</button>
			</li>
		{/each}
	</ul>
</nav>

<style>
	.type-nav {
		padding: var(--space-md) var(--space-md);
		border-right: 1px solid var(--edge-default);
		overflow-y: auto;
		min-width: 0;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3xs);
	}

	li {
		list-style: none;
	}

	.bucket {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-xs);
		width: 100%;
		font: inherit;
		font-size: var(--font-size-sm);
		text-align: left;
		padding: var(--space-2xs) var(--space-sm);
		border: 0;
		background: transparent;
		color: var(--ink-body);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
	}

	.bucket:hover {
		background: var(--surface-sunken);
	}

	.bucket.selected {
		background: var(--surface-raised);
		font-weight: var(--font-weight-semibold);
	}

	.bucket[data-count='0'] {
		color: var(--ink-subtle);
	}

	.bucket[data-count='0'].selected {
		color: var(--ink-body);
	}

	.bucket:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.label {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.count {
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0 var(--space-xs);
		min-width: 1.75rem;
		text-align: center;
	}

	.bucket.selected .count {
		background: var(--surface-panel);
		color: var(--ink-strong);
	}

	@media (max-width: 900px) {
		.type-nav {
			border-right: 0;
			border-bottom: 1px solid var(--edge-default);
			padding: var(--space-2xs) var(--space-sm);
			overflow-x: auto;
			overflow-y: hidden;
		}

		ul {
			flex-direction: row;
			gap: var(--space-2xs);
		}

		.bucket {
			flex: 0 0 auto;
		}
	}
</style>
