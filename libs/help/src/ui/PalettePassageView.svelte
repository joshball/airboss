<script lang="ts">
import type { SearchResult } from '../schema/result-types';

/**
 * I-3 (phrase-FTS) passage view. Renders the result rows as passage
 * cards with hit-word highlighting from `result.passageHighlight`.
 *
 * The FTS loader (slice 3.5i, lands in PR C) populates
 * `passageHighlight` with `ts_headline` output -- HTML-escaped text plus
 * the highlight markup the loader chose. We accept it as an HTML string
 * here because Postgres has already escaped the content; this component
 * NEVER renders `result.title` or `result.snippet` as HTML, only the
 * `passageHighlight` slot.
 *
 * Until PR C lands, this view renders an empty-state hint so the wiring
 * is in place but doesn't lie about having FTS results.
 *
 * Source of truth: `design/mockups/search/mockup-02-new-layout.md` (I-3
 * intent shape) + WP decisions R10 + R15.
 */

interface Props {
	passages: readonly SearchResult[];
	focusedIndex?: number;
	onActivate: (result: SearchResult) => void;
	onHover?: (result: SearchResult, index: number) => void;
}

let { passages, focusedIndex = 0, onActivate, onHover }: Props = $props();

const hasFtsLoader = $derived(passages.some((p) => p.passageHighlight !== undefined));

function activate(result: SearchResult): void {
	onActivate(result);
}

function hover(result: SearchResult, index: number): void {
	onHover?.(result, index);
}
</script>

<section class="passage-view" aria-label="Passages" data-testid="palette-passage-view">
	{#if passages.length === 0}
		<p class="empty" data-testid="palette-passage-empty">
			Phrase-level full-text search is not yet wired in. Try a shorter,
			doc-shaped query (like <code>AvWX</code> or <code>FAA-H-8083-28</code>)
			to use the broad search instead.
		</p>
	{:else}
		<ul>
			{#each passages as passage, index (passage.id)}
				<li>
					<button
						type="button"
						class="card"
						class:focused={index === focusedIndex}
						aria-current={index === focusedIndex ? 'true' : undefined}
						data-result-id={passage.id}
						data-result-type={passage.type}
						onclick={() => activate(passage)}
						onmouseenter={() => hover(passage, index)}
						data-testid="palette-passage-card"
					>
						<header>
							{#if passage.docCode}
								<span class="code">{passage.docCode}</span>
							{/if}
							<span class="title">{passage.title}</span>
						</header>
						{#if passage.passageHighlight}
							<!--
								`passageHighlight` is HTML produced by Postgres
								`ts_headline`. The loader chooses StartSel / StopSel
								wrappers; the input text is escaped by `ts_headline`
								itself. We render it verbatim so the highlight markup
								(e.g. <mark>) actually highlights.
							-->
							<!-- eslint-disable-next-line svelte/no-at-html-tags -->
							<p class="snippet">{@html passage.passageHighlight}</p>
						{:else if passage.snippet}
							<p class="snippet">{passage.snippet}</p>
						{/if}
						<footer>
							<span class="action-hint" aria-hidden="true">Open</span>
						</footer>
					</button>
				</li>
			{/each}
		</ul>
		{#if !hasFtsLoader}
			<p class="hint">
				Phrase-level results aren't FTS-highlighted yet (PR C wires
				<code>ts_headline</code>). These are fallback substring matches.
			</p>
		{/if}
	{/if}
</section>

<style>
	.passage-view {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		overflow-y: auto;
		flex: 1;
	}

	ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	li {
		list-style: none;
	}

	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
		width: 100%;
		text-align: left;
		background: var(--surface-panel);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		padding: var(--space-md) var(--space-lg);
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-size: var(--font-size-sm);
		transition: background var(--palette-motion-duration-xs) var(--palette-motion-ease-out),
			border-color var(--palette-motion-duration-xs) var(--palette-motion-ease-out);
	}

	.card:hover,
	.card.focused {
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.card:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	header {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.code {
		font-family: var(--font-family-mono);
		color: var(--palette-accent-amber);
		font-weight: var(--font-weight-semibold);
		font-size: var(--font-size-xs);
	}

	.title {
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
	}

	.snippet {
		margin: 0;
		font-size: var(--font-size-sm);
		line-height: var(--line-height-relaxed);
		color: var(--ink-strong);
	}

	/* Highlight markup from ts_headline. */
	.snippet :global(mark),
	.snippet :global(b) {
		background: var(--palette-accent-amber-wash);
		color: var(--palette-accent-amber);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
		font-weight: var(--font-weight-semibold);
	}

	footer {
		display: flex;
		justify-content: flex-end;
	}

	.action-hint {
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.empty,
	.hint {
		margin: 0;
		padding: var(--space-md);
		text-align: center;
		font-size: var(--font-size-sm);
		color: var(--ink-subtle);
	}

	.hint {
		font-style: italic;
	}

	code {
		font-family: var(--font-family-mono);
		font-size: var(--font-size-xs);
		background: var(--surface-sunken);
		padding: 0 var(--space-3xs);
		border-radius: var(--radius-xs);
	}
</style>
