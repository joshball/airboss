<!--
	CitationChips -- shared inline render for the citations list.

	Used by both the owner-only `/memory/<id>` editor (with the [x] remove
	button) and the public `/cards/<id>` page (read-only). The component takes
	a normalised `items` shape so callers don't have to leak the
	bc-study citation row shape into `@ab/ui` (which would be a layering
	inversion: ui depends on constants only, not on bcs).

	When `editable` is true and `removeAction` is provided, each chip renders
	a SvelteKit form posting `{ citationId }` to that action. The caller wires
	the action's `use:enhance` behavior on the page (via the form action;
	there is no client callback here so this stays SSR-clean).
-->
<script lang="ts">
export interface CitationChipItem {
	id: string;
	/** Type label (e.g. "Regulation", "Knowledge node"). Optional. */
	typeLabel?: string | null;
	/** Primary display text (e.g. "14 CFR 91.155(b)"). */
	label: string;
	/** Optional external URL. When set, the chip label renders as a link. */
	href?: string | null;
	/** Optional author note ("basis for the answer"). Italic, quoted. */
	context?: string | null;
}

interface Props {
	items: ReadonlyArray<CitationChipItem>;
	/** When true, render a remove button per chip. Defaults to false. */
	editable?: boolean;
	/**
	 * SvelteKit form action path used by the per-chip remove form. Required
	 * when `editable` is true. Each form posts `citationId=<id>` to this
	 * action. Ignored when `editable` is false.
	 */
	removeAction?: string;
	/** Optional aria-label for the remove button. Defaults to "Remove citation". */
	removeLabel?: string;
}

let { items, editable = false, removeAction, removeLabel = 'Remove citation' }: Props = $props();
</script>

<ul class="citation-list">
	{#each items as item (item.id)}
		<li class="citation-chip">
			{#if item.typeLabel}
				<span class="citation-type">{item.typeLabel}</span>
			{/if}
			{#if item.href}
				<a class="citation-label" href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
			{:else}
				<span class="citation-label">{item.label}</span>
			{/if}
			{#if item.context}
				<span class="citation-context">"{item.context}"</span>
			{/if}
			{#if editable && removeAction}
				<form method="POST" action={removeAction} class="citation-remove-form">
					<input type="hidden" name="citationId" value={item.id} />
					<button type="submit" class="citation-remove" aria-label={removeLabel}>×</button>
				</form>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.citation-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.citation-chip {
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

	.citation-type {
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		color: var(--ink-subtle);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.citation-label {
		color: var(--ink-body);
		font-weight: 500;
	}

	.citation-label:is(a) {
		color: var(--action-default-active);
		text-decoration: none;
	}

	.citation-label:is(a):hover {
		text-decoration: underline;
	}

	.citation-context {
		color: var(--ink-muted);
		font-style: italic;
	}

	.citation-remove-form {
		margin-left: auto;
		display: inline-flex;
	}

	.citation-remove {
		background: transparent;
		border: none;
		color: var(--ink-muted);
		font-size: var(--font-size-body);
		cursor: pointer;
		padding: 0 var(--space-xs);
		line-height: 1;
	}

	.citation-remove:hover {
		color: var(--action-hazard-active);
	}
</style>
