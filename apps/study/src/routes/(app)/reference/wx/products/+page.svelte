<script lang="ts">
import { ROUTES } from '@ab/constants';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const groups = $derived(data.groups);
const total = $derived(data.total);
</script>

<svelte:head>
	<title>Weather products -- Reference -- airboss</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.REFERENCE}>Reference</a></li>
			<li aria-current="page">Weather products</li>
		</ol>
	</nav>

	<header class="hd">
		<h1 data-testid="page-anchor">Weather products</h1>
		<p class="lede">
			Field reference for the aviation weather products a pilot reads pre-flight, en route, and on approach. One
			page per product covers the format, the read order, what changes the decision, and where the regulatory
			definition lives. {total} products catalogued.
		</p>
	</header>

	{#each groups as group (group.key)}
		<section class="group" aria-labelledby="cat-{group.key}">
			<h2 id="cat-{group.key}">{group.label}</h2>
			<ul class="cards">
				{#each group.products as product (product.slug)}
					<li class="card">
						<a class="card-link" href={ROUTES.REFERENCE_WX_PRODUCT(product.slug)}>
							<div class="card-head">
								<h3 class="card-title">{product.title}</h3>
								{#if product.shortCode}
									<span class="short-code">{product.shortCode}</span>
								{/if}
							</div>
							<div class="card-meta">
								<span class="badge tier tier-{product.tier}">Tier {product.tier}</span>
								<span class="badge status status-{product.status}">{product.status}</span>
							</div>
							{#if product.elevatorPitch}
								<p class="pitch">{product.elevatorPitch}</p>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</section>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-xl);
	}

	.crumb {
		display: flex;
		gap: var(--space-sm);
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.crumb li + li::before {
		content: '/';
		margin-right: var(--space-sm);
		color: var(--ink-faint);
	}

	.crumb a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.crumb a:hover {
		text-decoration: underline;
	}

	.hd h1 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.lede {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-muted);
		line-height: 1.5;
		max-width: 50rem;
	}

	.group h2 {
		margin: 0 0 var(--space-md);
		font-size: var(--type-heading-2-size);
		color: var(--ink-body);
		letter-spacing: -0.01em;
	}

	.cards {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: var(--space-md);
	}

	.card {
		display: flex;
	}

	.card-link {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		flex: 1;
		padding: var(--space-md) var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		color: inherit;
		text-decoration: none;
		transition: border-color var(--motion-fast), background var(--motion-fast);
	}

	.card-link:hover {
		border-color: var(--action-default-edge);
		background: var(--surface-muted);
	}

	.card-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--space-sm);
	}

	.card-title {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-body);
		font-weight: 600;
	}

	.short-code {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-xs);
		padding: var(--space-2xs) var(--space-xs);
		white-space: nowrap;
	}

	.card-meta {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-weight: 600;
		border-radius: var(--radius-pill);
		border: 1px solid var(--edge-default);
		color: var(--ink-muted);
		background: var(--surface-muted);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-wide);
	}

	.badge.tier-1 {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
	}

	.badge.tier-2 {
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.badge.status-draft {
		color: var(--signal-warning);
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
	}

	.badge.status-stub {
		color: var(--ink-faint);
		background: var(--surface-sunken);
		border-color: var(--edge-strong);
	}

	.badge.status-done {
		color: var(--signal-success);
		background: var(--signal-success-wash);
		border-color: var(--signal-success-edge);
	}

	.pitch {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		line-height: 1.5;
	}
</style>
