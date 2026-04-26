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
	faaPageStart: number | null;
	faaPageEnd: number | null;
} = $props();

const pageRange = $derived(
	faaPageStart === null
		? null
		: faaPageEnd && faaPageEnd !== faaPageStart
			? `pp. ${faaPageStart}-${faaPageEnd}`
			: `p. ${faaPageStart}`,
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
		color: var(--ink-muted);
	}
</style>
