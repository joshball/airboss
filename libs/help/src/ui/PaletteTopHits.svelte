<script lang="ts">
import type { SearchResult } from '../schema/result-types';
import PaletteRow from './PaletteRow.svelte';

/**
 * Top-hits strip rendered above the result column in I-2 broad search
 * mode. Three rows max (TOP_HITS_MAX), mixed types, ranker-decided.
 *
 * Hidden when `intent === 'phrase-fts'` -- the caller (`CommandPalette`)
 * just doesn't mount this component in that mode.
 *
 * Source of truth: `design/mockups/search/mockup-02-new-layout.md`
 * ("TOP HITS" section).
 */

interface Props {
	hits: readonly SearchResult[];
	/** Index of the currently-focused row (when this strip is focused). */
	focusedIndex?: number;
	/** True when keyboard focus is parked on the strip vs the type-nav column. */
	focused?: boolean;
	onActivate: (result: SearchResult) => void;
	onHover?: (result: SearchResult, index: number) => void;
}

let { hits, focusedIndex = 0, focused = false, onActivate, onHover }: Props = $props();
</script>

{#if hits.length > 0}
	<section
		class="top-hits"
		aria-labelledby="palette-top-hits-heading"
		data-testid="palette-top-hits"
		data-focused={focused ? 'true' : 'false'}
	>
		<header>
			<h3 id="palette-top-hits-heading">Top hits</h3>
		</header>
		<ul>
			{#each hits as hit, index (hit.id)}
				<li>
					<PaletteRow
						result={hit}
						focused={focused && index === focusedIndex}
						onActivate={onActivate}
						onHover={() => onHover?.(hit, index)}
					/>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.top-hits {
		padding: var(--space-sm) var(--space-lg);
		border-bottom: 1px solid var(--edge-default);
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h3 {
		margin: 0;
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: var(--font-weight-semibold);
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
</style>
