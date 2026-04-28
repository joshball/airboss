<script lang="ts">
import HandbookCard from '@ab/ui/handbooks/HandbookCard.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Handbooks -- airboss</title>
</svelte:head>

<header class="page-header">
	<h1>Handbooks</h1>
	<p>Read FAA handbooks in-app. Track per-section progress; jump to citing knowledge nodes.</p>
</header>

{#if data.references.length === 0}
	<p class="empty">
		No handbooks ingested yet. Run <code>bun run sources extract handbooks phak</code> followed by
		<code>bun run db seed handbooks</code>.
	</p>
{:else}
	<ul class="grid">
		{#each data.references as ref (ref.id)}
			<li>
				<HandbookCard
					documentSlug={ref.documentSlug}
					edition={ref.edition}
					title={ref.title}
					progress={ref.progress}
				/>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.page-header {
		margin-bottom: var(--space-lg);
	}
	.page-header h1 {
		margin: 0 0 var(--space-xs) 0;
		font-size: var(--font-size-2xl);
		font-weight: var(--font-weight-bold);
	}
	.page-header p {
		margin: 0;
		color: var(--ink-muted);
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
	}
	.empty {
		color: var(--ink-muted);
	}
	.empty code {
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
	}
</style>
