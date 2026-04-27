<script lang="ts">
import { ROUTES } from '@ab/constants';

let {
	documentSlug,
	code,
	title,
	faaPageStart,
	faaPageEnd,
}: {
	documentSlug: string;
	code: string;
	title: string;
	faaPageStart: string | null;
	faaPageEnd: string | null;
} = $props();

// Display the printed FAA page reference verbatim. No `pp.`/`p.` prefix --
// readers know what page numbers look like, and the prefix interferes with
// tabular alignment of the range column.
const pageRange = $derived(
	faaPageStart === null
		? null
		: faaPageEnd && faaPageEnd !== faaPageStart
			? `${faaPageStart} - ${faaPageEnd}`
			: faaPageStart,
);
</script>

<a class="chapter-item" href={ROUTES.HANDBOOK_CHAPTER(documentSlug, code)}>
	<span class="code">Ch {code}</span>
	<span class="title">{title}</span>
	{#if pageRange}
		<span class="pages">{pageRange}</span>
	{/if}
</a>

<style>
	.chapter-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-sm);
		align-items: center;
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		border: 1px solid var(--edge-default);
		background: var(--surface-raised);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast) ease;
	}
	.chapter-item:hover,
	.chapter-item:focus-visible {
		border-color: var(--action-default-edge);
		outline: none;
	}
	.code {
		font-family: var(--font-family-mono);
		color: var(--ink-muted);
		min-width: 4ch;
	}
	.title {
		font-weight: 500;
	}
	.pages {
		font-family: var(--font-family-mono);
		font-variant-numeric: tabular-nums;
		color: var(--ink-muted);
		text-align: right;
		min-width: 8ch;
	}
</style>
