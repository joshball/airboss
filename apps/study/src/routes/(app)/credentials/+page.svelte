<script lang="ts">
import { CREDENTIAL_KIND_LABELS, type CredentialKind, ROUTES } from '@ab/constants';
import PageHelp from '@ab/help/ui/PageHelp.svelte';
import EmptyState from '@ab/ui/components/EmptyState.svelte';
import PageHeader from '@ab/ui/components/PageHeader.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const rows = $derived(data.rows);
const hasPrimaryGoal = $derived(data.hasPrimaryGoal);
const isEmpty = $derived(rows.length === 0);

function kindLabel(slug: string): string {
	return CREDENTIAL_KIND_LABELS[slug as CredentialKind] ?? slug;
}

function pct(num: number, den: number): number {
	if (den === 0) return 0;
	return Math.round((num / den) * 100);
}
</script>

<svelte:head>
	<title>Credentials -- airboss</title>
</svelte:head>

<section class="page">
	<PageHeader
		title="Credentials"
		subtitle="Mastery and coverage across the certs, ratings, and endorsements you're targeting."
	>
		{#snippet titleSuffix()}
			<PageHelp pageId="credentials" />
		{/snippet}
	</PageHeader>

	{#if !hasPrimaryGoal}
		<aside class="banner" role="status">
			<p>
				<strong>No primary goal set.</strong> All active credentials are listed. Set a primary goal to filter this list to
				the ones you're actively pursuing.
			</p>
			<a class="banner-cta" href={ROUTES.GOALS_NEW}>Create a goal</a>
		</aside>
	{/if}

	{#if isEmpty}
		<EmptyState
			title="No active credentials"
			body="No credentials are seeded as active in the database. Run `bun run db seed credentials` if you're a developer."
		/>
	{:else}
		<ul class="grid">
			{#each rows as row (row.credential.id)}
				<li class="card" class:primary={row.primaryGoalCredential}>
					<a class="card-link" href={ROUTES.CREDENTIAL(row.credential.slug)}>
						<header class="card-header">
							<span class="kind">{kindLabel(row.credential.kind)}</span>
							{#if row.primaryGoalCredential}
								<span class="badge primary-badge">Primary goal</span>
							{/if}
						</header>
						<h2 class="title">{row.credential.title}</h2>
						{#if row.credential.category !== null || row.credential.class !== null}
							<p class="meta">
								{#if row.credential.category !== null}<span>{row.credential.category}</span>{/if}
								{#if row.credential.class !== null}<span>{row.credential.class}</span>{/if}
							</p>
						{/if}
						<dl class="stats">
							<div>
								<dt>Mastery</dt>
								<dd data-testid="cred-mastery">{pct(row.mastery.masteredLeaves, row.mastery.totalLeaves)}%</dd>
							</div>
							<div>
								<dt>Coverage</dt>
								<dd data-testid="cred-coverage">{pct(row.mastery.coveredLeaves, row.mastery.totalLeaves)}%</dd>
							</div>
							<div>
								<dt>Leaves</dt>
								<dd>{row.mastery.totalLeaves}</dd>
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

	.banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-md);
		padding: var(--space-md) var(--space-lg);
		background: var(--surface-raised);
		border: 1px solid var(--edge-default);
		border-left: 4px solid var(--signal-info-edge, var(--edge-strong));
		border-radius: var(--radius-md);
		color: var(--ink-body);
		flex-wrap: wrap;
	}

	.banner p {
		margin: 0;
		font-size: var(--font-size-body);
	}

	.banner-cta {
		flex-shrink: 0;
		color: var(--action-link);
		font-weight: var(--font-weight-semibold);
		text-decoration: underline;
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
		transition: border-color var(--motion-fast), box-shadow var(--motion-fast);
	}

	.card.primary {
		border-color: var(--edge-strong);
	}

	.card:hover {
		border-color: var(--edge-strong);
		box-shadow: var(--shadow-sm);
	}

	.card-link {
		display: block;
		padding: var(--space-md);
		color: inherit;
		text-decoration: none;
	}

	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.kind {
		color: var(--ink-faint);
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
	}

	.badge {
		font-size: var(--font-size-xs);
		font-weight: var(--font-weight-semibold);
		padding: var(--space-2xs) var(--space-xs);
		border-radius: var(--radius-pill);
	}

	.primary-badge {
		background: var(--surface-panel);
		color: var(--action-link);
		border: 1px solid var(--edge-strong);
	}

	.title {
		margin: var(--space-2xs) 0 var(--space-xs);
		font-size: var(--font-size-lg);
		font-weight: var(--font-weight-semibold);
		color: var(--ink-body);
		line-height: 1.2;
	}

	.meta {
		margin: 0 0 var(--space-sm);
		display: flex;
		gap: var(--space-sm);
		color: var(--ink-subtle);
		font-size: var(--font-size-xs);
		text-transform: capitalize;
	}

	.meta span:not(:last-child)::after {
		content: '·';
		margin-left: var(--space-sm);
		color: var(--ink-faint);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-sm);
		margin: 0;
		padding-top: var(--space-sm);
		border-top: 1px solid var(--edge-subtle);
	}

	.stats div {
		display: flex;
		flex-direction: column;
		min-width: 0;
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
		color: var(--ink-body);
	}
</style>
