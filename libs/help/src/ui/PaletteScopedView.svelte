<script lang="ts">
import type { SearchResult } from '../schema/result-types';
import { BUCKET_BY_TYPE, TYPE_BUCKET_LABELS } from '../schema/type-buckets';
import PaletteRow from './PaletteRow.svelte';

/**
 * I-1 (scoped search) view. Replaces the top-hits + type-nav + result
 * column with a single doc-headline card and a "References to this doc"
 * panel grouped by source (lessons / knowledge nodes / cards / etc.).
 *
 * The caller (`CommandPalette`) builds the `headline` (the doc the user
 * scoped to via autocomplete commit) and `references` (every row that
 * cites or extends the headline doc, grouped by bucket).
 *
 * When the headline doc isn't in the result set (the doc was filtered
 * but never matched the free-text), the headline card renders a stub
 * row with just the doc code chip; the references panel is the main
 * payload.
 *
 * Source of truth: `design/mockups/search/mockup-02-new-layout.md`
 * (I-1 intent shape) + WP decision R10.
 */

interface Props {
	/** The pinned doc. Null when the chip is set but the doc didn't match. */
	headline: SearchResult | null;
	/** Every other row that matched within the scope, in any bucket. */
	references: readonly SearchResult[];
	/** Doc code from the `doc:` filter chip. */
	docCode: string;
	onActivate: (result: SearchResult) => void;
	onHover?: (result: SearchResult) => void;
}

let { headline, references, docCode, onActivate, onHover }: Props = $props();

interface GroupedReferences {
	readonly bucket: string;
	readonly label: string;
	readonly rows: readonly SearchResult[];
}

const groupedReferences = $derived<readonly GroupedReferences[]>(groupReferences(references));

function groupReferences(rows: readonly SearchResult[]): readonly GroupedReferences[] {
	const byBucket = new Map<string, SearchResult[]>();
	for (const row of rows) {
		const bucket = BUCKET_BY_TYPE[row.type];
		const bag = byBucket.get(bucket) ?? [];
		bag.push(row);
		byBucket.set(bucket, bag);
	}
	const groups: GroupedReferences[] = [];
	for (const [bucket, bag] of byBucket) {
		groups.push({
			bucket,
			label: TYPE_BUCKET_LABELS[bucket as keyof typeof TYPE_BUCKET_LABELS] ?? bucket,
			rows: [...bag].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.title.localeCompare(b.title)),
		});
	}
	groups.sort((a, b) => a.label.localeCompare(b.label));
	return groups;
}

function activate(result: SearchResult): void {
	onActivate(result);
}

function hover(result: SearchResult): void {
	onHover?.(result);
}
</script>

<section class="scoped" data-testid="palette-scoped-view" aria-label="Scoped to {docCode}">
	<header class="headline" data-testid="palette-scoped-headline">
		{#if headline}
			<span class="kicker">Scoped to</span>
			<h2 class="title">{headline.title}</h2>
			<span class="code">{docCode}</span>
		{:else}
			<span class="kicker">Scoped to</span>
			<h2 class="title">{docCode}</h2>
			<p class="empty-hint">No matching headline doc found; showing references only.</p>
		{/if}
	</header>

	{#if groupedReferences.length === 0}
		<p class="empty" data-testid="palette-scoped-empty">No references found inside this doc.</p>
	{:else}
		<section class="references">
			<h3>References to this doc</h3>
			{#each groupedReferences as group (group.bucket)}
				<div class="group" data-bucket={group.bucket}>
					<div class="group-header">
						<span class="group-label">{group.label}</span>
						<span class="group-count">{group.rows.length}</span>
					</div>
					<ul>
						{#each group.rows as row (row.id)}
							<li>
								<PaletteRow result={row} onActivate={activate} onHover={hover} />
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</section>
	{/if}
</section>

<style>
	.scoped {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		overflow-y: auto;
		flex: 1;
	}

	.headline {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding: var(--space-md) var(--space-lg);
		background: var(--palette-accent-amber-wash);
		border: 1px solid var(--palette-accent-amber-edge);
		border-radius: var(--radius-md);
	}

	.kicker {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.title {
		margin: 0;
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
		line-height: var(--line-height-tight);
	}

	.code {
		font-family: var(--font-family-mono);
		color: var(--palette-accent-amber);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
	}

	.empty-hint {
		margin: var(--space-2xs) 0 0;
		font-size: var(--font-size-sm);
		color: var(--ink-muted);
	}

	.references {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.references h3 {
		margin: 0;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.group-header {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
	}

	.group-label {
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-strong);
	}

	.group-count {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		font-variant-numeric: tabular-nums;
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0 var(--space-sm);
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	li {
		list-style: none;
	}

	.empty {
		margin: 0;
		padding: var(--space-md);
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}
</style>
