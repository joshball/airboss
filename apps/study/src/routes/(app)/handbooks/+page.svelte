<script lang="ts">
import { ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import HandbookCard from '@ab/ui/handbooks/HandbookCard.svelte';
import { dev } from '$app/environment';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Handbooks -- airboss</title>
</svelte:head>

<PageHeader
	title="Handbooks"
	subtitle="Read FAA handbooks in-app. Track per-section progress; jump to citing knowledge nodes."
/>

{#if data.references.length === 0}
	<EmptyState title="No handbooks yet">
		{#snippet bodySnippet()}
			<p>
				Handbooks are added by your administrator -- check back, or browse
				<a href={ROUTES.KNOWLEDGE}>the knowledge graph</a> in the meantime.
			</p>
			{#if dev}
				<p class="dev-hint">
					Dev: run <code>bun run sources extract handbooks phak</code> then <code>bun run db seed handbooks</code>.
				</p>
			{/if}
		{/snippet}
	</EmptyState>
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
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
	}
	.dev-hint code {
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-sm);
		font-family: var(--font-family-mono);
	}
</style>
