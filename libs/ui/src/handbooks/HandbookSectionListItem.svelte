<script lang="ts">
import { ROUTES } from '@ab/constants';

let {
	documentSlug,
	chapterCode,
	code,
	title,
	faaPageStart,
	faaPageEnd,
}: {
	documentSlug: string;
	chapterCode: string;
	code: string;
	title: string;
	faaPageStart: number | null;
	faaPageEnd: number | null;
} = $props();

// `code` is `<chapter>.<section>`; URL takes the section number alone.
const sectionPart = $derived(code.split('.').slice(1).join('.'));
const pageRange = $derived(
	faaPageStart === null
		? null
		: faaPageEnd && faaPageEnd !== faaPageStart
			? `pp. ${faaPageStart}-${faaPageEnd}`
			: `p. ${faaPageStart}`,
);
</script>

<a class="section-item" href={ROUTES.HANDBOOK_SECTION(documentSlug, chapterCode, sectionPart)}>
	<span class="code">§{sectionPart}</span>
	<span class="title">{title}</span>
	{#if pageRange}
		<span class="pages">{pageRange}</span>
	{/if}
</a>

<style>
	.section-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--space-sm);
		align-items: center;
		padding: var(--space-xs) var(--space-sm);
		border-radius: var(--radius-sm);
		color: inherit;
		text-decoration: none;
		transition: background var(--motion-fast) ease;
	}
	.section-item:hover,
	.section-item:focus-visible {
		background: var(--surface-sunken);
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
