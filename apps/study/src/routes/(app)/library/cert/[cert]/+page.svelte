<script lang="ts">
import LibraryCardSwitch from '@ab/aviation/ui/cards/LibraryCardSwitch.svelte';
import { ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const totalCount = $derived(data.primary.length + data.carryover.reduce((acc, g) => acc + g.cards.length, 0));
</script>

<svelte:head>
	<title>{data.certLabel} library -- airboss</title>
</svelte:head>

<PageHeader title={`Library -- ${data.certLabel}`}>
	{#snippet eyebrowSnippet()}
		<nav aria-label="Breadcrumb">
			<a href={ROUTES.LIBRARY}>Library</a> &raquo; <span>{data.certLabel}</span>
		</nav>
	{/snippet}
	{#snippet subtitleSnippet()}
		<p class="counts">
			{data.primary.length} primary &middot;
			{data.carryover.reduce((acc, g) => acc + g.cards.length, 0)} carryover
		</p>
	{/snippet}
</PageHeader>

{#if totalCount === 0}
	<EmptyState
		title={`No references for ${data.certLabel} yet`}
		body="Either no reference rows are tagged with this primary cert or the credential prereq DAG is unseeded."
	/>
{:else}
	<section class="block" aria-labelledby="primary-h">
		<h2 id="primary-h">Primary references</h2>
		{#if data.primary.length === 0}
			<p class="muted">No references list this cert as primary -- everything below is inherited.</p>
		{:else}
			<ul class="grid">
				{#each data.primary as card (card.id)}
					<li>
						<LibraryCardSwitch payload={card.payload} />
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if data.carryover.length > 0}
		<section class="block" aria-labelledby="carryover-h">
			<h2 id="carryover-h">Carryover from prerequisites</h2>
			{#each data.carryover as group (group.fromCert)}
				<details class="group" open>
					<summary>
						<span class="group-label">{group.label}</span>
						<span class="group-count">{group.cards.length}</span>
					</summary>
					<ul class="grid">
						{#each group.cards as card (`${group.fromCert}:${card.id}`)}
							<li>
								<LibraryCardSwitch payload={card.payload} />
							</li>
						{/each}
					</ul>
				</details>
			{/each}
		</section>
	{/if}
{/if}

<style>
	.counts {
		margin: 0;
		color: var(--ink-muted);
	}
	.block {
		margin-bottom: var(--space-lg);
	}
	.block h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--font-size-xl);
	}
	.muted {
		color: var(--ink-muted);
		margin: 0 0 var(--space-sm);
	}
	.grid {
		list-style: none;
		padding: var(--space-2xs) 0;
		margin: 0;
		display: grid;
		gap: var(--space-sm);
		grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
	}
	.group {
		margin-bottom: var(--space-sm);
		border-radius: var(--radius-md);
		background: var(--surface-panel);
	}
	.group summary {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs) var(--space-sm);
		cursor: pointer;
		list-style: none;
		font-weight: var(--font-weight-semibold);
	}
	.group summary::-webkit-details-marker {
		display: none;
	}
	.group summary::before {
		content: '▸';
		display: inline-block;
		color: var(--ink-muted);
		transition: transform var(--motion-fast) ease;
	}
	.group[open] summary::before {
		transform: rotate(90deg);
	}
	.group-label {
		flex: 1;
	}
	.group-count {
		color: var(--ink-muted);
		font-size: var(--font-size-sm);
	}
</style>
