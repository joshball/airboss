<script lang="ts">
import { ROUTES } from '@ab/constants';
import MarkdownArticle from '@ab/ui/components/MarkdownArticle.svelte';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const product = $derived(data.product);
const bodyHtml = $derived(data.bodyHtml);
const relatedProductLinks = $derived(data.relatedProductLinks);
const relatedKnowledgeLinks = $derived(data.relatedKnowledgeLinks);
const examplesHref = $derived(data.examplesHref);
const drillHref = $derived(data.drillHref);
</script>

<svelte:head>
	<title>{product.title} -- Weather products -- airboss</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.REFERENCE}>Reference</a></li>
			<li><a href={ROUTES.REFERENCE_WX_PRODUCTS}>Weather products</a></li>
			<li aria-current="page">{product.shortCode || product.title}</li>
		</ol>
	</nav>

	<header class="hd">
		<div class="title-row">
			<h1 data-testid="page-anchor">{product.title}</h1>
			{#if product.shortCode}
				<span class="short-code">{product.shortCode}</span>
			{/if}
		</div>
		{#if product.elevatorPitch}
			<p class="elevator">{product.elevatorPitch}</p>
		{/if}
		<div class="meta">
			<span class="badge category">{product.category}</span>
			<span class="badge tier tier-{product.tier}">Tier {product.tier}</span>
			<span class="badge status status-{product.status}">{product.status}</span>
		</div>
		{#if examplesHref}
			<div class="practice-actions" data-testid="wx-product-practice-actions">
				<a class="practice-btn primary" href={examplesHref} data-testid="wx-product-browse-examples">
					Browse examples
				</a>
				<a class="practice-btn" href={drillHref} data-testid="wx-product-drill">
					Drill this now
				</a>
			</div>
		{/if}
	</header>

	<div class="layout">
		<div class="body">
			<MarkdownArticle bodyHtml={bodyHtml} ariaLabel="Weather product reference body" />
		</div>

		<aside class="sidebar" aria-label="Product references">
			{#if relatedKnowledgeLinks.length > 0}
				<section class="side-section">
					<h2>Related knowledge</h2>
					<ul>
						{#each relatedKnowledgeLinks as link (link.slug)}
							<li><a href={link.href}>{link.slug}</a></li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if relatedProductLinks.length > 0}
				<section class="side-section">
					<h2>Related products</h2>
					<ul>
						{#each relatedProductLinks as link (link.slug)}
							<li>
								{#if link.exists}
									<a href={link.href}>{link.title ?? link.slug}</a>
									{#if link.shortCode}
										<span class="short">{link.shortCode}</span>
									{/if}
								{:else}
									<span class="gap">{link.slug} <small>(not yet authored)</small></span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if product.authoritativeSources.length > 0}
				<section class="side-section">
					<h2>Authoritative sources</h2>
					<ul class="sources">
						{#each product.authoritativeSources as src, i (i)}
							<li>
								{#if src.source}
									<strong>{src.source}</strong>
								{/if}
								{#if src.section}
									<span class="src-section">{src.section}</span>
								{/if}
								{#if src.note}
									<p class="src-note">{src.note}</p>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</aside>
	</div>
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

	.hd {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.title-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-md);
		flex-wrap: wrap;
	}

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.short-code {
		font-family: var(--font-family-mono);
		font-size: var(--type-reading-lead-size);
		color: var(--ink-muted);
		background: var(--surface-sunken);
		border-radius: var(--radius-sm);
		padding: var(--space-2xs) var(--space-sm);
	}

	.elevator {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-muted);
		line-height: 1.5;
		max-width: 50rem;
	}

	.meta {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	.practice-actions {
		display: flex;
		gap: var(--space-sm);
		flex-wrap: wrap;
		margin-top: var(--space-xs);
	}

	.practice-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm) var(--space-md);
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		border-radius: var(--radius-md);
		border: 1px solid transparent;
		text-decoration: none;
		transition: background var(--motion-fast), border-color var(--motion-fast);
	}

	.practice-btn.primary {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--action-default-hover);
	}

	.practice-btn.primary:hover {
		background: var(--action-default-edge);
		color: var(--ink-inverse);
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

	.badge.category {
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
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

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 18rem;
		gap: var(--space-xl);
		align-items: start;
	}

	@media (max-width: 64rem) {
		.layout {
			grid-template-columns: 1fr;
		}
	}

	.body {
		min-width: 0;
	}

	.sidebar {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		position: sticky;
		top: var(--space-lg);
	}

	@media (max-width: 64rem) {
		.sidebar {
			position: static;
		}
	}

	.side-section {
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
		padding: var(--space-md);
	}

	.side-section h2 {
		margin: 0 0 var(--space-sm);
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.side-section ul {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.side-section a {
		color: var(--action-default-hover);
		text-decoration: none;
	}

	.side-section a:hover {
		text-decoration: underline;
	}

	.gap {
		color: var(--ink-subtle);
	}

	.gap small {
		color: var(--ink-faint);
		font-size: var(--type-ui-caption-size);
	}

	.short {
		margin-left: var(--space-2xs);
		color: var(--ink-faint);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
	}

	.sources li {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		padding-bottom: var(--space-sm);
		border-bottom: 1px solid var(--edge-default);
	}

	.sources li:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.src-section {
		color: var(--ink-muted);
		font-size: var(--type-ui-label-size);
	}

	.src-note {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		line-height: 1.45;
	}
</style>
