<script lang="ts">
import type { ParsedFilter } from '../schema/help-registry';
import type { SynonymRewrite } from '../schema/result-types';

/**
 * Removable filter chips rendered above the palette input. One chip per
 * parsed facet (`tag:`, `kind:`, `surface:`, `doc:`, `library:`) and one per
 * applied synonym rewrite (e.g. `wx -> weather`). Clicking the chip's X
 * dispatches `onRemoveFilter(key, value)` or `onRemoveSynonym(from)`; the
 * parent re-builds the raw query without that token.
 */

let {
	filters,
	synonymsApplied,
	onRemoveFilter,
	onRemoveSynonym,
}: {
	filters: readonly ParsedFilter[];
	synonymsApplied: readonly SynonymRewrite[];
	onRemoveFilter: (key: string, value: string) => void;
	onRemoveSynonym: (from: string) => void;
} = $props();

interface Chip {
	readonly id: string;
	readonly kind: 'filter' | 'synonym';
	readonly label: string;
	readonly remove: () => void;
}

const chips = $derived<Chip[]>(buildChips(filters, synonymsApplied));

function buildChips(filters: readonly ParsedFilter[], synonyms: readonly SynonymRewrite[]): Chip[] {
	const out: Chip[] = [];
	for (const f of filters) {
		for (const v of f.values) {
			out.push({
				id: `f-${f.key}-${v}`,
				kind: 'filter',
				label: `${f.key}: ${v}`,
				remove: () => onRemoveFilter(f.key, v),
			});
		}
	}
	for (const s of synonyms) {
		out.push({
			id: `s-${s.from}-${s.to}`,
			kind: 'synonym',
			label: `${s.from} → ${s.to}`,
			remove: () => onRemoveSynonym(s.from),
		});
	}
	return out;
}
</script>

{#if chips.length > 0}
	<div class="chips" data-testid="palette-filter-chips">
		{#each chips as chip (chip.id)}
			<span class="chip" data-kind={chip.kind}>
				<span class="label">{chip.label}</span>
				<button
					type="button"
					class="remove"
					aria-label="Remove {chip.label}"
					onclick={chip.remove}
				>
					×
				</button>
			</span>
		{/each}
	</div>
{/if}

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
		padding: var(--space-2xs) var(--space-lg);
		border-bottom: 1px solid var(--edge-default);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2xs);
		padding: 0 var(--space-xs);
		border-radius: var(--radius-pill);
		background: var(--surface-sunken);
		border: 1px solid var(--edge-default);
		font-size: var(--font-size-xs);
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
	}

	.chip[data-kind='synonym'] {
		background: var(--action-default-wash);
		border-color: var(--action-default);
	}

	.remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: var(--font-size-base);
		line-height: 1;
		cursor: pointer;
		border-radius: var(--radius-xs);
	}

	.remove:hover {
		background: var(--surface-panel);
	}

	.remove:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
</style>
