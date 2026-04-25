<!--
	CitedByPanel -- inverse of CitationChips.

	Renders the "Cited by" list shown on a citation target page (regulation,
	knowledge node, AC reference). Each row shows the source kind label, a link
	back to the citing source when it exists, and the optional context note.
	Used by `/knowledge/<slug>` and `/references/<id>` so the row HTML/CSS lives
	in one place. The component takes a normalised `items` shape so callers
	don't have to leak `@ab/bc-citations` row shapes into `@ab/ui` (ui depends
	on constants only, not on bcs).
-->
<script lang="ts">
export interface CitedByItem {
	id: string;
	/** Source-kind label (e.g. "Card", "Knowledge node"). */
	typeLabel: string;
	/** Primary display text (card front excerpt, scenario title, node title). */
	label: string;
	/**
	 * Resolved href back to the citing source. Null when the source row is
	 * missing -- the row renders as a non-link with `missing` styling.
	 */
	href?: string | null;
	/** Optional author note ("basis for the answer"). Italic, quoted. */
	context?: string | null;
}

interface Props {
	items: ReadonlyArray<CitedByItem>;
	/** Heading text. Defaults to "Cited by ({count})". */
	heading?: string;
	/** Empty-state message. */
	emptyMessage?: string;
	/** Heading level. Defaults to 2. */
	headingLevel?: 2 | 3;
}

let { items, heading, emptyMessage = 'Not yet cited by other content.', headingLevel = 2 }: Props = $props();

const resolvedHeading = $derived(heading ?? `Cited by (${items.length})`);
</script>

<section class="cited-by" aria-label="Cited by">
	{#if headingLevel === 2}
		<h2>{resolvedHeading}</h2>
	{:else}
		<h3>{resolvedHeading}</h3>
	{/if}
	{#if items.length === 0}
		<p class="cited-by-empty">{emptyMessage}</p>
	{:else}
		<ul class="cited-by-list">
			{#each items as item (item.id)}
				<li class="cited-by-row">
					<span class="cited-by-type">{item.typeLabel}</span>
					{#if item.href}
						<a class="cited-by-label" href={item.href}>{item.label}</a>
					{:else}
						<span class="cited-by-label cited-by-missing">{item.label}</span>
					{/if}
					{#if item.context}
						<span class="cited-by-context">"{item.context}"</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.cited-by h2,
	.cited-by h3 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-label-size);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
	}

	.cited-by-empty {
		margin: 0;
		color: var(--ink-faint);
		font-size: var(--type-ui-label-size);
	}

	.cited-by-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.cited-by-row {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-md);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		font-size: var(--type-ui-label-size);
		flex-wrap: wrap;
	}

	.cited-by-type {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.cited-by-label {
		color: var(--action-default-active);
		text-decoration: none;
		font-weight: 500;
	}

	.cited-by-label:is(a):hover {
		text-decoration: underline;
	}

	.cited-by-missing {
		color: var(--ink-subtle);
		font-style: italic;
	}

	.cited-by-context {
		color: var(--ink-muted);
		font-style: italic;
	}
</style>
