<script lang="ts">
import { QUERY_PARAMS, ROUTES } from '@ab/constants';
import { buildQuery } from '@ab/utils';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const product = $derived(data.product);
const examples = $derived(data.examples);
const totalExampleCount = $derived(data.totalExampleCount);
const activeFamilies = $derived(data.activeFamilies);
const search = $derived(data.search);
const expandSlug = $derived(data.expandSlug);
const expandedAnnotations = $derived(data.expandedAnnotations);
const references = $derived(data.references);

const activeFamilySet = $derived(new Set(activeFamilies));

/**
 * Build the URL for the examples page with the supplied param overrides,
 * preserving every other param. `null` removes the param.
 */
function buildHref(next: Record<string, string | null>): string {
	const params: Record<string, string | undefined> = {
		[QUERY_PARAMS.FAMILIES]: activeFamilies.length > 0 ? activeFamilies.join(',') : undefined,
		[QUERY_PARAMS.SEARCH]: search || undefined,
		[QUERY_PARAMS.EXPAND]: expandSlug || undefined,
	};
	for (const [k, v] of Object.entries(next)) {
		params[k] = v === null ? undefined : v;
	}
	return `${ROUTES.REFERENCE_WX_PRODUCT_EXAMPLES(product.slug)}${buildQuery(params)}`;
}

function toggleFamilyHref(family: string): string {
	const set = new Set(activeFamilies);
	if (set.has(family)) set.delete(family);
	else set.add(family);
	const next = [...set].sort();
	return buildHref({
		[QUERY_PARAMS.FAMILIES]: next.length > 0 ? next.join(',') : null,
		// Reset expand state when filters change so a now-hidden card
		// doesn't leave its decode panel orphaned.
		[QUERY_PARAMS.EXPAND]: null,
	});
}

function expandHref(slug: string): string {
	return buildHref({
		[QUERY_PARAMS.EXPAND]: expandSlug === slug ? null : slug,
	});
}

const clearFiltersHref = $derived(
	buildHref({
		[QUERY_PARAMS.FAMILIES]: null,
		[QUERY_PARAMS.SEARCH]: null,
		[QUERY_PARAMS.EXPAND]: null,
	}),
);

const hasActiveFilters = $derived(activeFamilies.length > 0 || search.length > 0);
</script>

<svelte:head>
	<title>{product.label} examples -- Weather products -- airboss</title>
</svelte:head>

<section class="page">
	<nav aria-label="Breadcrumb">
		<ol class="crumb">
			<li><a href={ROUTES.REFERENCE}>Reference</a></li>
			<li><a href={ROUTES.REFERENCE_WX_PRODUCTS}>Weather products</a></li>
			<li><a href={ROUTES.REFERENCE_WX_PRODUCT(product.slug)}>{product.label}</a></li>
			<li aria-current="page">Examples</li>
		</ol>
	</nav>

	<header class="hd">
		<h1 data-testid="page-anchor">{product.label} -- Examples</h1>
		<p class="lede">
			Every real-world {product.label} example in the catalog. Filter by token family to find the wind-gust group,
			the multi-layer sky, the freezing-fog visibility -- any shape you want to drill. Click "Decode" on any card
			to see token-by-token annotations.
		</p>
		<p class="count">{totalExampleCount} catalogued examples ({examples.length} match the current filters).</p>
	</header>

	<form method="GET" class="search-form" data-testid="examples-search-form">
		<label class="search-label">
			<span class="search-caption">Search raw text or synoptic</span>
			<input
				type="search"
				name={QUERY_PARAMS.SEARCH}
				value={search}
				placeholder="KORD, +TSRA, marine layer..."
				class="search-input"
				data-testid="examples-search-input"
			/>
		</label>
		{#if activeFamilies.length > 0}
			<input type="hidden" name={QUERY_PARAMS.FAMILIES} value={activeFamilies.join(',')} />
		{/if}
		<button type="submit" class="search-submit">Search</button>
		{#if hasActiveFilters}
			<a class="clear-link" href={clearFiltersHref} data-testid="examples-clear-filters">Clear filters</a>
		{/if}
	</form>

	<section class="family-row" aria-label="Token families">
		<h2 class="row-title">Token families</h2>
		<ul class="chips">
			{#each product.tokenFamilies as family (family.slug)}
				{@const active = activeFamilySet.has(family.slug)}
				<li>
					<a
						href={toggleFamilyHref(family.slug)}
						class="chip"
						class:chip-active={active}
						aria-current={active ? 'true' : undefined}
						data-testid="family-chip-{family.slug}"
						title={family.decode}
					>
						<span class="chip-label">{family.label}</span>
						<span class="chip-count">{family.exampleCount}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>

	{#if examples.length === 0}
		<article class="empty" role="status" data-testid="examples-empty-state">
			<h2>No examples match these filters</h2>
			<p>
				Token-family chips combine with AND -- an example matches only when it exercises every selected family.
				Try removing a chip, or clear the filters to start over.
			</p>
			<a class="empty-action" href={clearFiltersHref}>Clear filters</a>
		</article>
	{:else}
		<ol class="examples" data-testid="examples-list">
			{#each examples as ex (ex.slug)}
				{@const expanded = expandSlug === ex.slug}
				<li class="example-card" data-testid="example-card-{ex.slug}">
					<div class="example-head">
						<h3 class="example-slug">{ex.slug}</h3>
						<a
							class="decode-link"
							href={expandHref(ex.slug)}
							aria-expanded={expanded}
							data-testid="example-decode-{ex.slug}"
						>
							{expanded ? 'Hide decode' : 'Decode'}
						</a>
					</div>
					<pre class="raw" data-testid="example-raw-{ex.slug}">{ex.raw}</pre>
					{#if ex.synoptic}
						<p class="synoptic">{ex.synoptic}</p>
					{/if}

					{#if ex.triageDrivers.length > 0}
						<div class="meta-row">
							<span class="meta-label">Triage:</span>
							<ul class="meta-chips" aria-label="Triage drivers">
								{#each ex.triageDrivers as drv, i (i)}
									<li class="meta-chip meta-chip-triage">{drv}</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if ex.tokenFamilies.length > 0}
						<div class="meta-row">
							<span class="meta-label">Families:</span>
							<ul class="meta-chips" aria-label="Token families exercised">
								{#each ex.tokenFamilies as fam (fam)}
									<li class="meta-chip" class:meta-chip-active={activeFamilySet.has(fam)}>
										<a href={toggleFamilyHref(fam)} class="meta-chip-link">{fam}</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					{#if expanded}
						<div class="decode-panel" data-testid="example-annotations-{ex.slug}">
							<h4>Token walk</h4>
							{#if expandedAnnotations && expandedAnnotations.length > 0}
								<ol class="annotations">
									{#each expandedAnnotations as ann, i (i)}
										<li class="annotation">
											<code class="ann-token">{ann.token}</code>
											<div class="ann-body">
												<span class="ann-family">{ann.family}</span>
												<span class="ann-decode">{ann.decode}</span>
												{#if ann.why}
													<span class="ann-why">{ann.why}</span>
												{/if}
											</div>
										</li>
									{/each}
								</ol>
							{:else}
								<p class="decode-empty">
									No parser available for this product yet -- decode-on-demand currently covers METAR,
									TAF, PIREP, and FB. AIRMET / SIGMET decoding lands when the bulletin parser ships.
								</p>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	{#if references.length > 0}
		<section class="refs" aria-labelledby="refs-title">
			<h2 id="refs-title">References</h2>
			<ul class="refs-list">
				{#each references as ref, i (i)}
					<li><strong>{ref.source}</strong> <span class="ref-detail">{ref.detail}</span></li>
				{/each}
			</ul>
		</section>
	{/if}
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

	.hd h1 {
		margin: 0;
		font-size: var(--type-heading-1-size);
		letter-spacing: -0.02em;
		color: var(--ink-body);
	}

	.lede {
		margin: 0;
		font-size: var(--type-reading-lead-size);
		color: var(--ink-muted);
		line-height: 1.5;
		max-width: 60rem;
	}

	.count {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
	}

	.search-form {
		display: flex;
		align-items: flex-end;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.search-label {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
		flex: 1 1 24rem;
	}

	.search-caption {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
	}

	.search-input {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--type-ui-label-size);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-md);
		background: var(--ink-inverse);
		color: var(--ink-body);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--action-default-edge);
		box-shadow: 0 0 0 3px var(--action-default-wash);
	}

	.search-submit {
		padding: var(--space-sm) var(--space-md);
		font-size: var(--type-ui-label-size);
		font-weight: 600;
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		background: var(--action-default-wash);
		color: var(--action-default-hover);
		cursor: pointer;
	}

	.search-submit:hover {
		background: var(--action-default-edge);
		color: var(--ink-inverse);
	}

	.clear-link {
		font-size: var(--type-ui-label-size);
		color: var(--action-default-hover);
		text-decoration: none;
		padding: var(--space-sm) var(--space-sm);
	}

	.clear-link:hover {
		text-decoration: underline;
	}

	.family-row {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.row-title {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
	}

	.chips {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-label-size);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		background: var(--surface-muted);
		color: var(--ink-muted);
		text-decoration: none;
		transition: border-color var(--motion-fast), background var(--motion-fast);
	}

	.chip:hover {
		border-color: var(--action-default-edge);
		background: var(--action-default-wash);
	}

	.chip-active {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.chip-count {
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-caption-size);
		color: var(--ink-faint);
		background: var(--surface-sunken);
		padding: 0 var(--space-2xs);
		border-radius: var(--radius-xs);
	}

	.chip-active .chip-count {
		color: var(--action-default-hover);
		background: var(--ink-inverse);
	}

	.empty {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-xl);
		background: var(--surface-muted);
		border: 1px dashed var(--edge-default);
		border-radius: var(--radius-lg);
		align-items: flex-start;
	}

	.empty h2 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		color: var(--ink-body);
	}

	.empty p {
		margin: 0;
		color: var(--ink-muted);
		max-width: 50rem;
		line-height: 1.5;
	}

	.empty-action {
		display: inline-block;
		padding: var(--space-sm) var(--space-md);
		font-weight: 600;
		font-size: var(--type-ui-label-size);
		color: var(--action-default-hover);
		background: var(--action-default-wash);
		border: 1px solid var(--action-default-edge);
		border-radius: var(--radius-md);
		text-decoration: none;
	}

	.empty-action:hover {
		background: var(--action-default-edge);
		color: var(--ink-inverse);
	}

	.examples {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.example-card {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md) var(--space-lg);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-lg);
	}

	.example-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-sm);
	}

	.example-slug {
		margin: 0;
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		font-weight: 600;
	}

	.decode-link {
		font-size: var(--type-ui-label-size);
		color: var(--action-default-hover);
		text-decoration: none;
		padding: var(--space-2xs) var(--space-sm);
		border-radius: var(--radius-md);
	}

	.decode-link:hover {
		background: var(--action-default-wash);
	}

	.raw {
		margin: 0;
		padding: var(--space-sm) var(--space-md);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		background: var(--surface-sunken);
		color: var(--ink-body);
		border-radius: var(--radius-md);
		white-space: pre-wrap;
		word-break: break-word;
		line-height: 1.5;
	}

	.synoptic {
		margin: 0;
		color: var(--ink-body);
		font-size: var(--type-definition-body-size);
		line-height: 1.5;
	}

	.meta-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-sm);
		flex-wrap: wrap;
	}

	.meta-label {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
	}

	.meta-chips {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2xs);
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		padding: var(--space-2xs) var(--space-sm);
		font-size: var(--type-ui-caption-size);
		font-family: var(--font-family-mono);
		background: var(--surface-muted);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-pill);
		color: var(--ink-muted);
	}

	.meta-chip-triage {
		font-family: inherit;
		background: var(--signal-warning-wash);
		border-color: var(--signal-warning-edge);
		color: var(--signal-warning);
	}

	.meta-chip-link {
		color: inherit;
		text-decoration: none;
	}

	.meta-chip:hover {
		border-color: var(--action-default-edge);
	}

	.meta-chip-active {
		background: var(--action-default-wash);
		border-color: var(--action-default-edge);
		color: var(--action-default-hover);
		font-weight: 600;
	}

	.decode-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}

	.decode-panel h4 {
		margin: 0;
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-subtle);
		font-weight: 600;
	}

	.annotations {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.annotation {
		display: flex;
		gap: var(--space-md);
		align-items: flex-start;
	}

	.ann-token {
		flex: 0 0 auto;
		min-width: 8rem;
		padding: var(--space-2xs) var(--space-sm);
		font-family: var(--font-family-mono);
		font-size: var(--type-ui-label-size);
		background: var(--ink-inverse);
		border: 1px solid var(--edge-default);
		border-radius: var(--radius-sm);
		color: var(--ink-body);
	}

	.ann-body {
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.ann-family {
		font-size: var(--type-ui-caption-size);
		text-transform: uppercase;
		letter-spacing: var(--letter-spacing-caps);
		color: var(--ink-faint);
	}

	.ann-decode {
		font-size: var(--type-definition-body-size);
		color: var(--ink-body);
		line-height: 1.5;
	}

	.ann-why {
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		font-style: italic;
		line-height: 1.5;
	}

	.decode-empty {
		margin: 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-subtle);
		line-height: 1.5;
	}

	.refs {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.refs h2 {
		margin: 0;
		font-size: var(--type-heading-2-size);
		color: var(--ink-body);
		letter-spacing: -0.01em;
	}

	.refs-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2xs);
	}

	.refs-list li {
		padding: var(--space-2xs) 0;
		font-size: var(--type-ui-label-size);
		color: var(--ink-muted);
		border-bottom: 1px solid var(--edge-default);
	}

	.refs-list li:last-child {
		border-bottom: none;
	}

	.ref-detail {
		color: var(--ink-subtle);
	}
</style>
