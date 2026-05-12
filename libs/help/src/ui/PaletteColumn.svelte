<script lang="ts">
import { accentFor } from './palette-accent';
import { COLUMN_LABELS, type ResultColumn, type SearchResult } from '../schema/result-types';

/**
 * A single palette column. Renders a heading + a vertical list of result
 * rows. Used by `CommandPalette.svelte` (Variant C production) and the
 * three Phase 3 dev variant prototypes so they all share the same row
 * shape, accent semantics, and focus model.
 */

interface Props {
	column: ResultColumn;
	results: readonly SearchResult[];
	/** True when this column owns keyboard focus. */
	focused?: boolean;
	/** Index of the focused row within this column (only meaningful when focused). */
	focusedIndex?: number;
	/** True when the column is awaiting server results -- shows loading hint. */
	loading?: boolean;
	/** Activate a row (click or Enter from the parent's key handler). */
	onActivate: (result: SearchResult) => void;
	/** Hover -- moves the highlight in the parent. */
	onHover?: (result: SearchResult, index: number) => void;
	/** Reserved-empty hint used by Commands until Phase 4. */
	reservedHint?: string;
}

let {
	column,
	results,
	focused = false,
	focusedIndex = 0,
	loading = false,
	onActivate,
	onHover,
	reservedHint,
}: Props = $props();

const label = $derived<string>(COLUMN_LABELS[column]);

function activate(result: SearchResult): void {
	onActivate(result);
}

function hover(result: SearchResult, index: number): void {
	onHover?.(result, index);
}
</script>

<section
	class="column"
	aria-labelledby="col-heading-{column}"
	data-column={column}
	data-active={focused ? 'true' : 'false'}
	data-loading={loading ? 'true' : 'false'}
>
	<header>
		<span class="label" id="col-heading-{column}">{label}</span>
		<span class="count">{results.length}</span>
	</header>
	{#if results.length === 0}
		<p class="hint">
			{#if reservedHint}{reservedHint}{:else if loading}Loading…{:else}No hits{/if}
		</p>
	{:else}
		<ul>
			{#each results as result, index (result.id)}
				{@const accent = accentFor(result.type)}
				<li
					class:focused={focused && focusedIndex === index}
					aria-current={focused && focusedIndex === index ? 'true' : undefined}
				>
					<button
						type="button"
						class="row"
						data-accent={accent}
						data-result-id={result.id}
						data-result-type={result.type}
						onclick={() => activate(result)}
						onmouseenter={() => hover(result, index)}
					>
						<span class="tag" data-accent={accent}>{result.subtitle ?? result.type}</span>
						<span class="title">{result.title}</span>
						{#if result.snippet}
							<span class="snippet">{result.snippet}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.column {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.column[data-active='true'] header .label {
		color: var(--ink-body);
	}

	.column[data-loading='true'] header .label {
		animation: palette-column-loading-pulse 1200ms infinite;
	}

	@keyframes palette-column-loading-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.column[data-loading='true'] header .label {
			animation: none;
			opacity: 0.6;
		}
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		margin-bottom: var(--space-xs);
	}

	.count {
		font-variant-numeric: tabular-nums;
		background: var(--surface-sunken);
		border-radius: var(--radius-pill);
		padding: 0 var(--space-sm);
		font-size: var(--font-size-xs);
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	li.focused .row {
		background: var(--surface-raised);
		border-color: var(--edge-strong);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--space-3xs);
		width: 100%;
		text-align: left;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		color: inherit;
		font: inherit;
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out),
			border-color var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
		border-left-width: 3px;
	}

	.row[data-accent='amber'] {
		border-left-color: var(--palette-accent-amber-edge);
	}

	.row[data-accent='violet'] {
		border-left-color: var(--palette-accent-violet-edge);
	}

	.row[data-accent='cyan'] {
		border-left-color: var(--palette-accent-cyan-edge);
	}

	.row[data-accent='green'] {
		border-left-color: var(--palette-accent-green-edge);
	}

	.row[data-accent='rose'] {
		border-left-color: var(--palette-accent-rose-edge);
	}

	.row[data-accent='cmd'] {
		border-left-color: var(--palette-accent-cmd-edge);
	}

	.row:hover {
		background: var(--surface-sunken);
	}

	li.focused .row[data-accent='amber'] {
		background: var(--palette-accent-amber-wash);
	}

	li.focused .row[data-accent='violet'] {
		background: var(--palette-accent-violet-wash);
	}

	li.focused .row[data-accent='cyan'] {
		background: var(--palette-accent-cyan-wash);
	}

	li.focused .row[data-accent='green'] {
		background: var(--palette-accent-green-wash);
	}

	li.focused .row[data-accent='rose'] {
		background: var(--palette-accent-rose-wash);
	}

	.row:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.tag {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.tag[data-accent='amber'] {
		color: var(--palette-accent-amber);
	}

	.tag[data-accent='violet'] {
		color: var(--palette-accent-violet);
	}

	.tag[data-accent='cyan'] {
		color: var(--palette-accent-cyan);
	}

	.tag[data-accent='green'] {
		color: var(--palette-accent-green);
	}

	.tag[data-accent='rose'] {
		color: var(--palette-accent-rose);
	}

	.title {
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-sm);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.snippet {
		font-size: var(--font-size-xs);
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hint {
		margin: var(--space-sm) 0 0;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}
</style>
