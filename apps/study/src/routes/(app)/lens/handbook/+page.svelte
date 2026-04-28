<script lang="ts">
import { ROUTES } from '@ab/constants';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const entries = $derived(data.entries);

function pct(num: number, den: number): number {
	if (den === 0) return 0;
	return Math.round((num / den) * 100);
}
</script>

<svelte:head>
	<title>Handbook lens -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		eyebrow="Lens"
		title="Handbook lens"
		subtitle="What each FAA handbook looks like through the knowledge nodes that cite it and your read state on each section."
	/>

	{#if entries.length === 0}
		<EmptyState
			title="No handbooks ingested"
			body="No handbook references are seeded. Run `bun run db seed handbooks` to ingest PHAK / AFH / AvWX."
		/>
	{:else}
		<ul class="grid">
			{#each entries as entry (entry.reference.id)}
				<li class="card">
					<a class="card-link" href={ROUTES.LENS_HANDBOOK_DOC(entry.reference.documentSlug)}>
						<header>
							<span class="kind">{entry.reference.publisher}</span>
							<h2 class="title">{entry.reference.title}</h2>
							<p class="meta">Edition: {entry.reference.edition}</p>
						</header>
						<dl class="stats">
							<div>
								<dt>Read</dt>
								<dd>{pct(entry.progress.readSections, entry.progress.totalSections)}%</dd>
							</div>
							<div>
								<dt>Reading</dt>
								<dd>{entry.progress.readingSections}</dd>
							</div>
							<div>
								<dt>Sections</dt>
								<dd>{entry.progress.totalSections}</dd>
							</div>
						</dl>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-xl) var(--space-lg);
		max-width: 80rem;
		margin: 0 auto;
		width: 100%;
	}

	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--space-md);
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
	}

	.card {
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		transition: border-color var(--motion-fast);
	}

	.card:hover {
		border-color: var(--edge-strong);
	}

	.card-link {
		display: block;
		padding: var(--space-md);
		color: inherit;
		text-decoration: none;
	}

	.kind {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.title {
		margin: var(--space-2xs) 0 var(--space-xs);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		line-height: 1.2;
	}

	.meta {
		margin: 0 0 var(--space-sm);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
		margin: 0;
		padding-top: var(--space-sm);
		border-top: 1px solid var(--edge-subtle);
	}

	.stats dt {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.stats dd {
		margin: 0;
		font-variant-numeric: tabular-nums;
		font-size: var(--font-size-body);
		font-weight: var(--font-weight-semibold);
	}
</style>
